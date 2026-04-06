import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Sparkles, Store } from 'lucide-react';

export default function TableEntry() {
  const { storeId, tableNumber } = useParams<{ storeId: string, tableNumber: string }>();
  const navigate = useNavigate();
  const { isReady, users, recordVisit, currentUser } = useStore();
  const [status, setStatus] = useState<'syncing' | 'verifying' | 'linking'>('syncing');

  useEffect(() => {
    if (!isReady || !storeId || !tableNumber || !currentUser) return;

    const syncAndEntry = async () => {
      // Step 1: Syncing data (Wait for store to be available in users)
      setStatus('syncing');
      let retryCount = 0;
      const maxRetries = 10;
      
      const checkStore = () => {
        const store = users.find(u => u.id === storeId && u.role === 'owner');
        return !!store;
      };

      while (!checkStore() && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300));
        retryCount++;
      }

      // Step 2: Verifying session
      setStatus('verifying');
      await new Promise(resolve => setTimeout(resolve, 600));

      // Step 3: Linking table
      setStatus('linking');
      await recordVisit(currentUser.id, parseInt(tableNumber), storeId);
      
      // Complete
      setTimeout(() => {
        navigate(`/customer/store/${storeId}`);
      }, 500);
    };

    syncAndEntry();
  }, [isReady, storeId, tableNumber, users, currentUser, recordVisit, navigate]);

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-12 text-center selection:bg-primary/10 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div 
          key={status}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -20 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="relative mb-12">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 rounded-[3.5rem] border-[3px] border-primary/5 border-t-primary shadow-2xl"
            ></motion.div>
            <div className="absolute inset-0 flex items-center justify-center text-primary">
              {status === 'syncing' && <Store className="w-10 h-10 opacity-20" />}
              {status === 'verifying' && <ShieldCheck className="w-10 h-10 opacity-30" />}
              {status === 'linking' && <Sparkles className="w-10 h-10 text-gold animate-pulse" />}
            </div>
          </div>

          <div className="space-y-4">
             <h2 className="text-3xl font-serif font-black text-primary italic tracking-tight">
               {status === 'syncing' && "매장 입구 확인 중..."}
               {status === 'verifying' && "보안 세션 검증 중..."}
               {status === 'linking' && "테이블 연동 중..."}
             </h2>
             <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em] max-w-xs mx-auto leading-relaxed">
               {status === 'syncing' && "클라우드 데이터베이스와 동기화하고 있습니다"}
               {status === 'verifying' && "고객님의 안전한 입장을 확인하고 있습니다"}
               {status === 'linking' && `${tableNumber}번 테이블 세션을 준비하고 있습니다`}
             </p>
          </div>

          <div className="mt-12 flex gap-1.5 translate-x-1">
            {[0, 1, 2].map(i => (
              <motion.div 
                key={i} 
                animate={{ scaleY: [1, 2, 1], opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                className="w-0.5 h-4 bg-primary/40 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[150px]"></div>
      </div>
    </div>
  );
}
