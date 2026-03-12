import { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from './lib/firebase';
import { doc, onSnapshot, setDoc, runTransaction } from 'firebase/firestore';

export type Role = 'customer' | 'owner';

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  restaurantName?: string;
  storeId?: string;
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
  status: 'available' | 'used';
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

// Fallback to local storage if Firebase is not configured
if (!isFirebaseConfigured) {
  const savedState = localStorage.getItem('offline_global_state');
  if (savedState) {
    try {
      Object.assign(globalState, JSON.parse(savedState));
    } catch (e) {}
  }
  isInitialized = true;
}

export const getGlobalStorage = <T>(key: string, initialValue: T): T => {
  return globalState[key] !== undefined ? globalState[key] : initialValue;
};

export const runGlobalTransaction = (updater: (currentState: typeof globalState) => Partial<typeof globalState>) => {
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
    }).catch(e => {
      console.error("Transaction failed: ", e);
    });
  } else {
    localStorage.setItem('offline_global_state', JSON.stringify(globalState));
  }
};

export const setGlobalStorage = <T>(key: string, value: T) => {
  runGlobalTransaction(() => ({ [key]: value }));
};

export const useStore = () => {
  const [isReady, setIsReady] = useState(isInitialized);
  const [firebaseStatus, setFirebaseStatus] = useState<'connecting' | 'connected' | 'error' | 'offline'>(isFirebaseConfigured ? 'connecting' : 'offline');
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>(getGlobalStorage('users', []));
  const [visits, setVisits] = useState<Visit[]>(getGlobalStorage('visits', []));
  const [coupons, setCoupons] = useState<Coupon[]>(getGlobalStorage('coupons', []));
  const [tables, setTables] = useState<Table[]>(getGlobalStorage('tables', initialTables));
  const [communications, setCommunications] = useState<Communication[]>(getGlobalStorage('communications', []));
  const [tierOverrides, setTierOverrides] = useState<TierOverride[]>(getGlobalStorage('tierOverrides', []));
  const [masterPassword, setMasterPasswordState] = useState<string>(getGlobalStorage('masterPassword', 'IMC'));
  
  const [currentUser, setCurrentUser] = useState<User | null>(getLocalStorage('currentUser', null));

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isFirebaseConfigured && db && !isInitialized) {
      const docRef = doc(db, 'appState', 'global');
      
      // Force ready after 3 seconds if Firebase is hanging or database is not created
      const timeoutId = setTimeout(() => {
        if (!isInitialized) {
          console.warn("Firebase sync timeout. Falling back to offline state.");
          isInitialized = true;
          setIsReady(true);
          setFirebaseStatus('error');
          setFirebaseError('연결 시간 초과 (3초). 데이터베이스가 생성되지 않았거나 네트워크 문제일 수 있습니다.');
          window.dispatchEvent(new Event('global-storage-update'));
        }
      }, 3000);

      unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          clearTimeout(timeoutId);
          if (docSnap.exists()) {
            const data = docSnap.data();
            Object.assign(globalState, data);
          } else {
            const sanitizedState = JSON.parse(JSON.stringify(globalState));
            setDoc(docRef, sanitizedState).catch(console.error);
          }
          isInitialized = true;
          setIsReady(true);
          setFirebaseStatus('connected');
          setFirebaseError(null);
          window.dispatchEvent(new Event('global-storage-update'));
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error("Firebase sync error:", error);
          // Fallback to offline state
          isInitialized = true;
          setIsReady(true);
          setFirebaseStatus('error');
          setFirebaseError(error.message || String(error));
          window.dispatchEvent(new Event('global-storage-update'));
        }
      );
    } else if (!isFirebaseConfigured && !isReady) {
      setIsReady(true);
      setFirebaseStatus('offline');
      setFirebaseError('환경변수(VITE_FIREBASE_API_KEY 등)가 설정되지 않았습니다.');
    }

    const handleGlobalUpdate = () => {
      setIsReady(true);
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

    // If already initialized before component mounted, trigger update
    if (isInitialized && !isReady) {
      handleGlobalUpdate();
    }

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('global-storage-update', handleGlobalUpdate);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, [isReady]);

  const login = (phone: string, name: string, role: Role, restaurantName?: string, storeId?: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const newUserId = Math.random().toString(36).substring(2, 9);
    let loggedInUser: User | null = null;

    runGlobalTransaction((currentState) => {
      const currentUsers = currentState.users || [];
      let user = currentUsers.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === role && (role === 'owner' || u.storeId === storeId));
      
      const updates: Partial<typeof globalState> = {};
      
      if (!user) {
        user = {
          id: newUserId,
          role,
          name,
          phone: cleanPhone,
          restaurantName,
          storeId,
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
    });

    if (loggedInUser) {
      setLocalStorage('currentUser', loggedInUser);
      setCurrentUser(loggedInUser);
    }
    return loggedInUser!;
  };

  const logout = () => {
    setLocalStorage('currentUser', null);
    setCurrentUser(null);
  };

  const recordVisit = (customerId: string, tableNumber: number, storeId: string) => {
    const today = new Date().toDateString();
    const newVisitId = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    let shouldCheckCoupons = false;
    let finalVisits: Visit[] = [];

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
        shouldCheckCoupons = true;
        finalVisits = updates.visits;
      } else {
        finalVisits = currentVisits;
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
    });

    if (shouldCheckCoupons) {
      setTimeout(() => checkAndIssueTierCoupons(customerId, storeId, finalVisits), 0);
    }
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
    });
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

  const issueCoupon = (customerId: string, storeId: string, type: string, description: string) => {
    const newCouponId = Math.random().toString(36).substring(2, 9);
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
    });
  };

  const recordCommunication = (customerId: string, storeId: string, type: 'coupon' | 'message', content: string) => {
    const newCommId = Math.random().toString(36).substring(2, 9);
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
    });
  };

  const useCoupon = (couponId: string, tableNumber?: number) => {
    const now = new Date().toISOString();
    runGlobalTransaction((currentState) => {
      const currentCoupons = currentState.coupons || [];
      const newCoupons = currentCoupons.map((c: Coupon) => 
        c.id === couponId 
          ? { ...c, status: 'used' as const, usedAt: now, usedAtTable: tableNumber }
          : c
      );
      return { coupons: newCoupons };
    });
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
    });
  };

  const setCustomerTier = (customerId: string, storeId: string, tier: string) => {
    runGlobalTransaction((currentState) => {
      const currentOverrides = currentState.tierOverrides || [];
      const newOverrides = currentOverrides.filter((t: TierOverride) => !(t.customerId === customerId && t.storeId === storeId));
      if (tier !== 'auto') {
        newOverrides.push({ customerId, storeId, tier });
      }
      return { tierOverrides: newOverrides };
    });
  };

  const setMasterPassword = (newPassword: string) => {
    runGlobalTransaction(() => ({ masterPassword: newPassword }));
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
    });
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
    useCoupon,
    initTables,
    setCustomerTier,
    setMasterPassword,
    deleteUser,
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
    case 'VIP': return 'bg-purple-100 text-purple-800 border-purple-200';
    case '다이아': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case '골드': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case '실버': return 'bg-gray-200 text-gray-800 border-gray-300';
    case '브론즈': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-[#FFF3E0] text-[#D84315] border-[#FFE0B2]'; // 일반
  }
};

