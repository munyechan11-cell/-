import { useState, useEffect } from 'react';
import { db, auth, isFirebaseConfigured, collections } from './lib/firebase';
import { 
  doc, onSnapshot, setDoc, updateDoc, addDoc, deleteDoc, 
  query, where, getDocs, writeBatch, getDoc 
} from 'firebase/firestore';

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

// Global in-memory state
const globalState: Record<string, any> = {
  users: [],
  visits: [],
  coupons: [],
  tables: [],
  communications: [],
  tierOverrides: [],
  masterPassword: 'IMC'
};

let isInitialized = false;
let globalIsReady = false;
let globalFirebaseStatus: 'connecting' | 'connected' | 'error' | 'offline' = isFirebaseConfigured ? 'connecting' : 'offline';
let globalFirebaseError: string | null = null;

const notifyUpdate = () => {
  window.dispatchEvent(new Event('global-storage-update'));
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
      
      // 만약 이미 마이그레이션이 완료되었다면 중단
      if (settingsSnap.exists() && settingsSnap.data().migration_complete) {
        console.info("Migration already marked as complete.");
        return;
      }

      const globalDocRef = doc(db, 'appState', 'global');
      const snap = await getDoc(globalDocRef);
      
      if (snap.exists()) {
        console.info("Found legacy legacy data - starting migration...");
        const data = snap.data();
        const batch = writeBatch(db);
        
        // Migrate each category to its own collection
        const cats = ['users', 'visits', 'coupons', 'tables', 'communications', 'tierOverrides'];
        for (const cat of cats) {
          if (Array.isArray(data[cat])) {
            for (const item of data[cat]) {
              const itemRef = doc(db, cat, item.id || `${item.storeId}_${item.number}`);
              batch.set(itemRef, item, { merge: true });
            }
          }
        }
        
        // Mark migration as complete
        batch.set(settingsDocRef, { 
          migration_complete: true, 
          masterPassword: data.masterPassword || 'IMC' 
        }, { merge: true });
        
        // Delete legacy doc
        batch.delete(globalDocRef);
        await batch.commit();
        console.info("Migration to collections complete.");
      }
    } catch (err: any) {
      console.error("Migration fatal error (ignoring to allow app to run):", err);
    }
  };
  migrateData();

  // --- COLLECTION SUBSCRIPTIONS ---
  const syncCollection = (collName: string, stateKey: string) => {
    return onSnapshot(collections[collName as keyof typeof collections], (snap) => {
      globalState[stateKey] = snap.docs.map(d => d.data());
      globalFirebaseStatus = 'connected';
      globalIsReady = true;
      notifyUpdate();
    }, (err) => {
      console.error(`Error syncing ${collName}:`, err);
      let userMessage = err.message;
      if (err.code === 'permission-denied') {
        userMessage = `[권한 오류] Firebase 보안 규칙이 업데이트되지 않았습니다. (${collName})`;
      }
      globalFirebaseStatus = 'error';
      globalFirebaseError = userMessage;
      // 인지할 수 있도록 즉시 준비 완료 상태로 변경 (에러 화면을 위함)
      globalIsReady = true;
      notifyUpdate();
    });
  };

  syncCollection('users', 'users');
  syncCollection('visits', 'visits');
  syncCollection('coupons', 'coupons');
  syncCollection('tables', 'tables');
  syncCollection('communications', 'communications');
  syncCollection('tierOverrides', 'tierOverrides');
  
  onSnapshot(doc(db, 'appState', 'settings'), (snap) => {
    if (snap.exists()) {
      globalState.masterPassword = snap.data().masterPassword || 'IMC';
      notifyUpdate();
    }
  });

  // Set timeout for initial load (fallback)
  setTimeout(() => {
    if (!globalIsReady) {
      globalIsReady = true;
      globalFirebaseStatus = 'offline';
      notifyUpdate();
    }
  }, 8000); // 8초까지 대기 시간 연장 (마이그레이션 고려)

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
  if (!isFirebaseConfigured || !db) {
    localStorage.setItem('offline_global_state', JSON.stringify(globalState));
    return;
  }
  const docRef = doc(db, coll, id);
  if (isDelete) {
    await deleteDoc(docRef);
  } else {
    await setDoc(docRef, data, { merge: true });
  }
};

export const useStore = () => {
  const [isReady, setIsReady] = useState(globalIsReady);
  const [firebaseStatus, setFirebaseStatus] = useState(globalFirebaseStatus);
  const [firebaseError, setFirebaseError] = useState(globalFirebaseError);
  const [users, setUsers] = useState<User[]>(getGlobalStorage('users', []));
  const [visits, setVisits] = useState<Visit[]>(getGlobalStorage('visits', []));
  const [coupons, setCoupons] = useState<Coupon[]>(getGlobalStorage('coupons', []));
  const [tables, setTables] = useState<Table[]>(getGlobalStorage('tables', []));
  const [communications, setCommunications] = useState<Communication[]>(getGlobalStorage('communications', []));
  const [tierOverrides, setTierOverrides] = useState<TierOverride[]>(getGlobalStorage('tierOverrides', []));
  const [masterPassword, setMasterPasswordState] = useState<string>(globalState.masterPassword);
  const [currentUser, setCurrentUser] = useState<User | null>(getLocalStorage('currentUser', null));

  useEffect(() => {
    const handleGlobalUpdate = () => {
      setIsReady(globalIsReady);
      setFirebaseStatus(globalFirebaseStatus);
      setFirebaseError(globalFirebaseError);
      setUsers(getGlobalStorage('users', []));
      setVisits(getGlobalStorage('visits', []));
      setCoupons(getGlobalStorage('coupons', []));
      setTables(getGlobalStorage('tables', []));
      setCommunications(getGlobalStorage('communications', []));
      setTierOverrides(getGlobalStorage('tierOverrides', []));
      setMasterPasswordState(globalState.masterPassword);
    };

    const handleLocalUpdate = () => {
      setCurrentUser(getLocalStorage('currentUser', null));
    };

    window.addEventListener('global-storage-update', handleGlobalUpdate);
    window.addEventListener('local-storage-update', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    handleGlobalUpdate();

    return () => {
      window.removeEventListener('global-storage-update', handleGlobalUpdate);
      window.removeEventListener('local-storage-update', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, []);

  const login = async (phone: string, name: string, role: Role, restaurantName?: string, storeId?: string, socialId?: string, isPohangResident?: boolean, gender?: 'male' | 'female') => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    let user = users.find(u => (u.phone.replace(/[^0-9]/g, '') === cleanPhone || (socialId && (u.googleId === socialId || u.socialIds?.includes(socialId)))) && u.role === role && (role === 'owner' || u.storeId === storeId));
    
    if (user) {
      if (socialId && !user.socialIds?.includes(socialId)) {
        user = { ...user, socialIds: [...(user.socialIds || []), socialId] };
        await updateFirestoreDoc('users', user.id, user);
      }
    } else {
      user = {
        id: generateId(),
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
      await updateFirestoreDoc('users', user.id, user);
      
      if (role === 'owner') {
        const batch = writeBatch(db!);
        for (let i = 1; i <= 12; i++) {
          const tableRef = doc(db!, 'tables', `${user.id}_${i}`);
          batch.set(tableRef, { number: i, storeId: user.id, currentCustomerId: null, sessionStartTime: null });
        }
        await batch.commit();
      }
    }
    
    setLocalStorage('currentUser', user);
    setCurrentUser(user);
    showToast(`${name}님 환영합니다!`, 'success');
    return user;
  };

  const logout = () => {
    if (auth) auth.signOut().catch(console.error);
    setLocalStorage('currentUser', null);
    setCurrentUser(null);
    showToast('로그아웃 되었습니다.', 'info');
  };

  const recordVisit = async (customerId: string, tableNumber: number, storeId: string) => {
    const today = new Date().toDateString();
    const hasVisitedToday = visits.some(v => v.customerId === customerId && v.storeId === storeId && new Date(v.date).toDateString() === today);

    if (!hasVisitedToday) {
      const visit = { id: generateId(), customerId, storeId, date: new Date().toISOString(), tableNumber };
      await updateFirestoreDoc('visits', visit.id, visit);
      checkAndIssueTierCoupons(customerId, storeId, [...visits, visit]);
    }

    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc('tables', tableId, { currentCustomerId: customerId, sessionStartTime: new Date().toISOString() });
    showToast('방문이 기록되었습니다.', 'success');
  };

  const leaveTable = async (tableNumber: number, storeId: string) => {
    const tableId = `${storeId}_${tableNumber}`;
    await updateFirestoreDoc('tables', tableId, { currentCustomerId: null, sessionStartTime: null });
    showToast('퇴장 처리되었습니다.', 'info');
  };

  const checkAndIssueTierCoupons = (customerId: string, storeId: string, allVisits: Visit[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentVisits = allVisits.filter(v => v.customerId === customerId && v.storeId === storeId && new Date(v.date) >= thirtyDaysAgo);
    const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;

    let reward = null, tier = '';
    if (uniqueVisitDays === 12) { tier = 'VIP'; reward = '사이드 하나 + 음료수'; }
    else if (uniqueVisitDays === 8) { tier = '다이아'; reward = '사이드 하나'; }
    else if (uniqueVisitDays === 6) { tier = '골드'; reward = '작은 사이드 하나'; }
    else if (uniqueVisitDays === 4) { tier = '실버'; reward = '음료수 2개'; }
    else if (uniqueVisitDays === 2) { tier = '브론즈'; reward = '음료수 하나'; }

    if (reward) issueCoupon(customerId, storeId, `${tier} 등급 달성`, reward);
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
    const batch = writeBatch(db!);
    for (let i = 1; i <= 12; i++) {
      const tableRef = doc(db!, 'tables', `${storeId}_${i}`);
      batch.set(tableRef, { number: i, storeId, currentCustomerId: null, sessionStartTime: null }, { merge: true });
    }
    await batch.commit();
  };

  const setCustomerTier = async (customerId: string, storeId: string, tier: string) => {
    const id = `${customerId}_${storeId}`;
    if (tier === 'auto') {
      await updateFirestoreDoc('tierOverrides', id, null, true);
    } else {
      await updateFirestoreDoc('tierOverrides', id, { customerId, storeId, tier });
    }
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

  const recordCommunication = async (customerId: string, storeId: string, type: 'coupon' | 'message', content: string) => {
    const comm = { id: generateId(), customerId, storeId, type, content, date: new Date().toISOString() };
    await updateFirestoreDoc('communications', comm.id, comm);
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

  const bulkRecordCommunication = async (customerIds: string[], storeId: string, type: 'coupon' | 'message', content: string) => {
    const batch = writeBatch(db!);
    customerIds.forEach(id => {
      const commRef = doc(collections!.communications);
      batch.set(commRef, { id: commRef.id, customerId: id, storeId, type, content, date: new Date().toISOString() });
    });
    await batch.commit();
  };

  return {
    isReady, firebaseStatus, firebaseError, users, visits, coupons, tables, communications, tierOverrides,
    currentUser, masterPassword, login, logout, recordVisit, leaveTable, issueCoupon, 
    requestCouponUse, cancelCouponRequest, approveCouponUse, rejectCouponUse, 
    initTables, setCustomerTier, setMasterPassword, deleteUser, updateUserMemo, 
    recordCommunication, bulkIssueCoupon, bulkRecordCommunication
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

