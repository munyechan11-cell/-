import { useState, useEffect } from 'react';
import { db, auth, isFirebaseConfigured } from './lib/firebase';
import { doc, onSnapshot, setDoc, runTransaction } from 'firebase/firestore';

// 타임스탬프 + 랜덤 조합으로 ID 충돌 위험을 최소화하는 고유 ID 생성기
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

export type Role = 'customer' | 'owner';

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  restaurantName?: string;
  storeId?: string;
  googleId?: string;
  socialIds?: string[];
  isPohangResident?: boolean;
  gender?: 'male' | 'female';
  memo?: string;
}

export interface Visit {
  id: string;
  customerId: string;
  storeId: string;
  date: string; // ISO string
  tableNumber: number;
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
}

export interface Communication {
  id: string;
  customerId: string;
  storeId: string;
  type: 'coupon' | 'message';
  content: string;
  date: string;
}

export interface TierOverride {
  customerId: string;
  storeId: string;
  tier: string;
}

// Initial mock data
const initialTables: Table[] = [];

// Device-local storage (for currentUser)
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

// Global in-memory state synced via Firebase
const globalState: Record<string, any> = {
  users: [],
  visits: [],
  coupons: [],
  tables: initialTables,
  communications: [],
  tierOverrides: [],
  masterPassword: 'IMC'
};

let isInitialized = false;
let globalIsReady = false;
let globalFirebaseStatus: 'connecting' | 'connected' | 'error' | 'offline' = isFirebaseConfigured ? 'connecting' : 'offline';
let globalFirebaseError: string | null = null;

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
} else if (db) {
  const docRef = doc(db, 'appState', 'global');
  
  const timeoutId = setTimeout(() => {
    if (!isInitialized) {
      console.warn("Firebase sync timeout. Falling back to offline state.");
      isInitialized = true;
      globalIsReady = true;
      globalFirebaseStatus = 'error';
      globalFirebaseError = '연결 시간 초과 (10초). 파이어베이스 서버가 응답하지 않습니다. 데이터베이스 위치(Region) 문제이거나 일시적인 네트워크 오류일 수 있습니다.';
      window.dispatchEvent(new Event('global-storage-update'));
    }
  }, 10000);

  onSnapshot(
    docRef,
    (docSnap) => {
      clearTimeout(timeoutId);
      if (docSnap.exists()) {
        const data = docSnap.data();
        Object.assign(globalState, data);
      } else {
        const sanitizedState = JSON.parse(JSON.stringify(globalState));
        setDoc(docRef, sanitizedState).catch((e) => {
          console.error(e);
          if (e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions')) {
            const errInfo = {
              error: e.message || String(e),
              operationType: 'write',
              path: 'appState/global',
              authInfo: {
                userId: auth?.currentUser?.uid || null,
                email: auth?.currentUser?.email || null,
                emailVerified: auth?.currentUser?.emailVerified || false,
                isAnonymous: auth?.currentUser?.isAnonymous || false,
                tenantId: auth?.currentUser?.tenantId || null,
                providerInfo: auth?.currentUser?.providerData.map(provider => ({
                  providerId: provider.providerId,
                  displayName: provider.displayName,
                  email: provider.email,
                  photoUrl: provider.photoURL
                })) || []
              }
            };
            console.error('Firestore Error: ', JSON.stringify(errInfo));
            // Removed throw new Error to prevent unhandled promise rejection
          }
        });
      }
      isInitialized = true;
      globalIsReady = true;
      globalFirebaseStatus = 'connected';
      globalFirebaseError = null;
      window.dispatchEvent(new Event('global-storage-update'));
    },
    (error) => {
      clearTimeout(timeoutId);
      console.error("Firebase sync error:", error);
      isInitialized = true;
      globalIsReady = true;
      globalFirebaseStatus = 'error';
      globalFirebaseError = `[${error.code || '알 수 없는 에러'}] ${error.message || String(error)}`;
      window.dispatchEvent(new Event('global-storage-update'));
      
      if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
        const errInfo = {
          error: error.message || String(error),
          operationType: 'get',
          path: 'appState/global',
          authInfo: {
            userId: auth?.currentUser?.uid || null,
            email: auth?.currentUser?.email || null,
            emailVerified: auth?.currentUser?.emailVerified || false,
            isAnonymous: auth?.currentUser?.isAnonymous || false,
            tenantId: auth?.currentUser?.tenantId || null,
            providerInfo: auth?.currentUser?.providerData.map(provider => ({
              providerId: provider.providerId,
              displayName: provider.displayName,
              email: provider.email,
              photoUrl: provider.photoURL
            })) || []
          }
        };
        console.error('Firestore Error: ', JSON.stringify(errInfo));
        // Removed throw new Error to prevent uncaught exception
      }
    }
  );
} else {
  globalIsReady = true;
  globalFirebaseStatus = 'offline';
  globalFirebaseError = '환경변수(VITE_FIREBASE_API_KEY 등)가 설정되지 않았습니다.';
}

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

export const runGlobalTransaction = (updater: (currentState: typeof globalState) => Partial<typeof globalState>): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    // 1. Optimistic local update
    const localUpdates = updater(globalState);
    Object.assign(globalState, localUpdates);
    window.dispatchEvent(new Event('global-storage-update'));

    // 2. Async server update with transaction
    if (isFirebaseConfigured && db) {
      const docRef = doc(db, 'appState', 'global');
      runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        const serverData = docSnap.exists() ? docSnap.data() as typeof globalState : globalState;
        
        // Re-run the updater with the LATEST server data
        const serverUpdates = updater(serverData);
        
        const sanitizedUpdates = JSON.parse(JSON.stringify(serverUpdates));
        transaction.set(docRef, sanitizedUpdates, { merge: true });
        
        return serverUpdates;
      }).then((finalUpdates) => {
        // 3. Apply the final server-calculated updates locally to ensure consistency
        if (finalUpdates) {
          Object.assign(globalState, finalUpdates);
          window.dispatchEvent(new Event('global-storage-update'));
        }
        resolve();
      }).catch(e => {
        console.error("Transaction failed: ", e);
        if (e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions')) {
          const errInfo = {
            error: e.message || String(e),
            operationType: 'write',
            path: 'appState/global',
            authInfo: {
              userId: auth?.currentUser?.uid || null,
              email: auth?.currentUser?.email || null,
              emailVerified: auth?.currentUser?.emailVerified || false,
              isAnonymous: auth?.currentUser?.isAnonymous || false,
              tenantId: auth?.currentUser?.tenantId || null,
              providerInfo: auth?.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
              })) || []
            }
          };
          console.error('Firestore Error: ', JSON.stringify(errInfo));
          reject(new Error(JSON.stringify(errInfo)));
        } else {
          reject(e);
        }
      });
    } else {
      localStorage.setItem('offline_global_state', JSON.stringify(globalState));
      resolve();
    }
  });
};

export const setGlobalStorage = <T>(key: string, value: T) => {
  runGlobalTransaction(() => ({ [key]: value })).catch(console.error);
};

export const useStore = () => {
  const [isReady, setIsReady] = useState(globalIsReady);
  const [firebaseStatus, setFirebaseStatus] = useState(globalFirebaseStatus);
  const [firebaseError, setFirebaseError] = useState(globalFirebaseError);
  const [users, setUsers] = useState<User[]>(getGlobalStorage('users', []));
  const [visits, setVisits] = useState<Visit[]>(getGlobalStorage('visits', []));
  const [coupons, setCoupons] = useState<Coupon[]>(getGlobalStorage('coupons', []));
  const [tables, setTables] = useState<Table[]>(getGlobalStorage('tables', initialTables));
  const [communications, setCommunications] = useState<Communication[]>(getGlobalStorage('communications', []));
  const [tierOverrides, setTierOverrides] = useState<TierOverride[]>(getGlobalStorage('tierOverrides', []));
  const [masterPassword, setMasterPasswordState] = useState<string>(getGlobalStorage('masterPassword', 'IMC'));
  
  const [currentUser, setCurrentUser] = useState<User | null>(getLocalStorage('currentUser', null));

  useEffect(() => {
    const handleGlobalUpdate = () => {
      setIsReady(globalIsReady);
      setFirebaseStatus(globalFirebaseStatus);
      setFirebaseError(globalFirebaseError);
      setUsers(getGlobalStorage('users', []));
      setVisits(getGlobalStorage('visits', []));
      setCoupons(getGlobalStorage('coupons', []));
      setTables(getGlobalStorage('tables', initialTables));
      setCommunications(getGlobalStorage('communications', []));
      setTierOverrides(getGlobalStorage('tierOverrides', []));
      setMasterPasswordState(getGlobalStorage('masterPassword', 'IMC'));
    };

    const handleLocalUpdate = () => {
      setCurrentUser(getLocalStorage('currentUser', null));
    };

    window.addEventListener('global-storage-update', handleGlobalUpdate);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate); // For cross-tab local storage

    // Initial sync
    handleGlobalUpdate();

    return () => {
      window.removeEventListener('global-storage-update', handleGlobalUpdate);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, []);

  const login = (phone: string, name: string, role: Role, restaurantName?: string, storeId?: string, socialId?: string, isPohangResident?: boolean, gender?: 'male' | 'female') => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    let loggedInUser: User | null = null;
    const newUserId = generateId();

    runGlobalTransaction((currentState) => {
      const currentUsers = currentState.users || [];
      
      let user = null;
      
      // 1. Try to find by socialId
      if (socialId) {
        user = currentUsers.find(u => (u.googleId === socialId || u.socialIds?.includes(socialId)) && u.role === role && (role === 'owner' || u.storeId === storeId));
        // Backward compatibility: check if id === socialId
        if (!user) {
          user = currentUsers.find(u => u.id === socialId && u.role === role && (role === 'owner' || u.storeId === storeId));
        }
      }
      
      // 2. Try to find by phone
      if (!user && cleanPhone) {
        user = currentUsers.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === role && (role === 'owner' || u.storeId === storeId));
      }
      
      const updates: Partial<typeof globalState> = {};
      
      if (user) {
        // Link socialId if missing
        if (socialId) {
          const socialIds = user.socialIds ? [...user.socialIds] : [];
          if (user.googleId && !socialIds.includes(user.googleId)) {
            socialIds.push(user.googleId);
          }
          if (!socialIds.includes(socialId)) {
            socialIds.push(socialId);
            const updatedUser = { ...user, socialIds };
            updates.users = currentUsers.map(u => u.id === user!.id ? updatedUser : u);
            user = updatedUser;
          }
        }
      } else {
        // Create new user
        user = {
          id: newUserId,
          role,
          name,
          phone: cleanPhone,
          restaurantName,
          storeId,
          googleId: socialId,
          socialIds: socialId ? [socialId] : [],
          isPohangResident,
          gender
        };
        updates.users = [...currentUsers, user];
      }
      
      loggedInUser = user;

      if (role === 'owner') {
        const currentTables = currentState.tables || initialTables;
        const ownerTables = currentTables.filter(t => t.storeId === user!.id);
        if (ownerTables.length === 0) {
          const newStoreTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
            number: i + 1,
            storeId: user!.id,
            currentCustomerId: null,
            sessionStartTime: null,
          }));
          updates.tables = [...currentTables, ...newStoreTables];
        } else if (ownerTables.length < 12) {
          const existingNumbers = new Set(ownerTables.map(t => t.number));
          const newStoreTables: Table[] = [];
          for (let i = 1; i <= 12; i++) {
            if (!existingNumbers.has(i)) {
              newStoreTables.push({
                number: i,
                storeId: user!.id,
                currentCustomerId: null,
                sessionStartTime: null,
              });
            }
          }
          if (newStoreTables.length > 0) {
            updates.tables = [...currentTables, ...newStoreTables];
          }
        }
      }
      
      return updates;
    }).catch(console.error);

    if (loggedInUser) {
      setLocalStorage('currentUser', loggedInUser);
      setCurrentUser(loggedInUser);
      showToast(`${name}님 환영합니다!`, 'success');
    }
    return loggedInUser!;
  };

  const logout = () => {
    if (auth) {
      import('firebase/auth').then(({ signOut }) => {
        signOut(auth).catch(console.error);
      }).catch(console.error);
    }
    setLocalStorage('currentUser', null);
    setCurrentUser(null);
    showToast('로그아웃 되었습니다.', 'info');
  };

  const recordVisit = (customerId: string, tableNumber: number, storeId: string) => {
    const today = new Date().toDateString();
    const newVisitId = generateId();
    const now = new Date().toISOString();
    let couponCheckData: { customerId: string; storeId: string; visits: Visit[] } | null = null;

    runGlobalTransaction((currentState) => {
      const updates: Partial<typeof globalState> = {};
      const currentVisits = currentState.visits || [];
      
      const hasVisitedToday = currentVisits.some(
        (v: Visit) => v.customerId === customerId && v.storeId === storeId && new Date(v.date).toDateString() === today
      );

      if (!hasVisitedToday) {
        const newVisit: Visit = {
          id: newVisitId,
          customerId,
          storeId,
          date: now,
          tableNumber,
        };
        updates.visits = [...currentVisits, newVisit];
        couponCheckData = { customerId, storeId, visits: updates.visits };
      } else {
        // 오늘 이미 방문한 경우에도 테이블은 업데이트
      }

      const currentTables = currentState.tables || initialTables;
      let tableFound = false;
      const newTables = currentTables.map((t: Table) => {
        if (t.storeId === storeId && t.currentCustomerId === customerId && t.number !== tableNumber) {
          return { ...t, currentCustomerId: null, sessionStartTime: null };
        }
        if (t.number === tableNumber && t.storeId === storeId) {
          tableFound = true;
          return { ...t, currentCustomerId: customerId, sessionStartTime: now };
        }
        return t;
      });

      if (!tableFound) {
        newTables.push({
          number: tableNumber,
          storeId,
          currentCustomerId: customerId,
          sessionStartTime: now,
        });
      }
      
      updates.tables = newTables;
      return updates;
    }).then(() => {
      showToast('방문이 기록되었습니다.', 'success');
      // 트랜잭션 완료 후 쿠폰 지급 → Race Condition 방지
      if (couponCheckData) {
        checkAndIssueTierCoupons(couponCheckData.customerId, couponCheckData.storeId, couponCheckData.visits);
      }
    }).catch(console.error);
  };

  const leaveTable = (tableNumber: number, storeId: string) => {
    runGlobalTransaction((currentState) => {
      const currentTables = currentState.tables || initialTables;
      const newTables = currentTables.map((t: Table) => 
        (t.number === tableNumber && t.storeId === storeId)
          ? { ...t, currentCustomerId: null, sessionStartTime: null }
          : t
      );
      return { tables: newTables };
    }).then(() => {
      showToast('테이블에서 퇴장했습니다.', 'info');
    }).catch(console.error);
  };

  const checkAndIssueTierCoupons = (customerId: string, storeId: string, allVisits: Visit[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentVisits = allVisits.filter(v => 
      v.customerId === customerId && v.storeId === storeId && new Date(v.date) >= thirtyDaysAgo
    );

    const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;
    const recentVisitsCount = uniqueVisitDays;

    let tier = 'None';
    let reward = null;

    if (recentVisitsCount === 12) { tier = 'VIP'; reward = '사이드 하나 + 음료수'; }
    else if (recentVisitsCount === 8) { tier = '다이아'; reward = '사이드 하나'; }
    else if (recentVisitsCount === 6) { tier = '골드'; reward = '작은 사이드 하나'; }
    else if (recentVisitsCount === 4) { tier = '실버'; reward = '음료수 2개'; }
    else if (recentVisitsCount === 2) { tier = '브론즈'; reward = '음료수 하나'; }

    if (reward) {
      issueCoupon(customerId, storeId, `${tier} 등급 달성`, reward);
    }
  };

  const bulkIssueCoupon = (customerIds: string[], storeId: string, type: string, description: string) => {
    const now = new Date().toISOString();
    
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupons = customerIds.map(customerId => ({
        id: generateId(),
        customerId,
        storeId,
        type,
        description,
        status: 'available' as const,
        issuedAt: now,
      }));
      return { coupons: [...currentCoupons, ...newCoupons] };
    }).then(() => {
      showToast(`${customerIds.length}명에게 쿠폰을 발급했습니다.`, 'success');
    }).catch(console.error);
  };

  const bulkRecordCommunication = (customerIds: string[], storeId: string, type: 'coupon' | 'message', content: string) => {
    const now = new Date().toISOString();
    
    runGlobalTransaction((currentState) => {
      const currentComms = currentState.communications || [];
      const newComms = customerIds.map(customerId => ({
        id: generateId(),
        customerId,
        storeId,
        type,
        content,
        date: now,
      }));
      return { communications: [...currentComms, ...newComms] };
    }).catch(console.error);
  };

  const issueCoupon = (customerId: string, storeId: string, type: string, description: string) => {
    const newCouponId = generateId();
    const now = new Date().toISOString();
    
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupon: Coupon = {
        id: newCouponId,
        customerId,
        storeId,
        type,
        description,
        status: 'available',
        issuedAt: now,
      };
      return { coupons: [...currentCoupons, newCoupon] };
    }).then(() => {
      showToast(`쿠폰 발급: ${description}`, 'success');
    }).catch(console.error);
  };

  const recordCommunication = (customerId: string, storeId: string, type: 'coupon' | 'message', content: string) => {
    const newCommId = generateId();
    const now = new Date().toISOString();
    
    runGlobalTransaction((currentState) => {
      const currentComms = currentState.communications || [];
      const newComm: Communication = {
        id: newCommId,
        customerId,
        storeId,
        type,
        content,
        date: now,
      };
      return { communications: [...currentComms, newComm] };
    }).catch(console.error);
  };

  const requestCouponUse = (couponId: string, tableNumber?: number) => {
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupons = currentCoupons.map((c: Coupon) => 
        c.id === couponId 
          ? { ...c, status: 'pending' as const, usedAtTable: tableNumber }
          : c
      );
      return { coupons: newCoupons };
    }).then(() => {
      showToast('사장님께 사용 요청을 보냈습니다.', 'success');
    }).catch(console.error);
  };

  const cancelCouponRequest = (couponId: string) => {
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupons = currentCoupons.map((c: Coupon) => 
        c.id === couponId 
          ? { ...c, status: 'available' as const, usedAtTable: undefined }
          : c
      );
      return { coupons: newCoupons };
    }).then(() => {
      showToast('쿠폰 사용 요청을 취소했습니다.', 'info');
    }).catch(console.error);
  };

  const approveCouponUse = (couponId: string) => {
    const now = new Date().toISOString();
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupons = currentCoupons.map((c: Coupon) => 
        c.id === couponId 
          ? { ...c, status: 'used' as const, usedAt: now }
          : c
      );
      return { coupons: newCoupons };
    }).then(() => {
      showToast('쿠폰 사용을 승인했습니다.', 'success');
    }).catch(console.error);
  };

  const rejectCouponUse = (couponId: string) => {
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupons = currentCoupons.map((c: Coupon) => 
        c.id === couponId 
          ? { ...c, status: 'available' as const, usedAtTable: undefined }
          : c
      );
      return { coupons: newCoupons };
    }).then(() => {
      showToast('쿠폰 사용을 거절했습니다.', 'info');
    }).catch(console.error);
  };

  const initTables = (storeId: string) => {
    runGlobalTransaction((currentState) => {
      const currentTables = currentState.tables || initialTables;
      const existingTables = currentTables.filter((t: Table) => t.storeId === storeId);
      if (existingTables.length === 0) {
        const newStoreTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          storeId,
          currentCustomerId: null,
          sessionStartTime: null,
        }));
        return { tables: [...currentTables, ...newStoreTables] };
      } else if (existingTables.length < 12) {
        const existingNumbers = new Set(existingTables.map((t: Table) => t.number));
        const newStoreTables: Table[] = [];
        for (let i = 1; i <= 12; i++) {
          if (!existingNumbers.has(i)) {
            newStoreTables.push({
              number: i,
              storeId,
              currentCustomerId: null,
              sessionStartTime: null,
            });
          }
        }
        if (newStoreTables.length > 0) {
          return { tables: [...currentTables, ...newStoreTables] };
        }
      }
      return {};
    }).catch(console.error);
  };

  const setCustomerTier = (customerId: string, storeId: string, tier: string) => {
    runGlobalTransaction((currentState) => {
      const currentOverrides = currentState.tierOverrides || [];
      const newOverrides = currentOverrides.filter((t: TierOverride) => !(t.customerId === customerId && t.storeId === storeId));
      if (tier !== 'auto') {
        newOverrides.push({ customerId, storeId, tier });
      }
      return { tierOverrides: newOverrides };
    }).catch(console.error);
  };

  const setMasterPassword = (newPassword: string) => {
    runGlobalTransaction(() => ({ masterPassword: newPassword })).catch(console.error);
  };

  const deleteUser = (userId: string, role: Role) => {
    runGlobalTransaction((currentState) => {
      const updates: Partial<typeof globalState> = {};
      
      if (role === 'owner') {
        updates.users = (currentState.users || []).filter((u: User) => u.id !== userId && u.storeId !== userId);
        updates.visits = (currentState.visits || []).filter((v: Visit) => v.storeId !== userId);
        updates.coupons = (currentState.coupons || []).filter((c: Coupon) => c.storeId !== userId);
        updates.tables = (currentState.tables || []).filter((t: Table) => t.storeId !== userId);
        updates.communications = (currentState.communications || []).filter((c: Communication) => c.storeId !== userId);
        updates.tierOverrides = (currentState.tierOverrides || []).filter((t: TierOverride) => t.storeId !== userId);
      } else {
        updates.users = (currentState.users || []).filter((u: User) => u.id !== userId);
        updates.visits = (currentState.visits || []).filter((v: Visit) => v.customerId !== userId);
        updates.coupons = (currentState.coupons || []).filter((c: Coupon) => c.customerId !== userId);
        updates.communications = (currentState.communications || []).filter((c: Communication) => c.customerId !== userId);
        updates.tierOverrides = (currentState.tierOverrides || []).filter((t: TierOverride) => t.customerId !== userId);
        
        updates.tables = (currentState.tables || []).map((t: Table) => 
          t.currentCustomerId === userId ? { ...t, currentCustomerId: null, sessionStartTime: null } : t
        );
      }
      
      return updates;
    }).catch(console.error);
  };

  const updateUserMemo = (userId: string, storeId: string, memo: string) => {
    runGlobalTransaction((currentState) => {
      const currentUsers = currentState.users || [];
      const newUsers = currentUsers.map(u => 
        u.id === userId && u.storeId === storeId ? { ...u, memo } : u
      );
      return { users: newUsers };
    }).catch(console.error);
  };

  return {
    isReady,
    firebaseStatus,
    firebaseError,
    users,
    visits,
    coupons,
    tables,
    communications,
    tierOverrides,
    currentUser,
    masterPassword,
    login,
    logout,
    recordVisit,
    leaveTable,
    issueCoupon,
    recordCommunication,
    requestCouponUse,
    cancelCouponRequest,
    approveCouponUse,
    rejectCouponUse,
    initTables,
    setCustomerTier,
    setMasterPassword,
    deleteUser,
    updateUserMemo,
    bulkIssueCoupon,
    bulkRecordCommunication
  };
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
  if (visitCount >= 12) return 0;
  if (visitCount >= 8) return 12 - visitCount;
  if (visitCount >= 6) return 8 - visitCount;
  if (visitCount >= 4) return 6 - visitCount;
  if (visitCount >= 2) return 4 - visitCount;
  return 2 - visitCount;
};

export const getTierColor = (tier: string) => {
  switch (tier) {
    case 'VIP': return 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-burgundy-light border-burgundy/20';
    case '다이아': return 'bg-espresso/10 text-espresso dark:bg-espresso/20 dark:text-espresso-light border-espresso/20';
    case '골드': return 'bg-mustard/20 text-mustard-dark dark:bg-mustard/30 dark:text-mustard border-mustard/30';
    case '실버': return 'bg-ink-light/5 text-ink-light dark:bg-ink-dark/10 dark:text-ink-dark border-ink-light/10';
    case '브론즈': return 'bg-olive/10 text-olive dark:bg-olive/20 dark:text-olive-light border-olive/20';
    default: return 'bg-ink-light/5 text-ink-light/70 dark:bg-ink-dark/5 dark:text-ink-dark/70 border-ink-light/10'; // 일반
  }
};

