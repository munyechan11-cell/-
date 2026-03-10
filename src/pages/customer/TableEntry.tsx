import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';

export default function TableEntry() {
  const { storeId, tableNumber } = useParams<{ storeId: string, tableNumber: string }>();
  const navigate = useNavigate();
  const { currentUser, recordVisit, logout } = useStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    
    if (!storeId || !tableNumber) {
      navigate('/');
      return;
    }

    processedRef.current = true;

    if (currentUser?.role === 'customer') {
      if (currentUser.storeId === storeId) {
        // Already logged in to this store
        recordVisit(currentUser.id, parseInt(tableNumber), storeId);
        navigate(`/customer/store/${storeId}`);
      } else {
        // Logged in to a different store, log out and redirect to login
        logout();
        navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
      }
    } else if (currentUser?.role === 'owner') {
      // Owner shouldn't be scanning customer QR codes
      logout();
      navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
    } else {
      // Not logged in
      navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
    }
  }, [currentUser, navigate, storeId, tableNumber, recordVisit, logout]);

  return (
    <div className="min-h-full bg-transparent flex items-center justify-center">
      <p className="text-[#795548] font-bold">테이블 확인 중...</p>
    </div>
  );
}
