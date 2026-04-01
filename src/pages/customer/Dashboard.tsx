import { useEffect, useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits, getTierCustomName } from '../../store';
import { 
  LogOut, Ticket, Award, Calendar, X, ArrowLeft, 
  LogOut as LeaveIcon, MessageSquare, Bell, Edit3, 
  Send, Loader2, Star, ShieldCheck, Heart, 
  TrendingUp, Clock, MapPin, Search, Filter,
  ChevronRight, Activity, Zap, Store as StoreIcon,
  ArrowUpRight, QrCode
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
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);

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
             <button onClick={handleLogout} className="p-2.5 bg-surface-container rounded-full text-on-surface-variant/40 hover:text-burgundy transition-all"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-8 flex-1">
          {/* Welcome Bento Card */}
          <section className="bg-primary p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
             <div className="relative z-10 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                   <div>
                      <h2 className="text-2xl font-serif font-bold italic mb-1">반가워요, {currentUser.name}님!</h2>
                      <p className="text-xs opacity-70">오늘도 결에서 좋은 시간 보내세요.</p>
                   </div>
                   <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg ${getTierColor(currentTier)} text-white`}>
                      {getTierCustomName(currentTier, owner?.tierNames)}
                   </div>
                </div>
                
                <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
                   <div className="p-3 bg-white/10 rounded-xl"><Activity className="w-5 h-5" /></div>
                   <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">다음 등급까지</p>
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                         <div className="h-full bg-white" style={{ width: `${Math.min((uniqueVisitDays / (uniqueVisitDays + getNextTierVisits(uniqueVisitDays))) * 100, 100)}%` }}></div>
                      </div>
                   </div>
                   <span className="text-xs font-bold">{getNextTierVisits(uniqueVisitDays)}일 남음</span>
                </div>
             </div>
             <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-1000"></div>
          </section>

          {/* Table Assignment Info */}
          {currentTable && (
            <div className="bg-[#4a0e0e]/5 border-2 border-primary/20 rounded-3xl p-6 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white"><MapPin className="w-6 h-6" /></div>
                  <div>
                     <p className="text-[10px] font-bold uppercase text-primary opacity-60">현재 이용 중인 공방</p>
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-1">공방 입장</p>
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

          {/* Communication/News */}
          {myCommunications.length > 0 && (
            <section className="space-y-4">
               <h3 className="font-serif font-black text-xl italic text-primary">공방 소통함</h3>
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
      </div>
    </div>
  );
}
