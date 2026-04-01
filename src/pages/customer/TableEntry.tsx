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
    if (!storeId || !tableNumber) { navigate('/'); return; }

    const run = async () => {
      processedRef.current = true;
      const userExists = currentUser && users.some(u => u.id === currentUser.id);

      if (currentUser?.role === 'customer' && userExists) {
        if (currentUser.storeId === storeId) {
          await recordVisit(currentUser.id, parseInt(tableNumber), storeId);
          navigate(`/customer/store/${storeId}`);
        } else {
          logout();
          navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
        }
      } else {
        logout();
        navigate(`/customer/store/${storeId}/login?table=${tableNumber}`);
      }
    };
    run();
  }, [currentUser, users, navigate, storeId, tableNumber, recordVisit, logout, isReady]);

  return (
    <div className="min-h-screen bg-[#fdfaf7] text-[#261c1a] font-sans selection:bg-primary/10 flex flex-col items-center justify-center p-6">
      
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-12 text-center shadow-3xl border border-[#e5dcd3] relative animate-in fade-in zoom-in duration-700">
        <div className="relative mb-10">
           <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mx-auto shadow-2xl rotate-12">
              <span className="text-3xl font-serif font-black text-white italic">결</span>
           </div>
        </div>

        <h2 className="text-2xl font-serif font-black text-primary mb-2 italic">매장 연동 중</h2>
        <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-8">테이블 정보를 확인하고 있습니다</p>
        
        <div className="flex items-center justify-center gap-3">
           <Loader2 className="w-5 h-5 animate-spin text-primary opacity-30" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40">동기화 중</span>
        </div>
      </div>

      <footer className="mt-16 flex flex-col items-center opacity-20">
         <ShieldCheck className="w-8 h-8 text-primary mb-4" />
         <p className="text-[8px] font-black uppercase tracking-[0.5em]">결 SECURE CONNECTION</p>
      </footer>
    </div>
  );
}
