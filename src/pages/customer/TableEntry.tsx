import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';

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

    const run = async () => {
      processedRef.current = true;
      const userExists = currentUser && users.some(u => u.id === currentUser.id);

      if (currentUser?.role === 'customer' && userExists) {
        if (currentUser.storeId === storeId) {
          // Already logged in to this store
          await recordVisit(currentUser.id, parseInt(tableNumber), storeId);
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
    };
    run();
  }, [currentUser, users, navigate, storeId, tableNumber, recordVisit, logout, isReady]);

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 hanji-texture relative overflow-hidden">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
      
      <div className="max-w-sm w-full bg-white rounded-[3.5rem] shadow-3xl border border-primary/10 p-12 text-center relative z-10 animate-in fade-in zoom-in duration-700">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16"></div>
        
        <div className="relative mb-10">
           <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl animate-pulse"></div>
           <div className="w-20 h-20 rounded-[2rem] bg-primary flex items-center justify-center mx-auto shadow-2xl shadow-primary/20 rotate-12 animate-spin-slow">
              <span className="text-3xl font-serif font-black text-white italic">결</span>
           </div>
        </div>

        <h2 className="text-2xl font-serif font-black text-primary mb-2 italic tracking-tighter">시스템 연동 중</h2>
        <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mb-4">테이블 정보를 확인하는 중입니다</p>
        
        <div className="flex items-center justify-center space-x-3 text-burgundy opacity-50">
           <Loader2 className="w-4 h-4 animate-spin" />
           <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">동기화 중...</span>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center opacity-20">
         <ShieldCheck className="w-8 h-8 text-primary mb-4" fill="currentColor" />
         <p className="text-[10px] font-black uppercase tracking-[0.5em]">보안 시스템 작동 중</p>
      </div>
    </div>
  );
}
