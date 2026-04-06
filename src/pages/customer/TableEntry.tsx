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
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-12 text-center selection:bg-primary/10 overflow-hidden relative">
      {/* Dynamic Background */}
      <motion.div 
        animate={{ 
          scale: status === 'linking' ? 1.2 : 1,
          opacity: status === 'linking' ? 0.4 : 0.2 
        }}
        className="absolute inset-0 pointer-events-none"
      >
         <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-primary/5 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-1/4 right-1/4 w-[50rem] h-[50rem] bg-gold/5 rounded-full blur-[150px]"></div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={status}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -20 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="relative mb-14">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-36 h-36 rounded-[4rem] border-[3px] border-primary/5 border-t-primary shadow-premium"
            ></motion.div>
            <div className="absolute inset-0 flex items-center justify-center text-primary">
              {status === 'syncing' && <Store className="w-12 h-12 opacity-20" />}
              {status === 'verifying' && <ShieldCheck className="w-12 h-12 opacity-30" />}
              {status === 'linking' && <Sparkles className="w-12 h-12 text-gold animate-pulse" />}
            </div>
            
            {/* Success Ripple */}
            {status === 'linking' && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 bg-gold/20 rounded-[4rem]"
              />
            )}
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-1 h-1 bg-primary/20 rounded-full"></div>
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.6em]">Secure Entry Session</p>
                <div className="w-1 h-1 bg-primary/20 rounded-full"></div>
             </div>
             
             <h2 className="text-4xl font-serif font-black text-primary italic tracking-tight leading-none">
               {status === 'syncing' && "매장 동기화 중"}
               {status === 'verifying' && "세션 인증 확인"}
               {status === 'linking' && "테이블 연동 완료"}
             </h2>
             
             <p className="text-xs font-medium text-primary/30 max-w-xs mx-auto leading-relaxed">
               {status === 'syncing' && "클라우드 데이터베이스와 실시간 정보를 맞추고 있습니다."}
               {status === 'verifying' && "고객님의 안전하고 프라이빗한 입장을 검증하고 있습니다."}
               {status === 'linking' && `${tableNumber}번 테이블로 곧 안내해 드리겠습니다.`}
             </p>
          </div>

          {/* Progress Indicator */}
          <div className="mt-16 flex gap-3">
            {[0, 1, 2].map(i => (
              <motion.div 
                key={i} 
                animate={{ 
                  scaleY: [1, 2.5, 1], 
                  opacity: [0.1, 0.6, 0.1],
                  backgroundColor: status === 'linking' ? "var(--color-gold)" : "var(--color-primary)"
                }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                className="w-1 h-6 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
