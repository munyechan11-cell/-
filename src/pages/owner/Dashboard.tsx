import { useState, useEffect, useRef } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Check, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Square, Plus, 
  Minus, Trash2, Circle, GripVertical, Layers, Palette, 
  MoreVertical, Edit2, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerDashboard() {
  const { 
    currentUser, tables, users, visits, coupons, sections, logout, leaveTable, 
    initTables, tierOverrides, approveCouponUse, rejectCouponUse, 
    updateTableLayout, addTable, deleteTable, addSection, updateSection, 
    deleteSection, updateTableStatus 
  } = useStore();
  
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [draggedTable, setDraggedTable] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Section Management
  const currentStoreSections = sections.filter(s => s.storeId === currentUser?.id);
  const [activeSectionId, setActiveSectionId] = useState<string | 'all' | 'unassigned'>('all');
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role === 'owner') {
      const myTables = tables.filter(t => t.storeId === currentUser.id);
      if (myTables.length === 0) {
        initTables(currentUser.id);
      }
    }
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

  const filteredTables = myTables.filter(t => {
    if (activeSectionId === 'all') return true;
    if (activeSectionId === 'unassigned') return !t.sectionId;
    return t.sectionId === activeSectionId;
  });

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

  const getStatusColor = (status?: string, isOccupied?: boolean) => {
    if (isOccupied) return 'bg-sky-500 border-sky-600 text-white'; // Blue
    switch (status) {
      case 'paid': return 'bg-emerald-500 border-emerald-600 text-white'; // Green
      case 'dirty': return 'bg-amber-400 border-amber-500 text-ink-light'; // Yellow
      case 'available': 
      default: return 'bg-white dark:bg-black/40 border-ink-light/20 text-ink-light/50'; // Gray
    }
  };

  const handleDragDrop = (e: React.DragEvent, tableNumber: number) => {
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (rect && draggedTable !== null) {
      const draggedT = myTables.find(t => t.number === draggedTable);
      if (draggedT) {
        const x = Math.max(0, Math.min(rect.width - (draggedT.width || 70), e.clientX - rect.left - (draggedT.width || 70) / 2));
        const y = Math.max(0, Math.min(rect.height - (draggedT.height || 70), e.clientY - rect.top - (draggedT.height || 70) / 2));
        updateTableLayout(currentUser.id, draggedTable, { x, y });
      }
    }
  };

  return (
    <div className="min-h-full bg-[#F5F5F7] dark:bg-hanji-dark pb-20 overflow-hidden h-screen flex flex-col">
      {/* Top Professional Header */}
      <div className="bg-white dark:bg-black/40 backdrop-blur-md border-b border-ink-light/10 dark:border-ink-dark/10 p-4 flex justify-between items-center z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-burgundy text-white p-2 rounded-xl shadow-lg shadow-burgundy/20">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-light dark:text-ink-dark">{currentUser.restaurantName || '매장 관리'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] font-bold text-ink-light/40 dark:text-ink-dark/40 uppercase tracking-widest">
                <div className={`w-1.5 h-1.5 rounded-full ${pendingRequests.length > 0 ? 'bg-burgundy animate-pulse' : 'bg-emerald-500'}`}></div>
                Live Status
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {pendingRequests.length > 0 && (
            <button className="relative p-2 bg-burgundy/10 text-burgundy rounded-full hover:bg-burgundy/20 transition-all">
              <Bell className="w-6 h-6 animate-swing origin-top" />
              <span className="absolute -top-1 -right-1 bg-burgundy text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{pendingRequests.length}</span>
            </button>
          )}
          <div className="h-8 w-[1px] bg-ink-light/10 mx-1"></div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-ink-light/5 dark:bg-ink-dark/5 rounded-xl hover:bg-ink-light/10 text-ink-light/70 font-bold text-sm transition-all">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Section Tabs & Controls */}
        <div className="px-4 pt-4 flex justify-between items-center bg-white/50 backdrop-blur-sm border-b border-ink-light/5 z-20">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 max-w-[70%]">
            <button 
              onClick={() => setActiveSectionId('all')}
              className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap border-b-2 ${activeSectionId === 'all' ? 'border-burgundy text-burgundy bg-burgundy/5' : 'border-transparent text-ink-light/40 hover:text-ink-light'}`}
            >
              전체
            </button>
            {currentStoreSections.map(section => (
              <button 
                key={section.id}
                onClick={() => setActiveSectionId(section.id)}
                className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap border-b-2 ${activeSectionId === section.id ? 'border-burgundy text-burgundy bg-burgundy/5' : 'border-transparent text-ink-light/40 hover:text-ink-light'}`}
              >
                {section.name}
              </button>
            ))}
            <button 
              onClick={() => setActiveSectionId('unassigned')}
              className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap border-b-2 ${activeSectionId === 'unassigned' ? 'border-burgundy text-burgundy bg-burgundy/5' : 'border-transparent text-ink-light/40 hover:text-ink-light'}`}
            >
              미지정
            </button>
            <button onClick={() => setIsEditingSections(true)} className="p-2 text-ink-light/20 hover:text-burgundy transition-colors"><Plus className="w-4 h-4" /></button>
          </div>

          <div className="flex gap-2 pb-2">
            <div className="flex bg-ink-light/5 p-1 rounded-xl">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-burgundy' : 'text-ink-light/30'}`}><List className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-burgundy' : 'text-ink-light/30'}`}><MapIcon className="w-4 h-4" /></button>
            </div>
            <button 
              onClick={() => setIsLayoutMode(!isLayoutMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${isLayoutMode ? 'bg-burgundy text-white border-burgundy shadow-lg shadow-burgundy/20' : 'bg-white text-ink-light/40 border-ink-light/10'}`}
            >
              {isLayoutMode ? <Check className="w-3 h-3" /> : <Settings className="w-3 h-3" />}
              {isLayoutMode ? 'Done' : 'Edit Mode'}
            </button>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 relative overflow-hidden bg-hanji-light dark:bg-hanji-dark p-6">
          {viewMode === 'map' ? (
            <div 
              className="relative w-full h-full bg-white dark:bg-black/20 rounded-[3rem] border border-ink-light/10 shadow-inner overflow-auto no-scrollbar"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const tableNum = e.dataTransfer.getData('tableNumber');
                if (tableNum) handleDragDrop(e as any, parseInt(tableNum));
              }}
            >
              {/* Layout Helper Grid */}
              {isLayoutMode && <div className="absolute inset-0 bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:30px_30px] opacity-10 pointer-events-none"></div>}
              
              <div className="relative min-w-[1200px] min-h-[900px]">
                {filteredTables.map((table) => {
                  const isOccupied = table.currentCustomerId !== null;
                  const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                  const isCorridor = table.type === 'corridor';
                  const currentStatus = isOccupied ? 'occupied' : (table.status || 'available');
                  
                  return (
                    <div
                      key={table.number}
                      draggable={false} // We use the handle for dragging
                      onClick={() => !isCorridor && setSelectedTable(table.number)}
                      className={`absolute flex flex-col items-center justify-center p-3 shadow-sm border-2 transition-all cursor-pointer group ${table.shape === 'circle' ? 'rounded-full' : (table.isRoom ? 'rounded-[2.5rem]' : 'rounded-3xl')} ${getStatusColor(currentStatus, isOccupied)} ${selectedTable === table.number ? 'ring-4 ring-burgundy/20 border-burgundy' : ''}`}
                      style={{ 
                        left: `${table.x}px`, 
                        top: `${table.y}px`, 
                        width: `${table.width || 80}px`, 
                        height: `${table.height || 80}px`,
                        zIndex: table.isRoom ? 1 : 10
                      }}
                    >
                      {/* MOVE HANDLE */}
                      <div 
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('tableNumber', table.number.toString());
                          setDraggedTable(table.number);
                          // Set transparent ghost image
                          const img = new Image();
                          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                          e.dataTransfer.setDragImage(img, 0, 0);
                        }}
                        onDragEnd={() => setDraggedTable(null)}
                        className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-black rounded-lg shadow-lg border border-ink-light/10 text-ink-light/30 hover:text-burgundy opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-50"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Content Overlay */}
                      {!isCorridor && (
                        <div className="flex flex-col items-center select-none">
                          <span className="text-lg font-black tracking-tighter leading-none">{table.number}</span>
                          <div className="flex items-center gap-1 mt-1 opacity-60">
                            <Users className="w-2.5 h-2.5" />
                            <span className="text-[10px] font-bold">G: {table.seats || 4}</span>
                          </div>
                          {isOccupied && table.sessionStartTime && (
                            <div className="flex items-center gap-1 mt-1 font-black text-[9px] bg-black/10 px-1.5 py-0.5 rounded-full">
                              <Clock className="w-2.5 h-2.5" />
                              {(() => {
                                const diff = Math.floor((currentTime.getTime() - new Date(table.sessionStartTime).getTime()) / 60000);
                                return diff > 60 ? `${Math.floor(diff/60)}h ${diff%60}m` : `${diff}m`;
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status Info (Label) */}
                      {isOccupied && customer && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm whitespace-nowrap z-50">
                          {customer.name}
                        </div>
                      )}
                      {!isOccupied && table.status === 'dirty' && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-amber-400 text-ink-light px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm whitespace-nowrap z-50 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> 청소필요
                        </div>
                      )}

                      {/* Layout Mode Controls */}
                      {isLayoutMode && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-black/60 rounded-inherit flex flex-wrap items-center justify-center gap-1 p-1 z-20 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                          <button onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { width: (table.width || 80) + 10, height: (table.height || 80) + 10 }); }} className="p-1.5 bg-white rounded-lg shadow hover:bg-burgundy hover:text-white transition-colors"><Plus className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { shape: table.shape === 'circle' ? 'square' : 'circle' }); }} className="p-1.5 bg-white rounded-lg shadow hover:bg-burgundy hover:text-white transition-colors"><Square className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} className="p-1.5 bg-white rounded-lg shadow hover:bg-burgundy hover:text-white transition-colors text-red-500"><Trash2 className="w-3 h-3" /></button>
                          <div className="w-full flex justify-center gap-1 mt-1">
                            {currentStoreSections.map(s => (
                              <button key={s.id} onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { sectionId: s.id }); }} className={`w-3 h-3 rounded-full border border-ink-light/20 ${table.sectionId === s.id ? 'bg-burgundy' : 'bg-white'}`}></button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-full pr-2 no-scrollbar">
              {filteredTables.map(table => {
                 const isOccupied = table.currentCustomerId !== null;
                 const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                 return (
                   <div 
                    key={table.number}
                    onClick={() => setSelectedTable(table.number)}
                    className={`bg-white dark:bg-black/40 p-6 rounded-[2rem] border-2 transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1 ${isOccupied ? 'border-sky-500/30' : table.status === 'dirty' ? 'border-amber-400/30' : 'border-ink-light/5'}`}
                   >
                     <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg ${isOccupied ? 'bg-sky-500 text-white' : table.status === 'dirty' ? 'bg-amber-400 text-ink-light' : 'bg-burgundy text-white'}`}>
                          {table.number}
                        </div>
                        {isOccupied && table.sessionStartTime && (
                          <div className="text-xs font-black text-sky-600 bg-sky-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {(() => {
                              const diff = Math.floor((currentTime.getTime() - new Date(table.sessionStartTime).getTime()) / 60000);
                              return diff > 60 ? `${Math.floor(diff/60)}시간 ${diff%60}분` : `${diff}분 전`;
                            })()}
                          </div>
                        )}
                     </div>
                     {isOccupied && customer ? (
                       <div className="space-y-1">
                          <p className="text-lg font-bold text-ink-light dark:text-ink-dark">{customer.name}님</p>
                          <p className="text-xs text-ink-light/40 font-medium">{customer.phone}</p>
                       </div>
                     ) : (
                       <p className="text-sm font-bold text-ink-light/20 uppercase tracking-widest">{table.status === 'dirty' ? 'Cleaning Needed' : 'Available'}</p>
                     )}
                   </div>
                 );
              })}
            </div>
          )}

          {/* Quick Add Floating Panel */}
          {isLayoutMode && (
            <div className="absolute top-1/2 -translate-y-1/2 left-8 bg-white dark:bg-black/60 backdrop-blur-xl border border-ink-light/10 p-3 rounded-2xl shadow-2xl z-40 flex flex-col gap-3 animate-in fade-in slide-in-from-left-4">
              <button 
                onClick={() => addTable(currentUser.id, 'table', activeSectionId !== 'all' ? activeSectionId : undefined)}
                className="p-3 bg-burgundy/10 text-burgundy rounded-xl hover:bg-burgundy hover:text-white transition-all flex flex-col items-center gap-1"
              >
                <Plus className="w-6 h-6" />
                <span className="text-[8px] font-black">TABLE</span>
              </button>
              <button 
                onClick={() => addTable(currentUser.id, 'room', activeSectionId !== 'all' ? activeSectionId : undefined)}
                className="p-3 bg-espresso/10 text-espresso rounded-xl hover:bg-espresso hover:text-white transition-all flex flex-col items-center gap-1"
              >
                <Square className="w-6 h-6" />
                <span className="text-[8px] font-black">AREA</span>
              </button>
              <button 
                onClick={() => addTable(currentUser.id, 'corridor', activeSectionId !== 'all' ? activeSectionId : undefined)}
                className="p-3 bg-ink-light/10 text-ink-light rounded-xl hover:bg-ink-light hover:text-white transition-all flex flex-col items-center gap-1"
              >
                <Move className="w-6 h-6" />
                <span className="text-[8px] font-black">DRAG</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE PANEL (Toast POS Detail Panel) */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-hanji-dark z-50 shadow-2xl border-l border-ink-light/10 transform transition-transform duration-300 ease-out flex flex-col ${selectedTable ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedTable && activeTable ? (
          <>
            <div className="p-6 border-b border-ink-light/5 flex justify-between items-center bg-zinc-50/50">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl ${activeTable.currentCustomerId ? 'bg-sky-500 shadow-sky-500/20' : 'bg-burgundy shadow-burgundy/20'}`}>
                  {selectedTable}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink-light dark:text-ink-dark">상세 정보</h2>
                  <p className="text-xs font-black text-ink-light/30 uppercase tracking-widest">{activeTable.sectionId ? (currentStoreSections.find(s => s.id === activeTable.sectionId)?.name) : '미지정 구역'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-ink-light/5 rounded-full transition-colors"><X className="w-6 h-6 text-ink-light/40" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {activeCustomer ? (
                (() => {
                  const stats = getCustomerStats(activeCustomer.id);
                  return (
                    <div className="space-y-6">
                      <div className="bg-white dark:bg-black/20 p-6 rounded-[2.5rem] border border-ink-light/10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-burgundy/5 rounded-full -mr-16 -mt-16"></div>
                        <div className="flex justify-between items-start mb-6 relative">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xl font-black">{activeCustomer.name.charAt(0)}</div>
                            <div>
                              <h3 className="text-2xl font-bold text-ink-light dark:text-ink-dark">{activeCustomer.name}</h3>
                              <p className="text-sm font-medium text-ink-light/40 mt-1">{activeCustomer.phone}</p>
                            </div>
                          </div>
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black border uppercase tracking-wider ${getTierColor(stats.tier)}`}>
                            {getTierCustomName(stats.tier, currentUser.tierNames)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-ink-light/5 relative">
                          <div className="text-center">
                            <p className="text-[10px] font-black text-ink-light/30 uppercase mb-1">Total Visits</p>
                            <p className="text-lg font-black text-ink-light">{stats.totalVisits}</p>
                          </div>
                          <div className="text-center border-x border-ink-light/5">
                            <p className="text-[10px] font-black text-ink-light/30 uppercase mb-1">Recent 30D</p>
                            <p className="text-lg font-black text-sky-500">{stats.recentVisits}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-black text-ink-light/30 uppercase mb-1">Monthly Peak</p>
                            <p className="text-lg font-black text-burgundy">{stats.frequencyPerMonth}</p>
                          </div>
                        </div>
                        
                        <div className="mt-6 flex justify-center">
                           <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-full border border-ink-light/5 text-xs font-bold text-ink-light/50">
                             <Clock className="w-3.5 h-3.5" />
                             마지막 방문: {stats.daysSinceLastVisit !== null ? (stats.daysSinceLastVisit === 0 ? '오늘' : `${stats.daysSinceLastVisit}일 전`) : '기록 없음'}
                           </div>
                        </div>
                      </div>

                      {activeCustomer.memo && (
                        <div className="p-6 bg-[#FAF9F6] dark:bg-black/40 rounded-3xl border border-espresso/10">
                          <p className="text-xs font-black text-espresso/40 uppercase mb-3 flex items-center gap-2">
                             <Edit2 className="w-3.5 h-3.5" /> 고객 특이사항
                          </p>
                          <p className="text-sm text-espresso/80 leading-relaxed font-serif whitespace-pre-wrap">
                            {formatMemoDisplay(activeCustomer.memo)}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center space-y-6 flex flex-col items-center justify-center h-full opacity-50">
                   <div className="bg-white p-8 rounded-[3rem] border border-ink-light/10 shadow-lg scale-110">
                      <QRCodeSVG value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} size={160} level="H" />
                   </div>
                   <div className="space-y-2">
                      <p className="text-lg font-black text-ink-light">Scan to Check-in</p>
                      <p className="text-sm font-medium text-ink-light/40">{selectedTable}번 테이블 전용 QR 코드</p>
                   </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ink-light/10 space-y-3 bg-zinc-50/50">
              {activeCustomer ? (
                <button 
                  onClick={() => { 
                    updateTableStatus(currentUser.id, selectedTable, 'dirty');
                    leaveTable(selectedTable, currentUser.id); 
                    setSelectedTable(null); 
                  }} 
                  className="w-full bg-burgundy text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-burgundy/20 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" /> 테이블 비우기
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                   <button 
                    onClick={() => { updateTableStatus(currentUser.id, selectedTable, 'available'); setSelectedTable(null); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${activeTable.status === 'available' ? 'border-emerald-500 bg-emerald-50' : 'border-ink-light/5 hover:bg-ink-light/5'}`}
                   >
                     <CheckCircle2 className={`w-8 h-8 ${activeTable.status === 'available' ? 'text-emerald-500' : 'text-ink-light/20'}`} />
                     <span className="text-[10px] font-black uppercase">Available</span>
                   </button>
                   <button 
                    onClick={() => { updateTableStatus(currentUser.id, selectedTable, 'dirty'); setSelectedTable(null); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${activeTable.status === 'dirty' ? 'border-amber-400 bg-amber-50' : 'border-ink-light/5 hover:bg-ink-light/5'}`}
                   >
                     <AlertCircle className={`w-8 h-8 ${activeTable.status === 'dirty' ? 'text-amber-500' : 'text-ink-light/20'}`} />
                     <span className="text-[10px] font-black uppercase">Dirty</span>
                   </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-ink-light/20 p-12 text-center flex-col gap-4">
             <LayoutGrid className="w-16 h-16" />
             <p className="font-bold">현황판에서 테이블을 선택하여 관리하세요.</p>
          </div>
        )}
      </div>

      {/* Section Editor Modal */}
      {isEditingSections && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-hanji-dark w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-ink-light/10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-ink-light tracking-tighter">구역 관리</h2>
              <button 
                onClick={() => { setIsEditingSections(false); setEditingSectionId(null); }}
                className="p-2 bg-ink-light/5 rounded-full hover:bg-ink-light/10 transition-colors"
                ><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-4 max-h-80 overflow-y-auto no-scrollbar pr-2">
              {currentStoreSections.map(section => (
                <div key={section.id} className="flex items-center gap-3 p-4 bg-[#F5F5F7] rounded-2xl border border-ink-light/5">
                  <div className="bg-emerald-500 w-2 h-2 rounded-full"></div>
                  {editingSectionId === section.id ? (
                    <input 
                      autoFocus
                      className="flex-1 bg-transparent border-b-2 border-burgundy focus:outline-none font-bold text-ink-light"
                      value={section.name}
                      onBlur={() => setEditingSectionId(null)}
                      onChange={(e) => updateSection(section.id, e.target.value)}
                    />
                  ) : (
                    <span className="flex-1 font-bold text-ink-light">{section.name}</span>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => setEditingSectionId(section.id)} className="p-2 hover:bg-white rounded-lg transition-colors text-ink-light/30 hover:text-ink-light"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteSection(currentUser.id, section.id)} className="p-2 hover:bg-white rounded-lg transition-colors text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-ink-light/10">
              <div className="flex gap-3">
                <input 
                  className="flex-1 bg-[#F5F5F7] border border-ink-light/5 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-burgundy/20 font-medium text-ink-light"
                  placeholder="새 구역 이름 (예: 테라스)"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                />
                <button 
                  onClick={() => {
                    if (newSectionName.trim()) {
                      addSection(currentUser.id, newSectionName);
                      setNewSectionName('');
                    }
                  }}
                  className="px-6 bg-burgundy text-white font-black rounded-2xl hover:bg-burgundy/90 transition-all shadow-lg shadow-burgundy/20"
                >추가</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/60 backdrop-blur-md border-t border-ink-light/10 flex justify-around p-4 z-40">
        <Link to="/owner" className="flex flex-col items-center text-burgundy"><LayoutGrid className="w-6 h-6 mb-1" /><span className="text-xs font-bold">테이블</span></Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-ink-light/40"><Users className="w-6 h-6 mb-1" /><span className="text-xs font-bold">고객</span></Link>
        <Link to="/owner/statistics" className="flex flex-col items-center text-ink-light/40"><BarChart3 className="w-6 h-6 mb-1" /><span className="text-xs font-bold">통계</span></Link>
      </div>
    </div>
  );
}
