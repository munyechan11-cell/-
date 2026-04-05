import { useEffect, useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits, getTierCustomName, showToast } from '../../store';
import { 
  LogOut, Ticket, Award, Calendar, X, ArrowLeft, 
  LogOut as LeaveIcon, MessageSquare, Bell, Edit3, 
  Send, Loader2, Star, ShieldCheck, Heart, 
  TrendingUp, Clock, MapPin, Search, Filter,
  ChevronRight, Activity, Zap, Store as StoreIcon,
  ArrowUpRight, QrCode, User, Settings as SettingsIcon,
  ShieldAlert, Trash2, Mail, History, Leaf, Coins,
  Sparkles, Trophy, Globe
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';
import Skeleton, { CustomerCardSkeleton } from '../../components/Skeleton';

export default function CustomerDashboard() {
  const { isReady, currentUser, visits, coupons, users, tables, logout, leaveTable, communications, tierOverrides, requestCouponUse, cancelCouponRequest, updateUserMemo, recordCommunication } = useStore();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [cancelingCoupon, setCancelingCoupon] = useState<string | null>(null);
  const [editingMemo, setEditingMemo] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showReviewReward, setShowReviewReward] = useState(false);
  const { linkSocialAccount, deleteAccount } = useStore();

  useEffect(() => {
    if (currentUser && storeId && currentUser.storeId !== storeId) {
      logout();
      navigate(`/customer/store/${storeId}/login`);
    }
  }, [currentUser, storeId, logout, navigate]);

  useEffect(() => {
    // Show review prompt for frequent visitors who haven't seen it recently
    const hasLastVisitToday = visits.some(v => v.customerId === currentUser?.id && new Date(v.date).toDateString() === new Date().toDateString());
    if (hasLastVisitToday && Math.random() > 0.7) {
       const timer = setTimeout(() => setShowReviewReward(true), 2000);
       return () => clearTimeout(timer);
    }
  }, [visits, currentUser]);

  if (!currentUser || currentUser.storeId !== storeId) return null;

  if (!isReady) {
    return (
      <div className="min-h-screen bg-surface-bright p-8 space-y-12 max-w-md mx-auto">
        <div className="flex justify-between items-center py-4">
           <Skeleton width={120} height={40} />
           <Skeleton variant="circle" width={48} height={48} />
        </div>
        <Skeleton height={256} className="rounded-[3rem]" />
        <div className="grid grid-cols-2 gap-6">
           <Skeleton height={160} />
           <Skeleton height={160} />
        </div>
        <div className="space-y-6">
           <Skeleton width={100} height={20} />
           <Skeleton height={80} />
           <Skeleton height={80} />
        </div>
      </div>
    );
  }

  const owner = users.find(u => u.id === storeId && u.role === 'owner');
  if (!owner) return null;

  const restaurantName = owner.restaurantName || '단골 매장';
  const myVisits = visits.filter(v => v.customerId === currentUser.id && v.storeId === storeId);
  const myCoupons = coupons.filter(c => c.customerId === currentUser.id && c.storeId === storeId && (c.status === 'available' || c.status === 'pending'));
  const myCommunications = communications.filter(c => c.customerId === currentUser.id && c.storeId === storeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentTable = tables.find(t => t.currentCustomerId === currentUser.id && t.storeId === storeId);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentVisits = myVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
  const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;
  
  const override = tierOverrides.find(t => t.customerId === currentUser.id && t.storeId === storeId);
  const currentTier = getEffectiveTier(uniqueVisitDays, override?.tier);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLeaveStore = () => {
    if (currentTable && storeId) {
      leaveTable(currentTable.number, storeId);
      navigate('/scan');
    }
  };

  const activeCoupon = myCoupons.find(c => c.id === selectedCoupon);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-surface-bright text-on-surface font-sans selection:bg-primary/10 flex flex-col items-center overflow-x-hidden"
    >
      <div className="w-full max-w-md min-h-screen flex flex-col relative pb-40">
        
        {/* Elite Header */}
        <header className="px-8 py-8 flex justify-between items-center bg-surface-bright/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-gyeol-wood flex items-center justify-center text-white font-serif italic text-2xl shadow-premium">결</div>
             <div>
                <h1 className="font-serif font-black text-xl italic tracking-tight text-primary">{restaurantName}</h1>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 leading-none">Concierge Active</p>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <motion.button 
               whileTap={{ scale: 0.9 }}
               onClick={() => setIsSettingsOpen(true)} 
               className="p-3 bg-white rounded-2xl text-primary/30 border border-primary/5 shadow-sm hover:text-primary transition-all"
             >
               <SettingsIcon className="w-5 h-5" />
             </motion.button>
          </div>
        </header>

        {/* Content Flow */}
        <div className="px-8 space-y-12 flex-1 pb-10">
          
          {/* VIP Membership Card with Progress */}
          <section className="relative perspective-1000">
             <motion.div 
               whileHover={{ rotateY: 5, rotateX: -5 }}
               className="relative h-[22rem] w-full rounded-[3.5rem] bg-gyeol-wood p-12 text-white shadow-premium overflow-hidden group border border-white/10 flex flex-col justify-between"
             >
                {/* Holographic Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 opacity-50"></div>
                <div className="absolute top-[-50%] right-[-50%] w-[400px] h-[400px] bg-gold/10 rounded-full blur-[100px] group-hover:scale-150 transition-transform duration-[2000ms]"></div>
                
                <div className="relative z-10 flex flex-col h-full justify-between">
                   <div className="flex justify-between items-start">
                      <div className="flex gap-6 items-center">
                         <div className="w-20 h-20 rounded-[2rem] bg-white/10 border border-white/20 p-1 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
                            {currentUser.avatarUrl ? (
                               <img src={currentUser.avatarUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                               <User className="w-10 h-10 text-white/40" />
                            )}
                         </div>
                         <div>
                            <h2 className="text-3xl font-serif font-black italic tracking-tight">{currentUser.name}</h2>
                            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.4em]">Legendary Customer</p>
                         </div>
                      </div>
                      <div className={`px-6 py-3 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl ${getTierColor(currentTier)} border border-white/20`}>
                         {getTierCustomName(currentTier, owner?.tierNames)}
                      </div>
                   </div>

                   <div className="space-y-6 pt-8 border-t border-white/10">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.4em] text-gold/60">
                         <span>Membership Velocity</span>
                         {getNextTierVisits(uniqueVisitDays) ? (
                            <span>{getNextTierVisits(uniqueVisitDays)?.remaining} More to {getTierCustomName(getNextTierVisits(uniqueVisitDays)!.next, owner?.tierNames)}</span>
                         ) : (
                            <span className="flex items-center gap-2"><Trophy className="w-3 h-3" /> Master Tier</span>
                         )}
                      </div>
                      
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ 
                             width: getNextTierVisits(uniqueVisitDays) 
                               ? `${(uniqueVisitDays / getNextTierVisits(uniqueVisitDays)!.total) * 100}%` 
                               : '100%' 
                           }}
                           className="h-full bg-gold shadow-[0_0_20px_rgba(198,163,79,0.7)]"
                         />
                      </div>
                      
                      <div className="flex justify-between items-end">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gold/30">Total Experiences</p>
                            <p className="text-4xl font-serif font-black italic leading-none">{myVisits.length}<span className="text-xs ml-2 opacity-50 uppercase font-sans not-italic">Visits</span></p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] font-black uppercase tracking-widest text-white/20 italic">ID_ST_{currentUser.id.slice(0, 6).toUpperCase()}</p>
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
          </section>

          {/* Table Active Session HUD */}
          {currentTable && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-primary/5 border border-primary/20 rounded-[3rem] p-8 lg:p-10 flex justify-between items-center relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-2 h-full bg-primary/20"></div>
               <div className="flex items-center gap-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-3xl animate-ping opacity-40"></div>
                    <div className="w-16 h-16 bg-primary rounded-[1.5rem] flex items-center justify-center text-white shadow-xl relative z-10"><MapPin className="w-7 h-7" /></div>
                  </div>
                  <div>
                     <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] lg:text-[11px] font-black uppercase text-primary tracking-[0.3em] opacity-60">Currently Occupying</span>
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                     </div>
                     <p className="text-3xl font-serif font-black text-primary italic leading-none">{currentTable.number}번 테이블</p>
                  </div>
               </div>
               <motion.button 
                 whileTap={{ scale: 0.9 }}
                 onClick={handleLeaveStore} 
                 className="p-5 bg-white rounded-2xl text-burgundy shadow-sm border border-burgundy/10 hover:bg-burgundy hover:text-white transition-all group"
               >
                 <LeaveIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
               </motion.button>
            </motion.div>
          )}

          {/* Quick Hub Portal */}
          <section className="grid grid-cols-2 gap-6 pb-6">
             <motion.button 
               whileTap={{ scale: 0.98 }}
               onClick={() => setEditingMemo(true)} 
               className="bg-white p-8 rounded-[3rem] border border-primary/5 shadow-premium hover:shadow-2xl transition-all text-left relative group overflow-hidden"
             >
                <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all outline-none"><Edit3 className="w-7 h-7" /></div>
                <p className="text-[11px] font-black uppercase text-primary/30 tracking-widest leading-tight mb-1">사장님께 전하는</p>
                <p className="text-2xl font-serif font-black text-primary italic">나의 기록</p>
             </motion.button>
             
             <motion.button 
               whileTap={{ scale: 0.98 }}
               onClick={() => navigate('/scan')} 
               className="bg-white p-8 rounded-[3rem] border border-primary/5 shadow-premium hover:shadow-2xl transition-all text-left relative group overflow-hidden"
             >
                <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all outline-none"><QrCode className="w-7 h-7" /></div>
                <p className="text-[11px] font-black uppercase text-primary/30 tracking-widest leading-tight mb-1">손님 맞이용</p>
                <p className="text-2xl font-serif font-black text-primary italic">QR 스캔</p>
             </motion.button>
          </section>

          {/* Exclusive Benefits (Coupons) */}
          <section className="space-y-8">
             <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-4">
                   <Ticket className="w-6 h-6 text-primary opacity-30" />
                   <h3 className="font-serif font-black text-xl italic text-primary uppercase tracking-tight">나의 특권</h3>
                </div>
                <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-4 py-1.5 rounded-full ring-1 ring-primary/10">{myCoupons.length}개 보유</span>
             </div>
             
             {myCoupons.length === 0 ? (
                <div className="bg-white py-20 rounded-[4rem] border border-dashed border-primary/10 text-center relative overflow-hidden group">
                   <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <Sparkles className="w-12 h-12 text-primary/10 mx-auto mb-6 group-hover:scale-110 transition-transform" />
                   <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.3em]">새로운 혜택을 사냥하는 중...</p>
                </div>
             ) : (
                <div className="space-y-6">
                   {myCoupons.map(coupon => (
                     <motion.button 
                       layout
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       key={coupon.id} 
                       onClick={() => coupon.status === 'available' ? setSelectedCoupon(coupon.id) : setCancelingCoupon(coupon.id)}
                       className={`w-full p-8 rounded-[3rem] border transition-all flex justify-between items-center group relative overflow-hidden ${coupon.status === 'pending' ? 'bg-primary/5 border-primary/20' : 'bg-white border-primary/5 shadow-premium hover:scale-[1.01]'}`}
                     >
                        {coupon.status === 'pending' && <div className="absolute top-0 left-0 w-2 h-full bg-primary/40 animate-pulse"></div>}
                        <div className="text-left flex items-center gap-8">
                           <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${coupon.status === 'pending' ? 'bg-primary/10 text-primary' : 'bg-gold/10 text-gold'}`}>
                              <Ticket className="w-7 h-7" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase text-primary/40 mb-1">{coupon.status === 'pending' ? '사용 승인 대기 중' : '즉시 사용 가능'}</p>
                              <p className="text-2xl font-serif font-black text-primary italic leading-tight">{coupon.description}</p>
                           </div>
                        </div>
                        <div className={`p-5 rounded-full ${coupon.status === 'pending' ? 'bg-burgundy/10 text-burgundy' : 'bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm'}`}>
                           {coupon.status === 'pending' ? <X className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                        </div>
                     </motion.button>
                   ))}
                </div>
             )}
          </section>

          {/* Chronicles: Visit History */}
          <section className="space-y-8 pb-10">
             <div className="flex items-center gap-4 px-4">
                <History className="w-6 h-6 text-primary opacity-30" />
                <h3 className="font-serif font-black text-xl italic text-primary uppercase tracking-tight">방문의 기록</h3>
             </div>
             
             {myVisits.length === 0 ? (
                <div className="bg-white py-20 rounded-[4rem] border border-dashed border-primary/10 text-center">
                   <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.3em]">역사가 시작되기를 기다립니다.</p>
                </div>
             ) : (
                <div className="bg-white rounded-[3.5rem] border border-primary/5 overflow-hidden shadow-premium">
                   {myVisits.slice(0, 5).map((visit, idx) => (
                      <div key={visit.id} className={`p-8 flex justify-between items-center ${idx !== 0 ? 'border-t border-primary/5' : ''} hover:bg-primary/[0.01] transition-colors`}>
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-surface-bright flex items-center justify-center text-primary/30 border border-primary/5 shadow-inner"><Clock className="w-6 h-6" /></div>
                            <div>
                               <p className="text-base font-black text-primary italic mb-0.5">{new Date(visit.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
                               <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">{visit.tableNumber}번 테이블 (오후 {new Date(visit.date).getHours()}:{new Date(visit.date).getMinutes() < 10 ? '0' : ''}{new Date(visit.date).getMinutes()})</p>
                            </div>
                         </div>
                         <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-[11px] font-black text-primary/30 italic ring-1 ring-primary/10">#{myVisits.length - idx}</div>
                      </div>
                   ))}
                   <button className="w-full py-6 bg-surface-bright/50 text-center block border-t border-primary/5 group transition-all">
                      <p className="text-[11px] font-black uppercase text-primary/20 tracking-[0.4em] group-hover:text-primary group-hover:tracking-[0.5em] transition-all">Archived Memories</p>
                   </button>
                </div>
             )}
          </section>
        </div>

        {/* Cinematic Bottom Hub */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] bg-sidebar-bg/95 backdrop-blur-2xl px-12 py-7 rounded-[3rem] flex justify-between items-center z-50 shadow-3xl border border-white/10 ring-1 ring-white/5">
           <Link to={`/customer/store/${storeId}/dashboard`} className="flex flex-col items-center gap-2 text-gold transition-all group">
              <Zap className="w-7 h-7 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-80">Home</span>
           </Link>
           <motion.button 
             whileHover={{ scale: 1.1, y: -10 }}
             whileTap={{ scale: 0.9 }}
             onClick={() => navigate('/scan')} 
             className="w-24 h-24 -mt-24 bg-primary text-white rounded-[2.5rem] shadow-premium flex items-center justify-center border-[10px] border-surface-bright active:scale-95 transition-all outline-none"
           >
              <QrCode className="w-10 h-10" />
           </motion.button>
           <button onClick={() => setSendingMessage(true)} className="flex flex-col items-center gap-2 text-white/30 hover:text-white transition-all group">
              <div className="relative">
                <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />
                {myCommunications.length > 0 && <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full shadow-lg ring-2 ring-sidebar-bg"></div>}
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-80">Pulse</span>
           </button>
        </div>

        {/* Cinematic Modals */}
        <AnimatePresence>
          {selectedCoupon && activeCoupon && (
            <div className="fixed inset-0 bg-primary/60 backdrop-blur-2xl flex items-center justify-center p-8 z-[100]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 30 }}
                className="bg-white rounded-[4rem] p-12 w-full max-w-sm text-center shadow-3xl border border-white/10"
              >
                 <div className="w-28 h-28 bg-primary rounded-[3rem] flex items-center justify-center text-white mx-auto mb-10 shadow-premium rotate-12 group overflow-hidden">
                    <Ticket className="w-14 h-14" />
                 </div>
                 <h3 className="text-4xl font-serif font-black text-primary italic mb-6">Redeem Privileges</h3>
                 <p className="text-base text-on-surface-variant/60 leading-relaxed mb-12 px-6 italic">"{activeCoupon.description}" 혜택을 사용하시겠습니까? 사장님께 승인 요청이 실시간으로 전송됩니다.</p>
                 <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => {
                        if (currentTable) {
                           requestCouponUse(activeCoupon.id, currentTable.number);
                           setSelectedCoupon(null);
                        } else {
                           setSelectedCoupon(null);
                           showToast('테이블 연동이 필요합니다. QR을 먼저 스캔해 주세요.', 'error');
                        }
                      }}
                      className="w-full py-7 bg-primary text-white rounded-[2rem] font-bold uppercase tracking-widest text-[11px] shadow-3xl active:scale-95 transition-all outline-none"
                    >실시간 요청 전송</button>
                    <button onClick={() => setSelectedCoupon(null)} className="w-full py-5 text-[10px] font-black uppercase tracking-[0.5em] text-primary/20 hover:text-primary transition-all">다음 기회에</button>
                 </div>
              </motion.div>
            </div>
          )}

          {sendingMessage && (
            <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl flex items-end justify-center z-[100]">
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-white w-full max-w-md rounded-t-[5rem] p-14 shadow-3xl flex flex-col gap-12"
              >
                 <div className="flex justify-between items-center">
                    <div className="space-y-2">
                       <h3 className="text-4xl font-serif font-black text-primary italic tracking-tight">Direct Concierge</h3>
                       <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.5em]">Real-time feedback pulse</p>
                    </div>
                    <button onClick={() => setSendingMessage(false)} className="p-5 bg-surface-container rounded-full hover:bg-primary/5 transition-colors outline-none"><X className="w-6 h-6 text-primary/20" /></button>
                 </div>
                 <textarea 
                   autoFocus
                   rows={6}
                   className="w-full bg-surface-container border-none rounded-[3rem] p-10 text-lg font-serif italic text-primary focus:ring-4 focus:ring-primary/10 resize-none shadow-inner"
                   placeholder="사장님께 전하고 싶은 특별한 메시지나 피드백을 남겨주세요..."
                   value={messageContent}
                   onChange={e => setMessageContent(e.target.value)}
                 />
                 <button 
                   onClick={async (e) => {
                     e.preventDefault();
                     if (!messageContent.trim() || isSending) return;
                     setIsSending(true);
                     try {
                       await recordCommunication(currentUser.id, storeId!, 'message', messageContent.trim(), 'customer');
                       setMessageContent('');
                       setSendingMessage(false);
                       showToast('정성이 담긴 피드백이 전송되었습니다.', 'success');
                     } catch (err) {
                       console.error(err);
                     } finally {
                       setIsSending(false);
                     }
                   }}
                   disabled={isSending || !messageContent.trim()}
                   className="w-full py-7 bg-primary text-white rounded-[2.5rem] font-bold uppercase tracking-widest text-[12px] disabled:opacity-30 shadow-3xl flex items-center justify-center gap-5 active:scale-[0.98] transition-all outline-none"
                 >
                    {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                    DISPATCH FEEDBACK
                 </button>
              </motion.div>
            </div>
          )}

          {showReviewReward && (
             <div className="fixed inset-0 bg-gold/20 backdrop-blur-xl flex items-center justify-center p-8 z-[150]">
                <motion.div 
                   initial={{ opacity: 0, scale: 0.9, y: 50 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.9, y: 50 }}
                   className="bg-sidebar-bg rounded-[4rem] p-14 text-white text-center shadow-premium relative overflow-hidden"
                >
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold via-white to-gold"></div>
                   <Sparkles className="w-16 h-16 text-gold mx-auto mb-10 animate-bounce" />
                   <h3 className="text-4xl font-serif font-black italic mb-6">Review & Elevate</h3>
                   <p className="text-base text-white/60 mb-12 leading-relaxed px-4">
                      오늘의 경험을 리뷰로 남겨주시면 <span className="text-gold font-black">서비스 쿠폰</span>을 즉시 지급해 드립니다. 사장님께 로열티를 증명해 보세요!
                   </p>
                   <div className="flex flex-col gap-4">
                      <button 
                         onClick={() => {
                            showToast('리뷰 연동 기능은 준비 중입니다.', 'info');
                            setShowReviewReward(false);
                         }}
                         className="w-full py-7 bg-gold text-sidebar-bg rounded-[2rem] font-black uppercase tracking-widest text-[12px] shadow-2xl active:scale-95 transition-all"
                      >리뷰 남기고 선물 받기</button>
                      <button onClick={() => setShowReviewReward(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-white/30 italic">나중에 할게요</button>
                   </div>
                </motion.div>
             </div>
          )}
        </AnimatePresence>

        <MemoModal
          isOpen={editingMemo}
          onClose={() => setEditingMemo(false)}
          initialMemo={currentUser.memo || ''}
          onSave={memo => updateUserMemo(currentUser.id, storeId!, memo)}
        />

        {/* Elite Profile Settings */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 bg-primary/40 backdrop-blur-2xl z-[110] flex items-end sm:items-center justify-center p-0 sm:p-8">
               <motion.div 
                 initial={{ y: "100%" }}
                 animate={{ y: 0 }}
                 exit={{ y: "100%" }}
                 className="bg-white w-full max-w-md rounded-t-[5rem] sm:rounded-[5rem] p-14 shadow-3xl flex flex-col gap-12 max-h-[90vh] overflow-y-auto no-scrollbar"
               >
                  <div className="flex justify-between items-center">
                     <div>
                        <h3 className="text-4xl font-serif font-black text-primary italic tracking-tight">Identity Governance</h3>
                        <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.5em]">System Profile & Security</p>
                     </div>
                     <button onClick={() => setIsSettingsOpen(false)} className="p-5 bg-surface-container rounded-full hover:bg-primary/5 transition-colors outline-none"><X className="w-6 h-6 text-primary/20" /></button>
                  </div>

                  <div className="space-y-12">
                     <div className="bg-surface-container p-10 rounded-[3.5rem] flex items-center gap-8 border border-primary/5 shadow-inner">
                        <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-primary shadow-2xl p-1 overflow-hidden">
                           {currentUser.avatarUrl ? (
                             <img src={currentUser.avatarUrl} className="w-full h-full object-cover rounded-[1.5rem]" alt="" />
                           ) : (
                             <User className="w-12 h-12 opacity-20" />
                           )}
                        </div>
                        <div>
                           <p className="text-3xl font-sans font-black text-primary leading-tight mb-1">{currentUser.name}</p>
                           <p className="text-xs font-black text-primary/30 uppercase tracking-[0.2em]">{currentUser.phone || '디지털 본인 인증 완료'}</p>
                        </div>
                     </div>

                     <div className="space-y-8">
                        <p className="text-[11px] font-black uppercase tracking-[0.5em] text-primary/20 px-4">Federated Digital Identities</p>
                        <div className="grid grid-cols-1 gap-5">
                           <div className="flex items-center justify-between p-8 bg-surface-bright border border-primary/10 rounded-[2.5rem] shadow-sm">
                              <div className="flex items-center gap-5">
                                 <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary/30"><Smartphone className="w-6 h-6" /></div>
                                 <span className="text-base font-sans font-black text-primary/80">기본 전화번호</span>
                              </div>
                              <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-5 py-2 rounded-full ring-1 ring-primary/20">Active Node</span>
                           </div>
                           
                           {['google', 'kakao'].map(provider => (
                             <button 
                               key={provider}
                               onClick={async () => {
                                 if (currentUser.linkedProviders?.includes(provider as any)) return;
                                 try {
                                   await linkSocialAccount(provider as any);
                                 } catch (error: any) {
                                   showToast(error.message || 'Identity synchronization failed.', 'error');
                                 }
                               }}
                               className={`flex items-center justify-between p-8 rounded-[2.5rem] border transition-all ${currentUser.linkedProviders?.includes(provider as any) ? 'bg-white border-primary/10 shadow-sm' : 'bg-surface-container border-transparent hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98]'}`}
                             >
                                 <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-white/50 rounded-2xl flex items-center justify-center text-primary/30 border border-primary/5">
                                       {provider === 'google' ? <Globe className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                                    </div>
                                    <span className="text-base font-black italic capitalize text-primary/60">{provider} Network</span>
                                 </div>
                                 {currentUser.linkedProviders?.includes(provider as any) ? (
                                   <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-2 rounded-full ring-1 ring-emerald-200">
                                      <ShieldCheck className="w-3 h-3" />
                                      <span className="text-[10px] font-black uppercase">Verified</span>
                                   </div>
                                 ) : (
                                   <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em] group-hover:text-primary transition-colors italic">Bind Identity</span>
                                 )}
                             </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="pt-12 border-t border-primary/5 flex flex-col gap-6">
                     <button 
                       onClick={handleLogout}
                       className="w-full py-7 text-primary font-black uppercase tracking-[0.5em] text-[12px] flex items-center justify-center gap-4 hover:bg-primary/5 rounded-[2.5rem] transition-all"
                     >
                        <LogOut className="w-5 h-5 opacity-30" /> Terminate Secure Session
                     </button>
                     <button 
                       onClick={() => setIsDeletingAccount(true)}
                       className="w-full py-5 text-burgundy/20 font-black uppercase tracking-[0.5em] text-[10px] hover:text-burgundy transition-colors italic"
                     >
                        Purge Digital Identity Permanently
                     </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Deletion Modal */}
        <AnimatePresence>
          {isDeletingAccount && (
            <div className="fixed inset-0 bg-burgundy/10 backdrop-blur-3xl z-[150] flex items-center justify-center p-10">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0, y: 50 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.9, opacity: 0, y: 50 }}
                 className="bg-white rounded-[5rem] p-16 w-full max-w-sm text-center shadow-3xl border border-burgundy/10"
               >
                  <div className="w-28 h-28 bg-burgundy/5 rounded-[3rem] flex items-center justify-center text-burgundy mx-auto mb-12 shadow-inner"><Trash2 className="w-14 h-14" /></div>
                  <h3 className="text-4xl font-sans font-black text-primary mb-6 tracking-tight">계정 탈퇴 확인</h3>
                  <p className="text-base text-on-surface-variant/60 leading-relaxed mb-14 px-4">모든 데이터가 영구적으로 파기되어 복구가 불가능합니다. 시스템에서의 영구 삭제를 승인하시겠습니까?</p>
                  <div className="flex flex-col gap-4">
                     <button 
                       onClick={() => {
                          deleteAccount();
                          setIsDeletingAccount(false);
                          setIsSettingsOpen(false);
                       }}
                       className="w-full py-8 bg-burgundy text-white rounded-[2rem] font-black uppercase tracking-widest text-[12px] shadow-3xl active:scale-95 transition-all outline-none"
                     >삭제 승인</button>
                     <button onClick={() => setIsDeletingAccount(false)} className="w-full py-5 text-[11px] font-black uppercase tracking-[0.5em] text-primary/20 outline-none">탈퇴 취소</button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Add missing icon for Profile Settings
function Smartphone(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
