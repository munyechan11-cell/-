import { newId, saveDoc } from "../../lib/db";
import type { StoreCore } from "../core";
import type { LoginInput } from "../types";
import { LS_MASTER, makeDefaultTables } from "../constants";
import { useCallback } from "react";
import { collection, query, where, doc, getDocs, writeBatch } from "firebase/firestore";
import { db, ensureAnonymousAuth } from "../../lib/firebase";
import { calculateAgeGroup } from "../../lib/auth";
import { normalizePhone } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { t } from "../../lib/i18n";
import type { User, Role } from "../../lib/types";

export function useAuthActions(core: StoreCore) {
  const {
    firebaseStatus, currentUser, masterPassword, setMasterPasswordState, setIsMaster, users,
    visits, setVisits, coupons, setCoupons, tables, setTables, sections, setSections,
    setCommunications, tierOverrides, setTierOverrides, menus, setMenus, orders, setOrders,
    reservations, setReservations, photos, setPhotos, shifts, setShifts, setIngredients,
    setExpenses, setMarketingDrafts, currentUserRef, setCurrentUser,
  } = core;


  // ============ LOGIN ============
  const login = useCallback(
    async (input: LoginInput): Promise<User> => {
      // DB 가 끊긴 상태에서는 users 가 비어 있어 아래 매칭이 100% 실패한다.
      // 그대로 흘려보내면 두 가지 사고가 난다:
      //   1) signInOnly → 멀쩡한 계정이 "일치하는 계정이 없습니다"로 거부되어,
      //      원인이 DB 장애인데 사용자·운영자 모두 계정 문제로 오인한다.
      //   2) signInOnly 아님 → 기존 회원에게 새 id 가 발급되고, 그 쓰기마저 실패한다.
      // → 매칭 전에 끊어서 원인을 그대로 말해 준다.
      if (firebaseStatus === "error") {
        throw new Error(t("db.unavailable"));
      }

      const phone = normalizePhone(input.phone);
      const { role, name, restaurantName, storeId, socialId, socialProvider } = input;

      // 1) match by socialId (고객은 전역 계정이므로 storeId 매칭 없이)
      let match: User | undefined;
      if (socialId) {
        match = users.find(
          (u) =>
            u.role === role &&
            (u.socialIds?.includes(socialId) ||
              u.googleId === socialId ||
              u.kakaoId === socialId)
        );
      }
      // 2) match by phone
      if (!match && phone) {
        match = users.find(
          (u) => u.role === role && normalizePhone(u.phone || "") === phone
        );
      }

      if (match) {
        // recover + merge social
        const patch: Partial<User> = {
          status: "active",
          name: match.name || name,
        };
        if (socialId && socialProvider) {
          const socialIds = Array.from(new Set([...(match.socialIds ?? []), socialId]));
          patch.socialIds = socialIds;
          patch.linkedProviders = Array.from(
            new Set([...(match.linkedProviders ?? []), socialProvider])
          );
          if (socialProvider === "google") patch.googleId = socialId;
          if (socialProvider === "kakao") patch.kakaoId = socialId;
          if (input.avatarUrl) patch.avatarUrl = input.avatarUrl;
        }
        if (input.birthYear) {
          patch.birthYear = input.birthYear;
          patch.ageGroup = calculateAgeGroup(input.birthYear);
        }
        if (input.birthday) patch.birthday = input.birthday;
        if (input.gender) patch.gender = input.gender;
        if (input.isPohangResident !== undefined) patch.isPohangResident = input.isPohangResident;
        if (input.privacyAgreedAt) patch.privacyAgreedAt = input.privacyAgreedAt;
        if (input.phoneVerifiedAt) patch.phoneVerifiedAt = input.phoneVerifiedAt;

        await saveDoc("users", match.id, patch);
        const final = { ...match, ...patch } as User;
        setCurrentUser(final);
        showToast(t("store.welcome", undefined, { name: final.name }), "success");
        return final;
      }

      // signInOnly 모드: 기존 계정 없으면 가입 거부
      if (input.signInOnly) {
        throw new Error("일치하는 계정이 없습니다. 신규 가입 모드에서 등록해 주세요.");
      }

      // 3) new user
      const createdUserId = newId();
      const user: User = {
        id: createdUserId,
        role,
        name,
        phone,
        status: "active",
        authType: input.authType ?? (socialProvider ? socialProvider : "phone"),
      };
      if (role === "owner") {
        user.restaurantName = restaurantName;
        if (input.posVendor) user.posVendor = input.posVendor;
        if (input.posApiKey) user.posApiKey = input.posApiKey;
      }
      // customer는 storeId 없이 전역 계정으로 생성 (방문은 visits 컬렉션에 storeId 별도 저장)
      void storeId;
      if (socialId && socialProvider) {
        user.socialIds = [socialId];
        user.linkedProviders = [socialProvider];
        if (socialProvider === "google") user.googleId = socialId;
        if (socialProvider === "kakao") user.kakaoId = socialId;
      }
      if (input.avatarUrl) user.avatarUrl = input.avatarUrl;
      if (input.birthYear) {
        user.birthYear = input.birthYear;
        user.ageGroup = calculateAgeGroup(input.birthYear);
      }
      if (input.birthday) user.birthday = input.birthday;
      if (input.gender) user.gender = input.gender;
      if (input.isPohangResident !== undefined) user.isPohangResident = input.isPohangResident;
      if (input.privacyAgreedAt) user.privacyAgreedAt = input.privacyAgreedAt;
      if (input.phoneVerifiedAt) user.phoneVerifiedAt = input.phoneVerifiedAt;

      await saveDoc("users", createdUserId, user);

      // Owner: auto-create 15 tables
      if (role === "owner" && db) {
        const batch = writeBatch(db);
        for (const t of makeDefaultTables(createdUserId)) {
          batch.set(doc(db, "tables", t.id), t);
        }
        try {
          await batch.commit();
        } catch (e) {
          console.error("[create tables]", e);
        }
      }

      setCurrentUser(user);
      showToast(t("store.welcome", undefined, { name }), "success");
      return user;
    },
    [users, setCurrentUser, firebaseStatus]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    // 계정 전환 시 이전 매장 데이터가 다음 유저 화면에 잠깐 노출되지 않도록 scoped 상태를 비움.
    // (scoped 리스너는 currentUser=null 이면 early-return 하므로 자동으로는 비워지지 않음)
    setVisits([]);
    setCoupons([]);
    setTables([]);
    setSections([]);
    setCommunications([]);
    setTierOverrides([]);
    setMenus([]);
    setOrders([]);
    setReservations([]);
    setPhotos([]);
    setShifts([]);
    setIngredients([]);
    setExpenses([]);
    setMarketingDrafts([]);
    showToast(t("store.loggedOut"), "info");
  }, [setCurrentUser]);

  const deleteAccount = useCallback(async () => {
    if (!currentUser) return;
    await saveDoc("users", currentUser.id, {
      status: "deleted",
      name: "삭제된 계정",
      phone: "",
      googleId: null,
      kakaoId: null,
      socialIds: [],
    });
    logout();
  }, [currentUser, logout]);

  const setMasterPassword = useCallback(async (pw: string) => {
    await saveDoc("appState", "settings", { masterPassword: pw });
    setMasterPasswordState(pw);
    showToast(t("store.master.pwChanged"), "success");
  }, []);

  /** SMS 인증 완료 후 users 문서에 phoneVerifiedAt 마킹 + 인증한 번호 동기화. */
  const markPhoneVerified = useCallback(async (userId: string, e164Phone?: string) => {
    const patch: Partial<User> = {
      phoneVerifiedAt: new Date().toISOString(),
    };
    // ⚠️ E.164("+821012345678")를 그대로 저장하면 안 된다.
    //    로그인 매칭은 국내 0-prefix 숫자열을 쓰므로, 그대로 넣는 순간 그 계정은
    //    전화번호로 영영 로그인할 수 없게 된다(인증을 마친 사람부터 차례로 잠김).
    //    인증된 번호를 반영하되 표준형으로 정규화해서 넣는다.
    if (e164Phone) patch.phone = normalizePhone(e164Phone);
    // write 전 익명 토큰 보장 — 전화인증(signOut) 직후 토큰 미회복 시 permission-denied 로
    // phoneVerifiedAt 저장이 실패해 재인증이 반복되던 버그를 차단.
    await ensureAnonymousAuth();
    await saveDoc("users", userId, patch);
    // 로컬 currentUser 도 즉시 반영 — 안 하면 새로고침 시 인증 게이트가 다시 떠 재인증(SMS 비용) 발생
    const cu = currentUserRef.current;
    if (cu?.id === userId) setCurrentUser({ ...cu, ...patch });
  }, [setCurrentUser]);

  const loginMaster = useCallback(
    (pw: string) => {
      if (pw === masterPassword) {
        setIsMaster(true);
        localStorage.setItem(LS_MASTER, "1");
        showToast(t("store.master.loginOk"), "success");
        return true;
      }
      showToast(t("store.master.pwWrong"), "error");
      return false;
    },
    [masterPassword]
  );

  const logoutMaster = useCallback(() => {
    setIsMaster(false);
    localStorage.removeItem(LS_MASTER);
  }, []);

  const deleteUser = useCallback(
    async (userId: string, role: Role) => {
      if (!db) {
        showToast(t("store.master.offlineDelete"), "error");
        return;
      }
      const batch = writeBatch(db);
      const cascade = async (
        coll: string,
        field: string,
        value: string
      ) => {
        const snap = await import("firebase/firestore").then(({ getDocs, query, where, collection }) =>
          getDocs(query(collection(db!, coll), where(field, "==", value)))
        );
        snap.forEach((d) => batch.delete(d.ref));
      };

      if (role === "owner") {
        await cascade("tables", "storeId", userId);
        await cascade("visits", "storeId", userId);
        await cascade("coupons", "storeId", userId);
        await cascade("Communications", "storeId", userId);
        await cascade("tierOverrides", "storeId", userId);
        await cascade("sections", "storeId", userId);
        await cascade("menus", "storeId", userId);
        await cascade("orders", "storeId", userId);
        await cascade("reservations", "storeId", userId);
        await cascade("photos", "storeId", userId);
        await cascade("shifts", "storeId", userId);
      } else if (role === "staff") {
        await cascade("shifts", "staffId", userId);
      } else {
        await cascade("visits", "customerId", userId);
        await cascade("coupons", "customerId", userId);
        await cascade("Communications", "customerId", userId);
        await cascade("tierOverrides", "customerId", userId);
      }
      batch.delete(doc(db, "users", userId));
      await batch.commit();
      showToast(t("store.master.deleted"), "success");
    },
    []
  );

  return { login, logout, deleteAccount, setMasterPassword, markPhoneVerified, loginMaster, logoutMaster, deleteUser };
}
