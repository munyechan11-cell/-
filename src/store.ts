import { useState, useEffect } from 'react';
import { db, auth, isFirebaseConfigured, collections } from './lib/firebase';
import { 
  doc, onSnapshot, setDoc, updateDoc, addDoc, deleteDoc, 
  query, where, getDocs, writeBatch, getDoc 
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

// 타임스탬프 + 랜덤 조합으로 ID 충돌 위험을 최소화하는 고유 ID 생성기
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

declare global {
  interface Window {
    Kakao: any;
  }
}

// 전화번호 자동 하이픈 및 유효성 검사
export const formatPhoneNumber = (value: string) => {
  const nums = value.replace(/[^0-9]/g, '');
  if (nums.length <= 3) return nums;
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
};

export type Role = 'customer' | 'owner';

export interface StoreConfig {
  industry: 'cafe' | 'meat' | 'bakery' | 'general';
  rewardType: 'point' | 'stamp';
  pointRate?: number; // e.g., 5%
  stampMax?: number; // e.g., 10 stamps for reward
  marketingTriggers?: {
    inactiveDays: number;
    birthdayCoupon: boolean;
  };
  smsApiKey?: string; // New: Aligo/Twilio API Key
  alimtalkSenderId?: string; // New: Kakao Alimtalk Sender Profile
  defaultDashboardView?: 'grid' | 'map'; // New: Default landing view
  crmCustomInsights?: Record<string, string>; // New: Customizable marketing insights
  locationAccessOnly?: boolean; // New: Restrict access by GPS
  allowedRadius?: number; // New: Allowed radius in meters
}

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  restaurantName?: string;
  storeId?: string;
  googleId?: string;
  kakaoId?: string;
  socialIds?: string[];
  authType?: 'phone' | 'google' | 'kakao';
  status?: 'active' | 'deleted';
  linkedProviders?: ('google' | 'kakao')[];
  isPohangResident?: boolean;
  gender?: 'male' | 'female';
  memo?: string;
  tierNames?: Record<string, string>; // { 'VIP': '단골마스터', ... }
  tierRewards?: Record<string, string>; // { 'VIP': '특별 서비스 제공', ... }
  avatarUrl?: string; // New: social profile image
  aligoKey?: string;
  aligoUserId?: string;
  aligoSender?: string;
  smsGatewayUrl?: string;
  storeConfig?: StoreConfig; // New: Multi-tenancy config
  rewardBalance?: number; // New: Accumulated points or stamps
  lat?: number; // New: Store Latitude
  lng?: number; // New: Store Longitude
}

export interface Visit {
  id: string;
  customerId: string;
  storeId: string;
  date: string; // ISO string
  tableNumber: number;
  totalAmount?: number; // New: Monetary value for RFM
}

export interface Coupon {
  id: string;
  customerId: string;
  storeId: string;
  type: string;
  description: string;
  status: 'available' | 'pending' | 'used';
  issuedAt: string;
  usedAt?: string;
  usedAtTable?: number;
}

export interface Table {
  number: number;
  storeId: string;
  currentCustomerId: string | null;
  sessionStartTime: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  seats: number;
  isRoom?: boolean;
  type?: 'table' | 'room' | 'corridor' | 'pos' | 'door';
  shape?: 'square' | 'circle';
  sectionId?: string; // New: Section association
  status?: 'available' | 'occupied' | 'paid' | 'dirty'; // New: Toast POS status
}

export interface Section {
  id: string;
  storeId: string;
  name: string;
  order: number;
}

export interface Communication {
  id: string;
  customerId: string;
  storeId: string;
  type: 'coupon' | 'message';
  senderRole?: Role; // 발신자 정보 (사장님/고객)
  content: string;
  date: string;
}

export interface TierOverride {
  customerId: string;
  storeId: string;
  tier: string;
}

export interface MenuItem {
  id: string;
  storeId: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
  isAvailable?: boolean;
}

export interface StoreOrder {
  id: string;
  storeId: string;
  tableNumber: number;
  customerId: string;
  items: { 
    menuId: string; 
    name: string; 
    quantity: number; 
    price: number; 
  }[];
  totalAmount: number;
  status: 'pending' | 'accepted' | 'cooking' | 'served' | 'cancelled';
  createdAt: string;
}

// Global in-memory state
const globalState: Record<string, any> = {
  users: [],
  visits: [],
  coupons: [],
  tables: [],
  sections: [],
  communications: [],
  tierOverrides: [],
  menus: [],
  orders: [],
  masterPassword: 'IMC',
  offlineQueue: [] // New: Queue for offline mutations
};

// Snapshot & Rollback Utility for Optimistic UI
const createSnapshot = () => {
  return JSON.parse(JSON.stringify(globalState));
};

const rollback = (snapshot: any) => {
  Object.assign(globalState, snapshot);
  window.dispatchEvent(new Event('global-storage-update'));
};

let isInitialized = false;
let globalIsReady = false;
let globalReadyStates: Record<string, boolean> = {
  users: false,
  visits: false,
  coupons: false,
  tables: false,
  menus: false,
  orders: false
};
let globalFirebaseStatus: 'connecting' | 'connected' | 'error' | 'offline' = isFirebaseConfigured ? 'connecting' : 'offline';
let globalFirebaseError: string | null = null;
let currentDb = db;
let currentCollections = collections;
let activeListeners: (() => void)[] = [];

// Manual fallback trigger from UI
window.addEventListener('force-firebase-fallback', async () => {
  console.info("[Firebase] Manual fallback triggered. Switching to (default) database...");
  try {
    const { getDb, getCollections } = await import('./lib/firebase');
    const fallbackDb = getDb('(default)');
    const fallbackColls = getCollections(fallbackDb);
    if (fallbackDb && fallbackColls) {
      currentDb = fallbackDb;
      currentCollections = fallbackColls;
      startSync(currentDb, currentCollections);
    }
  } catch (e) {
    console.error('[Firebase] Manual fallback failed', e);
  }
});

const notifyUpdate = () => {
  // 소폭 지연을 주어 대량 업데이트 시 UI 렌더링이 꼬이지 않도록 보증
  setTimeout(() => {
    window.dispatchEvent(new Event('global-storage-update'));
  }, 10);
};

const cleanupListeners = () => {
  activeListeners.forEach(unsub => unsub());
  activeListeners = [];
};

// --- COLLECTION SUBSCRIPTIONS ---
const startSync = (database: any, colls: any) => {
  if (!database || !colls) return;
  cleanupListeners();

  const syncCollection = (collName: string, stateKey: string) => {
    if (!colls || !colls[collName as keyof typeof colls]) {
      console.warn(`Collection ${collName} not found, skipping sync.`);
      return;
    }

    const unsub = onSnapshot(colls[collName as keyof typeof colls], (snap) => {
      globalState[stateKey] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      globalFirebaseStatus = 'connected';
      globalReadyStates[stateKey] = true;
      // 필수 컬렉션들이 오면 Ready로 간주
      if (globalReadyStates.users && globalReadyStates.tables) {
         globalIsReady = true;
      }
      notifyUpdate();
    }, (err) => {
      console.error(`Error syncing ${collName}:`, err);
      let userMessage = err.message;
      
      // 구체적인 에러 원인 분석 및 사용자 친화적 메시징
      if (err.code === 'permission-denied') {
        userMessage = `[권한 차단] 데이터베이스는 존재하나 접근 권한이 없습니다 (보안 규칙 문제).`;
      } else if (err.code === 'not-found' || err.message.includes('not found')) {
        userMessage = `[DB 미생성] Firebase 프로젝트 내에 Firestore 데이터베이스가 아직 만들어지지 않았습니다.`;
      }
      
      globalFirebaseStatus = 'error';
      globalFirebaseError = userMessage;
      globalIsReady = true;
      notifyUpdate();
    });
    if (unsub) {
      activeListeners.push(unsub);
    }
  };

  syncCollection('users', 'users');
  syncCollection('visits', 'visits');
  syncCollection('coupons', 'coupons');
  syncCollection('tables', 'tables');
  syncCollection('sections', 'sections'); // New: Sync sections
  syncCollection('Communications', 'communications');
  syncCollection('tierOverrides', 'tierOverrides');
  syncCollection('menus', 'menus');
  syncCollection('orders', 'orders');
  
  const unsubSettings = onSnapshot(doc(database, 'appState', 'settings'), (snap) => {
    if (snap.exists()) {
      globalState.masterPassword = snap.data().masterPassword || 'IMC';
      notifyUpdate();
    }
  });
  activeListeners.push(unsubSettings);
};

// Fallback to local storage if Firebase is not configured
if (!isFirebaseConfigured) {
  const savedState = localStorage.getItem('offline_global_state');
  if (savedState) {
    try {
      Object.assign(globalState, JSON.parse(savedState));
    } catch (e) {}
  }
  isInitialized = true;
  globalIsReady = true;
} else if (db && collections) {
  // --- MIGRATION LOGIC (One-time) ---
  const migrateData = async () => {
    try {
      const settingsDocRef = doc(db, 'appState', 'settings');
      const settingsSnap = await getDoc(settingsDocRef);
      
      if (settingsSnap.exists() && settingsSnap.data().migration_complete) return;

      const globalDocRef = doc(db, 'appState', 'global');
      const snap = await getDoc(globalDocRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const batch = writeBatch(db);
        const cats = ['users', 'visits', 'coupons', 'tables', 'sections', 'communications', 'tierOverrides', 'menus', 'orders'];
        for (const cat of cats) {
          if (Array.isArray(data[cat])) {
            for (const item of data[cat]) {
              const itemRef = doc(db, cat, item.id || (cat === 'tables' ? `${item.storeId}_${item.number}` : item.id));
              batch.set(itemRef, item, { merge: true });
            }
          }
        }
        batch.set(settingsDocRef, { migration_complete: true, masterPassword: data.masterPassword || 'IMC' }, { merge: true });
        batch.delete(globalDocRef);
        await batch.commit();
      }
    } catch (err: any) {}
  };
  migrateData();

  // Initial Sync
  startSync(currentDb, currentCollections);

  // Final Timeout Check
  setTimeout(() => {
    if (!globalIsReady) {
      globalIsReady = true;
      globalFirebaseStatus = 'offline';
      notifyUpdate();
    }
  }, 10000);

} else {
  globalIsReady = true;
  globalFirebaseStatus = 'offline';
}

export const getLocalStorage = <T>(key: string, initialValue: T): T => {
  const item = localStorage.getItem(key);
  if (item) {
    try {
      return JSON.parse(item);
    } catch (e) {
      console.error(`Error parsing ${key} from localStorage`, e);
    }
  }
  return initialValue;
};

export const setLocalStorage = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('local-storage-update'));
};

export const getGlobalStorage = <T>(key: string, initialValue: T): T => {
  return globalState[key] !== undefined ? globalState[key] : initialValue;
};

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
  if (navigator.vibrate) {
    if (type === 'success') navigator.vibrate([100]);
    else if (type === 'error') navigator.vibrate([50, 50, 50]);
  }
};

// --- IMPROVED GRANULAR MUTATIONS ---
const updateFirestoreDoc = async (coll: string, id: string, data: any, isDelete = false) => {
  // Snapshot for Rollback
  const snapshot = createSnapshot();

  // Optimistic UI Update: 서버 저장 여부와 상관없이 로컬 메모리 즉각 업데이트
  if (isDelete) {
    globalState[coll] = globalState[coll].filter((item: any) => item.id !== id);
  } else {
    const idx = globalState[coll].findIndex((item: any) => (item.id === id || (coll === 'tables' && `${item.storeId}_${item.number}` === id)));
    if (idx !== -1) {
      globalState[coll][idx] = { ...globalState[coll][idx], ...data };
    } else {
      globalState[coll].push({ ...data, id });
    }
  }
  notifyUpdate();

  if (!isFirebaseConfigured || !db) {
    localStorage.setItem('offline_global_state', JSON.stringify(globalState));
    // Offline Queue
    globalState.offlineQueue.push({ coll, id, data, isDelete, timestamp: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(globalState.offlineQueue));
    return;
  }

  try {
    const docRef = doc(db, coll, id);
    if (isDelete) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, data, { merge: true });
    }
  } catch (e: any) {
    console.error(`[Firebase] Mutation failed for ${coll}/${id}. Rolling back...`, e);
    rollback(snapshot);
    
    // Provide specific error messages for better debugging
    let userMsg = '네트워크 오류로 작업이 취소되었습니다.';
    if (e.code === 'permission-denied') userMsg = '접근 권한이 없습니다. (Firebase 보안 규칙 확인 필요)';
    if (e.code === 'not-found') userMsg = '데이터베이스 경로를 찾을 수 없습니다.';
    if (e.message?.includes('database')) userMsg = '데이터베이스 설정 오류가 발생했습니다.';
    
    showToast(`${userMsg} 다시 시도해 주세요.`, 'error');
    
    // Fail-safe: add to offline queue if it was a network issue rather than auth/schema issue
    if ((e as any).code === 'unavailable' || (e as any).code === 'deadline-exceeded') {
       globalState.offlineQueue.push({ coll, id, data, isDelete, timestamp: Date.now() });
       localStorage.setItem('offline_queue', JSON.stringify(globalState.offlineQueue));
    }
    throw e;
  }
};

export const useStore = () => {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<'loading' | 'stable' | 'error' | 'offline'>('loading');
  const [firebaseError, setFirebaseError] = useState(globalFirebaseError);
  const [users, setUsers] = useState<User[]>(getGlobalStorage('users', []));
  const [visits, setVisits] = useState<Visit[]>(getGlobalStorage('visits', []));
  const [coupons, setCoupons] = useState<Coupon[]>(getGlobalStorage('coupons', []));
  const [tables, setTables] = useState<Table[]>(getGlobalStorage('tables', []));
  const [sections, setSections] = useState<Section[]>(getGlobalStorage('sections', []));
  const [communications, setCommunications] = useState<Communication[]>(getGlobalStorage('communications', []));
  const [tierOverrides, setTierOverrides] = useState<TierOverride[]>(getGlobalStorage('tierOverrides', []));
  const [menus, setMenus] = useState<MenuItem[]>(getGlobalStorage('menus', []));
  const [orders, setOrders] = useState<StoreOrder[]>(getGlobalStorage('orders', []));
  const [masterPassword, setMasterPasswordState] = useState<string>(globalState.masterPassword);
  const [currentUser, setCurrentUser] = useState<User | null>(getLocalStorage('currentUser', null));
  const [ownerViewMode, setOwnerViewModeState] = useState<'desktop' | 'mobile'>(
    (localStorage.getItem('ownerViewMode') as 'desktop' | 'mobile') || 'desktop'
  );

  const setOwnerViewMode = (mode: 'desktop' | 'mobile') => {
    setOwnerViewModeState(mode);
    localStorage.setItem('ownerViewMode', mode);
    window.dispatchEvent(new Event('local-storage-update'));
  };

  // 6단계 고도화: Scoped Listener & Optimistic UI
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !collections) return;

    let unsubscribes: (() => void)[] = [];

    // Offline Queue Processor
    const processQueue = async () => {
      const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
      if (queue.length === 0) return;
      
      console.info(`[Offline] Processing ${queue.length} queued items...`);
      const remaining = [];
      for (const item of queue) {
        try {
          const docRef = doc(db, item.coll, item.id);
          if (item.isDelete) await deleteDoc(docRef);
          else await setDoc(docRef, item.data, { merge: true });
        } catch (e) {
          remaining.push(item);
        }
      }
      globalState.offlineQueue = remaining;
      localStorage.setItem('offline_queue', JSON.stringify(remaining));
      if (remaining.length === 0) showToast('오프라인 작업이 모두 동기화되었습니다.', 'success');
    };

    window.addEventListener('online', processQueue);
    processQueue();

    const startScopedListeners = (storeId: string) => {
      console.info(`[Sync] Starting scoped listeners for Store: ${storeId}`);
      
      // Cleanup previous before starting new
      unsubscribes.forEach(unsub => unsub());
      unsubscribes = [];

      let readyCount = 0;
      const checkAllReady = () => {
        readyCount++;
        // tables, users are the minimum required for a stable dashboard
        if (readyCount >= 2) {
          setFirebaseStatus('stable');
          globalIsReady = true;
          setIsReady(true);
          notifyUpdate();
        }
      };

      const collectionMapping = [
        { key: 'tables', coll: collections.tables, filterField: 'storeId' },
        { key: 'visits', coll: collections.visits, filterField: 'storeId' },
        { key: 'coupons', coll: collections.coupons, filterField: 'storeId' },
        { key: 'communications', coll: collections.Communications, filterField: 'storeId' },
        { key: 'sections', coll: collections.sections, filterField: 'storeId' },
        { key: 'tierOverrides', coll: collections.tierOverrides, filterField: 'storeId' },
        { key: 'menus', coll: collections.menus, filterField: 'storeId' },
        { key: 'orders', coll: collections.orders, filterField: 'storeId' }
      ];

      collectionMapping.forEach(({ key, coll, filterField }) => {
        const unsub = onSnapshot(query(coll, where(filterField, '==', storeId)), (snapshot) => {
          const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
          globalState[key] = data;
          
          if (key === 'tables') checkAllReady();

          // Trigger React state updates for the specific key
          switch(key) {
            case 'tables': setTables(data as Table[]); break;
            case 'visits': setVisits(data as Visit[]); break;
            case 'coupons': setCoupons(data as Coupon[]); break;
            case 'communications': setCommunications(data as Communication[]); break;
            case 'sections': setSections(data as Section[]); break;
            case 'tierOverrides': setTierOverrides(data as TierOverride[]); break;
            case 'menus': setMenus(data as MenuItem[]); break;
            case 'orders': setOrders(data as StoreOrder[]); break;
          }
          notifyUpdate();
        });
        unsubscribes.push(unsub);
      });

      // Special case: Users belonging to this store
      unsubscribes.push(onSnapshot(query(collections.users, where('storeId', '==', storeId)), (snapshot) => {
        const storeCustomers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        globalState.users = Array.from(new Map([...globalState.users, ...storeCustomers].map(u => [u.id, u])).values());
        setUsers(globalState.users);
        checkAllReady();
        notifyUpdate();
      }));
    };

    // 사용자의 현재 매장 ID 감지
    const activeStoreId = currentUser?.storeId || (currentUser?.role === 'owner' ? currentUser.id : null);
    
    if (activeStoreId) {
      startScopedListeners(activeStoreId);
    } else {
      // 전역 사용자 정보만 구독 (로그인 전 또는 마스터용)
      unsubscribes.push(onSnapshot(collections?.users, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        globalState.users = data;
        setUsers(data);
        notifyUpdate();
        setFirebaseStatus('stable');
        globalIsReady = true;
        setIsReady(true);
      }));
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
      window.removeEventListener('online', processQueue);
    };
  }, [currentUser, db, isFirebaseConfigured, collections]);

  const addSection = async (storeId: string, name: string) => {
    const newSection: Section = { id: generateId(), storeId, name, order: globalState.sections.length };
    globalState.sections.push(newSection);
    notifyUpdate();
    await updateFirestoreDoc('sections', newSection.id, newSection);
  };

  const updateSection = async (sectionId: string, name: string) => {
    const idx = globalState.sections.findIndex((s: any) => s.id === sectionId);
    if (idx !== -1) {
      globalState.sections[idx] = { ...globalState.sections[idx], name };
      notifyUpdate();
      await updateFirestoreDoc('sections', sectionId, { name });
    }
  };

  const deleteSection = async (storeId: string, sectionId: string) => {
    globalState.tables.forEach(async (table: Table) => {
      if (table.storeId === storeId && table.sectionId === sectionId) {
        const id = `${table.storeId}_${table.number}`;
        table.sectionId = undefined;
        await updateFirestoreDoc('tables', id, { sectionId: null });
      }
    });
    globalState.sections = globalState.sections.filter((s: any) => s.id !== sectionId);
    notifyUpdate();
    await updateFirestoreDoc('sections', sectionId, null, true);
  };

  const updateTableStatus = async (storeId: string, tableNumber: number, status: Table['status']) => {
    const id = `${storeId}_${tableNumber}`;
    const idx = globalState.tables.findIndex((t: any) => t.storeId === storeId && t.number === tableNumber);
    
    if (idx !== -1) {
      // Optimistic Update with Rollback
      const previousStatus = globalState.tables[idx].status;
      globalState.tables[idx].status = status;
      notifyUpdate();

      try {
        await updateFirestoreDoc('tables', id, { status });
      } catch (e) {
        console.error("Optimistic Update Failed, rolling back...", e);
        globalState.tables[idx].status = previousStatus;
        notifyUpdate();
        showToast('네트워크 오류로 상태 업데이트에 실패했습니다. 다시 시도해 주세요.', 'error');
      }
    }
  };

  const login = async (phone: string, name: string, role: Role, restaurantName?: string, storeId?: string, socialProvider?: 'google' | 'kakao', isPohangResident?: boolean, gender?: 'male' | 'female') => {
    let socialId = '';
    let socialEmail = '';
    let socialName = '';
    let socialAvatar = '';

    try {
      if (socialProvider === 'google') {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth!, provider);
        socialId = result.user.uid;
        socialEmail = result.user.email || '';
        socialName = result.user.displayName || '';
        socialAvatar = result.user.photoURL || '';
      } else if (socialProvider === 'kakao') {
        const kakaoData: any = await new Promise((resolve, reject) => {
          if (!(window as any).Kakao) return reject(new Error('카카오 SDK가 로드되지 않았습니다.'));
          (window as any).Kakao.Auth.login({
            success: () => {
              (window as any).Kakao.API.request({
                url: '/v2/user/me',
                success: (res: any) => resolve(res),
                fail: reject
              });
            },
            fail: reject
          });
        });
        socialId = kakaoData.id.toString();
        socialName = kakaoData.kakao_account?.profile?.nickname || '';
        socialAvatar = kakaoData.kakao_account?.profile?.thumbnail_image_url || '';
      }
    } catch (e: any) {
      showToast('소셜 연동 실패: ' + (e.message || '인증 과정에서 오류가 발생했습니다.'), 'error');
      throw e;
    }

    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    
    // 1. 소셜 ID로 먼저 검색
    let user = users.find(u => 
      (socialId && (u.googleId === socialId || u.kakaoId === socialId || u.socialIds?.includes(socialId))) && 
      u.role === role && 
      (role === 'owner' || u.storeId === storeId)
    );

    // 2. 소셜 ID가 없으면 전화번호로 검색
    if (!user && cleanPhone) {
      user = users.find(u => 
        u.phone.replace(/[^0-9]/g, '') === cleanPhone && 
        u.role === role && 
        (role === 'owner' || u.storeId === storeId)
      );
    }

    if (user) {
      // 이미 탈퇴한 계정인 경우 복구 또는 에러 처리 (여기서는 복구로 처리)
      const updates: Partial<User> = { status: 'active' };
      if (socialId) {
        if (socialProvider === 'google' && user.googleId !== socialId) updates.googleId = socialId;
        if (socialProvider === 'kakao' && user.kakaoId !== socialId) updates.kakaoId = socialId;
        if (!user.socialIds?.includes(socialId)) updates.socialIds = [...(user.socialIds || []), socialId];
        if (!user.linkedProviders?.includes(socialProvider!)) updates.linkedProviders = [...(user.linkedProviders || []), socialProvider!];
        if (socialAvatar) updates.avatarUrl = socialAvatar;
      }
      
      if (Object.keys(updates).length > 0) {
        user = { ...user, ...updates };
        await updateFirestoreDoc('users', user.id, updates);
      }
    } else {
      // 신규 생성
      user = {
        id: generateId(),
        role,
        name: socialName || name || '익명',
        phone: cleanPhone,
        restaurantName,
        storeId,
        googleId: socialProvider === 'google' ? socialId : undefined,
        kakaoId: socialProvider === 'kakao' ? socialId : undefined,
        socialIds: socialId ? [socialId] : [],
        authType: socialProvider || 'phone',
        status: 'active',
        linkedProviders: socialProvider ? [socialProvider] : [],
        isPohangResident,
        gender,
        avatarUrl: socialAvatar
      };
      await updateFirestoreDoc('users', user.id, user);
      
      if (role === 'owner') {
        if (!db) {
          showToast('데이터베이스가 연결되지 않아 초기화가 불가능합니다.', 'error');
          return user;
        }
        const batch = writeBatch(db);
        for (let i = 1; i <= 15; i++) {
          const tableId = `${user.id}_${i}`;
          const x = ((i - 1) % 5) * 120 + 40;
          const y = Math.floor((i - 1) / 5) * 120 + 40;
          const tableRef = doc(db!, 'tables', tableId);
          batch.set(tableRef, { 
            number: i, storeId: user.id, currentCustomerId: null, sessionStartTime: null,
            x, y, width: 90, height: 90, isRoom: false, seats: 4, shape: 'square', status: 'available'
          });
        }
        await batch.commit();
      }
    }
    
    setLocalStorage('currentUser', user);
    setCurrentUser(user);
    showToast(`${user.name}님 환영합니다!`, 'success');
    return user;
  };

  const linkSocialAccount = async (provider: 'google' | 'kakao') => {
    if (!currentUser) throw new Error('로그인이 필요합니다.');
    
    let socialId = '';
    let socialAvatar = '';
    if (provider === 'google') {
      const authProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth!, authProvider);
      socialId = result.user.uid;
      socialAvatar = result.user.photoURL || '';
    } else if (provider === 'kakao') {
      const kakaoData: any = await new Promise((resolve, reject) => {
        if (!(window as any).Kakao) return reject(new Error('카카오 SDK가 로드되지 않았습니다.'));
        (window as any).Kakao.Auth.login({
          success: () => {
            (window as any).Kakao.API.request({
              url: '/v2/user/me',
              success: (res: any) => resolve(res),
              fail: reject
            });
          },
          fail: reject
        });
      });
      socialId = kakaoData.id.toString();
      socialAvatar = kakaoData.kakao_account?.profile?.thumbnail_image_url || '';
    }

    // 이미 다른 계정에 연결되어 있는지 확인
    const existingUser = users.find(u => 
      (u.googleId === socialId || u.kakaoId === socialId || u.socialIds?.includes(socialId)) && 
      u.id !== currentUser.id && u.role === currentUser.role
    );

    if (existingUser) {
      throw new Error(`해당 ${provider === 'google' ? '구글' : '카카오'} 계정은 이미 다른 회원정보와 연동되어 있습니다.`);
    }

    const updates: Partial<User> = {
      socialIds: Array.from(new Set([...(currentUser.socialIds || []), socialId])),
      linkedProviders: Array.from(new Set([...(currentUser.linkedProviders || []), provider]))
    };
    if (provider === 'google') updates.googleId = socialId;
    if (provider === 'kakao') updates.kakaoId = socialId;
    if (socialAvatar && !currentUser.avatarUrl) updates.avatarUrl = socialAvatar;

    await updateFirestoreDoc('users', currentUser.id, updates);
    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    setLocalStorage('currentUser', updatedUser);
    showToast(`${provider === 'google' ? '구글' : '카카오'} 계정이 연동되었습니다.`, 'success');
  };

  const deleteAccount = async () => {
    if (!currentUser) return;
    
    // Soft Delete: 정보 익명화 및 상태 변경
    const updates = {
      name: '삭제된 계정',
      phone: '',
      status: 'deleted',
      googleId: null,
      kakaoId: null,
      socialIds: []
    };
    
    await updateFirestoreDoc('users', currentUser.id, updates);
    showToast('계정이 정상적으로 삭제되었습니다.', 'info');
    logout();
  };

  const logout = () => {
    if (auth) auth.signOut().catch(console.error);
    setLocalStorage('currentUser', null);
    setCurrentUser(null);
    showToast('로그아웃 되었습니다.', 'info');
  };

  const recordVisit = async (customerId: string, tableNumber: number, storeId: string, amount?: number) => {
    // 10초 이내 동일 매장/테이블 중복 기록 방지 (레이스 컨디션 방어)
    const lastVisitKey = `last_visit_${customerId}_${storeId}`;
    const lastVisitTime = parseInt(sessionStorage.getItem(lastVisitKey) || '0');
    if (Date.now() - lastVisitTime < 10000) return;
    sessionStorage.setItem(lastVisitKey, Date.now().toString());

    const today = new Date().toDateString();
    const hasVisitedToday = visits.some(v => v.customerId === customerId && v.storeId === storeId && new Date(v.date).toDateString() === today);

    if (!hasVisitedToday) {
      const visit: Visit = { 
        id: generateId(), 
        customerId, 
        storeId, 
        date: new Date().toISOString(), 
        tableNumber,
        totalAmount: amount || 0 // New: Monetary value for RFM
      };
      await updateFirestoreDoc('visits', visit.id, visit);
      checkAndIssueTierCoupons(customerId, storeId, [...visits, visit]);

      // Update user's reward balance if store config exists
      const owner = users.find(u => u.id === storeId);
      const customer = users.find(u => u.id === customerId);
      if (owner?.storeConfig && customer) {
        const increment = owner.storeConfig.rewardType === 'stamp' ? 1 : Math.floor((amount || 10000) * (owner.storeConfig.pointRate || 0.05));
        const currentBalance = customer.rewardBalance || 0;
        await updateFirestoreDoc('users', customerId, { rewardBalance: currentBalance + increment });
      }
    }

    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc('tables', tableId, { 
      currentCustomerId: customerId, 
      sessionStartTime: new Date().toISOString(),
      status: 'occupied'
    });
    showToast('방문이 기록되었습니다.', 'success');
  };

  const leaveTable = async (tableNumber: number, storeId: string) => {
    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc('tables', tableId, { 
      currentCustomerId: null, 
      sessionStartTime: null,
      status: 'dirty'
    });
    showToast('퇴장 처리되었습니다.', 'info');
  };

  const checkAndIssueTierCoupons = (customerId: string, storeId: string, allVisits: Visit[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentVisits = allVisits.filter(v => v.customerId === customerId && v.storeId === storeId && new Date(v.date) >= thirtyDaysAgo);
    const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;

    let reward = null, tier = '';
    if (reward) {
      const owner = users.find(u => u.id === storeId);
      const customReward = owner?.tierRewards?.[tier];
      issueCoupon(customerId, storeId, `${owner?.tierNames?.[tier] || tier} 등급 달성`, customReward || reward);
    }
  };

  const issueCoupon = async (customerId: string, storeId: string, type: string, description: string) => {
    const coupon = { id: generateId(), customerId, storeId, type, description, status: 'available' as const, issuedAt: new Date().toISOString() };
    await updateFirestoreDoc('coupons', coupon.id, coupon);
    showToast(`쿠폰 발급: ${description}`, 'success');
  };

  const requestCouponUse = async (couponId: string, tableNumber?: number) => {
    await updateFirestoreDoc('coupons', couponId, { status: 'pending', usedAtTable: tableNumber });
    showToast('사용 요청을 보냈습니다.', 'success');
  };

  const cancelCouponRequest = async (couponId: string) => {
    await updateFirestoreDoc('coupons', couponId, { status: 'available', usedAtTable: null });
    showToast('사용 요청을 취소했습니다.', 'info');
  };

  const approveCouponUse = async (couponId: string) => {
    await updateFirestoreDoc('coupons', couponId, { status: 'used', usedAt: new Date().toISOString() });
    showToast('쿠폰 사용을 승인했습니다.', 'success');
  };

  const rejectCouponUse = async (couponId: string) => {
    await updateFirestoreDoc('coupons', couponId, { status: 'available', usedAtTable: null });
    showToast('쿠폰 사용을 거절했습니다.', 'info');
  };

  const initTables = async (storeId: string) => {
    if (!db || !collections) {
      showToast('데이터베이스가 아직 준비되지 않았습니다.', 'error');
      return;
    }
    
    try {
      const batch = writeBatch(db);
      
      // 1. Find and delete existing tables first
      const q = query(collections.tables, where('storeId', '==', storeId));
      const existingSnaps = await getDocs(q);
      existingSnaps.forEach(d => batch.delete(d.ref));
      
      // 2. Create 15 default tables in a 5x3 grid
      for (let i = 1; i <= 15; i++) {
        const tableId = `${storeId}_${i}`;
        const x = ((i - 1) % 5) * 120 + 40;
        const y = Math.floor((i - 1) / 5) * 120 + 40;
        const tableRef = doc(db, 'tables', tableId);
        
        const newTable: Table = { 
          number: i, storeId, currentCustomerId: null, sessionStartTime: null, 
          x, y, width: 90, height: 90, seats: 4, type: 'table', shape: 'square', status: 'available' 
        };
        batch.set(tableRef, newTable);
      }

      await batch.commit();
      showToast('15개 기본 테이블로 초기화되었습니다.', 'success');
    } catch (err) {
      console.error('Error initializing tables:', err);
      showToast('테이블 초기화 중 오류가 발생했습니다.', 'error');
    }
  };

  const setCustomerTier = async (customerId: string, storeId: string, tier: string) => {
    const id = `${customerId}_${storeId}`;
    if (tier === 'auto') {
      await updateFirestoreDoc('tierOverrides', id, null, true);
    } else {
      await updateFirestoreDoc('tierOverrides', id, { customerId, storeId, tier });
    }
  };

  const updateTableLayout = async (storeId: string, tableNumber: number, data: Partial<Table>) => {
    if (!currentUser || currentUser.id !== storeId) return;
    const id = `${storeId}_${tableNumber}`;
    const idx = globalState.tables.findIndex((t: any) => t.storeId === storeId && t.number === tableNumber);
    if (idx !== -1) {
      // Clean undefined values from data
      const cleanData = { ...data };
      if ('sectionId' in cleanData && cleanData.sectionId === undefined) {
        cleanData.sectionId = null as any;
      }
      
      globalState.tables[idx] = { ...globalState.tables[idx], ...cleanData };
      notifyUpdate();
      await updateFirestoreDoc('tables', id, cleanData);
    }
  };

  const addTable = async (storeId: string, type: 'table' | 'room' | 'corridor' | 'pos' | 'door' = 'table', sectionId?: string) => {
    const storeTables = globalState.tables.filter((t: any) => t.storeId === storeId);
    const nextNum = storeTables.length > 0 ? Math.max(...storeTables.map((t: any) => t.number)) + 1 : 1;
    const tableId = `${storeId}_${nextNum}`;
    const newTable: Table = { 
      number: nextNum, storeId, currentCustomerId: null, sessionStartTime: null,
      x: 100, y: 100, width: type === 'table' ? 70 : 150, height: type === 'table' ? 70 : 80, 
      isRoom: type === 'room', type, seats: type === 'table' ? 4 : 0,
      shape: 'square', status: 'available', sectionId: sectionId || null as any
    };
    await updateFirestoreDoc('tables', tableId, newTable);
    showToast(`${type === 'corridor' ? '복도' : (type === 'room' ? '룸' : '테이블')}가 추가되었습니다.`, 'success');
  };

  const deleteTable = async (storeId: string, tableNumber: number) => {
    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc('tables', tableId, null, true);
    showToast(`${tableNumber}번 테이블이 삭제되었습니다.`, 'info');
  };

  const updateBrandSettings = async (storeId: string, settings: Partial<User>) => {
    await updateFirestoreDoc('users', storeId, settings);
  };

  const setMasterPassword = async (newPassword: string) => {
    const settingsRef = doc(db!, 'appState', 'settings');
    await setDoc(settingsRef, { masterPassword: newPassword }, { merge: true });
  };

  const deleteUser = async (userId: string, role: Role) => {
    const batch = writeBatch(db!);
    if (role === 'owner') {
      const relatedColls = ['users', 'visits', 'coupons', 'tables', 'communications', 'tierOverrides'];
      for (const collName of relatedColls) {
        const q = query(collections![collName as keyof typeof collections], where('storeId', '==', userId));
        const snaps = await getDocs(q);
        snaps.forEach(d => batch.delete(d.ref));
      }
    } else {
      batch.delete(doc(db!, 'users', userId));
      // Cleanup related data
      const related = [
        { coll: 'visits', field: 'customerId' },
        { coll: 'coupons', field: 'customerId' },
        { coll: 'communications', field: 'customerId' },
        { coll: 'tierOverrides', field: 'customerId' }
      ];
      for (const item of related) {
        const q = query(collections![item.coll as keyof typeof collections], where(item.field, '==', userId));
        const snaps = await getDocs(q);
        snaps.forEach(d => batch.delete(d.ref));
      }
    }
    await batch.commit();
    showToast('사용자가 삭제되었습니다.', 'info');
  };

  const updateUserMemo = async (userId: string, storeId: string, memo: string) => {
    await updateFirestoreDoc('users', userId, { memo });
  };

  const recordCommunication = async (customerId: string, storeId: string, type: 'coupon' | 'message', content: string, senderRole: Role = 'owner') => {
    const comm = { id: generateId(), customerId, storeId, type, content, senderRole, date: new Date().toISOString() };
    await updateFirestoreDoc('Communications', comm.id, comm);
  };

  const bulkIssueCoupon = async (customerIds: string[], storeId: string, type: string, description: string) => {
    const batch = writeBatch(db!);
    customerIds.forEach(id => {
      const couponRef = doc(collections!.coupons);
      batch.set(couponRef, { id: couponRef.id, customerId: id, storeId, type, description, status: 'available', issuedAt: new Date().toISOString() });
    });
    await batch.commit();
    showToast(`${customerIds.length}명에게 쿠폰을 발급했습니다.`, 'success');
  };

  const sendPhysicalSms = async (phone: string, content: string, mode: 'device' | 'gateway' | 'aligo' = 'device', gatewayUrl?: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encodedMsg = encodeURIComponent(content);

    // 1. Aligo API Mode (Cloud Automation - Recommended for iPhone)
    if (mode === 'aligo' && currentUser?.aligoKey && currentUser?.aligoUserId) {
      try {
        const formData = new FormData();
        formData.append('key', currentUser.aligoKey);
        formData.append('userid', currentUser.aligoUserId);
        formData.append('sender', currentUser.aligoSender || '');
        formData.append('receiver', cleanPhone);
        formData.append('msg', content);
        
        await fetch('https://apis.aligo.in/send/', {
          method: 'POST',
          body: formData
        });
        showToast('알리고를 통해 자동 전송되었습니다.', 'success');
        return true;
      } catch (e) {
        showToast('알리고 전송 실패. 기기 직접 전송으로 전환합니다.', 'info');
      }
    }

    // 2. Local Gateway Mode: 안드로이드 게이트웨이 앱 사용 시
    if (mode === 'gateway' && (gatewayUrl || currentUser?.smsGatewayUrl)) {
      try {
        const targetUrl = gatewayUrl || currentUser?.smsGatewayUrl;
        await fetch(`${targetUrl}/send?phone=${cleanPhone}&message=${encodedMsg}`);
        showToast('로컬 게이트웨이를 통해 문자가 발송되었습니다.', 'success');
        return true;
      } catch (e) {
        showToast('게이트웨이 연결 실패. 기기 직접 전송으로 전환합니다.', 'info');
      }
    }

    // 3. Device Direct Mode: 사장님 폰의 문자 앱 실행 (무료)
    const isIOS = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    const smsUrl = `sms:${cleanPhone}${isIOS ? '&' : '?'}body=${encodedMsg}`;
    
    if (!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent)) {
      showToast('PC에서는 문자 앱을 실행할 수 없습니다. 모바일에서 접속해 주세요.', 'error');
      return false;
    }

    window.location.href = smsUrl;
    showToast('문자 앱으로 이동합니다. 전송 버튼을 눌러주세요.', 'info');
    return true;
  };

  const sendKakaoMessage = async (content: string, storeName: string, storeId: string) => {
    if (window.Kakao && window.Kakao.isInitialized()) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `[${storeName}] 서비스 안내`,
          description: content,
          imageUrl: 'https://images.unsplash.com/photo-1541167760496-162955ed8a9f?q=80&w=300&h=300&auto=format&fit=crop',
          link: {
            mobileWebUrl: `${window.location.origin}/customer/store/${storeId}`,
            webUrl: `${window.location.origin}/customer/store/${storeId}`,
          },
        },
        buttons: [
          {
            title: '매장 방문하기',
            link: {
              mobileWebUrl: `${window.location.origin}/customer/store/${storeId}`,
              webUrl: `${window.location.origin}/customer/store/${storeId}`,
            },
          },
        ],
      });
      showToast('카카오톡 공유창이 열렸습니다.', 'info');
      return true;
    } else {
      showToast('카카오 SDK가 준비되지 않았습니다.', 'error');
      return false;
    }
  };

  const bulkRecordCommunication = async (customerIds: string[], storeId: string, type: 'coupon' | 'message', content: string, senderRole: Role = 'owner') => {
    const batch = writeBatch(db!);
    customerIds.forEach(id => {
      const commRef = doc(collections!.Communications);
      batch.set(commRef, { id: commRef.id, customerId: id, storeId, type, content, senderRole, date: new Date().toISOString() });
    });
    await batch.commit();
  };

  const updateStoreConfig = async (storeId: string, config: Partial<StoreConfig>) => {
    if (!currentUser || currentUser.id !== storeId) return;
    const owner = users.find(u => u.id === storeId);
    if (owner) {
      const newConfig = { ...(owner.storeConfig || { industry: 'general', rewardType: 'point' }), ...config };
      await updateFirestoreDoc('users', storeId, { storeConfig: newConfig });
    }
  };

  const addMenuItem = async (item: Omit<MenuItem, 'id'>) => {
    const id = generateId();
    const newItem = { ...item, id };
    await updateFirestoreDoc('menus', id, newItem);
    showToast(`${item.name} 메뉴가 등록되었습니다.`, 'success');
  };

  const updateMenuItem = async (id: string, data: Partial<MenuItem>) => {
    await updateFirestoreDoc('menus', id, data);
  };

  const deleteMenuItem = async (id: string) => {
    await updateFirestoreDoc('menus', id, null, true);
    showToast('메뉴가 삭제되었습니다.', 'info');
  };

  const placeOrder = async (order: Omit<StoreOrder, 'id' | 'createdAt' | 'status'>) => {
    const id = generateId();
    const newOrder: StoreOrder = { 
      ...order, 
      id, 
      status: 'pending', 
      createdAt: new Date().toISOString() 
    };
    await updateFirestoreDoc('orders', id, newOrder);
    showToast('주문이 완료되었습니다. 사장님께 전송됩니다.', 'success');
    return id;
  };

  const updateOrderStatus = async (id: string, status: StoreOrder['status']) => {
    await updateFirestoreDoc('orders', id, { status });
    showToast('주문 상태가 업데이트되었습니다.', 'info');
  };

  const queryAI = async (prompt: string) => {
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('5월') || lowerPrompt.includes('오월') || lowerPrompt.includes('may')) {
      const mayVisits = globalState.visits.filter((v: any) => new Date(v.date).getMonth() === 4);
      const totalAmount = mayVisits.reduce((acc: number, v: any) => acc + (v.totalAmount || 0), 0);
      return `5월 한 달 동안 총 ${mayVisits.length}건의 방문이 있었으며, 예상 총 매출은 약 ${totalAmount.toLocaleString()}원입니다.`;
    }
    if (lowerPrompt.includes('단골') || lowerPrompt.includes('customer')) {
      const topCustomers = [...globalState.users].filter(u => u.role === 'customer')
        .sort((a, b) => (b.rewardBalance || 0) - (a.rewardBalance || 0))
        .slice(0, 3);
      return `현재 상위 단골 고객은 ${topCustomers.map(c => c.name).join(', ')}님입니다.`;
    }
    return "죄송합니다. 아직 학습 중인 질문입니다. 매출이나 단골 멤버에 대해 질문해 보세요!";
  };

  return {
    isReady, isProcessing, firebaseStatus, firebaseError, users, visits, coupons, tables, sections, communications, tierOverrides,
    menus, orders,
    masterPassword, currentUser, ownerViewMode, setOwnerViewMode,
    login, logout, linkSocialAccount, deleteAccount, 
    recordVisit, leaveTable, issueCoupon, requestCouponUse, cancelCouponRequest, approveCouponUse, rejectCouponUse,
    initTables, setCustomerTier, updateTableLayout, addTable, deleteTable, updateTableStatus,
    updateBrandSettings, setMasterPassword, deleteUser,
    updateUserMemo, recordCommunication, bulkIssueCoupon, bulkRecordCommunication,
    sendPhysicalSms, sendKakaoMessage, updateStoreConfig,
    calculateDistance,
    updateStoreLocation: async (storeId: string, lat: number, lng: number) => {
      await updateFirestoreDoc('users', storeId, { lat, lng });
    },
    addMenuItem, deleteMenuItem, updateMenuItem, placeOrder, updateOrderStatus, queryAI,
    formatPhoneNumber
  };
};

// --- CRM ANALYSIS UTILITY (Advanced RFM) ---
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const calculateRFMValue = (visits: Visit[] = [], customerId: string, storeId: string) => {
  const customerVisits = (visits || []).filter(v => v.customerId === customerId && v.storeId === storeId);
  if (!customerVisits || customerVisits.length === 0) return { r: 999, f: 0, m: 0, rScore: 0, fScore: 0, mScore: 0, total: 0 };

  const lastVisitDate = new Date(Math.max(...customerVisits.map(v => new Date(v.date).getTime())));
  const recency = Math.floor((new Date().getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24));
  const frequency = customerVisits.length;
  const monetary = customerVisits.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  // Scoring (1-5 scale, relative logic)
  const rScore = recency <= 7 ? 5 : recency <= 14 ? 4 : recency <= 30 ? 3 : recency <= 60 ? 2 : 1;
  const fScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 2 ? 2 : 1;
  const avgAmount = monetary / Math.max(frequency, 1);
  const mScore = avgAmount >= 50000 ? 5 : avgAmount >= 30000 ? 4 : avgAmount >= 15000 ? 3 : avgAmount >= 8000 ? 2 : 1;

  return { r: recency, f: frequency, m: monetary, rScore, fScore, mScore, total: rScore + fScore + mScore };
};

export const getRFMCluster = (r: number, f: number, m: number) => {
  const { rScore, fScore, mScore } = {
    rScore: r <= 7 ? 5 : r <= 14 ? 4 : r <= 30 ? 3 : r <= 60 ? 2 : 1,
    fScore: f >= 10 ? 5 : f >= 5 ? 4 : f >= 3 ? 3 : f >= 2 ? 2 : 1,
    mScore: (m/Math.max(f,1)) >= 30000 ? 5 : (m/Math.max(f,1)) >= 15000 ? 4 : (m/Math.max(f,1)) >= 8000 ? 3 : 2
  };

  if (rScore >= 4 && fScore >= 4) return { id: 'vip', name: 'VIP 레전드', color: 'bg-gold', icon: 'Trophy', desc: '절대 놓쳐선 안 될 핵심 고객' };
  if (rScore >= 4 && fScore < 3) return { id: 'new', name: '유망 신규', color: 'bg-blue-500', icon: 'Sparkles', desc: '첫 만남이 좋았던 신규 고객' };
  if (rScore < 3 && fScore >= 4) return { id: 'slipping', name: '이탈 위험 충성', color: 'bg-burgundy', icon: 'ShieldAlert', desc: '자주 왔었지만 최근 뜸한 고객' };
  if (rScore < 2) return { id: 'cold', name: '장기 휴면', color: 'bg-on-surface-variant/40', icon: 'UserX', desc: '관심이 필요한 휴면 고객' };
  if (fScore >= 4 && mScore >= 4) return { id: 'whale', name: '잠재 큰손', color: 'bg-primary', icon: 'Coins', desc: '재방문 시 가치가 매우 높은 고객' };
  
  return { id: 'general', name: '일반 고객', color: 'bg-on-surface-variant/20', icon: 'User', desc: '꾸준히 방문하는 일반 고객' };
};

export const getActionableInsights = (visits: Visit[] = [], customerId: string, storeId: string, customInsights?: Record<string, string>) => {
  const rfm = calculateRFMValue(visits || [], customerId, storeId);
  const cluster = getRFMCluster(rfm.r, rfm.f, rfm.m);

  if (customInsights && customInsights[cluster.id]) return customInsights[cluster.id];

  if (cluster.id === 'slipping') return '지난 한 달간 방문이 없습니다. 안부 인사와 함께 재방문 쿠폰을 보내보세요.';
  if (cluster.id === 'new') return '방금 데뷔한 신규 고객입니다. 웰컴 푸드나 무료 음료 쿠폰으로 첫 인상을 굳히세요.';
  if (cluster.id === 'whale') return '객단가가 높은 우량 고객입니다. VIP 등급 수동 지정을 검토해 보세요.';
  if (cluster.id === 'vip') return '우리 매장의 기둥입니다. 신메뉴 테스트나 특별 행사에 우선 초대하세요.';
  
  return '정기적인 메뉴 안내를 통해 방문 빈도를 높여보세요.';
};

export const getTierCustomName = (tier: string, tierNames?: Record<string, string>) => {
  if (tierNames && tierNames[tier]) return tierNames[tier];
  return tier;
};

export const getCustomerTier = (visitCount: number) => {
  if (visitCount >= 12) return 'VIP';
  if (visitCount >= 8) return '다이아';
  if (visitCount >= 6) return '골드';
  if (visitCount >= 4) return '실버';
  if (visitCount >= 2) return '브론즈';
  return '일반';
};

export const getEffectiveTier = (visitCount: number, overrideTier?: string) => {
  if (overrideTier && overrideTier !== 'auto') return overrideTier;
  return getCustomerTier(visitCount);
};

export const getNextTierVisits = (visitCount: number) => {
  if (visitCount < 2) return { next: '브론즈', remaining: 2 - visitCount, total: 2 };
  if (visitCount < 4) return { next: '실버', remaining: 4 - visitCount, total: 4 };
  if (visitCount < 6) return { next: '골드', remaining: 6 - visitCount, total: 6 };
  if (visitCount < 8) return { next: '다이아', remaining: 8 - visitCount, total: 8 };
  if (visitCount < 12) return { next: 'VIP', remaining: 12 - visitCount, total: 12 };
  return null;
};

export const getTierColor = (tier: string) => {
  switch (tier) {
    case 'VIP': return 'bg-primary shadow-lg shadow-primary/20 text-white';
    case '다이아': return 'bg-accent-burgundy text-white shadow-md';
    case '골드': return 'bg-[#261c1a] text-white shadow-sm';
    case '실버': return 'bg-on-surface-variant/40 text-white';
    case '브론즈': return 'bg-on-surface-variant/20 text-white';
    default: return 'bg-on-surface-variant/10 text-on-surface-variant/60';
  }
};

