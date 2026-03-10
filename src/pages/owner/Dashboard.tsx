import { useState, useEffect } from 'react';
import { useStore, getCustomerTier, getEffectiveTier, getTierColor } from '../../store';
import { Users, LayoutGrid, ScanLine, LogOut, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function OwnerDashboard() {
  const { currentUser, tables, users, visits, coupons, logout, leaveTable, initTables, tierOverrides } = useStore();
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
  }, [currentUser, tables, initTables]);

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

  return (
    <div className="min-h-full bg-transparent pb-20">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 flex justify-between items-center border-b border-[#E7E0D7]">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{currentUser.restaurantName || '단골 파트너'}</h1>
          <p className="text-[#795548] text-sm mt-1 font-medium">테이블 현황</p>
        </div>
        <button onClick={handleLogout} className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors">
          <LogOut className="w-5 h-5 text-[#4E342E]" />
        </button>
      </div>

      {/* Table Grid */}
      <div className="p-6">
        {myTables.length === 0 ? (
          <div className="text-center py-12 bg-white/90 backdrop-blur-sm rounded-3xl shadow-sm border border-[#E7E0D7]">
            <p className="text-[#795548] mb-2">테이블 정보가 없습니다.</p>
            <p className="text-sm text-[#A1887F]">새로고침하거나 다시 로그인해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {myTables.map(table => {
              const isOccupied = table.currentCustomerId !== null;
              const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
              
              return (
                <button
                  key={table.number}
                  onClick={() => setSelectedTable(table.number)}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 shadow-sm border-2 transition-all ${
                    isOccupied 
                      ? 'bg-[#FFF3E0]/50 border-[#D84315] hover:bg-[#FFF3E0]' 
                      : 'bg-white/90 backdrop-blur-sm border-[#E7E0D7] hover:border-stone-300'
                  }`}
                >
                  <span className={`text-lg font-bold ${isOccupied ? 'text-[#BF360C]' : 'text-[#A1887F]'}`}>
                    {table.number}
                  </span>
                  {isOccupied && customer && (
                    <span className="text-xs font-medium text-[#D84315] mt-1 truncate w-full text-center px-1">
                      {customer.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-[#E7E0D7] flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-[#2D1B15]">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-[#A1887F] hover:text-[#2D1B15] transition-colors">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
        <Link to="/owner/scanner" className="flex flex-col items-center text-[#A1887F] hover:text-[#2D1B15] transition-colors">
          <ScanLine className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">스캐너</span>
        </Link>
      </div>

      {/* Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white/90 backdrop-blur-sm w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-12 sm:pb-6 relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedTable(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-[#EFEBE9]"
            >
              <X className="w-5 h-5 text-[#5D4037]" />
            </button>

            <h2 className="text-2xl font-black text-[#2D1B15] mb-6 flex items-center">
              <span className="bg-[#4E342E] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3">
                {selectedTable}
              </span>
              테이블 정보
            </h2>

            {activeCustomer ? (
              <div className="space-y-6">
                <div className="bg-[#F5F2EB]/50 p-4 rounded-2xl border border-[#E7E0D7]">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#2D1B15]">{activeCustomer.name}님</h3>
                      <p className="text-[#795548] text-sm">{activeCustomer.phone}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getTierColor(getCustomerStats(activeCustomer.id).tier)}`}>
                      {getCustomerStats(activeCustomer.id).tier}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm text-[#5D4037] border-t border-[#E7E0D7] pt-3">
                    <span>최근 30일: {getCustomerStats(activeCustomer.id).recentVisits}회</span>
                    <span>마지막 방문: {getCustomerStats(activeCustomer.id).daysSinceLastVisit !== null ? `${getCustomerStats(activeCustomer.id).daysSinceLastVisit}일 전` : '없음'}</span>
                  </div>
                  <div className="flex justify-between text-sm text-[#5D4037] mt-1">
                    <span>총 방문: {getCustomerStats(activeCustomer.id).totalVisits}회</span>
                    <span>월 평균 방문: {getCustomerStats(activeCustomer.id).frequencyPerMonth}회</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-[#2D1B15] mb-3">사용된 서비스 (이번 방문)</h4>
                  <div className="space-y-2">
                    {coupons.filter(c => c.customerId === activeCustomer.id && c.storeId === currentUser.id && c.status === 'used' && c.usedAtTable === selectedTable).length === 0 ? (
                      <p className="text-[#795548] text-sm p-4 bg-[#F5F2EB]/50 rounded-xl text-center border border-[#E7E0D7]/50">
                        아직 사용된 서비스가 없습니다.
                      </p>
                    ) : (
                      coupons
                        .filter(c => c.customerId === activeCustomer.id && c.storeId === currentUser.id && c.status === 'used' && c.usedAtTable === selectedTable)
                        .map(coupon => (
                          <div key={coupon.id} className="bg-[#FFF3E0]/50 text-[#D84315] p-3 rounded-xl text-sm font-medium border border-[#FFF3E0] flex justify-between">
                            <span>{coupon.description}</span>
                            <span className="text-[#D84315] text-xs">{new Date(coupon.usedAt!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    leaveTable(selectedTable, currentUser.id);
                    setSelectedTable(null);
                  }}
                  className="w-full bg-[#EFEBE9] hover:bg-stone-300 text-[#2D1B15] font-bold py-4 rounded-xl transition-colors"
                >
                  테이블 비우기
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-[#795548] mb-6">현재 비어있는 테이블입니다.</p>
                <div className="bg-[#F5F2EB]/50 p-6 rounded-2xl border-2 border-dashed border-[#E7E0D7] inline-block relative group">
                  <QRCodeSVG 
                    value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} 
                    size={150}
                    level="H"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`);
                      alert('QR 링크가 복사되었습니다. (테스트용)');
                    }}
                    className="absolute inset-0 bg-black/50 text-white font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                  >
                    링크 복사
                  </button>
                  <p className="text-xs text-[#A1887F] mt-4 font-medium">
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
