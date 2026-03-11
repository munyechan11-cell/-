import { useState, useEffect } from 'react';
import { isFirebaseConfigured, initFirebaseSync, syncToFirebase } from './firebase';

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
const initialTables: Table[] = []; // We will generate tables dynamically per store

export const getStorage = <T>(key: string, initialValue: T): T => {
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

export const setStorage = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
  // Dispatch a custom event to notify other tabs/components
  window.dispatchEvent(new Event('storage-update'));
  
  if (isFirebaseConfigured && key !== 'currentUser') {
    syncToFirebase(key, value as any[]);
  }
};

// Initialize Firebase sync once
if (isFirebaseConfigured) {
  initFirebaseSync();
}

export const useStore = () => {
  const [users, setUsers] = useState<User[]>(getStorage('users', []));
  const [visits, setVisits] = useState<Visit[]>(getStorage('visits', []));
  const [coupons, setCoupons] = useState<Coupon[]>(getStorage('coupons', []));
  const [tables, setTables] = useState<Table[]>(getStorage('tables', initialTables));
  const [communications, setCommunications] = useState<Communication[]>(getStorage('communications', []));
  const [tierOverrides, setTierOverrides] = useState<TierOverride[]>(getStorage('tierOverrides', []));
  const [currentUser, setCurrentUser] = useState<User | null>(getStorage('currentUser', null));
  const [masterPassword, setMasterPasswordState] = useState<string>(getStorage('masterPassword', 'IMC'));

  useEffect(() => {
    const handleStorageUpdate = () => {
      setUsers(prev => {
        const next = getStorage('users', []);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setVisits(prev => {
        const next = getStorage('visits', []);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setCoupons(prev => {
        const next = getStorage('coupons', []);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setTables(prev => {
        const next = getStorage('tables', initialTables);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setCommunications(prev => {
        const next = getStorage('communications', []);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setTierOverrides(prev => {
        const next = getStorage('tierOverrides', []);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setCurrentUser(prev => {
        const next = getStorage('currentUser', null);
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setMasterPasswordState(prev => {
        const next = getStorage('masterPassword', 'IMC');
        return prev === next ? prev : next;
      });
    };

    window.addEventListener('storage-update', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate); // For cross-tab

    return () => {
      window.removeEventListener('storage-update', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  const login = (phone: string, name: string, role: Role, restaurantName?: string, storeId?: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const currentUsers = getStorage<User[]>('users', []);
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
      setStorage('users', newUsers);
      setUsers(newUsers);
    }

    if (role === 'owner') {
      // Ensure the owner has tables initialized
      const currentTables = getStorage<Table[]>('tables', initialTables);
      const ownerTables = currentTables.filter(t => t.storeId === user!.id);
      if (ownerTables.length === 0) {
        const newStoreTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          storeId: user!.id,
          currentCustomerId: null,
          sessionStartTime: null,
        }));
        const allTables = [...currentTables, ...newStoreTables];
        setStorage('tables', allTables);
        setTables(allTables);
      } else if (ownerTables.length < 12) {
        // If they have some tables but less than 12, fill the rest up to 12
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
          setStorage('tables', allTables);
          setTables(allTables);
        }
      }
    }

    setStorage('currentUser', user);
    setCurrentUser(user);
    return user;
  };

  const logout = () => {
    setStorage('currentUser', null);
    setCurrentUser(null);
  };

  const recordVisit = (customerId: string, tableNumber: number, storeId: string) => {
    const today = new Date().toDateString();
    
    const currentVisits = getStorage<Visit[]>('visits', []);
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
      setStorage('visits', newVisits);
      setVisits(newVisits);
      
      // Trigger coupon check asynchronously to avoid state update loops
      setTimeout(() => checkAndIssueTierCoupons(customerId, storeId, newVisits), 0);
    }

    const currentTables = getStorage<Table[]>('tables', initialTables);
    let tableFound = false;
    const newTables = currentTables.map(t => {
      // Clear the customer from any other table in this store
      if (t.storeId === storeId && t.currentCustomerId === customerId && t.number !== tableNumber) {
        return { ...t, currentCustomerId: null, sessionStartTime: null };
      }
      // Set the customer at the new table
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
    
    setStorage('tables', newTables);
    setTables(newTables);
  };

  const leaveTable = (tableNumber: number, storeId: string) => {
    const currentTables = getStorage<Table[]>('tables', initialTables);
    const newTables = currentTables.map(t => 
      (t.number === tableNumber && t.storeId === storeId)
        ? { ...t, currentCustomerId: null, sessionStartTime: null }
        : t
    );
    setStorage('tables', newTables);
    setTables(newTables);
  };

  const checkAndIssueTierCoupons = (customerId: string, storeId: string, allVisits: Visit[]) => {
    // Calculate visits in the last 30 days for this specific store
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
    const currentCoupons = getStorage<Coupon[]>('coupons', []);
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
    setStorage('coupons', newCoupons);
    setCoupons(newCoupons);
  };

  const recordCommunication = (customerId: string, storeId: string, type: 'coupon' | 'message', content: string) => {
    const currentComms = getStorage<Communication[]>('communications', []);
    const newComm: Communication = {
      id: Math.random().toString(36).substring(2, 9),
      customerId,
      storeId,
      type,
      content,
      date: new Date().toISOString(),
    };
    const newComms = [...currentComms, newComm];
    setStorage('communications', newComms);
    setCommunications(newComms);
  };

  const useCoupon = (couponId: string, tableNumber?: number) => {
    const currentCoupons = getStorage<Coupon[]>('coupons', []);
    const newCoupons = currentCoupons.map(c => 
      c.id === couponId 
        ? { ...c, status: 'used' as const, usedAt: new Date().toISOString(), usedAtTable: tableNumber }
        : c
    );
    setStorage('coupons', newCoupons);
    setCoupons(newCoupons);
  };

  const initTables = (storeId: string) => {
    const currentTables = getStorage<Table[]>('tables', initialTables);
    const existingTables = currentTables.filter(t => t.storeId === storeId);
    if (existingTables.length === 0) {
      const newStoreTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
        number: i + 1,
        storeId,
        currentCustomerId: null,
        sessionStartTime: null,
      }));
      const allTables = [...currentTables, ...newStoreTables];
      setStorage('tables', allTables);
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
        setStorage('tables', allTables);
        setTables(allTables);
      }
    }
  };

  const setCustomerTier = (customerId: string, storeId: string, tier: string) => {
    const currentOverrides = getStorage<TierOverride[]>('tierOverrides', []);
    const newOverrides = currentOverrides.filter(t => !(t.customerId === customerId && t.storeId === storeId));
    if (tier !== 'auto') {
      newOverrides.push({ customerId, storeId, tier });
    }
    setStorage('tierOverrides', newOverrides);
    setTierOverrides(newOverrides);
  };

  const setMasterPassword = (newPassword: string) => {
    setStorage('masterPassword', newPassword);
    setMasterPasswordState(newPassword);
  };

  const deleteUser = (userId: string, role: Role) => {
    if (role === 'owner') {
      const newUsers = getStorage<User[]>('users', []).filter(u => u.id !== userId && u.storeId !== userId);
      const newVisits = getStorage<Visit[]>('visits', []).filter(v => v.storeId !== userId);
      const newCoupons = getStorage<Coupon[]>('coupons', []).filter(c => c.storeId !== userId);
      const newTables = getStorage<Table[]>('tables', []).filter(t => t.storeId !== userId);
      const newComms = getStorage<Communication[]>('communications', []).filter(c => c.storeId !== userId);
      const newTiers = getStorage<TierOverride[]>('tierOverrides', []).filter(t => t.storeId !== userId);

      setStorage('users', newUsers);
      setUsers(newUsers);
      setStorage('visits', newVisits);
      setVisits(newVisits);
      setStorage('coupons', newCoupons);
      setCoupons(newCoupons);
      setStorage('tables', newTables);
      setTables(newTables);
      setStorage('communications', newComms);
      setCommunications(newComms);
      setStorage('tierOverrides', newTiers);
      setTierOverrides(newTiers);
    } else {
      const newUsers = getStorage<User[]>('users', []).filter(u => u.id !== userId);
      const newVisits = getStorage<Visit[]>('visits', []).filter(v => v.customerId !== userId);
      const newCoupons = getStorage<Coupon[]>('coupons', []).filter(c => c.customerId !== userId);
      const newComms = getStorage<Communication[]>('communications', []).filter(c => c.customerId !== userId);
      const newTiers = getStorage<TierOverride[]>('tierOverrides', []).filter(t => t.customerId !== userId);
      
      const newTables = getStorage<Table[]>('tables', []).map(t => 
        t.currentCustomerId === userId ? { ...t, currentCustomerId: null, sessionStartTime: null } : t
      );

      setStorage('users', newUsers);
      setUsers(newUsers);
      setStorage('visits', newVisits);
      setVisits(newVisits);
      setStorage('coupons', newCoupons);
      setCoupons(newCoupons);
      setStorage('communications', newComms);
      setCommunications(newComms);
      setStorage('tierOverrides', newTiers);
      setTierOverrides(newTiers);
      setStorage('tables', newTables);
      setTables(newTables);
    }
  };

  return {
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
