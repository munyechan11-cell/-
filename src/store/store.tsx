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
import { db, isFirebaseConfigured } from "../lib/firebase";
import { updateFirestoreDoc, flushOfflineQueue } from "../lib/firestore";
import { calculateAgeGroup } from "../lib/auth";
import { generateId, digitsOnly } from "../lib/ids";
import { showToast } from "../lib/toast";
import { getCustomerTier } from "../lib/tier";
import { relayOrderToPos } from "../lib/pos";
import { printReceipt } from "../lib/receipt";
import { printReceiptViaUsb, getAuthorizedPrinters } from "../lib/thermalPrinter";
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
  /** 현재 테이블의 미결제 주문 일괄 결제 처리. 결제 합계 반환. */
  payTableSession: (
    customerId: string,
    storeId: string,
    tableNumber: number
  ) => Promise<number>;

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
  privacyAgreedAt?: string;
  posVendor?: string;
  posApiKey?: string;
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

    // Always subscribe to users (login matching needs full list)
    const usersUnsub = onSnapshot(
      collection(db, "users"),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User))),
      (err) => {
        console.error("[users listener]", err);
        setFirebaseError(err.message);
        setFirebaseStatus("error");
      }
    );

    // Master password
    getDoc(doc(db, "appState", "settings")).then((s) => {
      if (s.exists()) {
        const data = s.data() as any;
        if (data.masterPassword) setMasterPasswordState(data.masterPassword);
      }
    });

    setReady(true);
    return () => {
      usersUnsub();
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
  }, [currentUser?.id, currentUser?.role]);

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
        if (input.privacyAgreedAt) patch.privacyAgreedAt = input.privacyAgreedAt;

        await updateFirestoreDoc("users", match.id, patch);
        const final = { ...match, ...patch } as User;
        setCurrentUser(final);
        showToast(`${final.name}님 환영합니다!`, "success");
        return final;
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

      // 3) Table state — 유령 테이블 생성 방지: 실제 존재할 때만 업데이트
      const tableId = `${storeId}_${tableNumber}`;
      const tableExists = tables.some((t) => t.id === tableId);
      if (tableExists) {
        await updateFirestoreDoc("tables", tableId, {
          currentCustomerId: customerId,
          sessionStartTime: new Date().toISOString(),
          status: "occupied",
        });
      } else {
        console.warn(`[recordVisit] table ${tableId} not found; visit recorded without table state update.`);
      }

      if (!alreadyToday) showToast("방문이 기록되었습니다.", "success");
    },
    [setCurrentUser]
  );

  const leaveTable = useCallback(async (tableNumber: number, storeId: string) => {
    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc("tables", tableId, {
      currentCustomerId: null,
      sessionStartTime: null,
      status: "dirty",
    });
  }, []);

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
      if (status === "available") {
        patch.currentCustomerId = null;
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

      const owner = users.find((u) => u.id === storeId && u.role === "owner");
      const hasPosApi =
        owner?.posVendor && owner.posVendor !== "none" && owner.posApiKey;

      // 인쇄 시도: ① POS API → ② USB 프린터 직결 → ③ 브라우저 팝업 (폴백)
      const tryThermalThenPopup = async (failureFooter?: string) => {
        try {
          const printers = await getAuthorizedPrinters();
          if (printers.length > 0) {
            await printReceiptViaUsb({
              storeName: owner?.restaurantName ?? "결",
              order,
              footer: failureFooter,
            });
            return;
          }
        } catch (e) {
          console.warn("[thermal print failed, falling back to popup]", e);
        }
        printReceipt({
          storeName: owner?.restaurantName ?? "결",
          order,
          footer: failureFooter,
        });
      };

      if (hasPosApi || owner?.foodtechStoreCode) {
        const apiKey = owner?.posApiKey || owner?.foodtechStoreCode || "";
        const ok = await relayOrderToPos(
          apiKey,
          order,
          (mid) => menus.find((m) => m.id === mid)?.posProductCode,
          owner?.posVendor
        );
        if (!ok) {
          showToast("POS 전달 실패. 영수증을 인쇄합니다.", "info");
          await tryThermalThenPopup("POS 전송 실패 - 수동 처리 필요");
        }
      } else {
        // POS 미설정 → 영수증 인쇄 (USB 프린터 있으면 직결, 없으면 팝업)
        await tryThermalThenPopup();
      }

      showToast("주문이 접수되었습니다.", "success");
      return order;
    },
    [users, menus]
  );

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    await updateFirestoreDoc("orders", id, { status });
  }, []);

  const payTableSession = useCallback(
    async (customerId: string, storeId: string, tableNumber: number): Promise<number> => {
      const ordersNow = ordersRef.current;
      const tablesNow = tablesRef.current;
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
        // 오프라인: 개별로 큐에 적재
        for (const o of unpaid) {
          await updateFirestoreDoc("orders", o.id, { paymentStatus: "paid" });
        }
      } else {
        const batch = writeBatch(db);
        unpaid.forEach((o) => {
          batch.set(doc(db!, "orders", o.id), { paymentStatus: "paid" }, { merge: true });
        });
        const tableId = `${storeId}_${tableNumber}`;
        if (tablesNow.some((t) => t.id === tableId)) {
          batch.set(doc(db, "tables", tableId), { status: "paid" }, { merge: true });
        }
        await batch.commit();
      }

      showToast(`₩ ${total.toLocaleString()} 결제 완료`, "success");
      return total;
    },
    []
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
    ]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}
