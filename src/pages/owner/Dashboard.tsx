import { useState, useEffect } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { Users, LayoutGrid, LogOut, X, Check, Bell, BarChart3, Download, Copy, Settings, Map as MapIcon, List, Move, Maximize2, Square, Plus, Minus, Trash2, DoorOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerDashboard() {
  const { currentUser, tables, users, visits, coupons, logout, leaveTable, initTables, tierOverrides, approveCouponUse, rejectCouponUse, updateTableLayout, addTable, deleteTable } = useStore();
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [draggedTable, setDraggedTable] = useState<number | null>(null);

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
    <div className="min-h-full bg-hanji-light dark:bg-hanji-dark pb-20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md text-ink-light dark:text-ink-dark p-6 pt-8 flex justify-between items-center border-b border-ink-light/10 dark:border-ink-dark/10 sticky top-0 z-20">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">{currentUser.restaurantName || '단골 파트너'}</h1>
          <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm mt-1 font-medium">테이블 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/owner/brand" className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors">
            <Settings className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
          </Link>
          <button onClick={handleLogout} className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors">
            <LogOut className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="px-6 pt-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-sm font-bold text-burgundy dark:text-burgundy-light mb-4 flex items-center">
            <span className="bg-burgundy/10 dark:bg-burgundy/20 w-8 h-8 rounded-full flex items-center justify-center mr-2 animate-pulse">
              <Bell className="w-4 h-4 text-burgundy dark:text-burgundy-light" />
            </span>
            서비스 사용 요청 ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(request => {
              const customer = users.find(u => u.id === request.customerId);
              return (
                <div key={request.id} className="bg-white dark:bg-black/20 rounded-[2rem] p-5 shadow-sm border border-burgundy/20 dark:border-burgundy/30 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-serif font-bold text-ink-light dark:text-ink-dark text-xl">
                        {customer?.name || '알 수 없는 고객'} 
                        {request.usedAtTable && <span className="text-xs font-bold text-burgundy dark:text-burgundy-light ml-3 bg-burgundy/10 dark:bg-burgundy/20 px-2.5 py-1 rounded-full">테이블 {request.usedAtTable}</span>}
                      </p>
                      <p className="text-ink-light/70 dark:text-ink-dark/70 font-medium mt-2 text-sm">{request.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={async () => {
                        await rejectCouponUse(request.id);
                      }}
                      className="flex-1 py-3 bg-white dark:bg-black/20 text-ink-light/60 dark:text-ink-dark/60 border border-ink-light/10 dark:border-ink-dark/10 rounded-2xl font-bold hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors text-sm shadow-sm"
                    >
                      거절
                    </button>
                    <button 
                      onClick={async () => {
                        await approveCouponUse(request.id);
                      }}
                      className="flex-1 py-3 bg-burgundy text-hanji-light rounded-2xl font-bold hover:bg-burgundy/90 transition-colors shadow-md text-sm flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      수락
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="px-6 pt-6 flex justify-between items-center">
        <div className="flex bg-white dark:bg-black/20 p-1 rounded-2xl border border-ink-light/10 dark:border-ink-dark/10 shadow-sm">
          <button 
            onClick={() => { setViewMode('grid'); setIsLayoutMode(false); }}
            className={`flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl transition-all ${viewMode === 'grid' ? 'bg-burgundy text-hanji-light' : 'text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light'}`}
          >
            <List className="w-4 h-4" /> 리스트
          </button>
          <button 
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl transition-all ${viewMode === 'map' ? 'bg-burgundy text-hanji-light' : 'text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light'}`}
          >
            <MapIcon className="w-4 h-4" /> 매장 도면
          </button>
        </div>

        {viewMode === 'map' && (
          <button 
            onClick={() => setIsLayoutMode(!isLayoutMode)}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-2xl border transition-all ${isLayoutMode ? 'bg-burgundy/10 border-burgundy text-burgundy shadow-inner' : 'bg-white dark:bg-black/20 border-ink-light/10 text-ink-light/60 dark:text-ink-dark/60 shadow-sm'}`}
          >
            {isLayoutMode ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
            {isLayoutMode ? '배치 완료' : '위치 수정'}
          </button>
        )}
      </div>

      {/* Table Grid / Map View */}
      <div className="p-6">
        {myTables.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-black/20 rounded-[2rem] shadow-sm border border-ink-light/10 dark:border-ink-dark/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-ink-light/50 dark:text-ink-dark/50 mb-2">테이블 정보가 없습니다.</p>
            <p className="text-sm text-ink-light/40 dark:text-ink-dark/40">새로고침하거나 다시 로그인해주세요.</p>
            {isLayoutMode && (
              <button 
                onClick={() => addTable(currentUser.id)}
                className="mt-4 px-6 py-2 bg-burgundy text-white rounded-xl font-bold flex items-center mx-auto"
              >
                <Plus className="w-4 h-4 mr-2" /> 첫 테이블 추가
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
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
                      ? 'bg-burgundy/10 dark:bg-burgundy/20 border-burgundy/30 hover:bg-burgundy/20 dark:hover:bg-burgundy/30' 
                      : 'bg-white dark:bg-black/20 border-ink-light/10 dark:border-ink-dark/10 hover:border-ink-light/20 dark:hover:border-ink-dark/20'
                  }`}
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                >
                  <span className={`text-xl font-bold ${isOccupied ? 'text-burgundy dark:text-burgundy-light' : 'text-ink-light/40 dark:text-ink-dark/40'}`}>
                    {table.number}
                  </span>
                  {isOccupied && customer && (
                    <div className="flex flex-col items-center mt-1 w-full px-1 overflow-hidden">
                      <span className="text-xs font-bold text-burgundy dark:text-burgundy-light truncate w-full text-center">
                        {customer.name}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="relative w-full aspect-[4/3] bg-white/50 dark:bg-black/10 rounded-[3rem] border-2 border-dashed border-ink-light/10 dark:border-ink-dark/10 overflow-auto shadow-inner no-scrollbar p-1">
            {/* Toolbar */}
            {isLayoutMode && (
              <div className="sticky top-4 left-4 right-4 z-50 flex gap-2 justify-center pointer-events-none">
                <div className="bg-white dark:bg-black/60 backdrop-blur-md p-2 rounded-2xl shadow-xl flex gap-2 border border-ink-light/10 dark:border-ink-dark/10 pointer-events-auto">
                  <button 
                    onClick={() => addTable(currentUser.id, 'table')}
                    className="flex flex-col items-center gap-1 p-2 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-burgundy/10 flex items-center justify-center text-burgundy"><Plus className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold">테이블</span>
                  </button>
                  <button 
                    onClick={() => addTable(currentUser.id, 'room')}
                    className="flex flex-col items-center gap-1 p-2 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-espresso/10 flex items-center justify-center text-espresso"><Square className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold">룸 Area</span>
                  </button>
                  <button 
                    onClick={() => addTable(currentUser.id, 'corridor')}
                    className="flex flex-col items-center gap-1 p-2 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-olive/10 flex items-center justify-center text-olive"><Move className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold">복도</span>
                  </button>
                </div>
              </div>
            )}

            <div className="min-w-[800px] min-h-[600px] relative">
              <div className="absolute inset-0 bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>
              {myTables.map((table) => {
                const isOccupied = table.currentCustomerId !== null;
                const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                const isCorridor = table.type === 'corridor';
                
                return (
                  <div
                    key={table.number}
                    draggable={isLayoutMode}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('tableNumber', table.number.toString());
                      setDraggedTable(table.number);
                    }}
                    onDragEnd={() => setDraggedTable(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!isLayoutMode) return;
                      const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                      if (rect && draggedTable !== null) {
                        const x = Math.max(0, Math.min(rect.width - (table.width || 70), e.clientX - rect.left - (table.width || 70) / 2));
                        const y = Math.max(0, Math.min(rect.height - (table.height || 70), e.clientY - rect.top - (table.height || 70) / 2));
                        updateTableLayout(currentUser.id, draggedTable, { x, y });
                      }
                    }}
                    onClick={() => !isLayoutMode && !isCorridor && setSelectedTable(table.number)}
                    className={`absolute rounded-2xl flex flex-col items-center justify-center p-2 shadow-lg border transition-all cursor-pointer group ${
                      table.isRoom ? 'scale-110 !rounded-[2rem] border-dashed border-2' : ''
                    } ${
                      isCorridor ? 'bg-ink-light/5 dark:bg-ink-dark/5 border-ink-light/10 dark:border-ink-dark/10 shadow-none' :
                      isOccupied 
                        ? 'bg-burgundy/20 dark:bg-burgundy/30 border-burgundy/50' 
                        : 'bg-white dark:bg-black/40 border-ink-light/20 dark:border-ink-dark/20'
                    } ${isLayoutMode ? 'ring-2 ring-burgundy ring-offset-2 animate-bounce' : ''}`}
                    style={{ 
                      left: `${table.x}px`, 
                      top: `${table.y}px`,
                      width: `${table.width || 80}px`, 
                      height: `${table.height || 80}px`,
                    }}
                  >
                    {!isCorridor && (
                      <span className={`text-base font-black ${isOccupied ? 'text-burgundy dark:text-burgundy-light' : 'text-ink-light/50 dark:text-ink-dark/50'}`}>
                        {table.number}
                      </span>
                    )}
                    {!isOccupied && !isCorridor && (
                      <div className="flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 bg-ink-light/5 dark:bg-ink-dark/5 rounded-full border border-ink-light/5 dark:border-ink-dark/5">
                        <Users className="w-2 h-2 text-ink-light/30 dark:text-ink-dark/30" />
                        <span className="text-[8px] font-bold text-ink-light/40 dark:text-ink-dark/40">{table.seats || 4}</span>
                      </div>
                    )}
                    {isOccupied && customer && (
                      <span className="text-[10px] font-bold text-burgundy dark:text-burgundy-light truncate max-w-full">
                        {customer.name}
                      </span>
                    )}
                    {isLayoutMode && (
                      <div className="absolute top-0 left-0 right-0 bottom-0 bg-black/5 flex flex-col items-center justify-center gap-1 rounded-2xl pointer-events-none">
                        <div className="flex gap-1 pointer-events-auto">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTableLayout(currentUser.id, table.number, { width: Math.min((table.width || 80) + 15, 200), height: Math.min((table.height || 80) + 15, 200) });
                            }}
                            className="p-1 bg-white rounded-md shadow-md text-ink-light hover:bg-burgundy hover:text-white transition-colors"
                            title="크기 키우기"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTableLayout(currentUser.id, table.number, { width: Math.max((table.width || 80) - 15, 50), height: Math.max((table.height || 80) - 15, 50) });
                            }}
                            className="p-1 bg-white rounded-md shadow-md text-ink-light hover:bg-burgundy hover:text-white transition-colors"
                            title="크기 줄이기"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if(confirm('삭제하시겠습니까?')) {
                                deleteTable(currentUser.id, table.number);
                              }
                            }}
                            className="p-1 bg-white rounded-md shadow-md text-red-500 hover:bg-red-500 hover:text-white transition-all transform hover:scale-125"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {isLayoutMode && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink-light text-hanji-light px-6 py-3 rounded-full text-xs font-bold shadow-xl animate-pulse flex items-center gap-2 z-50">
                <Move className="w-4 h-4" /> 테이블을 끌어서 위치를 옮기거나 버튼으로 관리하세요
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Coupon Usage History */}
      <div className="px-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
        <h2 className="text-sm font-bold text-ink-light dark:text-ink-dark mb-4 flex items-center">
          <span className="bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 text-ink-light/50 dark:text-ink-dark/50 w-8 h-8 rounded-full flex items-center justify-center mr-2 shadow-sm">
            <Check className="w-4 h-4" />
          </span>
          최근 서비스 사용 내역
        </h2>
        <div className="bg-white dark:bg-black/20 rounded-[2rem] p-5 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
          {coupons.filter(c => c.storeId === currentUser.id && c.status === 'used').length === 0 ? (
            <p className="text-center text-ink-light/50 dark:text-ink-dark/50 py-6 text-sm">아직 사용된 서비스 쿠폰이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {coupons
                .filter(c => c.storeId === currentUser.id && c.status === 'used')
                .sort((a, b) => new Date(b.usedAt!).getTime() - new Date(a.usedAt!).getTime())
                .slice(0, 5)
                .map((coupon, index) => {
                  const customer = users.find(u => u.id === coupon.customerId);
                  return (
                    <div key={coupon.id} className="flex justify-between items-center border-b border-ink-light/5 dark:border-ink-dark/5 last:border-0 pb-4 last:pb-0 animate-in fade-in slide-in-from-right-4" style={{ animationDelay: `${(index + 4) * 100}ms`, animationFillMode: 'both' }}>
                      <div>
                        <p className="font-bold text-ink-light dark:text-ink-dark text-sm">{customer?.name || '알 수 없는 고객'} <span className="text-xs font-normal text-ink-light/50 dark:text-ink-dark/50 ml-1">(테이블 {coupon.usedAtTable || '?'})</span></p>
                        <p className="text-xs text-burgundy dark:text-burgundy-light font-medium mt-1">{coupon.description}</p>
                      </div>
                      <span className="text-xs text-ink-light/40 dark:text-ink-dark/40 font-medium">
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
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/80 backdrop-blur-md border-t border-ink-light/10 dark:border-ink-dark/10 flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-burgundy dark:text-burgundy-light">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light dark:hover:text-ink-dark transition-colors">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
        <Link to="/owner/statistics" className="flex flex-col items-center text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light dark:hover:text-ink-dark transition-colors">
          <BarChart3 className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">통계</span>
        </Link>
      </div>

      {/* Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-hanji-light dark:bg-hanji-dark w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-12 sm:pb-6 relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 border border-ink-light/10 dark:border-ink-dark/10">
            <button 
              onClick={() => setSelectedTable(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
            >
              <X className="w-5 h-5 text-ink-light/40 dark:text-ink-dark/40" />
            </button>

            <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark mb-6 flex items-center">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm mr-3 shadow-sm ${activeTable?.isRoom ? 'bg-espresso' : 'bg-burgundy'} text-hanji-light`}>
                {selectedTable}
              </span>
              {activeTable?.isRoom ? '룸' : '테이블'} 정보
              <span className="ml-auto text-xs font-bold text-ink-light/30 dark:text-ink-dark/30 bg-ink-light/5 px-3 py-1 rounded-full border border-ink-light/5 flex items-center gap-1">
                <Users className="w-3 h-3" /> {activeTable?.seats || 4}인석
              </span>
            </h2>

            {activeCustomer ? (
              (() => {
                const stats = getCustomerStats(activeCustomer.id);
                return (
                  <div className="space-y-6">
                    <div className="bg-white/50 dark:bg-black/10 p-5 rounded-[2rem] border border-ink-light/10 dark:border-ink-dark/10">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark">{activeCustomer.name}님</h3>
                          <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm mt-1">{activeCustomer.phone}</p>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${getTierColor(stats.tier)}`}>
                          {getTierCustomName(stats.tier, currentUser?.tierNames)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-ink-light/70 dark:text-ink-dark/70 border-t border-ink-light/10 dark:border-ink-dark/10 pt-4">
                        <span className="font-medium">최근 30일: {stats.recentVisits}회</span>
                        <span className="font-medium">마지막 방문: {stats.daysSinceLastVisit !== null ? `${stats.daysSinceLastVisit}일 전` : '없음'}</span>
                      </div>
                      <div className="flex justify-between text-sm text-ink-light/70 dark:text-ink-dark/70 mt-2">
                        <span className="font-medium">총 방문: {stats.totalVisits}회</span>
                        <span className="font-medium">월 평균 방문: {stats.frequencyPerMonth}회</span>
                      </div>
                      
                      {activeCustomer.memo && (
                        <div className="mt-4 pt-4 border-t border-ink-light/10 dark:border-ink-dark/10">
                          <p className="text-xs font-bold text-ink-light/50 dark:text-ink-dark/50 mb-2">고객 메모</p>
                          <p className="text-sm text-ink-light/80 dark:text-ink-dark/80 bg-white dark:bg-black/20 p-4 rounded-2xl border border-ink-light/5 dark:border-ink-dark/5 whitespace-pre-wrap leading-relaxed">
                            {formatMemoDisplay(activeCustomer.memo)}
                          </p>
                        </div>
                      )}
                    </div>

                <div>
                  <h4 className="font-bold text-ink-light dark:text-ink-dark mb-3 text-sm">사용된 서비스 (이번 방문)</h4>
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
                          <p className="text-ink-light/50 dark:text-ink-dark/50 text-sm p-4 bg-white/50 dark:bg-black/10 rounded-2xl text-center border border-ink-light/5 dark:border-ink-dark/5">
                            아직 사용된 서비스가 없습니다.
                          </p>
                        );
                      }
                      
                      return usedCouponsThisSession.map(coupon => (
                        <div key={coupon.id} className="bg-burgundy/5 dark:bg-burgundy/10 text-burgundy dark:text-burgundy-light p-4 rounded-2xl text-sm font-medium border border-burgundy/10 flex justify-between">
                          <span>{coupon.description}</span>
                          <span className="text-burgundy/60 dark:text-burgundy-light/60 text-xs">{new Date(coupon.usedAt!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
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
                  className="w-full bg-white dark:bg-black/20 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 text-ink-light/70 dark:text-ink-dark/70 border border-ink-light/10 dark:border-ink-dark/10 font-bold py-4 rounded-2xl transition-colors shadow-sm"
                >
                  테이블 비우기
                </button>
              </div>
              );
            })()
            ) : (
              <div className="text-center py-8">
                <p className="text-ink-light/50 dark:text-ink-dark/50 mb-6 font-medium">현재 비어있는 테이블입니다.</p>
                <div className="bg-white dark:bg-black/20 p-6 rounded-[2rem] border-2 border-dashed border-ink-light/20 dark:border-ink-dark/20 inline-block relative group">
                  <div className="bg-white p-2 rounded-xl">
                    <QRCodeSVG 
                      value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} 
                      size={150}
                      level="H"
                      className="qr-code-svg-target mx-auto"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] backdrop-blur-sm gap-2">
                    <button 
                      onClick={() => {
                        const svg = document.querySelector('.qr-code-svg-target') as SVGElement;
                        if (svg) {
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement("canvas");
                          const ctx = canvas.getContext("2d");
                          const img = new Image();
                          img.onload = () => {
                            canvas.width = img.width + 40;
                            canvas.height = img.height + 40;
                            if (ctx) {
                              ctx.fillStyle = "white";
                              ctx.fillRect(0, 0, canvas.width, canvas.height);
                              ctx.drawImage(img, 20, 20);
                              const pngFile = canvas.toDataURL("image/png");
                              const downloadLink = document.createElement("a");
                              downloadLink.download = `table_${selectedTable}_qr.png`;
                              downloadLink.href = pngFile;
                              downloadLink.click();
                            }
                          };
                          img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                          import('../../store').then(({ showToast }) => showToast('QR 코드가 다운로드되었습니다.', 'success')).catch(console.error);
                        }
                      }}
                      className="text-white font-bold text-sm bg-burgundy/80 hover:bg-burgundy px-4 py-2 rounded-xl flex items-center shadow-sm w-32 justify-center"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      저장하기
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`).catch(console.error);
                        import('../../store').then(({ showToast }) => showToast('QR 링크가 복사되었습니다.', 'info')).catch(console.error);
                      }}
                      className="text-white font-bold text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl flex items-center shadow-sm w-32 justify-center"
                    >
                      <Copy className="w-4 h-4 mr-1.5" />
                      링크 복사
                    </button>
                  </div>
                  <p className="text-xs text-ink-light/40 dark:text-ink-dark/40 mt-4 font-medium">
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
