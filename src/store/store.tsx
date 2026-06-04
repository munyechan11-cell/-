import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db, isFirebaseConfigured, ensureAnonymousAuth } from "../lib/firebase";
import { updateFirestoreDoc, flushOfflineQueue } from "../lib/firestore";
import { calculateAgeGroup } from "../lib/auth";
import { generateId, digitsOnly } from "../lib/ids";
import { showToast } from "../lib/toast";
import { getCustomerTier } from "../lib/tier";
import { relayOrderToPos } from "../lib/pos";
import { printReceipt } from "../lib/receipt";
import { printReceiptViaUsb, getAuthorizedPrinters } from "../lib/thermalPrinter";
import { enqueuePrintJob } from "../lib/printBridge";
import type {
  User,
  Visit,
  Coupon,
  TableDoc,
  Communication,
  Section,
  TierOverride,
  Menu,
  Order,
  OrderItem,
  OrderStatus,
  Reservation,
  Photo,
  Role,
  AuthType,
  Tier,
  TableStatus,
  Shift,
} from "../lib/types";

type FirebaseStatus = "connecting" | "ok" | "error" | "offline";

interface StoreState {
  isReady: boolean;
  firebaseStatus: FirebaseStatus;
  firebaseError: string | null;
  currentUser: User | null;
  masterPassword: string;
  isMaster: boolean;

  users: User[];
  visits: Visit[];
  coupons: Coupon[];
  tables: TableDoc[];
  sections: Section[];
  communications: Communication[];
  tierOverrides: TierOverride[];
  menus: Menu[];
  orders: Order[];
  reservations: Reservation[];
  photos: Photo[];
  shifts: Shift[];

  /** 현재 컨텍스트의 매장 id (사장님=자기 id, 직원=employerStoreId) */
  effectiveStoreId: string;
  /** 현재 사용자의 진행 중인 근무 (clockOutAt이 없는 것). 직원만 의미 있음. */
  activeShift: Shift | null;

  /** 고객이 현재 보고 있는 매장 (이 ID가 설정된 동안 tables/menus/orders를 해당 매장으로 구독) */
  activeStoreId: string | null;
  setActiveStoreId: (id: string | null) => void;

  // auth
  login: (input: LoginInput) => Promise<User>;
  logout: () => void;
  deleteAccount: () => Promise<void>;
  setMasterPassword: (pw: string) => Promise<void>;
  loginMaster: (pw: string) => boolean;
  logoutMaster: () => void;
  deleteUser: (userId: string, role: Role) => Promise<void>;

  // visits & coupons
  recordVisit: (customerId: string, tableNumber: number, storeId: string, amount?: number) => Promise<void>;
  leaveTable: (tableNumber: number, storeId: string) => Promise<void>;
  /** 손님 측 — QR 진입 시 테이블 점유 시작 (합석 시 occupantIds 추가) */
  enterTable: (input: {
    tableNumber: number;
    storeId: string;
    customerId: string;
    customerName?: string;
    partySize?: number;
  }) => Promise<void>;
  /** 사장님 측 — 손님 강제 퇴장 (미결제 주문은 cancelled 로) */
  evictTable: (tableNumber: number, storeId: string) => Promise<void>;
  issueCoupon: (customerId: string, storeId: string, type: string, description: string) => Promise<void>;
  requestCouponUse: (couponId: string, tableNumber?: number) => Promise<void>;
  cancelCouponRequest: (couponId: string) => Promise<void>;
  approveCouponUse: (couponId: string) => Promise<void>;
  rejectCouponUse: (couponId: string) => Promise<void>;

  // tables & sections
  addTable: (storeId: string, type?: TableDoc["type"], sectionId?: string) => Promise<void>;
  updateTableLayout: (storeId: string, number: number, data: Partial<TableDoc>) => Promise<void>;
  deleteTable: (storeId: string, number: number) => Promise<void>;
  updateTableStatus: (storeId: string, number: number, status: TableStatus) => Promise<void>;
  initTables: (storeId: string) => Promise<void>;
  addSection: (storeId: string, name: string) => Promise<void>;
  updateSection: (id: string, data: Partial<Section>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;

  // menus
  addMenuItem: (storeId: string, data: Omit<Menu, "id" | "storeId">) => Promise<void>;
  updateMenuItem: (id: string, data: Partial<Menu>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;

  // orders
  placeOrder: (input: {
    storeId: string;
    tableNumber: number;
    customerId: string;
    items: OrderItem[];
  }) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  /** 손님 측 — 결제 요청만 보냄(paymentStatus: requested). 실제 결제는 사장님 승인. */
  payTableSession: (
    customerId: string,
    storeId: string,
    tableNumber: number
  ) => Promise<number>;
  /** 사장님 측 — 결제 승인. paid 처리 + 총 영수증 인쇄. table.status: paid */
  approvePayment: (storeId: string, tableNumber: number) => Promise<number>;
  /** 사장님 측 — 계산 완료. 테이블 정리 (status: available + occupant null) */
  completeTable: (storeId: string, tableNumber: number) => Promise<void>;
  /** 사장님 또는 손님 측 — 중간 계산서 즉시 출력 (정식 영수증 아님 표시) */
  printInterimReceipt: (storeId: string, tableNumber: number) => Promise<void>;

  // CRM
  recordCommunication: (
    customerId: string,
    storeId: string,
    type: "coupon" | "message",
    content: string,
    senderRole?: "owner" | "customer"
  ) => Promise<void>;
  updateUserMemo: (userId: string, memo: string) => Promise<void>;
  setCustomerTier: (customerId: string, storeId: string, tier: Tier | "auto") => Promise<void>;
  bulkIssueCoupon: (customerIds: string[], storeId: string, type: string, description: string) => Promise<void>;
  updateBrandSettings: (storeId: string, data: Partial<User>) => Promise<void>;
  updateStoreConfig: (storeId: string, partial: Partial<NonNullable<User["storeConfig"]>>) => Promise<void>;
  updateStoreLocation: (storeId: string, lat: number, lng: number) => Promise<void>;

  // reservations
  addReservation: (input: Omit<Reservation, "id" | "createdAt" | "status"> & { status?: Reservation["status"] }) => Promise<void>;
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;

  // photos
  addPhoto: (input: Omit<Photo, "id" | "createdAt">) => Promise<Photo>;
  updatePhoto: (id: string, data: Partial<Photo>) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;

  // staff membership & shifts
  requestJoinStore: (storeId: string, position?: string) => Promise<void>;
  cancelJoinRequest: () => Promise<void>;
  approveStaff: (staffId: string) => Promise<void>;
  rejectStaff: (staffId: string) => Promise<void>;
  removeStaffMembership: (staffId: string) => Promise<void>;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
}

interface LoginInput {
  phone: string;
  name: string;
  role: Role;
  restaurantName?: string;
  storeId?: string;
  socialId?: string;
  socialProvider?: "google" | "kakao";
  authType?: AuthType;
  avatarUrl?: string;
  gender?: "male" | "female";
  birthYear?: number;
  birthday?: string;
  isPohangResident?: boolean;
  privacyAgreedAt?: string;
  posVendor?: string;
  posApiKey?: string;
  /** true면 기존 계정만 로그인 허용, 매칭 실패 시 throw (자동 가입 방지) */
  signInOnly?: boolean;
}

const StoreCtx = createContext<StoreState | null>(null);

const LS_USER = "gyeol:currentUser";
const LS_MASTER = "gyeol:isMaster";
const LS_OFFLINE_STATE = "gyeol:offline_state";

// Default 15 tables for new owner
function makeDefaultTables(storeId: string): TableDoc[] {
  return Array.from({ length: 15 }, (_, i) => {
    const n = i + 1;
    const col = (n - 1) % 5;
    const row = Math.floor((n - 1) / 5);
    return {
      id: `${storeId}_${n}`,
      number: n,
      storeId,
      x: col * 120 + 40,
      y: row * 120 + 40,
      width: 90,
      height: 90,
      seats: 4,
      type: "table",
      shape: "square",
      status: "available",
      currentCustomerId: null,
      sessionStartTime: null,
    };
  });
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setReady] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>("connecting");
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [masterPassword, setMasterPasswordState] = useState("IMC");
  const [isMaster, setIsMaster] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [tables, setTables] = useState<TableDoc[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [tierOverrides, setTierOverrides] = useState<TierOverride[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const scopedUnsubsRef = useRef<Array<() => void>>([]);
  const storeContextUnsubsRef = useRef<Array<() => void>>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  // 최신 상태를 캡처하기 위한 ref (useCallback identity 안정화)
  const usersRef = useRef<User[]>(users);
  const visitsRef = useRef<Visit[]>(visits);
  const couponsRef = useRef<Coupon[]>(coupons);
  const tablesRef = useRef<TableDoc[]>(tables);
  const menusRef = useRef<Menu[]>(menus);
  const sectionsRef = useRef<Section[]>(sections);
  const ordersRef = useRef<Order[]>(orders);
  const currentUserRef = useRef<User | null>(currentUser);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { visitsRef.current = visits; }, [visits]);
  useEffect(() => { couponsRef.current = coupons; }, [coupons]);
  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { menusRef.current = menus; }, [menus]);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // Persist for offline fallback
  useEffect(() => {
    if (!isReady) return;
    if (firebaseStatus !== "offline") return;
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
      })
    );
  }, [
    firebaseStatus,
    isReady,
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
    let cancelled = false;
    ensureAnonymousAuth().then(() => {
      if (cancelled || !db) return;

      // users — 로그인 매칭용 전체 구독
      usersUnsub = onSnapshot(
        collection(db, "users"),
        (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User))),
        (err) => {
          console.error("[users listener]", err);
          setFirebaseError(err.message);
          setFirebaseStatus("error");
        }
      );

      // Master password — 한 번만 읽기
      getDoc(doc(db, "appState", "settings")).then((s) => {
        if (s.exists()) {
          const data = s.data() as any;
          if (data.masterPassword) setMasterPasswordState(data.masterPassword);
        }
      }).catch((e) => console.warn("[appState/settings]", e?.message));

      setReady(true);
    });

    return () => {
      cancelled = true;
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
      const un = onSnapshot(q, (snap) => {
        setter(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
      });
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
      } else {
        setTables([]);
        setSections([]);
        setMenus([]);
        setOrders([]);
        setReservations([]);
        setPhotos([]);
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

    const sub = <T,>(coll: string, setter: (rows: T[]) => void) => {
      const q = query(collection(db!, coll), where("storeId", "==", activeStoreId));
      const un = onSnapshot(q, (snap) => {
        setter(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
      });
      storeContextUnsubsRef.current.push(un);
    };

    sub<TableDoc>("tables", setTables);
    sub<Menu>("menus", setMenus);
    sub<Order>("orders", setOrders);
    sub<Photo>("photos", setPhotos);

    return () => {
      storeContextUnsubsRef.current.forEach((u) => u());
      storeContextUnsubsRef.current = [];
    };
  }, [activeStoreId, currentUser?.id, currentUser?.role]);

  const setCurrentUser = useCallback((u: User | null) => {
    setCurrentUserState(u);
    if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
    else localStorage.removeItem(LS_USER);
  }, []);

  // ============ LOGIN ============
  const login = useCallback(
    async (input: LoginInput): Promise<User> => {
      const phone = digitsOnly(input.phone);
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
          (u) => u.role === role && digitsOnly(u.phone || "") === phone
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

        await updateFirestoreDoc("users", match.id, patch);
        const final = { ...match, ...patch } as User;
        setCurrentUser(final);
        showToast(`${final.name}님 환영합니다!`, "success");
        return final;
      }

      // signInOnly 모드: 기존 계정 없으면 가입 거부
      if (input.signInOnly) {
        throw new Error("일치하는 계정이 없습니다. 신규 가입 모드에서 등록해 주세요.");
      }

      // 3) new user
      const newId = generateId();
      const user: User = {
        id: newId,
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

      await updateFirestoreDoc("users", newId, user);

      // Owner: auto-create 15 tables
      if (role === "owner" && db) {
        const batch = writeBatch(db);
        for (const t of makeDefaultTables(newId)) {
          batch.set(doc(db, "tables", t.id), t);
        }
        try {
          await batch.commit();
        } catch (e) {
          console.error("[create tables]", e);
        }
      }

      setCurrentUser(user);
      showToast(`${name}님 환영합니다!`, "success");
      return user;
    },
    [users, setCurrentUser]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    showToast("로그아웃 되었습니다.", "info");
  }, [setCurrentUser]);

  const deleteAccount = useCallback(async () => {
    if (!currentUser) return;
    await updateFirestoreDoc("users", currentUser.id, {
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
    await updateFirestoreDoc("appState", "settings", { masterPassword: pw });
    setMasterPasswordState(pw);
    showToast("마스터 비밀번호가 변경되었습니다.", "success");
  }, []);

  const loginMaster = useCallback(
    (pw: string) => {
      if (pw === masterPassword) {
        setIsMaster(true);
        localStorage.setItem(LS_MASTER, "1");
        showToast("마스터 로그인 성공", "success");
        return true;
      }
      showToast("비밀번호가 일치하지 않습니다.", "error");
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
        showToast("오프라인 상태에서는 삭제할 수 없습니다.", "error");
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
      showToast("계정과 관련 데이터를 삭제했습니다.", "success");
    },
    []
  );

  // ============ VISITS ============
  const recordVisit = useCallback(
    async (customerId: string, tableNumber: number, storeId: string, amount?: number) => {
      // 10초 디바운스
      const guardKey = `gyeol:last_visit_${customerId}_${storeId}`;
      const last = Number(sessionStorage.getItem(guardKey) || 0);
      if (Date.now() - last < 10_000) return;
      sessionStorage.setItem(guardKey, String(Date.now()));

      // ref로 최신 스냅샷 읽어 identity 안정화
      const users = usersRef.current;
      const visits = visitsRef.current;
      const coupons = couponsRef.current;
      const tables = tablesRef.current;
      const currentUser = currentUserRef.current;

      const owner = users.find((u) => u.id === storeId && u.role === "owner");
      const today = new Date().toDateString();
      const alreadyToday = visits.some(
        (v) =>
          v.customerId === customerId &&
          v.storeId === storeId &&
          new Date(v.date).toDateString() === today
      );

      // 1) Create visit (only once per day)
      if (!alreadyToday) {
        const visit: Visit = {
          id: generateId(),
          customerId,
          storeId,
          tableNumber,
          date: new Date().toISOString(),
          totalAmount: amount,
        };
        await updateFirestoreDoc("visits", visit.id, visit);

        // Reward accrual (Firestore increment으로 atomic 처리)
        if (owner?.storeConfig) {
          const cfg = owner.storeConfig;
          let delta = 0;
          if (cfg.rewardType === "stamp") {
            delta = 1;
          } else if (cfg.rewardType === "point") {
            const rate = cfg.pointRate ?? 0.05;
            const base = amount ?? 10000;
            delta = Math.floor(base * rate);
          }
          if (delta > 0) {
            await updateFirestoreDoc("users", customerId, {
              rewardBalance: increment(delta),
            });
            // 로컬 currentUser도 즉시 반영 (UI stale 방지)
            if (currentUser?.id === customerId) {
              setCurrentUser({
                ...currentUser,
                rewardBalance: (currentUser.rewardBalance ?? 0) + delta,
              });
            }
          }
        }

        // 2) Tier coupons
        const myVisits = [
          ...visits.filter((v) => v.customerId === customerId && v.storeId === storeId),
          visit,
        ];
        const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
        const uniqueDays = new Set(
          myVisits
            .filter((v) => new Date(v.date).getTime() >= thirtyDaysAgo)
            .map((v) => new Date(v.date).toDateString())
        ).size;

        const tierRules: { min: number; tier: Tier; defaultDesc: string }[] = [
          { min: 12, tier: "VIP", defaultDesc: "사장님 특별 서비스" },
          { min: 8, tier: "다이아", defaultDesc: "메인 메뉴 할인 쿠폰" },
          { min: 6, tier: "골드", defaultDesc: "사이드 메뉴 무료권" },
          { min: 4, tier: "실버", defaultDesc: "음료 무료 쿠폰" },
          { min: 2, tier: "브론즈", defaultDesc: "재방문 스탬프 추가 적립" },
        ];
        for (const rule of tierRules) {
          if (uniqueDays >= rule.min) {
            const already = coupons.some(
              (c) => c.customerId === customerId && c.storeId === storeId && c.type === rule.tier
            );
            if (!already) {
              const desc = owner?.tierRewards?.[rule.tier] ?? rule.defaultDesc;
              const c: Coupon = {
                id: generateId(),
                customerId,
                storeId,
                type: rule.tier,
                description: desc,
                status: "available",
                issuedAt: new Date().toISOString(),
              };
              await updateFirestoreDoc("coupons", c.id, c);
            }
            break;
          }
        }
      }

      // 3) Table state — 사장이 인쇄한 QR이면 정식 테이블로 자동 생성
      const tableId = `${storeId}_${tableNumber}`;
      const existing = tables.find((t) => t.id === tableId);
      if (existing) {
        await updateFirestoreDoc("tables", tableId, {
          currentCustomerId: customerId,
          sessionStartTime: new Date().toISOString(),
          status: "occupied",
        });
      } else {
        // 없는 번호로 들어오면 새 테이블 doc 생성 (없으면 myTable이 영원히 안 잡혀 손님이 "테이블 이용" 메시지를 계속 봄)
        const num = Number(tableNumber);
        const col = ((num - 1) % 5 + 5) % 5;
        const row = Math.max(0, Math.floor((num - 1) / 5));
        await updateFirestoreDoc("tables", tableId, {
          id: tableId,
          number: num,
          storeId,
          type: "table",
          shape: "square",
          seats: 4,
          width: 90,
          height: 90,
          x: col * 120 + 40,
          y: row * 120 + 40,
          status: "occupied",
          currentCustomerId: customerId,
          sessionStartTime: new Date().toISOString(),
        });
      }

      if (!alreadyToday) showToast("방문이 기록되었습니다.", "success");
    },
    [setCurrentUser]
  );

  const leaveTable = useCallback(async (tableNumber: number, storeId: string) => {
    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc("tables", tableId, {
      currentCustomerId: null,
      occupantIds: [],
      currentCustomerName: null,
      partySize: null,
      sessionStartTime: null,
      status: "dirty",
    });
  }, []);

  /**
   * 손님이 QR 로 매장 진입 — 테이블 점유 시작.
   * 이미 점유 상태면 추가 손님으로 occupantIds 에 합석.
   * 호출처: customer/TableEntry.tsx (또는 customer/Dashboard.tsx 진입 시점)
   */
  const enterTable = useCallback(
    async (input: {
      tableNumber: number;
      storeId: string;
      customerId: string;
      customerName?: string;
      partySize?: number;
    }) => {
      const tableId = `${input.storeId}_${input.tableNumber}`;
      const existing = tablesRef.current.find((t) => t.id === tableId);
      const occupantIds = Array.from(
        new Set([...(existing?.occupantIds ?? []), input.customerId])
      );
      // 8단계 자동 전이 — 현재 status 가 setup/reserved/available 이었으면 occupied 로
      // 이미 occupied/dining/paid 면 유지 (합석/주문 후 점유 갱신)
      const cur = existing?.status;
      const nextStatus =
        cur === "dining" || cur === "paid" || cur === "cleaning" || cur === "dirty"
          ? cur
          : "occupied";
      await updateFirestoreDoc("tables", tableId, {
        currentCustomerId: existing?.currentCustomerId ?? input.customerId,
        currentCustomerName: existing?.currentCustomerName ?? input.customerName ?? null,
        occupantIds,
        partySize: input.partySize ?? existing?.partySize ?? occupantIds.length,
        sessionStartTime: existing?.sessionStartTime ?? new Date().toISOString(),
        status: nextStatus,
      });
    },
    []
  );

  /**
   * 사장님이 손님을 강제 퇴장 처리.
   * 미결제 주문은 cancelled 로 정리 (집계 보호) 후 테이블 정리.
   */
  const evictTable = useCallback(
    async (tableNumber: number, storeId: string) => {
      const tableId = `${storeId}_${tableNumber}`;
      const unpaid = ordersRef.current.filter(
        (o) => o.storeId === storeId && o.tableNumber === tableNumber && o.paymentStatus !== "paid"
      );
      for (const o of unpaid) {
        try {
          await updateFirestoreDoc("orders", o.id, { status: "cancelled" });
        } catch (e) {
          console.warn("[evictTable] cancel order skip", o.id, e);
        }
      }
      await updateFirestoreDoc("tables", tableId, {
        currentCustomerId: null,
        occupantIds: [],
        currentCustomerName: null,
        partySize: null,
        sessionStartTime: null,
        status: "dirty",
      });
      showToast(`테이블 ${tableNumber}번 손님을 퇴장 처리했어요.`, "success");
    },
    []
  );

  // ============ COUPONS ============
  const issueCoupon = useCallback(
    async (customerId: string, storeId: string, type: string, description: string) => {
      const c: Coupon = {
        id: generateId(),
        customerId,
        storeId,
        type,
        description,
        status: "available",
        issuedAt: new Date().toISOString(),
      };
      await updateFirestoreDoc("coupons", c.id, c);
      showToast("쿠폰이 발급되었습니다.", "success");
    },
    []
  );

  const requestCouponUse = useCallback(async (couponId: string, tableNumber?: number) => {
    await updateFirestoreDoc("coupons", couponId, {
      status: "pending",
      usedAtTable: tableNumber ?? null,
    });
    showToast("사용 요청을 보냈습니다. 사장님 확인을 기다려 주세요.", "info");
  }, []);

  const cancelCouponRequest = useCallback(async (couponId: string) => {
    await updateFirestoreDoc("coupons", couponId, {
      status: "available",
      usedAtTable: null,
    });
    showToast("사용 요청을 취소했습니다.", "info");
  }, []);

  const approveCouponUse = useCallback(async (couponId: string) => {
    await updateFirestoreDoc("coupons", couponId, {
      status: "used",
      usedAt: new Date().toISOString(),
    });
    showToast("쿠폰 사용을 승인했습니다.", "success");
  }, []);

  const rejectCouponUse = useCallback(async (couponId: string) => {
    await updateFirestoreDoc("coupons", couponId, {
      status: "available",
      usedAtTable: null,
    });
    showToast("쿠폰 사용을 반려했습니다.", "info");
  }, []);

  // ============ TABLES ============
  const addTable = useCallback(
    async (storeId: string, type: TableDoc["type"] = "table", sectionId?: string) => {
      const storeTables = tables.filter((t) => t.storeId === storeId);
      const nextNumber = storeTables.reduce((mx, t) => Math.max(mx, t.number), 0) + 1;
      const isRoom = type === "room";
      const t: TableDoc = {
        id: `${storeId}_${nextNumber}`,
        number: nextNumber,
        storeId,
        type,
        x: 40,
        y: 40,
        width: isRoom ? 150 : 70,
        height: isRoom ? 80 : 70,
        seats: isRoom ? 6 : 4,
        shape: "square",
        status: "available",
        sectionId,
      };
      await updateFirestoreDoc("tables", t.id, t);
    },
    [tables]
  );

  const updateTableLayout = useCallback(
    async (storeId: string, number: number, data: Partial<TableDoc>) => {
      await updateFirestoreDoc("tables", `${storeId}_${number}`, data);
    },
    []
  );

  const deleteTable = useCallback(async (storeId: string, number: number) => {
    await updateFirestoreDoc("tables", `${storeId}_${number}`, undefined, true);
  }, []);

  const updateTableStatus = useCallback(
    async (storeId: string, number: number, status: TableStatus) => {
      const patch: Partial<TableDoc> = { status };
      // 비어있음으로 복귀 시 점유 정보 일괄 정리
      if (status === "available") {
        patch.currentCustomerId = null;
        patch.currentCustomerName = null;
        patch.occupantIds = [];
        patch.partySize = null;
        patch.sessionStartTime = null;
      }
      await updateFirestoreDoc("tables", `${storeId}_${number}`, patch);
    },
    []
  );

  const initTables = useCallback(async (storeId: string) => {
    if (!db) return;
    const batch = writeBatch(db);
    tables.filter((t) => t.storeId === storeId).forEach((t) => batch.delete(doc(db!, "tables", t.id)));
    for (const t of makeDefaultTables(storeId)) {
      batch.set(doc(db, "tables", t.id), t);
    }
    await batch.commit();
    showToast("테이블을 초기화했습니다.", "success");
  }, [tables]);

  // ============ SECTIONS ============
  const addSection = useCallback(async (storeId: string, name: string) => {
    const id = generateId();
    const order = sections.filter((s) => s.storeId === storeId).length;
    await updateFirestoreDoc("sections", id, { id, storeId, name, order });
  }, [sections]);

  const updateSection = useCallback(async (id: string, data: Partial<Section>) => {
    await updateFirestoreDoc("sections", id, data);
  }, []);

  const deleteSection = useCallback(async (id: string) => {
    await updateFirestoreDoc("sections", id, undefined, true);
    // unassign tables in that section
    const targets = tables.filter((t) => t.sectionId === id);
    for (const t of targets) {
      await updateFirestoreDoc("tables", t.id, { sectionId: null });
    }
  }, [tables]);

  // ============ MENUS ============
  const addMenuItem = useCallback(async (storeId: string, data: Omit<Menu, "id" | "storeId">) => {
    const id = generateId();
    await updateFirestoreDoc("menus", id, { id, storeId, ...data });
    showToast("메뉴를 추가했습니다.", "success");
  }, []);

  const updateMenuItem = useCallback(async (id: string, data: Partial<Menu>) => {
    await updateFirestoreDoc("menus", id, data);
  }, []);

  const deleteMenuItem = useCallback(async (id: string) => {
    await updateFirestoreDoc("menus", id, undefined, true);
  }, []);

  // ============ ORDERS ============
  const placeOrder = useCallback(
    async ({
      storeId,
      tableNumber,
      customerId,
      items,
    }: {
      storeId: string;
      tableNumber: number;
      customerId: string;
      items: OrderItem[];
    }): Promise<Order> => {
      const totalAmount = items.reduce((s, it) => s + it.price * it.quantity, 0);
      const order: Order = {
        id: generateId(),
        storeId,
        tableNumber,
        customerId,
        items,
        totalAmount,
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString(),
      };
      await updateFirestoreDoc("orders", order.id, order);

      // 8단계 자동 전이 — 주문이 발생하면 테이블 상태 dining 으로 (occupied/setup/available 일 때만)
      try {
        const tableId = `${storeId}_${tableNumber}`;
        const cur = tablesRef.current.find((t) => t.id === tableId);
        const curStatus = cur?.status;
        if (curStatus === "occupied" || curStatus === "setup" || curStatus === "available" || !curStatus) {
          await updateFirestoreDoc("tables", tableId, { status: "dining" });
        }
      } catch (e: any) {
        console.warn("[placeOrder] status→dining skip", e?.message);
      }

      const owner = users.find((u) => u.id === storeId && u.role === "owner");
      const hasPosApi =
        owner?.posVendor && owner.posVendor !== "none" && owner.posApiKey;

      // ⚠️ 주문 시점에는 영수증 인쇄하지 않음 (정책 변경 — 2026-06).
      //   영수증은 결제 승인 시점에 '총 영수증' 한 번만 출력.
      //   POS API 연동만 즉시 호출 (주방 전달 등 매장 운영에 필요).
      if (hasPosApi || owner?.foodtechStoreCode) {
        const apiKey = owner?.posApiKey || owner?.foodtechStoreCode || "";
        const ok = await relayOrderToPos(
          apiKey,
          order,
          (mid) => menus.find((m) => m.id === mid)?.posProductCode,
          owner?.posVendor
        );
        if (!ok) {
          console.warn("[POS relay] failed — manual handling needed");
        }
      }
      // 영수증 인쇄(①②③④) 는 모두 결제 승인 시점(approvePayment) 으로 이동.
      // 손님이 중간에 영수증을 원하면 BillModal 의 '계산서 보기' 로 확인 가능.

      showToast("주문이 접수되었습니다.", "success");
      return order;
    },
    [users, menus]
  );

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    await updateFirestoreDoc("orders", id, { status });
  }, []);

  /**
   * 손님이 '결제하기' — 결제 요청만 보냄. 실제 결제·영수증은 사장님 승인 시점에.
   * 미결제 주문들의 paymentStatus 를 'requested' 로 변경 + 테이블 표시는 유지.
   */
  const payTableSession = useCallback(
    async (customerId: string, storeId: string, tableNumber: number): Promise<number> => {
      const ordersNow = ordersRef.current;
      const unpaid = ordersNow.filter(
        (o) =>
          o.customerId === customerId &&
          o.storeId === storeId &&
          o.status !== "cancelled" &&
          o.paymentStatus !== "paid"
      );
      if (unpaid.length === 0) {
        showToast("결제할 미결제 주문이 없습니다.", "info");
        return 0;
      }
      const total = unpaid.reduce((s, o) => s + o.totalAmount, 0);

      if (!db) {
        for (const o of unpaid) {
          await updateFirestoreDoc("orders", o.id, { paymentStatus: "requested" });
        }
      } else {
        const batch = writeBatch(db);
        unpaid.forEach((o) => {
          batch.set(doc(db!, "orders", o.id), { paymentStatus: "requested" }, { merge: true });
        });
        await batch.commit();
      }

      showToast(`결제 요청을 보냈어요. 매장에서 확인 후 결제해 주세요. (₩ ${total.toLocaleString()})`, "info");
      return total;
    },
    []
  );

  /**
   * 사장님이 '결제 승인' — 실제 결제 처리 + 총 영수증 인쇄.
   * - paymentStatus: requested|unpaid → paid
   * - 테이블 status: occupied → paid (정리 대기)
   * - 영수증 인쇄 ①POS → ②USB → ③팝업 → ④브릿지 큐 모두 시도
   */
  const approvePayment = useCallback(
    async (storeId: string, tableNumber: number): Promise<number> => {
      const ordersNow = ordersRef.current;
      const tablesNow = tablesRef.current;
      const targets = ordersNow.filter(
        (o) =>
          o.storeId === storeId &&
          o.tableNumber === tableNumber &&
          o.status !== "cancelled" &&
          o.paymentStatus !== "paid"
      );
      if (targets.length === 0) {
        showToast("승인할 결제 요청이 없어요.", "info");
        return 0;
      }
      const total = targets.reduce((s, o) => s + o.totalAmount, 0);

      // 1) Firestore 일괄 업데이트: 주문 paid + 테이블 status: paid
      if (db) {
        const batch = writeBatch(db);
        targets.forEach((o) => {
          batch.set(doc(db!, "orders", o.id), { paymentStatus: "paid" }, { merge: true });
        });
        const tableId = `${storeId}_${tableNumber}`;
        if (tablesNow.some((t) => t.id === tableId)) {
          batch.set(doc(db, "tables", tableId), { status: "paid" }, { merge: true });
        }
        await batch.commit();
      } else {
        for (const o of targets) {
          await updateFirestoreDoc("orders", o.id, { paymentStatus: "paid" });
        }
      }

      // 2) 총 영수증 1장 — 모든 주문 항목 합쳐서
      const owner = users.find((u) => u.id === storeId && u.role === "owner");
      const aggregated: Order = {
        id: `RECEIPT_${storeId}_${tableNumber}_${Date.now()}`,
        storeId,
        tableNumber,
        customerId: targets[0].customerId,
        items: targets.flatMap((o) => o.items),
        totalAmount: total,
        status: "served",
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
      };
      const payload = {
        storeName: owner?.restaurantName ?? "결",
        order: aggregated,
        footer: `테이블 ${tableNumber} · ${targets.length}건 합산 영수증`,
      };

      // 브릿지 큐 우선 (매장 PC 에이전트가 처리)
      if (owner?.printBridgeEnabled) {
        void enqueuePrintJob({
          storeId, type: "receipt", payload, expectedUid: storeId,
        });
      }
      // USB → 팝업 폴백 (사장님 화면에서 호출되는 경우만)
      try {
        const printers = await getAuthorizedPrinters();
        if (printers.length > 0) {
          await printReceiptViaUsb(payload);
        } else {
          printReceipt(payload);
        }
      } catch (e: any) {
        try { printReceipt(payload); } catch { /* 팝업도 차단됨 — 브릿지 큐에 맡김 */ }
      }

      showToast(`₩ ${total.toLocaleString()} 결제 승인 — 영수증 출력`, "success");
      return total;
    },
    [users]
  );

  /**
   * 사장님 '계산 완료' — 테이블을 비어있음(available) 으로 정리.
   * occupant 정리 + status: available + sessionStartTime 초기화.
   * approvePayment 가 status: paid 로 둔 테이블에 대해 호출.
   */
  const completeTable = useCallback(async (storeId: string, tableNumber: number) => {
    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc("tables", tableId, {
      status: "available",
      currentCustomerId: null,
      currentCustomerName: null,
      occupantIds: [],
      partySize: null,
      sessionStartTime: null,
    });
    showToast(`테이블 ${tableNumber}번이 비었어요.`, "success");
  }, []);

  /** 선택 인쇄 — 사장님 또는 손님이 원할 때 즉시 영수증(합산 미리보기) 출력 */
  const printInterimReceipt = useCallback(
    async (storeId: string, tableNumber: number) => {
      const ordersNow = ordersRef.current;
      const open = ordersNow.filter(
        (o) =>
          o.storeId === storeId &&
          o.tableNumber === tableNumber &&
          o.status !== "cancelled"
      );
      if (open.length === 0) {
        showToast("출력할 주문이 없어요.", "info");
        return;
      }
      const owner = users.find((u) => u.id === storeId && u.role === "owner");
      const total = open.reduce((s, o) => s + o.totalAmount, 0);
      const aggregated: Order = {
        id: `INTERIM_${storeId}_${tableNumber}_${Date.now()}`,
        storeId, tableNumber,
        customerId: open[0].customerId,
        items: open.flatMap((o) => o.items),
        totalAmount: total,
        status: "served",
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString(),
      };
      const payload = {
        storeName: owner?.restaurantName ?? "결",
        order: aggregated,
        footer: `[중간 계산서] 결제 전 미리보기 — 정식 영수증 아님`,
      };
      if (owner?.printBridgeEnabled) {
        void enqueuePrintJob({ storeId, type: "receipt", payload, expectedUid: storeId });
      }
      try {
        const printers = await getAuthorizedPrinters();
        if (printers.length > 0) await printReceiptViaUsb(payload);
        else printReceipt(payload);
      } catch {
        try { printReceipt(payload); } catch { /* ignore */ }
      }
      showToast("중간 계산서를 출력했어요.", "info");
    },
    [users]
  );

  // ============ CRM ============
  const recordCommunication = useCallback(
    async (
      customerId: string,
      storeId: string,
      type: "coupon" | "message",
      content: string,
      senderRole: "owner" | "customer" = "owner"
    ) => {
      const c: Communication = {
        id: generateId(),
        customerId,
        storeId,
        type,
        senderRole,
        content,
        date: new Date().toISOString(),
      };
      await updateFirestoreDoc("Communications", c.id, c);
    },
    []
  );

  const updateUserMemo = useCallback(async (userId: string, memo: string) => {
    await updateFirestoreDoc("users", userId, { memo });
  }, []);

  const setCustomerTier = useCallback(
    async (customerId: string, storeId: string, tier: Tier | "auto") => {
      const id = `${customerId}_${storeId}`;
      if (tier === "auto") {
        await updateFirestoreDoc("tierOverrides", id, undefined, true);
      } else {
        await updateFirestoreDoc("tierOverrides", id, { customerId, storeId, tier });
      }
    },
    []
  );

  const bulkIssueCoupon = useCallback(
    async (customerIds: string[], storeId: string, type: string, description: string) => {
      if (!db) return;
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      for (const cid of customerIds) {
        const id = generateId();
        batch.set(doc(db, "coupons", id), {
          id,
          customerId: cid,
          storeId,
          type,
          description,
          status: "available",
          issuedAt: now,
        });
      }
      await batch.commit();
      showToast(`${customerIds.length}명에게 쿠폰을 발급했습니다.`, "success");
    },
    []
  );

  const updateBrandSettings = useCallback(async (storeId: string, data: Partial<User>) => {
    await updateFirestoreDoc("users", storeId, data);
    if (currentUser?.id === storeId) setCurrentUser({ ...currentUser, ...data });
  }, [currentUser, setCurrentUser]);

  const updateStoreConfig = useCallback(
    async (storeId: string, partial: Partial<NonNullable<User["storeConfig"]>>) => {
      const target = users.find((u) => u.id === storeId);
      const next = { ...(target?.storeConfig ?? {}), ...partial } as NonNullable<User["storeConfig"]>;
      await updateFirestoreDoc("users", storeId, { storeConfig: next });
      if (currentUser?.id === storeId) {
        setCurrentUser({ ...currentUser, storeConfig: next });
      }
    },
    [users, currentUser, setCurrentUser]
  );

  const updateStoreLocation = useCallback(
    async (storeId: string, lat: number, lng: number) => {
      await updateFirestoreDoc("users", storeId, { lat, lng });
      if (currentUser?.id === storeId) setCurrentUser({ ...currentUser, lat, lng });
    },
    [currentUser, setCurrentUser]
  );

  // ============ RESERVATIONS ============
  const addReservation = useCallback(
    async (
      input: Omit<Reservation, "id" | "createdAt" | "status"> & { status?: Reservation["status"] }
    ) => {
      const r: Reservation = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        status: input.status ?? "confirmed",
        ...input,
      };
      await updateFirestoreDoc("reservations", r.id, r);
      showToast("예약이 등록되었습니다.", "success");
    },
    []
  );

  const updateReservation = useCallback(async (id: string, data: Partial<Reservation>) => {
    await updateFirestoreDoc("reservations", id, data);
  }, []);

  const deleteReservation = useCallback(async (id: string) => {
    await updateFirestoreDoc("reservations", id, undefined, true);
  }, []);

  // ============ PHOTOS ============
  const addPhoto = useCallback(async (input: Omit<Photo, "id" | "createdAt">): Promise<Photo> => {
    const p: Photo = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    await updateFirestoreDoc("photos", p.id, p);
    return p;
  }, []);

  const updatePhoto = useCallback(async (id: string, data: Partial<Photo>) => {
    await updateFirestoreDoc("photos", id, data);
  }, []);

  const deletePhoto = useCallback(async (id: string) => {
    await updateFirestoreDoc("photos", id, undefined, true);
  }, []);

  // ============ STAFF MEMBERSHIP & SHIFTS ============
  const requestJoinStore = useCallback(
    async (storeId: string, position?: string) => {
      const cu = currentUserRef.current;
      if (!cu || cu.role !== "staff") return;
      const patch: Partial<User> = {
        employerStoreId: storeId,
        employerStatus: "pending",
        joinRequestedAt: new Date().toISOString(),
      };
      if (position !== undefined) patch.position = position;
      await updateFirestoreDoc("users", cu.id, patch);
      setCurrentUser({ ...cu, ...patch });
      showToast("가입 요청을 보냈습니다. 사장님 승인을 기다려주세요.", "success");
    },
    [setCurrentUser]
  );

  const cancelJoinRequest = useCallback(async () => {
    const cu = currentUserRef.current;
    if (!cu || cu.role !== "staff") return;
    // null로 저장해 필드를 명시적으로 비웁니다 (stripUndefined가 undefined를 제거하므로)
    await updateFirestoreDoc("users", cu.id, {
      employerStoreId: null,
      employerStatus: null,
      joinRequestedAt: null,
    });
    setCurrentUser({
      ...cu,
      employerStoreId: undefined,
      employerStatus: undefined,
      joinRequestedAt: undefined,
    });
    showToast("가입 요청을 취소했습니다.", "info");
  }, [setCurrentUser]);

  const approveStaff = useCallback(async (staffId: string) => {
    await updateFirestoreDoc("users", staffId, { employerStatus: "approved" });
    showToast("직원을 승인했습니다.", "success");
  }, []);

  const rejectStaff = useCallback(async (staffId: string) => {
    await updateFirestoreDoc("users", staffId, {
      employerStatus: "rejected",
    });
    showToast("가입 요청을 거절했습니다.", "info");
  }, []);

  const removeStaffMembership = useCallback(async (staffId: string) => {
    await updateFirestoreDoc("users", staffId, {
      employerStoreId: null,
      employerStatus: null,
      position: null,
    });
    showToast("직원 소속을 해제했습니다.", "info");
  }, []);

  const clockIn = useCallback(async () => {
    const cu = currentUserRef.current;
    if (!cu || cu.role !== "staff" || !cu.employerStoreId || cu.employerStatus !== "approved") {
      showToast("출근할 수 없는 상태입니다.", "error");
      return;
    }
    // 이미 진행 중인 근무가 있으면 무시
    const open = shifts.find((s) => s.staffId === cu.id && !s.clockOutAt);
    if (open) {
      showToast("이미 출근 중입니다.", "info");
      return;
    }
    const id = generateId();
    const s: Shift = {
      id,
      staffId: cu.id,
      storeId: cu.employerStoreId,
      clockInAt: new Date().toISOString(),
      clockOutAt: null,
    };
    await updateFirestoreDoc("shifts", id, s);
    showToast("출근 완료. 오늘도 화이팅!", "success");
  }, [shifts]);

  const clockOut = useCallback(async () => {
    const cu = currentUserRef.current;
    if (!cu || cu.role !== "staff") return;
    const open = shifts.find((s) => s.staffId === cu.id && !s.clockOutAt);
    if (!open) {
      showToast("진행 중인 근무가 없습니다.", "info");
      return;
    }
    await updateFirestoreDoc("shifts", open.id, {
      clockOutAt: new Date().toISOString(),
    });
    showToast("퇴근 완료. 수고하셨습니다!", "success");
  }, [shifts]);

  // 현재 사용자 기준 진행 중 근무
  const activeShift = useMemo(() => {
    if (!currentUser || currentUser.role !== "staff") return null;
    return shifts.find((s) => s.staffId === currentUser.id && !s.clockOutAt) ?? null;
  }, [shifts, currentUser]);

  // 컨텍스트 매장 id (사장님=본인 id, 직원=employerStoreId, 그 외="")
  const effectiveStoreId = useMemo(() => {
    if (!currentUser) return "";
    if (currentUser.role === "owner") return currentUser.id;
    if (currentUser.role === "staff" && currentUser.employerStatus === "approved")
      return currentUser.employerStoreId ?? "";
    return "";
  }, [currentUser]);

  // silence unused warning
  void getCustomerTier;

  const value = useMemo<StoreState>(
    () => ({
      isReady,
      firebaseStatus,
      firebaseError,
      currentUser,
      masterPassword,
      isMaster,
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
      shifts,
      activeShift,
      effectiveStoreId,
      activeStoreId,
      setActiveStoreId,
      login,
      logout,
      deleteAccount,
      setMasterPassword,
      loginMaster,
      logoutMaster,
      deleteUser,
      recordVisit,
      leaveTable,
      enterTable,
      evictTable,
      issueCoupon,
      requestCouponUse,
      cancelCouponRequest,
      approveCouponUse,
      rejectCouponUse,
      addTable,
      updateTableLayout,
      deleteTable,
      updateTableStatus,
      initTables,
      addSection,
      updateSection,
      deleteSection,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      placeOrder,
      updateOrderStatus,
      payTableSession,
      approvePayment,
      completeTable,
      printInterimReceipt,
      recordCommunication,
      updateUserMemo,
      setCustomerTier,
      bulkIssueCoupon,
      updateBrandSettings,
      updateStoreConfig,
      updateStoreLocation,
      addReservation,
      updateReservation,
      deleteReservation,
      addPhoto,
      updatePhoto,
      deletePhoto,
      requestJoinStore,
      cancelJoinRequest,
      approveStaff,
      rejectStaff,
      removeStaffMembership,
      clockIn,
      clockOut,
    }),
    [
      isReady,
      firebaseStatus,
      firebaseError,
      currentUser,
      masterPassword,
      isMaster,
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
      shifts,
      activeShift,
      effectiveStoreId,
      activeStoreId,
      login,
      logout,
      deleteAccount,
      setMasterPassword,
      loginMaster,
      logoutMaster,
      deleteUser,
      recordVisit,
      leaveTable,
      enterTable,
      evictTable,
      issueCoupon,
      requestCouponUse,
      cancelCouponRequest,
      approveCouponUse,
      rejectCouponUse,
      addTable,
      updateTableLayout,
      deleteTable,
      updateTableStatus,
      initTables,
      addSection,
      updateSection,
      deleteSection,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      placeOrder,
      updateOrderStatus,
      payTableSession,
      approvePayment,
      completeTable,
      printInterimReceipt,
      recordCommunication,
      updateUserMemo,
      setCustomerTier,
      bulkIssueCoupon,
      updateBrandSettings,
      updateStoreConfig,
      updateStoreLocation,
      addReservation,
      updateReservation,
      deleteReservation,
      addPhoto,
      updatePhoto,
      deletePhoto,
      requestJoinStore,
      cancelJoinRequest,
      approveStaff,
      rejectStaff,
      removeStaffMembership,
      clockIn,
      clockOut,
    ]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}
