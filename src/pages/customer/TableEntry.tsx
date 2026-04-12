import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Sparkles, Store, ChevronRight } from 'lucide-react';

export default function TableEntry() {
  const { storeId, tableNumber } = useParams<{ storeId: string, tableNumber: string }>();
  const navigate = useNavigate();
  const { isReady, users, recordVisit, currentUser, login, formatPhoneNumber } = useStore();
  const [status, setStatus] = useState<'syncing' | 'verifying' | 'linking' | 'guest'>('syncing');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady || !storeId || !tableNumber) return;

    const syncAndEntry = async () => {
      setStatus('syncing');
      let retryCount = 0;
      const maxRetries = 10;
      const checkStore = () => users.find(u => u.id === storeId && u.role === 'owner');

      while (!checkStore() && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300));
        retryCount++;
      }

      if (!currentUser) {
        setStatus('guest');
        return;
      }

      setStatus('verifying');
      await new Promise(resolve => setTimeout(resolve, 600));

      setStatus('linking');
      await recordVisit(currentUser.id, parseInt(tableNumber), storeId);
      
      setTimeout(() => {
        navigate(`/customer/store/${storeId}`);
      }, 500);
    };

    syncAndEntry();
  }, [isReady, storeId, tableNumber, users, currentUser, recordVisit, navigate]);

  const handleGuestEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !name || !storeId || !tableNumber) return;
    
    setIsSubmitting(true);
    try {
      const user = await login(phoneNumber, name, 'customer', undefined, storeId);
      if (user) {
        setStatus('linking');
        await recordVisit(user.id, parseInt(tableNumber), storeId);
        setTimeout(() => navigate(`/customer/store/${storeId}`), 1000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
               {status === 'guest' && "반갑습니다!"}
             </h2>
             
             {status === 'guest' ? (
               <form onSubmit={handleGuestEntry} className="w-full max-w-sm mt-12 space-y-6">
                 <div className="space-y-4">
                   <div className="relative">
                      <input 
                        type="text" 
                        required
                        placeholder="전화번호를 입력해 주세요"
                        className="w-full bg-white border-2 border-primary/10 rounded-3xl py-6 px-8 text-xl font-bold text-primary placeholder:text-primary/20 focus:border-primary outline-none transition-all shadow-premium"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                      />
                   </div>
                   <div className="relative">
                      <input 
                        type="text" 
                        required
                        placeholder="성함을 입력해 주세요"
                        className="w-full bg-white border-2 border-primary/10 rounded-3xl py-6 px-8 text-xl font-bold text-primary placeholder:text-primary/20 focus:border-primary outline-none transition-all shadow-premium"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                   </div>
                 </div>
                 
                 <button 
                   type="submit"
                   disabled={isSubmitting}
                   className="w-full bg-primary text-white text-xl font-black py-6 rounded-3xl shadow-heavy hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                 >
                   {isSubmitting ? "입장 처리 중..." : "매장 입장하기"}
                   <ChevronRight className="w-6 h-6" />
                 </button>
                 
                 <p className="text-[10px] text-primary/30 font-bold uppercase tracking-widest">
                   단 한 번의 입력으로 단골 등급 혜택이 시작됩니다
                 </p>
               </form>
             ) : (
               <p className="text-xs font-medium text-primary/30 max-w-xs mx-auto leading-relaxed">
                 {status === 'syncing' && "클라우드 데이터베이스와 실시간 정보를 맞추고 있습니다."}
                 {status === 'verifying' && "고객님의 안전하고 프라이빗한 입장을 검증하고 있습니다."}
                 {status === 'linking' && `${tableNumber}번 테이블로 곧 안내해 드리겠습니다.`}
               </p>
             )}
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
