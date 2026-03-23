import { useState, useEffect } from 'react';
import { useStore, getEffectiveTier, getTierColor } from '../../store';
import { Users, LayoutGrid, LogOut, X, Check, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function OwnerDashboard() {
  const { currentUser, tables, users, visits, coupons, logout, leaveTable, initTables, tierOverrides, approveCouponUse, rejectCouponUse } = useStore();
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  // Initialize tables if they don't exist for this owner (backward compatibility)
  useEffect(() => {
    if (currentUser && currentUser.role === 'owner') {
      const myTables = tables.filter(t => t.storeId === currentUser.id);
      if (myTables.length < 12) {
        initTables(currentUser.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  if (!currentUser) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const myTables = tables.filter(t => t.storeId === currentUser.id);
  const activeTable = myTables.find(t => t.number === selectedTable);
  const activeCustomer = activeTable?.currentCustomerId 
    ? users.find(u => u.id === activeTable.currentCustomerId) 
    : null;

  const getCustomerStats = (customerId: string) => {
    const customerVisits = visits.filter(v => v.customerId === customerId && v.storeId === currentUser.id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentVisitsData = customerVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
    const recentVisits = new Set(recentVisitsData.map(v => new Date(v.date).toDateString())).size;
    
    // Calculate days since last visit
    const lastVisit = customerVisits.length > 0 
      ? new Date(Math.max(...customerVisits.map(v => new Date(v.date).getTime())))
      : null;
    
    const daysSinceLastVisit = lastVisit 
      ? Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 3600 * 24))
      : null;

    // Calculate frequency
    const firstVisit = customerVisits.length > 0 
      ? new Date(Math.min(...customerVisits.map(v => new Date(v.date).getTime())))
      : new Date();
    
    const daysSinceFirstVisit = Math.max(1, Math.floor((new Date().getTime() - firstVisit.getTime()) / (1000 * 3600 * 24)));
    const frequencyPerMonth = (customerVisits.length / daysSinceFirstVisit) * 30;

    const override = tierOverrides.find(t => t.customerId === customerId && t.storeId === currentUser.id);
    const effectiveTier = getEffectiveTier(recentVisits, override?.tier);

    return {
      totalVisits: customerVisits.length,
      recentVisits,
      tier: effectiveTier,
      daysSinceLastVisit,
      frequencyPerMonth: frequencyPerMonth.toFixed(1)
    };
  };

  const pendingRequests = coupons.filter(c => c.storeId === currentUser.id && c.status === 'pending');

  return (
    <div className="min-h-full bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white text-slate-900 p-6 pt-8 flex justify-between items-center border-b border-slate-100 sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentUser.restaurantName || '단골 파트너'}</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">테이블 현황</p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-white rounded-full hover:bg-slate-50 shadow-sm border border-slate-200 transition-colors">
          <LogOut className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="px-6 pt-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-sm font-bold text-indigo-600 mb-4 flex items-center">
            <span className="bg-indigo-100 w-8 h-8 rounded-full flex items-center justify-center mr-2 animate-pulse">
              <Bell className="w-4 h-4 text-indigo-600" />
            </span>
            서비스 사용 요청 ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(request => {
              const customer = users.find(u => u.id === request.customerId);
              return (
                <div key={request.id} className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900 text-lg">
                        {customer?.name || '알 수 없는 고객'} 
                        {request.usedAtTable && <span className="text-xs font-bold text-indigo-600 ml-2 bg-indigo-50 px-2 py-1 rounded-md">테이블 {request.usedAtTable}</span>}
                      </p>
                      <p className="text-slate-600 font-medium mt-1 text-sm">{request.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => rejectCouponUse(request.id)}
                      className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                    >
                      거절
                    </button>
                    <button 
                      onClick={() => approveCouponUse(request.id)}
                      className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm text-sm flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      수락
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table Grid */}
      <div className="p-6">
        {myTables.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-slate-500 mb-2">테이블 정보가 없습니다.</p>
            <p className="text-sm text-slate-400">새로고침하거나 다시 로그인해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {myTables.map((table, index) => {
              const isOccupied = table.currentCustomerId !== null;
              const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
              
              return (
                <button
                  key={table.number}
                  onClick={() => setSelectedTable(table.number)}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 shadow-sm border transition-all animate-in fade-in zoom-in-95 ${
                    isOccupied 
                      ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <span className={`text-lg font-bold ${isOccupied ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {table.number}
                  </span>
                  {isOccupied && customer && (
                    <span className="text-xs font-medium text-indigo-600 mt-1 truncate w-full text-center px-1">
                      {customer.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Coupon Usage History */}
      <div className="px-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
          <span className="bg-slate-100 text-slate-500 w-8 h-8 rounded-full flex items-center justify-center mr-2">
            <Check className="w-4 h-4" />
          </span>
          최근 서비스 사용 내역
        </h2>
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          {coupons.filter(c => c.storeId === currentUser.id && c.status === 'used').length === 0 ? (
            <p className="text-center text-slate-500 py-6 text-sm">아직 사용된 서비스 쿠폰이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {coupons
                .filter(c => c.storeId === currentUser.id && c.status === 'used')
                .sort((a, b) => new Date(b.usedAt!).getTime() - new Date(a.usedAt!).getTime())
                .slice(0, 5)
                .map((coupon, index) => {
                  const customer = users.find(u => u.id === coupon.customerId);
                  return (
                    <div key={coupon.id} className="flex justify-between items-center border-b border-slate-50 last:border-0 pb-3 last:pb-0 animate-in fade-in slide-in-from-right-4" style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'both' }}>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{customer?.name || '알 수 없는 고객'} <span className="text-xs font-normal text-slate-500 ml-1">(테이블 {coupon.usedAtTable || '?'})</span></p>
                        <p className="text-xs text-indigo-600 font-medium mt-0.5">{coupon.description}</p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(coupon.usedAt!).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-indigo-600">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-slate-400 hover:text-slate-900 transition-colors">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
      </div>

      {/* Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-12 sm:pb-6 relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedTable(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
              <span className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 shadow-sm">
                {selectedTable}
              </span>
              테이블 정보
            </h2>

            {activeCustomer ? (
              (() => {
                const stats = getCustomerStats(activeCustomer.id);
                return (
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{activeCustomer.name}님</h3>
                          <p className="text-slate-500 text-sm mt-1">{activeCustomer.phone}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          stats.tier === 'VIP' ? 'bg-purple-100 text-purple-700' :
                          stats.tier === '다이아' ? 'bg-blue-100 text-blue-700' :
                          stats.tier === '골드' ? 'bg-yellow-100 text-yellow-700' :
                          stats.tier === '실버' ? 'bg-slate-100 text-slate-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {stats.tier}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-slate-600 border-t border-slate-200 pt-4">
                        <span className="font-medium">최근 30일: {stats.recentVisits}회</span>
                        <span className="font-medium">마지막 방문: {stats.daysSinceLastVisit !== null ? `${stats.daysSinceLastVisit}일 전` : '없음'}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600 mt-2">
                        <span className="font-medium">총 방문: {stats.totalVisits}회</span>
                        <span className="font-medium">월 평균 방문: {stats.frequencyPerMonth}회</span>
                      </div>
                    </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-3 text-sm">사용된 서비스 (이번 방문)</h4>
                  <div className="space-y-2">
                    {(() => {
                      const sessionStart = activeTable.sessionStartTime ? new Date(activeTable.sessionStartTime).getTime() : 0;
                      const usedCouponsThisSession = coupons.filter(c => 
                        c.customerId === activeCustomer.id && 
                        c.storeId === currentUser.id && 
                        c.status === 'used' && 
                        c.usedAtTable === selectedTable &&
                        c.usedAt && new Date(c.usedAt).getTime() >= sessionStart
                      );
                      
                      if (usedCouponsThisSession.length === 0) {
                        return (
                          <p className="text-slate-500 text-sm p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
                            아직 사용된 서비스가 없습니다.
                          </p>
                        );
                      }
                      
                      return usedCouponsThisSession.map(coupon => (
                        <div key={coupon.id} className="bg-indigo-50 text-indigo-700 p-3 rounded-xl text-sm font-medium border border-indigo-100 flex justify-between">
                          <span>{coupon.description}</span>
                          <span className="text-indigo-500 text-xs">{new Date(coupon.usedAt!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    leaveTable(selectedTable, currentUser.id);
                    setSelectedTable(null);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-colors"
                >
                  테이블 비우기
                </button>
              </div>
              );
            })()
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-6 font-medium">현재 비어있는 테이블입니다.</p>
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 inline-block relative group">
                  <QRCodeSVG 
                    value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} 
                    size={150}
                    level="H"
                    className="mx-auto"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`);
                      import('../../store').then(({ showToast }) => showToast('QR 링크가 복사되었습니다. (테스트용)', 'info'));
                    }}
                    className="absolute inset-0 bg-slate-900/60 text-white font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl backdrop-blur-sm"
                  >
                    링크 복사
                  </button>
                  <p className="text-xs text-slate-400 mt-4 font-medium">
                    {selectedTable}번 테이블 전용 QR 코드
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
