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
      <div className="min-h-full bg-transparent flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-sm text-center">
          <p className="text-[#795548] mb-4">가게 정보를 찾을 수 없습니다.</p>
          <Link to="/scan" className="text-[#D84315] font-bold">스캐너로 돌아가기</Link>
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

  return (
    <div className="min-h-full bg-transparent pb-20 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 border-b border-[#E7E0D7]">
        <div className="flex justify-between items-center mb-6 relative">
          <Link to="/scan" className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#D84315]" />
          </Link>
          <h1 className="text-xl font-black tracking-tight flex-1 text-center">{restaurantName}</h1>
          <button onClick={handleLogout} className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors">
            <LogOut className="w-5 h-5 text-[#D84315]" />
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-[#FFF3E0] border border-[#FFE0B2] rounded-full flex items-center justify-center text-[#D84315] font-bold text-xl shadow-sm">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-[#795548] text-sm font-medium">환영합니다,</p>
            <h2 className="text-2xl font-bold text-[#2D1B15]">{currentUser.name}님</h2>
            {currentTable && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-[#D84315] text-sm font-bold bg-[#FFF3E0] inline-block px-3 py-1 rounded-full">
                  현재 테이블: {currentTable.number}번
                </p>
                <button 
                  onClick={handleLeaveStore}
                  className="flex items-center text-xs font-bold bg-white/90 backdrop-blur-sm text-[#795548] border border-[#E7E0D7] px-3 py-1.5 rounded-full hover:bg-[#F5F2EB] transition-colors shadow-sm"
                >
                  <LeaveIcon className="w-3 h-3 mr-1" />
                  가게 퇴장
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 relative z-10">
        {/* Notifications / Messages */}
        {myCommunications.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
            <h3 className="font-bold text-[#2D1B15] mb-4 px-2 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-[#D84315]" />
              알림 및 메시지
            </h3>
            <div className="space-y-3">
              {myCommunications.slice(0, 3).map((comm, index) => (
                <div key={comm.id} className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-[#E7E0D7] animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${(index + 2) * 100}ms`, animationFillMode: 'both' }}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold flex items-center ${comm.type === 'coupon' ? 'bg-[#FFF3E0] text-[#D84315]' : 'bg-blue-100 text-blue-800'}`}>
                      {comm.type === 'coupon' ? <Ticket className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                      {comm.type === 'coupon' ? '서비스 알림' : '가게 메시지'}
                    </span>
                    <span className="text-xs text-[#A1887F]">
                      {new Date(comm.date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p className="text-[#4E342E] text-sm font-medium">{comm.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-sm border border-[#E7E0D7] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#2D1B15] flex items-center">
              <Award className="w-5 h-5 mr-2 text-[#D84315]" />
              나의 등급
            </h3>
            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getTierColor(currentTier)}`}>
              {currentTier}
            </span>
          </div>
          
          <div className="bg-[#F5F2EB]/50 rounded-2xl p-4">
            <div className="flex justify-between text-sm text-[#795548] mb-2">
              <span>최근 30일 방문</span>
              <span className="font-bold text-[#2D1B15]">{recentVisitsCount}회</span>
            </div>
            <div className="w-full bg-[#EFEBE9] rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-[#D84315] h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${Math.min((recentVisitsCount / 12) * 100, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-[#A1887F] mt-2 text-right">
              다음 등급까지 {getNextTierVisits(recentVisitsCount)}회 남았습니다.
            </p>
          </div>
        </div>

        {/* Coupons */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
          <h3 className="font-bold text-[#2D1B15] mb-4 px-2 flex items-center">
            <Ticket className="w-5 h-5 mr-2 text-[#D84315]" />
            나의 쿠폰 (My Coupons)
          </h3>
          
          {myCoupons.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 text-center shadow-sm border border-[#E7E0D7]">
              <p className="text-[#795548]">현재 사용 가능한 쿠폰이 없습니다.</p>
              <p className="text-sm text-[#A1887F] mt-2">방문 횟수를 늘려 등급 혜택을 받아보세요!</p>
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
                  className={`w-full bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-sm border flex justify-between items-center transition-colors text-left animate-in fade-in slide-in-from-bottom-4 ${coupon.status === 'pending' ? 'border-[#D84315] bg-[#FFF3E0]/30' : 'border-[#D84315]/20 hover:bg-[#FFF3E0]/50'}`}
                  style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'both' }}
                >
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block ${coupon.status === 'pending' ? 'bg-[#D84315] text-white' : 'bg-[#FFF3E0] text-[#D84315]'}`}>
                      {coupon.type}
                    </span>
                    <h4 className="font-bold text-[#2D1B15]">{coupon.description}</h4>
                  </div>
                  <div className={`${coupon.status === 'pending' ? 'bg-[#EFEBE9] text-[#795548] hover:bg-[#E7E0D7]' : 'bg-[#D84315] text-white hover:shadow-md'} px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all`}>
                    {coupon.status === 'pending' ? '요청 취소' : '사용하기'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
          <h3 className="font-bold text-[#2D1B15] mb-4 px-2 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-[#795548]" />
            최근 방문 내역
          </h3>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-4 shadow-sm border border-[#E7E0D7]">
            {myVisits.length === 0 ? (
              <p className="text-center text-[#795548] py-4">방문 내역이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {myVisits.slice().reverse().slice(0, 5).map(visit => (
                  <div key={visit.id} className="flex justify-between items-center border-b border-[#E7E0D7]/50 last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium text-[#2D1B15]">
                        {new Date(visit.date).toLocaleDateString('ko-KR')}
                      </p>
                      <p className="text-sm text-[#795548]">테이블 {visit.tableNumber}번</p>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 max-w-sm w-full text-center relative">
            <button 
              onClick={() => setSelectedCoupon(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-[#EFEBE9]"
            >
              <X className="w-5 h-5 text-[#5D4037]" />
            </button>
            
            <h3 className="text-xl font-bold text-[#2D1B15] mb-2">서비스 쿠폰 사용</h3>
            <p className="text-[#795548] mb-6">{activeCoupon.description}</p>
            
            <p className="text-sm font-bold text-[#D84315] bg-[#FFF3E0]/50 p-3 rounded-xl mb-6">
              사장님께 쿠폰 사용을 요청하시겠습니까?
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedCoupon(null)}
                className="flex-1 py-3 bg-[#EFEBE9] text-[#5D4037] rounded-xl font-bold hover:bg-[#E7E0D7] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  requestCouponUse(activeCoupon.id, currentTable?.number);
                  setSelectedCoupon(null);
                }}
                className="flex-1 py-3 bg-[#D84315] text-white rounded-xl font-bold hover:bg-[#BF360C] transition-colors shadow-sm"
              >
                사용 요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Request Modal */}
      {cancelingCoupon && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 max-w-sm w-full text-center relative">
            <button 
              onClick={() => setCancelingCoupon(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-[#EFEBE9]"
            >
              <X className="w-5 h-5 text-[#5D4037]" />
            </button>
            
            <h3 className="text-xl font-bold text-[#2D1B15] mb-2">쿠폰 사용 요청 취소</h3>
            <p className="text-[#795548] mb-6">쿠폰 사용 요청을 취소하시겠습니까?</p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setCancelingCoupon(null)}
                className="flex-1 py-3 bg-[#EFEBE9] text-[#5D4037] rounded-xl font-bold hover:bg-[#E7E0D7] transition-colors"
              >
                아니오
              </button>
              <button
                onClick={() => {
                  cancelCouponRequest(cancelingCoupon);
                  setCancelingCoupon(null);
                }}
                className="flex-1 py-3 bg-[#D84315] text-white rounded-xl font-bold hover:bg-[#BF360C] transition-colors shadow-sm"
              >
                예, 취소합니다
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
