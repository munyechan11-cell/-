import { useEffect, useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits } from '../../store';
import { LogOut, Ticket, Award, Calendar, X, ArrowLeft, LogOut as LeaveIcon, MessageSquare, Bell, Edit3 } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';

export default function CustomerDashboard() {
  const { currentUser, visits, coupons, users, tables, logout, leaveTable, communications, tierOverrides, requestCouponUse, cancelCouponRequest, updateUserMemo } = useStore();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [cancelingCoupon, setCancelingCoupon] = useState<string | null>(null);
  const [editingMemo, setEditingMemo] = useState(false);

  useEffect(() => {
    if (currentUser && storeId && currentUser.storeId !== storeId) {
      logout();
      navigate(`/customer/store/${storeId}/login`);
    }
  }, [currentUser, storeId, logout, navigate]);

  if (!currentUser || currentUser.storeId !== storeId) return null;

  const owner = users.find(u => u.id === storeId && u.role === 'owner');
  if (!owner) {
    return (
      <div className="min-h-full bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm text-center border border-slate-100">
          <p className="text-slate-500 mb-4">가게 정보를 찾을 수 없습니다.</p>
          <Link to="/scan" className="text-indigo-600 font-bold">스캐너로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const restaurantName = owner.restaurantName || '단골 매장';

  const myVisits = visits.filter(v => v.customerId === currentUser.id && v.storeId === storeId);
  const myCoupons = coupons.filter(c => c.customerId === currentUser.id && c.storeId === storeId && (c.status === 'available' || c.status === 'pending'));
  const myCommunications = communications.filter(c => c.customerId === currentUser.id && c.storeId === storeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const currentTable = tables.find(t => t.currentCustomerId === currentUser.id && t.storeId === storeId);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentVisits = myVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
  const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;
  const recentVisitsCount = uniqueVisitDays;
  
  const override = tierOverrides.find(t => t.customerId === currentUser.id && t.storeId === storeId);
  const currentTier = getEffectiveTier(recentVisitsCount, override?.tier);

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
  const activeCancelingCoupon = myCoupons.find(c => c.id === cancelingCoupon);

  return (
    <div className="min-h-full bg-hanji-light dark:bg-hanji-dark pb-20 max-w-lg mx-auto">
      {/* Header Profile Section (Instagram Style) */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md text-ink-light dark:text-ink-dark p-6 pt-8 border-b border-ink-light/10 dark:border-ink-dark/10 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-6 relative">
          <Link to="/scan" className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
          </Link>
          <h1 className="text-xl font-serif font-bold tracking-tight flex-1 text-center">{restaurantName}</h1>
          <button onClick={handleLogout} className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors">
            <LogOut className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
          </button>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-burgundy to-espresso rounded-full p-1 shadow-md shrink-0">
            <div className="w-full h-full bg-hanji-light dark:bg-hanji-dark rounded-full flex items-center justify-center text-burgundy dark:text-burgundy-light font-serif font-bold text-2xl border-2 border-white/50 dark:border-black/50">
              {currentUser.name.charAt(0)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark truncate">{currentUser.name}</h2>
            <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm font-medium mt-1">단골 손님</p>
            
            <div className="mt-3 flex items-start justify-between bg-white dark:bg-black/20 p-3 rounded-xl border border-ink-light/10 dark:border-ink-dark/10">
              <div className="flex-1 mr-2">
                <p className="text-xs font-bold text-ink-light/50 dark:text-ink-dark/50 mb-1">나의 메모 (가게 전달용)</p>
                <p className="text-sm text-ink-light/80 dark:text-ink-dark/80 break-words">
                  {currentUser.memo ? formatMemoDisplay(currentUser.memo) : <span className="text-ink-light/40 dark:text-ink-dark/40 italic">메모가 없습니다.</span>}
                </p>
              </div>
              <button 
                onClick={() => setEditingMemo(true)}
                className="p-2 bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 text-ink-light/60 dark:text-ink-dark/60 rounded-lg hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors shadow-sm shrink-0"
                title="메모 수정"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {currentTable && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-burgundy dark:text-burgundy-light text-xs font-bold bg-burgundy/10 dark:bg-burgundy/20 px-3 py-1.5 rounded-full border border-burgundy/20 dark:border-burgundy/30 shrink-0">
                  테이블 {currentTable.number}
                </span>
                <button 
                  onClick={handleLeaveStore}
                  className="flex items-center text-xs font-bold bg-white dark:bg-black/20 text-ink-light/60 dark:text-ink-dark/60 border border-ink-light/10 dark:border-ink-dark/10 px-3 py-1.5 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors shadow-sm shrink-0"
                >
                  <LeaveIcon className="w-3 h-3 mr-1" />
                  퇴장
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-around mt-8 pt-6 border-t border-ink-light/10 dark:border-ink-dark/10">
          <div className="text-center">
            <p className="text-2xl font-bold text-ink-light dark:text-ink-dark">{recentVisitsCount}</p>
            <p className="text-xs font-medium text-ink-light/50 dark:text-ink-dark/50 mt-1">최근 방문</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-ink-light dark:text-ink-dark">{myCoupons.length}</p>
            <p className="text-xs font-medium text-ink-light/50 dark:text-ink-dark/50 mt-1">보유 쿠폰</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-burgundy dark:text-burgundy-light">{currentTier}</p>
            <p className="text-xs font-medium text-ink-light/50 dark:text-ink-dark/50 mt-1">현재 등급</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6 relative z-10">
        
        {/* Notifications / Messages */}
        {myCommunications.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
            <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark mb-4 px-2 flex items-center text-base">
              <span className="w-1.5 h-4 bg-olive rounded-full mr-2"></span>
              알림 및 메시지
            </h3>
            <div className="space-y-3">
              {myCommunications.slice(0, 3).map((comm, index) => (
                <div key={comm.id} className="bg-white dark:bg-black/20 rounded-2xl p-4 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${(index + 2) * 100}ms`, animationFillMode: 'both' }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold flex items-center ${comm.type === 'coupon' ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy-light/20 dark:text-burgundy-light' : 'bg-olive/10 text-olive dark:bg-olive/20 dark:text-olive-light'}`}>
                      {comm.type === 'coupon' ? <Ticket className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                      {comm.type === 'coupon' ? '서비스 알림' : '가게 메시지'}
                    </span>
                    <span className="text-xs text-ink-light/40 dark:text-ink-dark/40">
                      {new Date(comm.date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-ink-light/80 dark:text-ink-dark/80 text-sm font-medium">{comm.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier Card */}
        <div className="bg-white dark:bg-black/20 rounded-3xl p-6 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark flex items-center text-base">
              <span className="w-1.5 h-4 bg-burgundy rounded-full mr-2"></span>
              나의 등급
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              currentTier === 'VIP' ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-burgundy-light' :
              currentTier === '다이아' ? 'bg-espresso/10 text-espresso dark:bg-espresso/20 dark:text-espresso-light' :
              currentTier === '골드' ? 'bg-mustard/20 text-mustard-dark dark:bg-mustard/30 dark:text-mustard' :
              currentTier === '실버' ? 'bg-ink-light/5 text-ink-light dark:bg-ink-dark/10 dark:text-ink-dark' :
              'bg-olive/10 text-olive dark:bg-olive/20 dark:text-olive-light'
            }`}>
              {currentTier}
            </span>
          </div>
          
          <div className="bg-hanji-light dark:bg-hanji-dark rounded-2xl p-4 border border-ink-light/10 dark:border-ink-dark/10">
            {override ? (
              <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 font-medium text-center">
                사장님이 특별 부여한 등급입니다.
              </p>
            ) : (
              <>
                <div className="flex justify-between text-sm text-ink-light/50 dark:text-ink-dark/50 mb-2">
                  <span>최근 30일 방문</span>
                  <span className="font-bold text-ink-light dark:text-ink-dark">{recentVisitsCount}회</span>
                </div>
                <div className="w-full bg-ink-light/10 dark:bg-ink-dark/10 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-burgundy dark:bg-burgundy-light h-full rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${Math.min((recentVisitsCount / getNextTierVisits(recentVisitsCount)) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-ink-light/40 dark:text-ink-dark/40 mt-2 text-right">
                  다음 등급까지 {getNextTierVisits(recentVisitsCount) - recentVisitsCount}회 남았습니다.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Coupons */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
          <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark mb-4 px-2 flex items-center text-base">
            <span className="w-1.5 h-4 bg-mustard rounded-full mr-2"></span>
            나의 쿠폰 (My Coupons)
          </h3>
          
          {myCoupons.length === 0 ? (
            <div className="bg-white dark:bg-black/20 rounded-3xl p-8 text-center shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
              <div className="w-12 h-12 bg-hanji-light dark:bg-hanji-dark rounded-full flex items-center justify-center mx-auto mb-3">
                <Ticket className="w-6 h-6 text-ink-light/30 dark:text-ink-dark/30" />
              </div>
              <p className="text-ink-light/50 dark:text-ink-dark/50 font-medium text-sm">현재 사용 가능한 쿠폰이 없습니다.</p>
              <p className="text-xs text-ink-light/40 dark:text-ink-dark/40 mt-2">방문 횟수를 늘려 등급 혜택을 받아보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myCoupons.map((coupon, index) => (
                <button
                  key={coupon.id}
                  onClick={() => {
                    if (coupon.status === 'available') {
                      setSelectedCoupon(coupon.id);
                    } else if (coupon.status === 'pending') {
                      setCancelingCoupon(coupon.id);
                    }
                  }}
                  className={`w-full bg-white dark:bg-black/20 rounded-2xl p-5 shadow-sm border flex justify-between items-center transition-all text-left animate-in fade-in slide-in-from-bottom-4 ${coupon.status === 'pending' ? 'border-mustard/30 bg-mustard/5 dark:border-mustard/20 dark:bg-mustard/10' : 'border-ink-light/10 dark:border-ink-dark/10 hover:border-burgundy/30 dark:hover:border-burgundy-light/30 hover:shadow-md'}`}
                  style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'both' }}
                >
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block ${coupon.status === 'pending' ? 'bg-mustard/20 text-mustard-dark dark:bg-mustard/30 dark:text-mustard' : 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-burgundy-light'}`}>
                      {coupon.status === 'pending' ? '사용 승인 대기중' : '사용 가능'}
                    </span>
                    <h4 className="font-bold text-ink-light dark:text-ink-dark">{coupon.description}</h4>
                  </div>
                  <div className={`${coupon.status === 'pending' ? 'bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 text-ink-light/50 dark:text-ink-dark/50 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10' : 'bg-burgundy dark:bg-burgundy-light text-hanji-light dark:text-ink-dark hover:bg-burgundy/90 dark:hover:bg-burgundy-light/90 shadow-sm'} px-4 py-2 rounded-xl text-sm font-bold transition-all`}>
                    {coupon.status === 'pending' ? '요청 취소' : '사용하기'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
          <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark mb-4 px-2 flex items-center text-base">
            <span className="w-1.5 h-4 bg-espresso rounded-full mr-2"></span>
            최근 방문 내역
          </h3>
          <div className="bg-white dark:bg-black/20 rounded-3xl p-4 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
            {myVisits.length === 0 ? (
              <p className="text-center text-ink-light/50 dark:text-ink-dark/50 py-4 text-sm">방문 내역이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {myVisits.slice().reverse().slice(0, 5).map(visit => (
                  <div key={visit.id} className="flex justify-between items-center border-b border-ink-light/5 dark:border-ink-dark/5 last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium text-ink-light dark:text-ink-dark text-sm">
                        {new Date(visit.date).toLocaleDateString('ko-KR')}
                      </p>
                      <p className="text-xs text-ink-light/50 dark:text-ink-dark/50 mt-0.5">테이블 {visit.tableNumber}번</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {selectedCoupon && activeCoupon && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-hanji-light dark:bg-hanji-dark rounded-[2rem] p-8 max-w-sm w-full text-center relative shadow-2xl animate-in zoom-in-95 duration-200 border border-ink-light/10 dark:border-ink-dark/10">
            <button 
              onClick={() => setSelectedCoupon(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
            >
              <X className="w-5 h-5 text-ink-light/40 dark:text-ink-dark/40" />
            </button>
            
            <div className="w-16 h-16 bg-burgundy/10 dark:bg-burgundy/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Ticket className="w-8 h-8 text-burgundy dark:text-burgundy-light" />
            </div>
            
            <h3 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark mb-2">서비스 쿠폰 사용</h3>
            <p className="text-ink-light/60 dark:text-ink-dark/60 mb-6 text-sm">{activeCoupon.description}</p>
            
            <p className="text-sm font-bold text-burgundy dark:text-burgundy-light bg-burgundy/5 dark:bg-burgundy/10 p-3 rounded-xl mb-6">
              사장님께 쿠폰 사용을 요청하시겠습니까?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedCoupon(null)}
                className="flex-1 py-3 bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 text-ink-light/60 dark:text-ink-dark/60 rounded-xl font-bold hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (currentTable) {
                    requestCouponUse(activeCoupon.id, currentTable.number);
                    setSelectedCoupon(null);
                  } else {
                    import('../../store').then(({ showToast }) => showToast('테이블에 착석한 상태에서만 사용할 수 있습니다.', 'error')).catch(console.error);
                  }
                }}
                className="flex-1 py-3 bg-burgundy hover:bg-burgundy/90 text-hanji-light rounded-xl font-bold transition-colors shadow-sm"
              >
                사용 요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request Modal */}
      {cancelingCoupon && activeCancelingCoupon && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-hanji-light dark:bg-hanji-dark rounded-[2rem] p-8 max-w-sm w-full text-center relative shadow-2xl animate-in zoom-in-95 duration-200 border border-ink-light/10 dark:border-ink-dark/10">
            <button 
              onClick={() => setCancelingCoupon(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
            >
              <X className="w-5 h-5 text-ink-light/40 dark:text-ink-dark/40" />
            </button>
            
            <h3 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark mb-2">요청 취소</h3>
            <p className="text-ink-light/60 dark:text-ink-dark/60 mb-6 text-sm">쿠폰 사용 요청을 취소하시겠습니까?</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setCancelingCoupon(null)}
                className="flex-1 py-3 bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 text-ink-light/60 dark:text-ink-dark/60 rounded-xl font-bold hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
              >
                아니오
              </button>
              <button
                onClick={() => {
                  cancelCouponRequest(cancelingCoupon);
                  setCancelingCoupon(null);
                }}
                className="flex-1 py-3 bg-red-600/90 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memo Modal */}
      <MemoModal
        isOpen={editingMemo}
        onClose={() => setEditingMemo(false)}
        initialMemo={currentUser.memo || ''}
        onSave={(memo) => {
          updateUserMemo(currentUser.id, storeId, memo);
        }}
      />
    </div>
  );
}
