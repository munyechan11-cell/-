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
  const { linkSocialAccount, deleteAccount } = useStore();

  useEffect(() => {
    if (currentUser && storeId && currentUser.storeId !== storeId) {
      logout();
      navigate(`/customer/store/${storeId}/login`);
    }
  }, [currentUser, storeId, logout, navigate]);

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
          
          {/* VIP Membership Card */}
          <section className="relative perspective-1000">
             <motion.div 
               whileHover={{ rotateY: 5, rotateX: -5 }}
               className="relative h-64 w-full rounded-[3rem] bg-gyeol-wood p-10 text-white shadow-premium overflow-hidden group border border-white/10"
             >
                {/* Holographic Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 opacity-50"></div>
                <div className="absolute top-[-50%] right-[-50%] w-[300px] h-[300px] bg-gold/10 rounded-full blur-[80px] group-hover:scale-150 transition-transform duration-[2000ms]"></div>
                
                <div className="relative z-10 h-full flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div className="flex gap-5 items-center">
                         <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 p-1 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
                            {currentUser.avatarUrl ? (
                               <img src={currentUser.avatarUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                               <User className="w-8 h-8 text-white/40" />
                            )}
                         </div>
                         <div>
                            <h2 className="text-2xl font-serif font-black italic tracking-tight">{currentUser.name}</h2>
                            <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">Exclusive Member</p>
                         </div>
                      </div>
                      <div className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl ${getTierColor(currentTier)} border border-white/20`}>
                         {getTierCustomName(currentTier, owner?.tierNames)}
                      </div>
                   </div>
                   
                   <div className="flex justify-between items-end border-t border-white/5 pt-6">
                      <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase tracking-widest text-gold/60">Membership Visits</p>
                         <p className="text-3xl font-serif font-black italic">{myVisits.length}<span className="text-xs ml-1 opacity-50 uppercase">회</span></p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black uppercase tracking-widest text-white/30 italic">ID: {currentUser.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                   </div>
                </div>
             </motion.div>
          </section>

          {/* Table Active Session HUD - Pulse Effect */}
          {currentTable && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8 flex justify-between items-center relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-2 h-full bg-primary/20"></div>
               <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl animate-ping opacity-40"></div>
                    <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl relative z-10"><MapPin className="w-6 h-6" /></div>
                  </div>
                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] opacity-60">Currently Occupying</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                     </div>
                     <p className="text-2xl font-serif font-black text-primary italic leading-none">{currentTable.number}번 테이블</p>
                  </div>
               </div>
               <motion.button 
                 whileTap={{ scale: 0.9 }}
                 onClick={handleLeaveStore} 
                 className="p-4 bg-white rounded-2xl text-burgundy shadow-sm border border-burgundy/10 hover:bg-burgundy hover:text-white transition-all"
               >
                 <LeaveIcon className="w-6 h-6" />
               </motion.button>
            </motion.div>
          )}

          {/* Quick Hub Portal */}
          <section className="grid grid-cols-2 gap-6 pb-6">
             <motion.button 
               whileTap={{ scale: 0.98 }}
               onClick={() => setEditingMemo(true)} 
               className="bg-white p-8 rounded-[2.5rem] border border-primary/5 shadow-premium hover:shadow-2xl transition-all text-left relative group overflow-hidden"
             >
                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all"><Edit3 className="w-6 h-6" /></div>
                <p className="text-[11px] font-black uppercase text-primary/30 tracking-widest leading-tight">사장님께 전하는</p>
                <p className="text-xl font-serif font-black text-primary italic">나의 기록</p>
             </motion.button>
             
             <motion.button 
               whileTap={{ scale: 0.98 }}
               onClick={() => navigate('/scan')} 
               className="bg-white p-8 rounded-[2.5rem] border border-primary/5 shadow-premium hover:shadow-2xl transition-all text-left relative group overflow-hidden"
             >
                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-all"><QrCode className="w-6 h-6" /></div>
                <p className="text-[11px] font-black uppercase text-primary/30 tracking-widest leading-tight">손님 맞이용</p>
                <p className="text-xl font-serif font-black text-primary italic">QR 스캔</p>
             </motion.button>
          </section>

          {/* Exclusive Benefits (Coupons) */}
          <section className="space-y-6">
             <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                   <Ticket className="w-5 h-5 text-primary opacity-30" />
                   <h3 className="font-serif font-black text-lg italic text-primary uppercase tracking-tight">나의 특권</h3>
                </div>
                <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-3 py-1 rounded-full">{myCoupons.length}개 보유</span>
             </div>
             
             {myCoupons.length === 0 ? (
                <div className="bg-white py-14 rounded-[3rem] border border-dashed border-primary/10 text-center">
                   <Sparkles className="w-10 h-10 text-primary/10 mx-auto mb-4" />
                   <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em]">첫 번째 혜택을 기다리는 중...</p>
                </div>
             ) : (
                <div className="space-y-4">
                   {myCoupons.map(coupon => (
                     <motion.button 
                       layout
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       key={coupon.id} 
                       onClick={() => coupon.status === 'available' ? setSelectedCoupon(coupon.id) : setCancelingCoupon(coupon.id)}
                       className={`w-full p-8 rounded-[2.5rem] border transition-all flex justify-between items-center group relative overflow-hidden ${coupon.status === 'pending' ? 'bg-primary/5 border-primary/20' : 'bg-white border-primary/5 shadow-premium hover:scale-[1.01]'}`}
                     >
                        {coupon.status === 'pending' && <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/40 animate-pulse"></div>}
                        <div className="text-left flex items-center gap-6">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${coupon.status === 'pending' ? 'bg-primary/10 text-primary' : 'bg-gold/10 text-gold'}`}>
                              <Ticket className="w-6 h-6" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase text-primary/40 mb-1">{coupon.status === 'pending' ? '사용 승인 대기 중' : '즉시 사용 가능'}</p>
                              <p className="text-xl font-serif font-black text-primary italic leading-tight">{coupon.description}</p>
                           </div>
                        </div>
                        <div className={`p-4 rounded-full ${coupon.status === 'pending' ? 'bg-burgundy/10 text-burgundy' : 'bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all'}`}>
                           {coupon.status === 'pending' ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                     </motion.button>
                   ))}
                </div>
             )}
          </section>

          {/* Chronicles: Visit History */}
          <section className="space-y-6">
             <div className="flex items-center gap-3 px-2">
                <History className="w-5 h-5 text-primary opacity-30" />
                <h3 className="font-serif font-black text-lg italic text-primary uppercase tracking-tight">방문의 기록</h3>
             </div>
             
             {myVisits.length === 0 ? (
                <div className="bg-white py-14 rounded-[3rem] border border-dashed border-primary/10 text-center">
                   <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest">새로운 이야기가 시작될 곳입니다.</p>
                </div>
             ) : (
                <div className="bg-white rounded-[3rem] border border-primary/5 overflow-hidden shadow-premium">
                   {myVisits.slice(0, 5).map((visit, idx) => (
                      <div key={visit.id} className={`p-6 flex justify-between items-center ${idx !== 0 ? 'border-t border-primary/5' : ''}`}>
                         <div className="flex items-center gap-5">
                            <div className="w-10 h-10 rounded-xl bg-surface-bright flex items-center justify-center text-primary/30 border border-primary/5"><Clock className="w-5 h-5" /></div>
                            <div>
                               <p className="text-sm font-black text-primary italic">{new Date(visit.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
                               <p className="text-[9px] font-bold text-primary/30 uppercase tracking-tighter">{visit.tableNumber}번 테이블 이용 (오후 {new Date(visit.date).getHours()}:{new Date(visit.date).getMinutes()})</p>
                            </div>
                         </div>
                         <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary/30 italic">#{myVisits.length - idx}</div>
                      </div>
                   ))}
                   <Link to="#" className="w-full py-5 bg-surface-bright/50 text-center block border-t border-primary/5">
                      <p className="text-[10px] font-black uppercase text-primary/20 tracking-[0.3em] hover:text-primary transition-colors">전체 기록 보기</p>
                   </Link>
                </div>
             )}
          </section>
        </div>

        {/* Cinematic Bottom Hub */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[380px] bg-sidebar-bg/95 backdrop-blur-2xl px-10 py-6 rounded-[2.5rem] flex justify-between items-center z-50 shadow-2xl border border-white/5">
           <Link to={`/customer/store/${storeId}/dashboard`} className="flex flex-col items-center gap-2 text-white">
              <Zap className="w-6 h-6" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Home</span>
           </Link>
           <motion.button 
             whileHover={{ scale: 1.1, y: -5 }}
             whileTap={{ scale: 0.9 }}
             onClick={() => navigate('/scan')} 
             className="w-20 h-20 -mt-20 bg-primary text-white rounded-[2rem] shadow-2xl flex items-center justify-center border-8 border-surface-bright active:scale-95 transition-all outline-none"
           >
              <QrCode className="w-9 h-9" />
           </motion.button>
           <button onClick={() => setSendingMessage(true)} className="flex flex-col items-center gap-2 text-white/40 hover:text-white transition-all">
              <div className="relative">
                <MessageSquare className="w-6 h-6" />
                {myCommunications.length > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full shadow-lg"></div>}
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Pulse</span>
           </button>
        </div>

        {/* Cinematic Modals */}
        <AnimatePresence>
          {selectedCoupon && activeCoupon && (
            <div className="fixed inset-0 bg-primary/60 backdrop-blur-xl flex items-center justify-center p-8 z-[100]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[4rem] p-12 w-full max-w-sm text-center shadow-3xl border border-white/10"
              >
                 <div className="w-24 h-24 bg-primary rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-10 shadow-3xl rotate-6 group overflow-hidden">
                    <Ticket className="w-12 h-12" />
                 </div>
                 <h3 className="text-3xl font-serif font-black text-primary italic mb-4">Benefit Redemption</h3>
                 <p className="text-sm text-on-surface-variant/60 leading-relaxed mb-10 px-4">"{activeCoupon.description}" 혜택을 지금 사용하시겠습니까? 사장님께 승인 요청이 전송됩니다.</p>
                 <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        if (currentTable) {
                          requestCouponUse(activeCoupon.id, currentTable.number);
                          setSelectedCoupon(null);
                        } else {
                          setSelectedCoupon(null);
                          showToast('테이블 입장이 필요합니다. QR 스캔을 완료해 주세요.', 'error');
                        }
                      }}
                      className="w-full py-6 bg-primary text-white rounded-[1.5rem] font-bold uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all"
                    >사용 요청하기</button>
                    <button onClick={() => setSelectedCoupon(null)} className="w-full py-4 text-[10px] font-black uppercase tracking-[0.4em] text-primary/30 hover:text-primary transition-colors">나중에 쓰기</button>
                 </div>
              </motion.div>
            </div>
          )}

          {sendingMessage && (
            <div className="fixed inset-0 bg-primary/40 backdrop-blur-md flex items-end justify-center z-[100]">
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-white w-full max-w-md rounded-t-[4rem] p-12 shadow-3xl flex flex-col gap-10"
              >
                 <div className="flex justify-between items-center">
                    <div className="space-y-1">
                       <h3 className="text-3xl font-serif font-black text-primary italic">매장과의 소통</h3>
                       <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Connect with our staff</p>
                    </div>
                    <button onClick={() => setSendingMessage(false)} className="p-4 bg-surface-container rounded-full hover:bg-primary/5 transition-colors"><X className="w-5 h-5 text-primary/30" /></button>
                 </div>
                 <textarea 
                   autoFocus
                   rows={5}
                   className="w-full bg-surface-container border-none rounded-[2rem] p-8 text-base font-serif italic text-primary focus:ring-2 focus:ring-primary/20 resize-none"
                   placeholder="남기고 싶은 말씀을 자유롭게 적어주세요..."
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
                       showToast('메시지가 사장님께 전송되었습니다.', 'success');
                     } catch (err) {
                       console.error(err);
                     } finally {
                       setIsSending(false);
                     }
                   }}
                   disabled={isSending || !messageContent.trim()}
                   className="w-full py-6 bg-primary text-white rounded-[2rem] font-bold uppercase tracking-widest text-[11px] disabled:opacity-30 shadow-3xl flex items-center justify-center gap-4 transition-all"
                 >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    SEND MESSAGE
                 </button>
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
            <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[110] flex items-end sm:items-center justify-center p-0 sm:p-8">
               <motion.div 
                 initial={{ y: "100%" }}
                 animate={{ y: 0 }}
                 exit={{ y: "100%" }}
                 className="bg-white w-full max-w-md rounded-t-[4rem] sm:rounded-[4rem] p-12 shadow-3xl flex flex-col gap-10 max-h-[90vh] overflow-y-auto no-scrollbar"
               >
                  <div className="flex justify-between items-center">
                     <div>
                        <h3 className="text-3xl font-serif font-black text-primary italic">프로필 설정</h3>
                        <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Account Governance</p>
                     </div>
                     <button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-surface-container rounded-full hover:bg-primary/5 transition-colors"><X className="w-5 h-5 text-primary/30" /></button>
                  </div>

                  <div className="space-y-10">
                     <div className="bg-surface-container p-8 rounded-[3rem] flex items-center gap-8 border border-primary/5">
                        <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-primary shadow-xl p-1 overflow-hidden">
                           {currentUser.avatarUrl ? (
                             <img src={currentUser.avatarUrl} className="w-full h-full object-cover rounded-[1.5rem]" alt="" />
                           ) : (
                             <User className="w-10 h-10 opacity-20" />
                           )}
                        </div>
                        <div>
                           <p className="text-2xl font-serif font-black text-primary italic">{currentUser.name}</p>
                           <p className="text-xs font-bold text-primary/30 uppercase tracking-widest">{currentUser.phone || 'Social Verified'}</p>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/20 px-2">연동된 디지털 아이덴티티</p>
                        <div className="grid grid-cols-1 gap-4">
                           <div className="flex items-center justify-between p-6 bg-surface-bright border border-primary/10 rounded-[2rem]">
                              <div className="flex items-center gap-4">
                                 <Mail className="w-5 h-5 text-primary/30" />
                                 <span className="text-sm font-black italic">전화번호</span>
                              </div>
                              <span className="text-[9px] font-black text-primary uppercase bg-primary/5 px-4 py-1.5 rounded-full ring-1 ring-primary/20">Active Session</span>
                           </div>
                           
                           {/* Social Links... */}
                           {['google', 'kakao'].map(provider => (
                             <button 
                               key={provider}
                               onClick={async () => {
                                 if (currentUser.linkedProviders?.includes(provider as any)) return;
                                 try {
                                   await linkSocialAccount(provider as any);
                                 } catch (error: any) {
                                   showToast(error.message || '연동 중 오류가 발생했습니다.', 'error');
                                 }
                               }}
                               className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${currentUser.linkedProviders?.includes(provider as any) ? 'bg-white border-primary/10' : 'bg-surface-container border-transparent hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98]'}`}
                             >
                                <div className="flex items-center gap-4">
                                   {provider === 'google' ? <Globe className="w-5 h-5 text-primary/30" /> : <MessageSquare className="w-5 h-5 text-primary/30" />}
                                   <span className="text-sm font-black italic capitalize text-primary/60">{provider} Identity</span>
                                </div>
                                {currentUser.linkedProviders?.includes(provider as any) ? (
                                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full ring-1 ring-emerald-200">Verified</span>
                                ) : (
                                  <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest group-hover:text-primary transition-colors">계정 연동</span>
                                )}
                             </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="pt-10 border-t border-primary/5 flex flex-col gap-4">
                     <button 
                       onClick={handleLogout}
                       className="w-full py-6 text-primary font-black uppercase tracking-[0.4em] text-[11px] flex items-center justify-center gap-3 hover:bg-primary/5 rounded-[2rem] transition-all"
                     >
                        <LogOut className="w-4 h-4 opacity-30" /> Terminate Session
                     </button>
                     <button 
                       onClick={() => setIsDeletingAccount(true)}
                       className="w-full py-4 text-burgundy/20 font-black uppercase tracking-[0.4em] text-[9px] hover:text-burgundy transition-colors"
                     >
                        Permanently Delete Identity
                     </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Deletion Modal */}
        <AnimatePresence>
          {isDeletingAccount && (
            <div className="fixed inset-0 bg-burgundy/20 backdrop-blur-2xl z-[150] flex items-center justify-center p-8">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 className="bg-white rounded-[4rem] p-12 w-full max-w-sm text-center shadow-3xl border border-burgundy/10"
               >
                  <div className="w-24 h-24 bg-burgundy/5 rounded-[2.5rem] flex items-center justify-center text-burgundy mx-auto mb-10 shadow-inner"><Trash2 className="w-12 h-12" /></div>
                  <h3 className="text-3xl font-serif font-black text-primary italic mb-4">Identity Deletion</h3>
                  <p className="text-sm text-on-surface-variant/60 leading-relaxed mb-12 px-2">데이터가 영구적으로 파기됩니다. 이 작업은 되돌릴 수 없습니다. 삭제를 승인하시겠습니까?</p>
                  <div className="flex flex-col gap-3">
                     <button 
                       onClick={() => {
                          deleteAccount();
                          setIsDeletingAccount(false);
                          setIsSettingsOpen(false);
                       }}
                       className="w-full py-6 bg-burgundy text-white rounded-[1.5rem] font-bold uppercase tracking-widest text-[11px] shadow-3xl active:scale-95 transition-all"
                     >삭제 승인</button>
                     <button onClick={() => setIsDeletingAccount(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-[0.4em] text-primary/30">동작 취소</button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
