import { useState, useEffect } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { Users, LayoutGrid, LogOut, X, Check, Bell, BarChart3, Download, Copy, Settings, Map as MapIcon, List, Move, Maximize2, Square, Plus, Minus, Trash2, DoorOpen, Circle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerDashboard() {
  const { 
    currentUser, tables, users, visits, coupons, logout, leaveTable, 
    initTables, tierOverrides, approveCouponUse, rejectCouponUse, 
    updateTableLayout, addTable, deleteTable 
  } = useStore();
  
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [draggedTable, setDraggedTable] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Initialize tables if they don't exist for this owner
  useEffect(() => {
    if (currentUser && currentUser.role === 'owner') {
      const myTables = tables.filter(t => t.storeId === currentUser.id);
      if (myTables.length === 0) {
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
    
    const lastVisit = customerVisits.length > 0 
      ? new Date(Math.max(...customerVisits.map(v => new Date(v.date).getTime())))
      : null;
    
    let daysSinceLastVisit = null;
    if (lastVisit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const visitDate = new Date(lastVisit);
      visitDate.setHours(0, 0, 0, 0);
      daysSinceLastVisit = Math.round((today.getTime() - visitDate.getTime()) / (1000 * 3600 * 24));
    }

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
                    <button onClick={() => rejectCouponUse(request.id)} className="flex-1 py-3 bg-white dark:bg-black/20 text-ink-light/60 dark:text-ink-dark/60 border border-ink-light/10 dark:border-ink-dark/10 rounded-2xl font-bold hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors text-sm shadow-sm">거절</button>
                    <button onClick={() => approveCouponUse(request.id)} className="flex-1 py-3 bg-burgundy text-hanji-light rounded-2xl font-bold hover:bg-burgundy/90 transition-colors shadow-md text-sm flex items-center justify-center">
                      <Check className="w-4 h-4 mr-1.5" /> 수락
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

      {/* Table Content */}
      <div className="p-6">
        {myTables.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-black/20 rounded-[2rem] border-2 border-dashed border-ink-light/10">
            <p className="text-ink-light/50">데이터를 불러오는 중이거나 테이블이 없습니다.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTables.filter(t => t.type !== 'corridor').map((table, index) => {
              const isOccupied = table.currentCustomerId !== null;
              const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
              return (
                <div 
                  key={table.number} 
                  onClick={() => setSelectedTable(table.number)}
                  className={`bg-white dark:bg-black/20 rounded-3xl p-5 shadow-sm border transition-all cursor-pointer group hover:shadow-md ${isOccupied ? 'border-burgundy/30 bg-burgundy/5 dark:bg-burgundy/10' : 'border-ink-light/10 dark:border-ink-dark/10'}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 ${table.shape === 'circle' ? 'rounded-full' : 'rounded-xl'} flex items-center justify-center text-sm font-bold shadow-sm ${table.isRoom ? 'bg-espresso' : 'bg-burgundy'} text-hanji-light`}>
                        {table.number}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold flex items-center gap-1">
                          {table.isRoom ? '룸' : '테이블'} {table.shape === 'circle' ? <Circle className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
                        </span>
                        <span className="text-[10px] text-ink-light/40 font-bold">{table.seats || 4}인석</span>
                      </div>
                    </div>
                    {isOccupied && table.sessionStartTime && (
                      <span className="text-[10px] font-bold text-burgundy bg-burgundy/10 px-2 py-1 rounded-lg">
                        {(() => {
                          const diff = Math.floor((currentTime.getTime() - new Date(table.sessionStartTime).getTime()) / 60000);
                          return diff > 60 ? `${Math.floor(diff/60)}시간 ${diff%60}분` : `${diff}분 전 입장`;
                        })()}
                      </span>
                    )}
                  </div>
                  {isOccupied && customer && (
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-black/20 rounded-2xl border border-ink-light/5">
                      <div className="w-8 h-8 rounded-full bg-burgundy/10 flex items-center justify-center text-burgundy font-bold text-xs">{customer.name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{customer.name}</p>
                        <p className="text-[10px] text-ink-light/50 truncate">{customer.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative w-full aspect-[4/3] bg-white/50 dark:bg-black/10 rounded-[3rem] border-2 border-dashed border-ink-light/10 overflow-auto shadow-inner no-scrollbar p-1">
            {isLayoutMode && (
              <div className="sticky top-4 left-4 right-4 z-50 flex gap-2 justify-center pointer-events-none">
                <div className="bg-white dark:bg-black/60 backdrop-blur-md p-2 rounded-2xl shadow-xl flex gap-2 border border-ink-light/10 pointer-events-auto">
                  <button onClick={() => addTable(currentUser.id, 'table')} className="flex flex-col items-center gap-1 p-2 hover:bg-ink-light/5 rounded-xl transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-burgundy/10 flex items-center justify-center text-burgundy"><Plus className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold">테이블</span>
                  </button>
                  <button onClick={() => addTable(currentUser.id, 'room')} className="flex flex-col items-center gap-1 p-2 hover:bg-ink-light/5 rounded-xl transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-espresso/10 flex items-center justify-center text-espresso"><Square className="w-5 h-5" /></div>
                    <span className="text-[10px] font-bold">룸 Area</span>
                  </button>
                  <button onClick={() => addTable(currentUser.id, 'corridor')} className="flex flex-col items-center gap-1 p-2 hover:bg-ink-light/5 rounded-xl transition-colors">
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
                    onDragStart={(e) => { e.dataTransfer.setData('tableNumber', table.number.toString()); setDraggedTable(table.number); }}
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
                    className={`absolute flex flex-col items-center justify-center p-2 shadow-lg border transition-all cursor-pointer group ${table.shape === 'circle' ? 'rounded-full' : (table.isRoom ? '!rounded-[2rem]' : 'rounded-2xl')} ${isCorridor ? 'bg-ink-light/5 border-ink-light/10 shadow-none' : isOccupied ? 'bg-burgundy/20 border-burgundy/50 ring-2 ring-burgundy/20' : 'bg-white dark:bg-black/40 border-ink-light/20'} ${isLayoutMode ? 'ring-2 ring-burgundy ring-offset-2 animate-bounce' : ''}`}
                    style={{ left: `${table.x}px`, top: `${table.y}px`, width: `${table.width || 80}px`, height: `${table.height || 80}px`, scale: table.isRoom ? '1.1' : '1' }}
                  >
                    {!isCorridor && (
                      <div className="flex flex-col items-center">
                        <span className={`text-base font-black ${isOccupied ? 'text-burgundy dark:text-burgundy-light' : 'text-ink-light/50 dark:text-ink-dark/50'}`}>{table.number}</span>
                        {isOccupied && table.sessionStartTime && (
                          <span className="text-[8px] font-bold text-burgundy/60 -mt-1">
                            {(() => {
                              const diff = Math.floor((currentTime.getTime() - new Date(table.sessionStartTime).getTime()) / 60000);
                              return diff > 60 ? `${Math.floor(diff/60)}시간 ${diff%60}분` : `${diff}분 전 입장`;
                            })()}
                          </span>
                        )}
                      </div>
                    )}
                    {!isOccupied && !isCorridor && (
                      <div className="flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 bg-ink-light/5 rounded-full">
                        <Users className="w-2 h-2 text-ink-light/30" />
                        <span className="text-[8px] font-bold text-ink-light/40">{table.seats || 4}</span>
                      </div>
                    )}
                    {isOccupied && customer && <span className="text-[10px] font-bold text-burgundy truncate max-w-full">{customer.name}</span>}
                    {isLayoutMode && (
                      <div className="absolute inset-0 bg-black/5 flex flex-wrap items-center justify-center gap-1 rounded-2xl pointer-events-none">
                        <div className="flex flex-wrap justify-center gap-1 pointer-events-auto max-w-[95%]">
                          <button onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { width: Math.min((table.width || 80) + 15, 200), height: Math.min((table.height || 80) + 15, 200) }); }} className="p-1 bg-white rounded-md shadow text-ink-light hover:bg-burgundy hover:text-white"><Plus className="w-2.5 h-2.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { shape: table.shape === 'circle' ? 'square' : 'circle' }); }} className="p-1 bg-white rounded-md shadow text-ink-light hover:bg-burgundy hover:text-white">{table.shape === 'circle' ? <Square className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}</button>
                          <button onClick={(e) => { e.stopPropagation(); const ns = (table.seats || 4) + 1; updateTableLayout(currentUser.id, table.number, { seats: ns > 12 ? 1 : ns }); }} className="p-1 bg-white rounded-md shadow text-ink-light hover:bg-burgundy hover:text-white"><span className="text-[8px] font-bold">{table.seats || 4}</span></button>
                          <button onClick={(e) => { e.stopPropagation(); if(confirm('삭제하시겠습니까?')) deleteTable(currentUser.id, table.number); }} className="p-1 bg-white rounded-md shadow text-red-500 hover:bg-red-500 hover:text-white"><Trash2 className="w-2.5 h-2.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isLayoutMode && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink-light text-hanji-light px-6 py-3 rounded-full text-xs font-bold shadow-xl animate-pulse flex items-center gap-2 z-50">
                <Move className="w-4 h-4" /> 테이블을 끌어서 옮기거나 버튼으로 관리하세요
              </div>
            )}
          </div>
        )}
      </div>

      {/* Usage History */}
      <div className="px-6 pb-24">
        <h2 className="text-sm font-bold text-ink-light mb-4">최근 서비스 사용 내역</h2>
        <div className="bg-white dark:bg-black/20 rounded-[2rem] p-5 shadow-sm border border-ink-light/10">
          {coupons.filter(c => c.storeId === currentUser.id && c.status === 'used').length === 0 ? (
            <p className="text-center text-ink-light/50 py-6 text-sm">기록이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {coupons.filter(c => c.storeId === currentUser.id && c.status === 'used').slice(0, 5).map(coupon => {
                const customer = users.find(u => u.id === coupon.customerId);
                return (
                  <div key={coupon.id} className="flex justify-between items-center border-b border-ink-light/5 last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-bold text-sm">{customer?.name || '고객'} <span className="text-xs font-normal text-ink-light/50 ml-1">({coupon.usedAtTable}번)</span></p>
                      <p className="text-xs text-burgundy font-medium mt-1">{coupon.description}</p>
                    </div>
                    <span className="text-xs text-ink-light/40">{new Date(coupon.usedAt!).toLocaleDateString()}</span>
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
      {selectedTable && activeTable && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-hanji-light dark:bg-hanji-dark w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-12 sm:pb-6 relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 border border-ink-light/10 dark:border-ink-dark/10 overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setSelectedTable(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
            >
              <X className="w-5 h-5 text-ink-light/40 dark:text-ink-dark/40" />
            </button>

            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${activeTable.isRoom ? 'bg-espresso' : 'bg-burgundy'} text-hanji-light`}>
                  {selectedTable}
                </span>
                <span className="text-xs font-bold text-ink-light/30 dark:text-ink-dark/30 bg-ink-light/5 px-2 py-0.5 rounded-full border border-ink-light/5">
                  {activeTable.seats || 4}인석
                </span>
              </div>
              {activeTable.sessionStartTime && (
                <span className="text-xs font-bold text-burgundy dark:text-burgundy-light bg-burgundy/10 px-3 py-1 rounded-lg">
                  {(() => {
                    const diff = Math.floor((currentTime.getTime() - new Date(activeTable.sessionStartTime).getTime()) / 60000);
                    return diff > 60 ? `${Math.floor(diff/60)}시간 ${diff%60}분` : `${diff}분 전 입장`;
                  })()}
                </span>
              )}
            </div>

            {activeCustomer ? (
              <div className="space-y-6">
                {(() => {
                  const stats = getCustomerStats(activeCustomer.id);
                  return (
                    <div className="bg-white/50 dark:bg-black/10 p-5 rounded-[2rem] border border-ink-light/10 dark:border-ink-dark/10">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark">{activeCustomer.name}님</h3>
                          <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 mt-1">{activeCustomer.phone}</p>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${getTierColor(stats.tier)}`}>
                          {getTierCustomName(stats.tier, currentUser.tierNames)}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm text-ink-light/70 dark:text-ink-dark/70 border-t border-ink-light/10 dark:border-ink-dark/10 pt-4">
                        <span className="font-medium text-xs">최근 30일: {stats.recentVisits}회</span>
                        <span className="font-medium text-xs">
                          마지막 방문: {stats.daysSinceLastVisit !== null 
                            ? (stats.daysSinceLastVisit === 0 ? '오늘' : `${stats.daysSinceLastVisit}일 전`) 
                            : '없음'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-ink-light/70 dark:text-ink-dark/70 mt-2">
                        <span className="font-medium text-xs">총 방문: {stats.totalVisits}회</span>
                        <span className="font-medium text-xs">월 평균 방문: {stats.frequencyPerMonth}회</span>
                      </div>
                      {activeCustomer.memo && (
                        <div className="mt-4 pt-4 border-t border-ink-light/10 dark:border-ink-dark/10">
                          <p className="text-xs font-bold text-ink-light/50 dark:text-ink-dark/50 mb-2">고객 메모</p>
                          <p className="text-sm text-ink-light/80 dark:text-ink-dark/80 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-ink-light/5 whitespace-pre-wrap">
                            {formatMemoDisplay(activeCustomer.memo)}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <button 
                  onClick={() => {
                    leaveTable(activeTable.number, currentUser.id);
                    setSelectedTable(null);
                  }}
                  className="w-full bg-white dark:bg-black/20 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 text-ink-light/70 dark:text-ink-dark/70 border border-ink-light/10 dark:border-ink-dark/10 font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-sm"
                >
                  테이블 비우기
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-ink-light/10 inline-block relative group">
                  <QRCodeSVG 
                    value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} 
                    size={150}
                    level="H"
                  />
                  <p className="mt-4 text-xs font-bold text-ink-light/50">{selectedTable}번 테이블 전용 QR</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
