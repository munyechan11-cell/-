import { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from './lib/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

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

export const setGlobalStorage = <T>(key: string, value: T) => {
  globalState[key] = value;
  
  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'appState', 'global');
    setDoc(docRef, globalState).catch(console.error);
  } else {
    localStorage.setItem('offline_global_state', JSON.stringify(globalState));
  }
  
  window.dispatchEvent(new Event('global-storage-update'));
};

export const useStore = () => {
  const [isReady, setIsReady] = useState(isInitialized);
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
      
      getDoc(docRef).then((snapshot) => {
        if (!snapshot.exists()) {
          setDoc(docRef, globalState);
        }
        
        unsubscribe = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            Object.assign(globalState, data);
          }
          isInitialized = true;
          setIsReady(true);
          window.dispatchEvent(new Event('global-storage-update'));
        });
      });
    } else if (!isFirebaseConfigured && !isReady) {
      setIsReady(true);
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
    const currentUsers = getGlobalStorage<User[]>('users', []);
    let user = currentUsers.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === role && (role === 'owner' || u.storeId === storeId));
    
    if (!user) {
      user = {
        id: Math.random().toString(36).substring(2, 9),
        role,
        name,
        phone: cleanPhone,
        restaurantName,
        storeId,
      };
      const newUsers = [...currentUsers, user];
      setGlobalStorage('users', newUsers);
      setUsers(newUsers);
    }

    if (role === 'owner') {
      const currentTables = getGlobalStorage<Table[]>('tables', initialTables);
      const ownerTables = currentTables.filter(t => t.storeId === user!.id);
      if (ownerTables.length === 0) {
        const newStoreTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          storeId: user!.id,
          currentCustomerId: null,
          sessionStartTime: null,
        }));
        const allTables = [...currentTables, ...newStoreTables];
        setGlobalStorage('tables', allTables);
        setTables(allTables);
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
          const allTables = [...currentTables, ...newStoreTables];
          setGlobalStorage('tables', allTables);
          setTables(allTables);
        }
      }
    }

    setLocalStorage('currentUser', user);
    setCurrentUser(user);
    return user;
  };

  const logout = () => {
    setLocalStorage('currentUser', null);
    setCurrentUser(null);
  };

  const recordVisit = (customerId: string, tableNumber: number, storeId: string) => {
    const today = new Date().toDateString();
    
    const currentVisits = getGlobalStorage<Visit[]>('visits', []);
    const hasVisitedToday = currentVisits.some(
      v => v.customerId === customerId && v.storeId === storeId && new Date(v.date).toDateString() === today
    );

    let newVisits = [...currentVisits];
    if (!hasVisitedToday) {
      const newVisit: Visit = {
        id: Math.random().toString(36).substring(2, 9),
        customerId,
        storeId,
        date: new Date().toISOString(),
        tableNumber,
      };
      newVisits = [...currentVisits, newVisit];
      setGlobalStorage('visits', newVisits);
      setVisits(newVisits);
      
      setTimeout(() => checkAndIssueTierCoupons(customerId, storeId, newVisits), 0);
    }

    const currentTables = getGlobalStorage<Table[]>('tables', initialTables);
    let tableFound = false;
    const newTables = currentTables.map(t => {
      if (t.storeId === storeId && t.currentCustomerId === customerId && t.number !== tableNumber) {
        return { ...t, currentCustomerId: null, sessionStartTime: null };
      }
      if (t.number === tableNumber && t.storeId === storeId) {
        tableFound = true;
        return { ...t, currentCustomerId: customerId, sessionStartTime: new Date().toISOString() };
      }
      return t;
    });

    if (!tableFound) {
      newTables.push({
        number: tableNumber,
        storeId,
        currentCustomerId: customerId,
        sessionStartTime: new Date().toISOString(),
      });
    }
    
    setGlobalStorage('tables', newTables);
    setTables(newTables);
  };

  const leaveTable = (tableNumber: number, storeId: string) => {
    const currentTables = getGlobalStorage<Table[]>('tables', initialTables);
    const newTables = currentTables.map(t => 
      (t.number === tableNumber && t.storeId === storeId)
        ? { ...t, currentCustomerId: null, sessionStartTime: null }
        : t
    );
    setGlobalStorage('tables', newTables);
    setTables(newTables);
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
    const currentCoupons = getGlobalStorage<Coupon[]>('coupons', []);
    const newCoupon: Coupon = {
      id: Math.random().toString(36).substring(2, 9),
      customerId,
      storeId,
      type,
      description,
      status: 'available',
      issuedAt: new Date().toISOString(),
    };
    const newCoupons = [...currentCoupons, newCoupon];
    setGlobalStorage('coupons', newCoupons);
    setCoupons(newCoupons);
  };

  const recordCommunication = (customerId: string, storeId: string, type: 'coupon' | 'message', content: string) => {
    const currentComms = getGlobalStorage<Communication[]>('communications', []);
    const newComm: Communication = {
      id: Math.random().toString(36).substring(2, 9),
      customerId,
      storeId,
      type,
      content,
      date: new Date().toISOString(),
    };
    const newComms = [...currentComms, newComm];
    setGlobalStorage('communications', newComms);
    setCommunications(newComms);
  };

  const useCoupon = (couponId: string, tableNumber?: number) => {
    const currentCoupons = getGlobalStorage<Coupon[]>('coupons', []);
    const newCoupons = currentCoupons.map(c => 
      c.id === couponId 
        ? { ...c, status: 'used' as const, usedAt: new Date().toISOString(), usedAtTable: tableNumber }
        : c
    );
    setGlobalStorage('coupons', newCoupons);
    setCoupons(newCoupons);
  };

  const initTables = (storeId: string) => {
    const currentTables = getGlobalStorage<Table[]>('tables', initialTables);
    const existingTables = currentTables.filter(t => t.storeId === storeId);
    if (existingTables.length === 0) {
      const newStoreTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
        number: i + 1,
        storeId,
        currentCustomerId: null,
        sessionStartTime: null,
      }));
      const allTables = [...currentTables, ...newStoreTables];
      setGlobalStorage('tables', allTables);
      setTables(allTables);
    } else if (existingTables.length < 12) {
      const existingNumbers = new Set(existingTables.map(t => t.number));
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
        const allTables = [...currentTables, ...newStoreTables];
        setGlobalStorage('tables', allTables);
        setTables(allTables);
      }
    }
  };

  const setCustomerTier = (customerId: string, storeId: string, tier: string) => {
    const currentOverrides = getGlobalStorage<TierOverride[]>('tierOverrides', []);
    const newOverrides = currentOverrides.filter(t => !(t.customerId === customerId && t.storeId === storeId));
    if (tier !== 'auto') {
      newOverrides.push({ customerId, storeId, tier });
    }
    setGlobalStorage('tierOverrides', newOverrides);
    setTierOverrides(newOverrides);
  };

  const setMasterPassword = (newPassword: string) => {
    setGlobalStorage('masterPassword', newPassword);
    setMasterPasswordState(newPassword);
  };

  const deleteUser = (userId: string, role: Role) => {
    if (role === 'owner') {
      const newUsers = getGlobalStorage<User[]>('users', []).filter(u => u.id !== userId && u.storeId !== userId);
      const newVisits = getGlobalStorage<Visit[]>('visits', []).filter(v => v.storeId !== userId);
      const newCoupons = getGlobalStorage<Coupon[]>('coupons', []).filter(c => c.storeId !== userId);
      const newTables = getGlobalStorage<Table[]>('tables', []).filter(t => t.storeId !== userId);
      const newComms = getGlobalStorage<Communication[]>('communications', []).filter(c => c.storeId !== userId);
      const newTiers = getGlobalStorage<TierOverride[]>('tierOverrides', []).filter(t => t.storeId !== userId);

      setGlobalStorage('users', newUsers);
      setUsers(newUsers);
      setGlobalStorage('visits', newVisits);
      setVisits(newVisits);
      setGlobalStorage('coupons', newCoupons);
      setCoupons(newCoupons);
      setGlobalStorage('tables', newTables);
      setTables(newTables);
      setGlobalStorage('communications', newComms);
      setCommunications(newComms);
      setGlobalStorage('tierOverrides', newTiers);
      setTierOverrides(newTiers);
    } else {
      const newUsers = getGlobalStorage<User[]>('users', []).filter(u => u.id !== userId);
      const newVisits = getGlobalStorage<Visit[]>('visits', []).filter(v => v.customerId !== userId);
      const newCoupons = getGlobalStorage<Coupon[]>('coupons', []).filter(c => c.customerId !== userId);
      const newComms = getGlobalStorage<Communication[]>('communications', []).filter(c => c.customerId !== userId);
      const newTiers = getGlobalStorage<TierOverride[]>('tierOverrides', []).filter(t => t.customerId !== userId);
      
      const newTables = getGlobalStorage<Table[]>('tables', []).map(t => 
        t.currentCustomerId === userId ? { ...t, currentCustomerId: null, sessionStartTime: null } : t
      );

      setGlobalStorage('users', newUsers);
      setUsers(newUsers);
      setGlobalStorage('visits', newVisits);
      setVisits(newVisits);
      setGlobalStorage('coupons', newCoupons);
      setCoupons(newCoupons);
      setGlobalStorage('communications', newComms);
      setCommunications(newComms);
      setGlobalStorage('tierOverrides', newTiers);
      setTierOverrides(newTiers);
      setGlobalStorage('tables', newTables);
      setTables(newTables);
    }
  };

  return {
    isReady,
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

