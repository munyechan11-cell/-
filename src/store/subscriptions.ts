import { useEffect } from "react";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured, ensureAnonymousAuth } from "../lib/firebase";
import { flushOfflineQueue, saveDoc } from "../lib/db";
import { LS_USER, LS_MASTER, LS_OFFLINE_STATE } from "./constants";
import type { StoreCore } from "./core";
import type { User, Visit, Coupon, TableDoc, Communication, Section, TierOverride, Menu, Order, Reservation, Photo, Shift, Ingredient, Expense, MarketingDraft } from "../lib/types";

/**
 * Firestore 실시간 구독 + 오프라인 캐시 미러링 + 부팅 복원.
 *
 * 이 훅이 등록하는 effect 의 순서는 분해 이전 store.tsx 의 순서를 그대로 유지한다
 * (사장님 언어 동기화 → 오프라인 캐시 미러링 → users 전역 구독 → 로그인 스코프 구독 →
 * 매장 컨텍스트 구독 → 부팅 복원/직원 상태 재동기화).
 * 순서를 바꾸면 첫 스냅샷 전에 ready 가 켜지는 부류의 회귀가 생긴다.
 */
export function useStoreSubscriptions(core: StoreCore) {
  const {
    isReady, setReady, firebaseStatus, setFirebaseStatus, setFirebaseError, currentUser,
    setCurrentUserState, masterPassword, setMasterPasswordState, setIsMaster, users, setUsers,
    visits, setVisits, coupons, setCoupons, tables, setTables, sections, setSections,
    communications, setCommunications, tierOverrides, setTierOverrides, menus, setMenus, orders,
    setOrders, reservations, setReservations, photos, setPhotos, shifts, setShifts, ingredients,
    setIngredients, expenses, setExpenses, marketingDrafts, setMarketingDrafts, scopedUnsubsRef,
    storeContextUnsubsRef, activeStoreId, currentUserRef, lang, setCurrentUser,
  } = core;

  useEffect(() => {
    const cu = currentUserRef.current;
    if (cu?.role === "owner" && cu.lang !== lang) {
      saveDoc("users", cu.id, { lang }).catch(() => {});
    }
  }, [lang, currentUser]);

  // Persist for offline fallback
  useEffect(() => {
    if (!isReady) return;
    if (firebaseStatus !== "offline") return;
    // 로그아웃/미로그인 상태에서는 캐시를 미러링하지 않는다. logout()이 메모리 상태를 []로 비우는데,
    // 이때 빈 배열로 LS_OFFLINE_STATE 를 덮어쓰면 오프라인 캐시(매장·메뉴·주문)가 영구 소실된다.
    if (!currentUser) return;
    // 디바운스(1s) — 오프라인에서 onSnapshot 이 연달아 오더라도 마지막 1회만 직렬화/저장
    const id = setTimeout(() => {
      localStorage.setItem(
        LS_OFFLINE_STATE,
        JSON.stringify({
          users,
          visits,
          coupons,
          tables,
          sections,
          communications,
          tierOverrides,
          menus,
          orders,
          reservations,
          photos,
          ingredients,
          expenses,
        })
      );
    }, 1000);
    return () => clearTimeout(id);
  }, [
    firebaseStatus,
    isReady,
    currentUser,
    users,
    visits,
    coupons,
    tables,
    sections,
    communications,
    tierOverrides,
    menus,
    orders,
    reservations,
    photos,
    ingredients,
    expenses,
  ]);

  // Boot
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_USER);
      if (raw) setCurrentUserState(JSON.parse(raw));
      if (localStorage.getItem(LS_MASTER) === "1") setIsMaster(true);
    } catch {}

    if (!isFirebaseConfigured || !db) {
      try {
        const raw = localStorage.getItem(LS_OFFLINE_STATE);
        if (raw) {
          const s = JSON.parse(raw);
          setUsers(s.users ?? []);
          setVisits(s.visits ?? []);
          setCoupons(s.coupons ?? []);
          setTables(s.tables ?? []);
          setSections(s.sections ?? []);
          setCommunications(s.communications ?? []);
          setTierOverrides(s.tierOverrides ?? []);
          setMenus(s.menus ?? []);
          setOrders(s.orders ?? []);
          setReservations(s.reservations ?? []);
          setPhotos(s.photos ?? []);
          setIngredients(s.ingredients ?? []);
          setExpenses(s.expenses ?? []);
        }
      } catch {}
      setFirebaseStatus("offline");
      setReady(true);
      return;
    }

    setFirebaseStatus("ok");
    flushOfflineQueue();

    // 익명 로그인 보장 후 listener 등록 — Firestore 보안 규칙의 인증 게이트 통과용.
    // 카카오 사용자는 익명 토큰 위에 자체 매칭, Google 사용자는 익명 → 본 계정 자동 전환.
    let usersUnsub: (() => void) | null = null;
    let readyFallback: ReturnType<typeof setTimeout> | null = null;
    // 첫 스냅샷·에러·타임아웃 중 무엇이든 하나만 ready 를 결정하도록 하는 래치.
    let settled = false;
    let cancelled = false;
    ensureAnonymousAuth().then(() => {
      if (cancelled || !db) return;

      // users — 로그인 매칭용 전체 구독.
      //
      // ⚠️ setReady 를 여기서(구독 등록 직후) 켜면 안 된다.
      //    첫 스냅샷이 오기 전에 ready 가 켜지면 로그인 화면이 users=[] 인 채로 뜨고,
      //    그 상태에서 로그인하면 login() 이 빈 배열을 뒤져 매칭에 실패한다.
      //      - signInOnly(사장님·직원) → 멀쩡한 계정이 "일치하는 계정이 없습니다"로 거부
      //      - signInOnly 아님(손님)   → 같은 사람에게 새 계정이 또 발급되어 기존 적립·쿠폰이 고아가 됨
      //    그래서 ready 는 "첫 스냅샷 도착" 또는 "리스너 에러" 시점에만 켠다.
      usersUnsub = onSnapshot(
        collection(db, "users"),
        (snap) => {
          setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
          // 캐시에서 온 첫 스냅샷은 서버 연결을 보장하지 않는다(IndexedDB 퍼시스턴스).
          // 서버 응답으로 확인된 경우에만 ok 로 표시.
          if (!snap.metadata.fromCache) {
            setFirebaseStatus("ok");
            setFirebaseError(null);
          }
          settled = true;
          if (readyFallback) clearTimeout(readyFallback);
          setReady(true);
        },
        (err) => {
          console.error("[users listener]", (err as any)?.code, err.message);
          setFirebaseError(err.message);
          setFirebaseStatus("error");
          // 에러여도 ready 는 켠다 — 안 켜면 PageLoader 에 영구히 갇혀 원인조차 볼 수 없다.
          settled = true;
          if (readyFallback) clearTimeout(readyFallback);
          setReady(true);
        }
      );

      // 스냅샷도 에러도 오지 않는 경우(네트워크 블랙홀·프록시 차단) 대비 안전망.
      // 화면이 로더에서 멈추는 것보다는, 연결 실패 배너와 함께 앱을 띄우는 편이 낫다.
      // settled 를 반드시 봐야 한다 — 안 그러면 정상 연결된 세션도 8초 뒤에
      // 이 타이머가 깨어나 error 로 뒤집어 버린다.
      readyFallback = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.error("[users listener] 8초 내 응답 없음 — 연결 실패로 처리");
        setFirebaseError("users 구독 응답 없음 (timeout)");
        setFirebaseStatus("error");
        setReady(true);
      }, 8000);

      // Master password — 한 번만 읽기
      getDoc(doc(db, "appState", "settings")).then((s) => {
        if (s.exists()) {
          const data = s.data() as any;
          if (data.masterPassword) setMasterPasswordState(data.masterPassword);
        }
      }).catch((e) => console.warn("[appState/settings]", e?.message));
    });

    return () => {
      cancelled = true;
      if (readyFallback) clearTimeout(readyFallback);
      if (usersUnsub) usersUnsub();
    };
  }, []);

  // Scoped listeners by user role
  useEffect(() => {
    scopedUnsubsRef.current.forEach((u) => u());
    scopedUnsubsRef.current = [];
    if (!db || !currentUser) return;

    const sub = <T,>(
      coll: string,
      setter: (rows: T[]) => void,
      whereField: string,
      value: string
    ) => {
      const q = query(collection(db!, coll), where(whereField, "==", value));
      const un = onSnapshot(
        q,
        (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
        },
        (err) => {
          // 침묵 실패 방지 — permission-denied 면 보안규칙(firestore.rules) 배포 여부 확인
          console.error(`[onSnapshot ${coll}]`, (err as any)?.code, err?.message);
        }
      );
      scopedUnsubsRef.current.push(un);
    };

    if (currentUser.role === "owner") {
      const sid = currentUser.id;
      sub<Visit>("visits", setVisits, "storeId", sid);
      sub<Coupon>("coupons", setCoupons, "storeId", sid);
      sub<TableDoc>("tables", setTables, "storeId", sid);
      sub<Section>("sections", setSections, "storeId", sid);
      sub<Communication>("Communications", setCommunications, "storeId", sid);
      sub<TierOverride>("tierOverrides", setTierOverrides, "storeId", sid);
      sub<Menu>("menus", setMenus, "storeId", sid);
      sub<Order>("orders", setOrders, "storeId", sid);
      sub<Reservation>("reservations", setReservations, "storeId", sid);
      sub<Photo>("photos", setPhotos, "storeId", sid);
      sub<Shift>("shifts", setShifts, "storeId", sid);
      sub<Ingredient>("ingredients", setIngredients, "storeId", sid);
      sub<Expense>("expenses", setExpenses, "storeId", sid);
      sub<MarketingDraft>("marketingDrafts", setMarketingDrafts, "storeId", sid);
    } else if (currentUser.role === "staff") {
      const sid = currentUser.employerStoreId;
      // 본인 근무 기록은 항상 구독 (승인 전에도 빈 배열)
      sub<Shift>("shifts", setShifts, "staffId", currentUser.id);
      if (sid && currentUser.employerStatus === "approved") {
        sub<TableDoc>("tables", setTables, "storeId", sid);
        sub<Section>("sections", setSections, "storeId", sid);
        sub<Menu>("menus", setMenus, "storeId", sid);
        sub<Order>("orders", setOrders, "storeId", sid);
        sub<Reservation>("reservations", setReservations, "storeId", sid);
        sub<Photo>("photos", setPhotos, "storeId", sid);
        sub<Ingredient>("ingredients", setIngredients, "storeId", sid);
      } else {
        setTables([]);
        setSections([]);
        setMenus([]);
        setOrders([]);
        setReservations([]);
        setPhotos([]);
        setIngredients([]);
      }
    } else {
      // customer: 본인 데이터를 매장 무관하게 구독
      const cid = currentUser.id;
      sub<Visit>("visits", setVisits, "customerId", cid);
      sub<Coupon>("coupons", setCoupons, "customerId", cid);
      sub<Communication>("Communications", setCommunications, "customerId", cid);
      sub<TierOverride>("tierOverrides", setTierOverrides, "customerId", cid);
    }

    return () => {
      scopedUnsubsRef.current.forEach((u) => u());
      scopedUnsubsRef.current = [];
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.employerStoreId, currentUser?.employerStatus]);

  // 고객이 매장에 진입했을 때 그 매장의 tables/menus/orders/photos 구독
  useEffect(() => {
    storeContextUnsubsRef.current.forEach((u) => u());
    storeContextUnsubsRef.current = [];
    if (!db || !currentUser || currentUser.role !== "customer" || !activeStoreId) {
      // 매장 컨텍스트 벗어났을 때 표는 비움 (메모리)
      if (currentUser?.role === "customer") {
        setTables([]);
        setMenus([]);
        setOrders([]);
        setPhotos([]);
      }
      return;
    }

    const sub = <T,>(
      coll: string,
      setter: (rows: T[]) => void,
      field: string = "storeId",
      value: string = activeStoreId!
    ) => {
      const q = query(collection(db!, coll), where(field, "==", value));
      const un = onSnapshot(
        q,
        (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
        },
        (err) => {
          // 침묵 실패 방지 — permission-denied 면 보안규칙(firestore.rules) 배포 여부 확인
          console.error(`[onSnapshot ${coll}]`, (err as any)?.code, err?.message);
        }
      );
      storeContextUnsubsRef.current.push(un);
    };

    sub<TableDoc>("tables", setTables);
    sub<Menu>("menus", setMenus);
    // 손님은 본인 주문만 필요(Dashboard 가 customerId 로 필터)·매장 전체 주문 구독은
    // 읽기 낭비 + 남의 주문 노출이므로 customerId 로 좁힌다 — 읽기 원가↓ + 프라이버시↑.
    sub<Order>("orders", setOrders, "customerId", currentUser.id);
    sub<Photo>("photos", setPhotos);

    return () => {
      storeContextUnsubsRef.current.forEach((u) => u());
      storeContextUnsubsRef.current = [];
    };
  }, [activeStoreId, currentUser?.id, currentUser?.role]);


  // 사장이 원격으로 바꾸는 직원의 권한 등급·추가권한·승인 상태를, 실행 중인 직원 세션에 실시간 반영.
  // 전역 users 구독은 users 배열만 갱신하고 권한 판정의 원천인 currentUser 는 갱신하지 않아서,
  // 재로그인 전까지 (a) 강등돼도 옛 등급 권한 유지, (b) 승인돼도 Pending 에 묶이고 매장 데이터 구독이
  // 시작되지 않는 문제가 있었다. employerStatus/employerStoreId 가 scoped 구독 effect 의존성(524)이라
  // 이 한 번의 setCurrentUser 로 라우트 가드·NAV·구독 재시작이 모두 정상화된다.
  useEffect(() => {
    if (currentUser?.role !== "staff") return; // 직원 세션만 — 사장/손님 낙관적 패치와 충돌 방지
    const fresh = users.find((u) => u.id === currentUser.id);
    if (!fresh) return;
    const changed =
      fresh.staffLevel !== currentUser.staffLevel ||
      fresh.employerStatus !== currentUser.employerStatus ||
      fresh.employerStoreId !== currentUser.employerStoreId ||
      fresh.position !== currentUser.position ||
      fresh.hourlyWage !== currentUser.hourlyWage ||
      fresh.status !== currentUser.status ||
      JSON.stringify(fresh.extraPerms ?? []) !== JSON.stringify(currentUser.extraPerms ?? []);
    if (!changed) return; // 실제 변경이 있을 때만 set — 무한 루프 방지
    setCurrentUser({
      ...currentUser,
      staffLevel: fresh.staffLevel,
      extraPerms: fresh.extraPerms,
      employerStatus: fresh.employerStatus,
      employerStoreId: fresh.employerStoreId,
      position: fresh.position,
      hourlyWage: fresh.hourlyWage,
      status: fresh.status,
    });
  }, [users, currentUser, setCurrentUser]);
}
