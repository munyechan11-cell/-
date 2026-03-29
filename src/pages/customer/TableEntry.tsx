import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';

export default function TableEntry() {
  const { storeId, tableNumber } = useParams<{ storeId: string, tableNumber: string }>();
  const navigate = useNavigate();
  const { currentUser, users, recordVisit, logout, isReady } = useStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current || !isReady) return;
    
    if (!storeId || !tableNumber) {
      navigate('/');
      return;
    }

    processedRef.current = true;
    const userExists = currentUser && users.some(u => u.id === currentUser.id);

    if (currentUser?.role === 'customer' && userExists) {
      if (currentUser.storeId === storeId) {
        // Already logged in to this store
        recordVisit(currentUser.id, parseInt(tableNumber), storeId);
        navigate(`/customer/store/${storeId}`);
      } else {
        // Logged in to a different store, log out and redirect to login
        logout();
        navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
      }
    } else if (currentUser?.role === 'owner' || (currentUser && !userExists)) {
      // Owner shouldn't be scanning customer QR codes, or user was deleted
      logout();
      navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
    } else {
      // Not logged in
      navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
    }
  }, [currentUser, users, navigate, storeId, tableNumber, recordVisit, logout, isReady]);

  return (
    <div className="min-h-full bg-hanji-light dark:bg-hanji-dark flex items-center justify-center">
      <div className="bg-white dark:bg-black/20 p-8 rounded-3xl shadow-sm border border-ink-light/10 dark:border-ink-dark/10 text-center">
        <div className="w-16 h-16 border-4 border-burgundy/20 border-t-burgundy rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-ink-light/70 dark:text-ink-dark/70 font-bold">테이블 확인 중...</p>
      </div>
    </div>
  );
}
