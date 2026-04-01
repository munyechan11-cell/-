import { useEffect, useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits, getTierCustomName } from '../../store';
import { 
  LogOut, Ticket, Award, Calendar, X, ArrowLeft, 
  LogOut as LeaveIcon, MessageSquare, Bell, Edit3, 
  Send, Loader2, Star, ShieldCheck, Heart, 
  TrendingUp, Clock, MapPin, Search, Filter,
  ChevronRight, Activity, Zap, Store as StoreIcon,
  ArrowUpRight, QrCode, User, Settings as SettingsIcon,
  ShieldAlert, Trash2, Mail, History
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';

export default function CustomerDashboard() {
  const { currentUser, visits, coupons, users, tables, logout, leaveTable, communications, tierOverrides, requestCouponUse, cancelCouponRequest, updateUserMemo, recordCommunication } = useStore();
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || isSending) return;
    setIsSending(true);
    try {
      await recordCommunication(currentUser.id, storeId!, 'message', messageContent.trim(), 'customer');
      setMessageContent('');
      setSendingMessage(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const activeCoupon = myCoupons.find(c => c.id === selectedCoupon);

  return (
    <div className="min-h-screen bg-[#fdfaf7] text-[#261c1a] font-sans selection:bg-primary/10 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col relative pb-32">
        
        {/* Header Section */}
        <header className="p-6 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-[#e5dcd3]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-serif italic text-xl shadow-lg">결</div>
             <div>
                <h1 className="font-serif font-black text-lg italic tracking-tight">{restaurantName}</h1>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">단골 전용 모바일 웹</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setSendingMessage(true)} className="p-2.5 bg-surface-container rounded-full text-primary hover:bg-primary/5 transition-all"><MessageSquare className="w-5 h-5" /></button>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-surface-container rounded-full text-on-surface-variant/40 hover:text-primary transition-all"><SettingsIcon className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-8 flex-1">
          {/* Welcome Bento Card */}
          <section className="glass-effect p-8 rounded-[3rem] text-primary shadow-2xl relative overflow-hidden group border-none">
             <div className="relative z-10 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                   <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center overflow-hidden border border-primary/10 shadow-inner">
                         {currentUser.avatarUrl ? (
                            <img src={currentUser.avatarUrl} className="w-full h-full object-cover" alt="" />
                         ) : (
                            <User className="w-8 h-8 text-primary opacity-20" />
                         )}
                      </div>
                      <div>
                         <h2 className="text-2xl font-serif font-black italic mb-1">반가워요, {currentUser.name}님!</h2>
                         <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">오늘도 {restaurantName}에서 즐거운 시간 되세요.</p>
                      </div>
                   </div>
                   <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg ${getTierColor(currentTier)} text-white animate-pulse-premium`}>
                      {getTierCustomName(currentTier, owner?.tierNames)}
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/40 backdrop-blur-sm p-6 rounded-[2rem] border border-primary/5 flex flex-col gap-1 items-center justify-center">
                      <p className="text-4xl font-serif font-black italic">{myVisits.length}</p>
                      <p className="text-[8px] font-black uppercase opacity-40">Total Visits</p>
                   </div>
                   <div className="bg-primary p-6 rounded-[2rem] text-white flex flex-col gap-1 items-center justify-center shadow-xl shadow-primary/20">
                      <p className="text-4xl font-serif font-black italic">{myCoupons.length}</p>
                      <p className="text-[8px] font-black uppercase opacity-40">Active Rewards</p>
                   </div>
                </div>

                <div className="flex items-center gap-4 bg-primary/5 p-5 rounded-[2rem] border border-primary/5">
                   <div className="p-3 bg-primary/5 rounded-2xl"><Activity className="w-5 h-5" /></div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-40">등급 성장률</p>
                         <p className="text-[10px] font-black text-primary">{Math.min(uniqueVisitDays, (uniqueVisitDays + getNextTierVisits(uniqueVisitDays)))} / {uniqueVisitDays + getNextTierVisits(uniqueVisitDays)}일</p>
                      </div>
                      <div className="h-2 bg-primary/5 rounded-full overflow-hidden">
                         <div className="h-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${Math.min((uniqueVisitDays / (uniqueVisitDays + getNextTierVisits(uniqueVisitDays))) * 100, 100)}%` }}></div>
                      </div>
                   </div>
                </div>
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
          </section>

          {/* Table Assignment Info */}
          {currentTable && (
            <div className="bg-[#4a0e0e]/5 border-2 border-primary/20 rounded-3xl p-6 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white"><MapPin className="w-6 h-6" /></div>
                  <div>
                     <p className="text-[10px] font-bold uppercase text-primary opacity-60">현재 이용 중인 매장</p>
                     <p className="text-lg font-serif font-black text-primary italic">{currentTable.number}번 테이블</p>
                  </div>
               </div>
               <button onClick={handleLeaveStore} className="p-3 text-burgundy/40 hover:text-burgundy transition-colors"><LeaveIcon className="w-6 h-6" /></button>
            </div>
          )}

          {/* Quick Actions Grid */}
          <section className="grid grid-cols-2 gap-4">
             <button onClick={() => setEditingMemo(true)} className="bg-white p-6 rounded-[2rem] border border-[#e5dcd3] shadow-sm hover:shadow-md transition-all text-left group">
                <div className="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform"><Edit3 className="w-5 h-5" /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">사장님께 남기는</p>
                <p className="font-serif font-black text-primary italic">단골 메모</p>
             </button>
             <button onClick={() => navigate('/scan')} className="bg-white p-6 rounded-[2rem] border border-[#e5dcd3] shadow-sm hover:shadow-md transition-all text-left group">
                <div className="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform"><QrCode className="w-5 h-5" /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">매장 입장</p>
                <p className="font-serif font-black text-primary italic">QR 스캔</p>
             </button>
          </section>

          {/* Rewards List */}
          <section className="space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-serif font-black text-xl italic text-primary">나의 혜택 (쿠폰)</h3>
                <span className="text-[10px] font-bold uppercase text-primary/40 leading-none">{myCoupons.length}개</span>
             </div>
             
             {myCoupons.length === 0 ? (
                <div className="bg-white py-12 rounded-[2rem] border border-dashed border-[#e5dcd3] text-center">
                   <Ticket className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
                   <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">아직 보유한 혜택이 없습니다.</p>
                </div>
             ) : (
                <div className="space-y-3">
                   {myCoupons.map(coupon => (
                     <button 
                       key={coupon.id} 
                       onClick={() => coupon.status === 'available' ? setSelectedCoupon(coupon.id) : setCancelingCoupon(coupon.id)}
                       className={`w-full p-6 rounded-2xl border transition-all flex justify-between items-center group ${coupon.status === 'pending' ? 'bg-primary/5 border-primary/20' : 'bg-white border-[#e5dcd3] shadow-sm hover:shadow-md'}`}
                     >
                        <div className="text-left">
                           <p className="text-[10px] font-bold uppercase text-primary/40 mb-1">{coupon.status === 'pending' ? '사용 승인 대기 중' : '사용 가능'}</p>
                           <p className="font-serif font-black text-primary italic">{coupon.description}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${coupon.status === 'pending' ? 'text-burgundy' : 'bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all'}`}>
                           {coupon.status === 'pending' ? <X className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                     </button>
                   ))}
                </div>
             )}
          </section>

          {/* Visit History Log */}
          <section className="space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-serif font-black text-xl italic text-primary">방문 기록</h3>
                <span className="text-[10px] font-bold uppercase text-primary/40 leading-none">{myVisits.length}회</span>
             </div>
             
             {myVisits.length === 0 ? (
                <div className="bg-white py-12 rounded-[2rem] border border-dashed border-[#e5dcd3] text-center">
                   <History className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
                   <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">첫 방문을 기다리고 있어요!</p>
                </div>
             ) : (
                <div className="bg-white rounded-[2rem] border border-[#e5dcd3] overflow-hidden shadow-sm">
                   {myVisits.slice(0, 5).map((visit, idx) => (
                      <div key={visit.id} className={`p-4 flex justify-between items-center ${idx !== 0 ? 'border-t border-outline-variant/10' : ''}`}>
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary/40"><Clock className="w-4 h-4" /></div>
                            <div>
                               <p className="text-xs font-bold text-primary">{new Date(visit.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</p>
                               <p className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">{visit.tableNumber}번 테이블 이용</p>
                            </div>
                         </div>
                         <div className="text-[10px] font-black text-primary/20 italic">#{myVisits.length - idx}</div>
                      </div>
                   ))}
                   {myVisits.length > 5 && (
                      <div className="p-3 bg-surface-container/30 text-center">
                         <p className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-widest">최근 5개 항목만 표시됩니다</p>
                      </div>
                   )}
                </div>
             )}
          </section>

          {/* Communication/News */}
          {myCommunications.length > 0 && (
            <section className="space-y-4">
               <h3 className="font-serif font-black text-xl italic text-primary">매장 소통함</h3>
               <div className="space-y-3">
                  {myCommunications.slice(0, 2).map(comm => (
                    <div key={comm.id} className="bg-white p-5 rounded-2xl border border-[#e5dcd3] shadow-sm">
                       <div className="flex justify-between items-center mb-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${comm.type === 'coupon' ? 'bg-primary' : 'bg-on-surface-variant/40'}`}>{comm.type === 'coupon' ? '쿠폰' : '메시지'}</span>
                          <span className="text-[9px] font-bold text-on-surface-variant/30">{new Date(comm.date).toLocaleDateString()}</span>
                       </div>
                       <p className="text-sm font-sans italic text-primary/80 leading-relaxed">{comm.content}</p>
                    </div>
                  ))}
               </div>
            </section>
          )}
        </div>

        {/* Floating Bottom Nav for Mobile Feel */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/90 backdrop-blur-md border-t border-[#e5dcd3] px-10 py-6 flex justify-between items-center z-50">
           <Link to={`/customer/store/${storeId}/dashboard`} className="flex flex-col items-center gap-1 text-primary">
              <Zap className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">홈</span>
           </Link>
           <button onClick={() => navigate('/scan')} className="w-16 h-16 -mt-12 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white active:scale-95 transition-all">
              <QrCode className="w-8 h-8" />
           </button>
           <button onClick={() => setSendingMessage(true)} className="flex flex-col items-center gap-1 text-on-surface-variant/40 hover:text-primary transition-all">
              <MessageSquare className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">소통</span>
           </button>
        </div>

        {/* Modals */}
        {selectedCoupon && activeCoupon && (
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-md flex items-center justify-center p-8 z-[100] animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-3xl border border-primary/10">
               <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl rotate-3"><Ticket className="w-10 h-10" /></div>
               <h3 className="text-2xl font-serif font-black text-primary italic mb-2">쿠폰 사용 확인</h3>
               <p className="text-xs text-on-surface-variant/60 leading-relaxed mb-8">"{activeCoupon.description}" 쿠폰을 사용하시겠습니까? 사장님께 사용 요청이 전송됩니다.</p>
               <div className="flex gap-4">
                  <button onClick={() => setSelectedCoupon(null)} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">취소</button>
                  <button 
                    onClick={() => {
                      if (currentTable) {
                        requestCouponUse(activeCoupon.id, currentTable.number);
                        setSelectedCoupon(null);
                      } else {
                        setSelectedCoupon(null);
                        alert('테이블 입장이 필요합니다. 메뉴의 QR 스캔을 이용해 주세요.');
                      }
                    }}
                    className="flex-[2] py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                  >사용하기</button>
               </div>
            </div>
          </div>
        )}

        {cancelingCoupon && (
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-md flex items-center justify-center p-8 z-[100] animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-3xl border border-primary/10">
               <h3 className="text-2xl font-serif font-black text-primary italic mb-2">사용 요청 취소</h3>
               <p className="text-xs text-on-surface-variant/60 leading-relaxed mb-8">아직 사장님이 승인하기 전입니다. 요청을 취소하시겠습니까?</p>
               <div className="flex gap-4">
                  <button onClick={() => setCancelingCoupon(null)} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">유지</button>
                  <button 
                    onClick={() => {
                      cancelCouponRequest(cancelingCoupon);
                      setCancelingCoupon(null);
                    }}
                    className="flex-[2] py-4 bg-burgundy text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                  >요청 취소</button>
               </div>
            </div>
          </div>
        )}

        {sendingMessage && (
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-md flex items-end justify-center z-[100] animate-in slide-in-from-bottom-full duration-500">
            <div className="bg-white w-full max-w-md rounded-t-[3rem] p-10 shadow-3xl flex flex-col gap-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-serif font-black text-primary italic">사장님께 소식 전하기</h3>
                  <button onClick={() => setSendingMessage(false)} className="p-2 bg-surface-container rounded-full"><X className="w-5 h-5 text-on-surface-variant/40" /></button>
               </div>
               <textarea 
                 autoFocus
                 rows={4}
                 className="w-full bg-surface-container border-none rounded-2xl p-6 text-sm font-sans focus:ring-1 focus:ring-primary resize-none"
                 placeholder="전하고 싶은 말씀을 입력해 주세요..."
                 value={messageContent}
                 onChange={e => setMessageContent(e.target.value)}
               />
               <button 
                 onClick={handleSendMessage}
                 disabled={isSending || !messageContent.trim()}
                 className="w-full py-5 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs disabled:opacity-30 shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
               >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  메시지 보내기
               </button>
            </div>
          </div>
        )}

        <MemoModal
          isOpen={editingMemo}
          onClose={() => setEditingMemo(false)}
          initialMemo={currentUser.memo || ''}
          onSave={memo => updateUserMemo(currentUser.id, storeId!, memo)}
        />

        {/* Profile Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-8 animate-in slide-in-from-bottom full duration-500">
             <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-10 shadow-3xl flex flex-col gap-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                   <h3 className="text-2xl font-serif font-black text-primary italic">프로필 설정</h3>
                   <button onClick={() => setIsSettingsOpen(false)} className="p-3 bg-surface-container rounded-full"><X className="w-5 h-5 text-on-surface-variant/40" /></button>
                </div>

                <div className="space-y-6">
                   <div className="bg-surface-container p-6 rounded-3xl flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm"><User className="w-8 h-8" /></div>
                      <div>
                         <p className="text-xl font-serif font-black text-primary">{currentUser.name}</p>
                         <p className="text-xs font-bold text-on-surface-variant/40">{currentUser.phone || '소셜 계정 전용'}</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary opacity-40">연동된 계정</p>
                      <div className="grid grid-cols-1 gap-3">
                         <div className="flex items-center justify-between p-4 bg-white border border-outline-variant/30 rounded-2xl">
                            <div className="flex items-center gap-3">
                               <Mail className="w-4 h-4 text-on-surface-variant/40" />
                               <span className="text-xs font-bold">전화번호</span>
                            </div>
                            <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-3 py-1 rounded-full">ACTIVE</span>
                         </div>
                         
                         {/* Google Link */}
                         <button 
                           onClick={() => !currentUser.linkedProviders?.includes('google') && linkSocialAccount('google')}
                           className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${currentUser.linkedProviders?.includes('google') ? 'bg-white border-outline-variant/30' : 'bg-surface-container border-transparent hover:border-primary'}`}
                         >
                            <div className="flex items-center gap-3">
                               <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                               <span className="text-xs font-bold">Google</span>
                            </div>
                            {currentUser.linkedProviders?.includes('google') ? (
                              <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-3 py-1 rounded-full">LINKED</span>
                            ) : (
                              <span className="text-[10px] font-black text-on-surface-variant/20 uppercase">계정 연동</span>
                            )}
                         </button>

                         {/* Kakao Link */}
                         <button 
                           onClick={() => !currentUser.linkedProviders?.includes('kakao') && linkSocialAccount('kakao')}
                           className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${currentUser.linkedProviders?.includes('kakao') ? 'bg-white border-outline-variant/30' : 'bg-[#FEE500]/10 border-transparent hover:border-[#3c1e1e]/20'}`}
                         >
                            <div className="flex items-center gap-3">
                               <div className="w-4 h-4 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[6px] text-[#FEE500] font-black">K</div>
                               <span className="text-xs font-bold text-[#3c1e1e]">Kakao</span>
                            </div>
                            {currentUser.linkedProviders?.includes('kakao') ? (
                               <span className="text-[10px] font-black text-[#3c1e1e] uppercase bg-[#FEE500] px-3 py-1 rounded-full">LINKED</span>
                            ) : (
                               <span className="text-[10px] font-black text-[#3c1e1e]/40 uppercase text-xs">계정 연동</span>
                            )}
                         </button>
                      </div>
                   </div>
                </div>

                <div className="pt-6 border-t border-outline-variant/10 flex flex-col gap-3">
                   <button 
                     onClick={handleLogout}
                     className="w-full py-4 text-burgundy font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-burgundy/5 rounded-2xl transition-all"
                   >
                      <LogOut className="w-4 h-4" /> 로그아웃
                   </button>
                   <button 
                     onClick={() => setIsDeletingAccount(true)}
                     className="w-full py-4 text-on-surface-variant/30 font-bold uppercase tracking-widest text-[10px] hover:text-burgundy transition-colors"
                   >
                      계정 삭제 (방문 기록 포함)
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Account Deletion Confirmation */}
        {isDeletingAccount && (
          <div className="fixed inset-0 bg-burgundy/10 backdrop-blur-md z-[120] flex items-center justify-center p-8 animate-in fade-in zoom-in-95">
             <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm text-center shadow-3xl border border-burgundy/20">
                <div className="w-20 h-20 bg-burgundy/5 rounded-3xl flex items-center justify-center text-burgundy mx-auto mb-8 shadow-inner"><Trash2 className="w-10 h-10" /></div>
                <h3 className="text-2xl font-serif font-black text-primary italic mb-2">계정 삭제 확인</h3>
                <p className="text-xs text-on-surface-variant/60 leading-relaxed mb-10">계정을 삭제하시겠습니까? 방문 기록과 쿠폰은 통계 데이터로 남지만, 개인 정보는 모두 파기되며 되돌릴 수 없습니다.</p>
                <div className="flex gap-4">
                   <button onClick={() => setIsDeletingAccount(false)} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">취소</button>
                   <button 
                     onClick={() => {
                        deleteAccount();
                        setIsDeletingAccount(false);
                        setIsSettingsOpen(false);
                     }}
                     className="flex-[2] py-4 bg-burgundy text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                   >삭제 실행</button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
