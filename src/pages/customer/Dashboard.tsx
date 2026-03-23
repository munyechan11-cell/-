import { useEffect, useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits } from '../../store';
import { LogOut, Ticket, Award, Calendar, X, ArrowLeft, LogOut as LeaveIcon, MessageSquare, Bell } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';

export default function CustomerDashboard() {
  const { currentUser, visits, coupons, users, tables, logout, leaveTable, communications, tierOverrides, requestCouponUse, cancelCouponRequest } = useStore();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [cancelingCoupon, setCancelingCoupon] = useState<string | null>(null);

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
    <div className="min-h-full bg-slate-50 pb-20 max-w-lg mx-auto">
      {/* Header Profile Section (Instagram Style) */}
      <div className="bg-white text-slate-900 p-6 pt-8 border-b border-slate-100 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-6 relative">
          <Link to="/scan" className="p-2 bg-white rounded-full hover:bg-slate-50 shadow-sm border border-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight flex-1 text-center">{restaurantName}</h1>
          <button onClick={handleLogout} className="p-2 bg-white rounded-full hover:bg-slate-50 shadow-sm border border-slate-200 transition-colors">
            <LogOut className="w-5 h-5 text-slate-700" />
          </button>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full p-1 shadow-md shrink-0">
            <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl border-2 border-white">
              {currentUser.name.charAt(0)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 truncate">{currentUser.name}</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">단골 손님</p>
            {currentTable && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-indigo-600 text-xs font-bold bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 shrink-0">
                  테이블 {currentTable.number}
                </span>
                <button 
                  onClick={handleLeaveStore}
                  className="flex items-center text-xs font-bold bg-white text-slate-600 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors shadow-sm shrink-0"
                >
                  <LeaveIcon className="w-3 h-3 mr-1" />
                  퇴장
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-around mt-8 pt-6 border-t border-slate-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{recentVisitsCount}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">최근 방문</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{myCoupons.length}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">보유 쿠폰</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{currentTier}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">현재 등급</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6 relative z-10">
        
        {/* Notifications / Messages */}
        {myCommunications.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
            <h3 className="font-bold text-slate-900 mb-4 px-2 flex items-center text-sm">
              <Bell className="w-4 h-4 mr-2 text-indigo-500" />
              알림 및 메시지
            </h3>
            <div className="space-y-3">
              {myCommunications.slice(0, 3).map((comm, index) => (
                <div key={comm.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${(index + 2) * 100}ms`, animationFillMode: 'both' }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold flex items-center ${comm.type === 'coupon' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                      {comm.type === 'coupon' ? <Ticket className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                      {comm.type === 'coupon' ? '서비스 알림' : '가게 메시지'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(comm.date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-slate-700 text-sm font-medium">{comm.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900 flex items-center text-sm">
              <Award className="w-4 h-4 mr-2 text-indigo-500" />
              나의 등급
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              currentTier === 'VIP' ? 'bg-purple-100 text-purple-700' :
              currentTier === '다이아' ? 'bg-blue-100 text-blue-700' :
              currentTier === '골드' ? 'bg-yellow-100 text-yellow-700' :
              currentTier === '실버' ? 'bg-slate-100 text-slate-700' :
              'bg-orange-100 text-orange-700'
            }`}>
              {currentTier}
            </span>
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            {override ? (
              <p className="text-sm text-slate-600 font-medium text-center">
                사장님이 특별 부여한 등급입니다.
              </p>
            ) : (
              <>
                <div className="flex justify-between text-sm text-slate-500 mb-2">
                  <span>최근 30일 방문</span>
                  <span className="font-bold text-slate-900">{recentVisitsCount}회</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${Math.min((recentVisitsCount / getNextTierVisits(recentVisitsCount)) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-right">
                  다음 등급까지 {getNextTierVisits(recentVisitsCount) - recentVisitsCount}회 남았습니다.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Coupons */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
          <h3 className="font-bold text-slate-900 mb-4 px-2 flex items-center text-sm">
            <Ticket className="w-4 h-4 mr-2 text-indigo-500" />
            나의 쿠폰 (My Coupons)
          </h3>
          
          {myCoupons.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Ticket className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium text-sm">현재 사용 가능한 쿠폰이 없습니다.</p>
              <p className="text-xs text-slate-400 mt-2">방문 횟수를 늘려 등급 혜택을 받아보세요!</p>
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
                  className={`w-full bg-white rounded-2xl p-5 shadow-sm border flex justify-between items-center transition-all text-left animate-in fade-in slide-in-from-bottom-4 ${coupon.status === 'pending' ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}
                  style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'both' }}
                >
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block ${coupon.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {coupon.status === 'pending' ? '사용 승인 대기중' : '사용 가능'}
                    </span>
                    <h4 className="font-bold text-slate-900">{coupon.description}</h4>
                  </div>
                  <div className={`${coupon.status === 'pending' ? 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'} px-4 py-2 rounded-xl text-sm font-bold transition-all`}>
                    {coupon.status === 'pending' ? '요청 취소' : '사용하기'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
          <h3 className="font-bold text-slate-900 mb-4 px-2 flex items-center text-sm">
            <Calendar className="w-4 h-4 mr-2 text-slate-500" />
            최근 방문 내역
          </h3>
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
            {myVisits.length === 0 ? (
              <p className="text-center text-slate-500 py-4 text-sm">방문 내역이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {myVisits.slice().reverse().slice(0, 5).map(visit => (
                  <div key={visit.id} className="flex justify-between items-center border-b border-slate-50 last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {new Date(visit.date).toLocaleDateString('ko-KR')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">테이블 {visit.tableNumber}번</p>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedCoupon(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Ticket className="w-8 h-8 text-indigo-600" />
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-2">서비스 쿠폰 사용</h3>
            <p className="text-slate-500 mb-6 text-sm">{activeCoupon.description}</p>
            
            <p className="text-sm font-bold text-indigo-600 bg-indigo-50 p-3 rounded-xl mb-6">
              사장님께 쿠폰 사용을 요청하시겠습니까?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedCoupon(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
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
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                사용 요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request Modal */}
      {cancelingCoupon && activeCancelingCoupon && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setCancelingCoupon(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            
            <h3 className="text-xl font-bold text-slate-900 mb-2">요청 취소</h3>
            <p className="text-slate-500 mb-6 text-sm">쿠폰 사용 요청을 취소하시겠습니까?</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setCancelingCoupon(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                아니오
              </button>
              <button
                onClick={() => {
                  cancelCouponRequest(cancelingCoupon);
                  setCancelingCoupon(null);
                }}
                className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors shadow-sm"
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
