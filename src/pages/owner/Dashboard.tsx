import { useState, useEffect, useRef } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Plus, 
  Minus, Trash2, Layers, Clock, Maximize2,
  TrendingUp, Calendar, History, Store,
  Utensils, Hourglass, GripVertical, Monitor,
  User, Mail, Settings as SettingsIcon, ShieldAlert,
  Send, ChevronRight, Activity, Zap
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerDashboard() {
  const { 
    currentUser, tables, users, visits, coupons, sections, logout, leaveTable, 
    initTables, tierOverrides, approveCouponUse, rejectCouponUse, 
    updateTableLayout, addTable, deleteTable, addSection, updateSection, 
    deleteSection, updateTableStatus, linkSocialAccount, deleteAccount
  } = useStore();
  
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [draggedTable, setDraggedTable] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoom, setZoom] = useState(1);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [tableStart, setTableStart] = useState<{x: number, y: number} | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  
  const currentStoreSections = sections.filter(s => s.storeId === currentUser?.id);
  const [activeSectionId, setActiveSectionId] = useState<string | 'all' | 'unassigned'>('all');
  const [isEditingSections, setIsEditingSections] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<{id: string, name: string, time: string, table: number, avatar?: string, tier: string}[]>([]);
  const processedVisitIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);
  const [highlightedTable, setHighlightedTable] = useState<number | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

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

  // Entrance Notifications Logic
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'owner') return;

    const myVisits = visits.filter(v => v.storeId === currentUser.id);
    
    if (isInitialLoad.current) {
      if (myVisits.length > 0) {
        myVisits.forEach(v => processedVisitIds.current.add(v.id));
        isInitialLoad.current = false;
      }
      return;
    }

    const newVisits = myVisits.filter(v => !processedVisitIds.current.has(v.id));
    
    if (newVisits.length > 0) {
      newVisits.forEach(v => {
        processedVisitIds.current.add(v.id);
        const customer = users.find(u => u.id === v.customerId);
        const customerName = customer?.name || '신규 고객';
        
        // Trigger Premium Feedback
        setHighlightedTable(v.tableNumber);
        setTimeout(() => setHighlightedTable(null), 8000);
        
        // Play Chime (Royalty-free subtle chime)
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.4;
          audio.play();
        } catch (e) {}

        // Trigger Toast
        window.dispatchEvent(new CustomEvent('show-toast', { 
          detail: { 
            message: `${customerName}님이 ${v.tableNumber}번 테이블에 입장하셨습니다!`, 
            type: 'info' 
          } 
        }));

        // Add to local notification history
        setLocalNotifications(prev => [
          { 
            id: v.id, 
            name: customerName, 
            avatar: customer?.avatarUrl,
            tier: getCustomerStats(v.customerId).tier,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            table: v.tableNumber 
          },
          ...prev
        ].slice(0, 10)); // Keep last 10
      });
    }
  }, [visits, currentUser, users]);

  if (!currentUser) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const myTables = tables.filter(t => t.storeId === currentUser.id);
  const actualTables = myTables.filter(t => t.type === 'table');
  const actualRoomsCount = myTables.filter(t => t.type === 'room').length;
  
  const activeTable = myTables.find(t => t.number === selectedTable);
  const activeCustomer = activeTable?.currentCustomerId 
    ? users.find(u => u.id === activeTable.currentCustomerId) 
    : null;

  const filteredTables = myTables.filter(t => {
    if (viewMode === 'grid' && t.type !== 'table' && t.type !== 'room') return false; 
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
    const override = tierOverrides.find(t => t.customerId === customerId && t.storeId === currentUser.id);
    const effectiveTier = getEffectiveTier(recentVisits, override?.tier);
    return { totalVisits: customerVisits.length, recentVisits, tier: effectiveTier };
  };

  const pendingRequests = coupons.filter(c => c.storeId === currentUser.id && c.status === 'pending');

  const handlePointerDown = (e: React.PointerEvent, table: any) => {
    if (!isLayoutMode) return;
    setDraggedTable(table.number);
    setDragStart({ x: e.clientX, y: e.clientY });
    setTableStart({ x: table.x, y: table.y });
    setDragPosition({ x: table.x, y: table.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedTable === null || !dragStart || !tableStart) return;
    
    // Delta-based movement: how much the mouse has moved from start
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    
    setDragPosition({ 
      x: tableStart.x + dx, 
      y: tableStart.y + dy 
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedTable !== null && dragPosition) {
      // Apply 10px grid snap only on release for final alignment
      const snappedX = Math.round(dragPosition.x / 10) * 10;
      const snappedY = Math.round(dragPosition.y / 10) * 10;
      updateTableLayout(currentUser.id, draggedTable, { x: snappedX, y: snappedY });
    }
    setDraggedTable(null);
    setDragPosition(null);
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `QR_Table_${selectedTable}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyTableLink = () => {
    const url = `${window.location.origin}/customer/store/${currentUser.id}?table=${selectedTable}`;
    navigator.clipboard.writeText(url);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '링크가 복사되었습니다.', type: 'success' } }));
  };

  const stats = (() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const newCustomers = new Set(visits.filter(v => v.storeId === currentUser.id && new Date(v.date) >= weekAgo).map(v => v.customerId)).size;
    
    const occupiedTables = actualTables.filter(t => t.currentCustomerId);
    const occupancyRate = actualTables.length > 0 ? Math.round((occupiedTables.length / actualTables.length) * 100) : 0;
    
    const hourCounts: Record<number, number> = {};
    visits.filter(v => v.storeId === currentUser.id).forEach(v => {
      const hour = new Date(v.date).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';
    
    const currentDurations = occupiedTables.map(t => (currentTime.getTime() - new Date(t.sessionStartTime!).getTime()) / 60000);
    const avgUsage = currentDurations.length > 0 ? Math.round(currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length) : 45;

    return { 
      newCustomers, 
      occupancyRate, 
      peakTime: `${peakHour}:00`, 
      avgUsage 
    };
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface">
      <aside className="h-screen w-20 lg:w-64 fixed left-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl">결</Link>
          <div className="mt-8 hidden lg:block">
            <p className="text-[#fcfcfc] font-serif italic text-sm">{currentUser.restaurantName}</p>
            <p className="text-[#fcfcfc]/50 uppercase tracking-widest text-[10px]">실시간 매장 관리</p>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/owner" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4 transition-all">
            <LayoutGrid className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">대시보드</span>
          </Link>
          <Link to="/owner/customers" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <Users className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">단골 관리</span>
          </Link>
          <Link to="/owner/statistics" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <BarChart3 className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">매장 통계</span>
          </Link>
          <Link to="/owner/brand-settings" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <SettingsIcon className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">매장 설정</span>
          </Link>
          <button onClick={() => setIsSettingsOpen(true)} className="w-full text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <User className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">프로필 설정</span>
          </button>
        </nav>
        <button onClick={handleLogout} className="px-8 mt-auto text-white/40 hover:text-white text-[10px] flex items-center gap-2">
          <LogOut className="w-4 h-4" /> <span className="hidden lg:block">로그아웃</span>
        </button>
      </aside>

      <main className="ml-20 lg:ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        <header className="bg-white/90 backdrop-blur-md px-8 py-6 border-b border-outline-variant/30 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div>
               <h1 className="text-3xl font-serif font-black italic text-primary mb-1">Gyeol Dashboard</h1>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live Sync: {currentTime.toLocaleTimeString('ko-KR')}</span>
               </div>
            </div>
            <nav className="hidden xl:flex gap-6 ml-8">
              <button onClick={() => setViewMode('map')} className={`text-sm font-bold ${viewMode === 'map' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant'}`}>배치도</button>
              <button onClick={() => setViewMode('grid')} className={`text-sm font-bold ${viewMode === 'grid' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant'}`}>리스트</button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
             {/* Notification Bell */}
             <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-3 rounded-full transition-all relative ${showNotifications ? 'bg-primary text-white' : 'bg-surface-container text-primary hover:bg-primary/5'}`}
                >
                   <Bell className="w-5 h-5" />
                   {localNotifications.length > 0 && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-burgundy rounded-full border-2 border-white animate-bounce"></span>
                   )}
                </button>

                {showNotifications && (
                   <div className="absolute top-16 right-0 w-80 bg-white rounded-[2rem] shadow-3xl border border-outline-variant/30 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-4">
                      <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-primary opacity-40">실시간 알림</h4>
                         {localNotifications.length > 0 && (
                            <button onClick={() => setLocalNotifications([])} className="text-[10px] font-bold text-burgundy opacity-60 hover:opacity-100">모두 삭제</button>
                         )}
                      </div>
                      <div className="max-h-96 overflow-y-auto no-scrollbar">
                         {localNotifications.length > 0 ? (
                            localNotifications.map(notification => (
                               <div key={notification.id} onClick={() => { setHighlightedTable(notification.table); setShowNotifications(false); }} className="p-5 border-b border-outline-variant/5 hover:bg-surface-container transition-colors flex items-center gap-4 cursor-pointer group">
                                  <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary overflow-hidden shadow-inner border border-primary/5">
                                     {notification.avatar ? (
                                        <img src={notification.avatar} className="w-full h-full object-cover" alt="" />
                                     ) : (
                                        <Users className="w-6 h-6 opacity-40" />
                                     )}
                                  </div>
                                  <div className="flex-1">
                                     <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-xs font-black text-primary">{notification.name}님</p>
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${getTierColor(notification.tier)} opacity-80 uppercase tracking-tighter`}>{notification.tier}</span>
                                     </div>
                                     <p className="text-[9px] font-bold text-on-surface-variant/40">{notification.table}번 테이블에 입장하였습니다 • {notification.time}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-40 -translate-x-2 group-hover:translate-x-0 transition-all" />
                               </div>
                            ))
                         ) : (
                            <div className="p-12 text-center">
                               <Bell className="w-8 h-8 text-on-surface-variant/10 mx-auto mb-3" />
                               <p className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest">새로운 알림이 없습니다</p>
                            </div>
                         )}
                      </div>
                   </div>
                )}
             </div>

             <button onClick={() => setIsLayoutMode(!isLayoutMode)} className={`px-8 py-3 rounded-full font-serif text-sm shadow-xl ${isLayoutMode ? 'bg-primary text-white' : 'bg-surface-container-highest text-primary hover:shadow-2xl transition-all active:scale-[0.98]'}`}>
                {isLayoutMode ? '배치 저장 (완료)' : '테이블 배치변경 (이동)'}
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-8 space-y-8">
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: '실시간 가동률', value: `${stats.occupancyRate}%`, icon: Activity, sub: `${actualTables.filter(t => t.currentCustomerId).length}/${actualTables.length}` },
              { label: '평균 체류 시간', value: `${stats.avgUsage}분`, icon: Hourglass, sub: '현재 기준' },
              { label: '금일 신규 단골', value: `${stats.newCustomers}명`, icon: TrendingUp, sub: '최근 7일' },
              { label: '매장 혼잡도', value: stats.occupancyRate > 80 ? '혼잡' : (stats.occupancyRate > 40 ? '여유' : '쾌적'), icon: Zap, sub: stats.peakTime }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-outline-variant/30 flex items-center justify-between shadow-sm group hover:border-primary transition-all">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1">{s.label}</p>
                  <div className="flex items-baseline gap-2">
                     <p className="text-3xl font-serif font-black text-primary italic">{s.value}</p>
                     <p className="text-[9px] font-bold text-primary/30 uppercase">{s.sub}</p>
                  </div>
                </div>
                <div className="p-4 bg-primary/5 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-all"><s.icon className="w-6 h-6" /></div>
              </div>
            ))}
          </div>

          <div className="flex-1 relative bg-white rounded-[3rem] border border-outline-variant/30 shadow-inner overflow-hidden">
             {viewMode === 'map' ? (
                <div ref={mapContainerRef} className="absolute inset-0 overflow-auto p-20 bg-[radial-gradient(#e5dcd3_1px,transparent_1px)] [background-size:20px_20px] no-scrollbar">
                   <div 
                    className="relative origin-top-left transition-transform duration-300" 
                    style={{ minWidth: '1200px', minHeight: '1000px', transform: `scale(${zoom})` }}
                   >
                      {filteredTables.map(table => {
                        const isOccupied = table.currentCustomerId !== null;
                        const isBeingDragged = draggedTable === table.number;
                        return (
                          <div
                            key={table.number}
                            onPointerDown={(e) => handlePointerDown(e, table)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onClick={() => (isLayoutMode || table.type === 'table' || table.type === 'room') && setSelectedTable(table.number)}
                            className={`absolute flex flex-col items-center justify-center group cursor-pointer ${isOccupied ? 'shadow-lg shadow-primary/20' : 'hover:shadow-xl'} ${isBeingDragged ? 'scale-[1.05] shadow-3xl z-[100] cursor-grabbing !transition-none' : 'duration-300 transition-all'} ${table.type !== 'table' && table.type !== 'room' && !isLayoutMode ? 'pointer-events-none opacity-60' : ''}`}
                            style={{
                              left: isBeingDragged ? dragPosition?.x : table.x,
                              top: isBeingDragged ? dragPosition?.y : table.y,
                              width: table.width || 80,
                              height: table.height || 80,
                              backgroundColor: table.type === 'room' ? 'transparent' : (isOccupied ? '#261c1a' : (table.status === 'dirty' ? '#fdf2f2' : (isBeingDragged ? '#ffffff' : '#ffffff'))),
                              border: table.type === 'room' 
                                ? `4px solid ${isBeingDragged ? '#4285F4' : '#261c1a'}` 
                                : (isOccupied ? 'none' : `3px solid ${selectedTable === table.number ? '#261c1a' : (isBeingDragged ? '#4285F4' : '#e5dcd3')}`),
                              borderRadius: table.shape === 'circle' ? '50%' : (table.type === 'room' ? '3rem' : '1.5rem'),
                              zIndex: isBeingDragged ? 100 : (selectedTable === table.number ? 40 : 10),
                              touchAction: 'none',
                              borderStyle: table.type === 'corridor' ? 'dashed' : 'solid',
                              opacity: table.type === 'corridor' ? 0.4 : 1
                            }}
                          >
                            {table.type === 'pos' && <div className="text-primary/20"><Monitor className="w-10 h-10" /></div>}
                            {table.type === 'door' && <div className="text-primary/20"><LogOut className="w-10 h-10 rotate-90" /></div>}
                            {table.type === 'room' && <div className="absolute top-4 left-8 text-[11px] font-black uppercase text-primary/30 tracking-widest">프라이빗 룸</div>}
                            
                            {table.type === 'table' && <span className={`text-xl font-serif font-black italic ${isOccupied ? 'text-white' : 'text-primary'}`}>{table.number}</span>}
                            {isOccupied && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                   <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full"></div>
                                   <div className="mt-8 px-2 py-1 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                                      <p className="text-[9px] font-black text-white/60 tracking-widest leading-none">
                                         {(() => {
                                            const start = new Date(table.sessionStartTime!);
                                            const diff = Math.floor((currentTime.getTime() - start.getTime()) / 60000);
                                            return `${diff}M`;
                                         })()}
                                      </p>
                                   </div>
                                </div>
                             )}

                            {isLayoutMode && !isOccupied && (
                               <>
                                  <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 transition-opacity">
                                     <GripVertical className="w-4 h-4 text-primary" />
                                  </div>
                                  {!isBeingDragged && (
                                     <>
                                        <button 
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} 
                                          className="absolute top-2 left-2 p-2 bg-burgundy/10 text-burgundy rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-burgundy hover:text-white z-20 shadow-sm"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => { e.stopPropagation(); setSelectedTable(table.number); }} 
                                          className={`absolute top-2 right-2 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm ${selectedTable === table.number ? 'bg-primary text-white opacity-100' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
                                        >
                                          <Settings className="w-3.5 h-3.5" />
                                        </button>
                                     </>
                                  )}
                               </>
                            )}
                          </div>
                        );
                      })}
                   </div>
                </div>
             ) : (
                <div className="p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-full no-scrollbar">
                   {filteredTables.map(table => (
                      <div key={table.number} onClick={() => setSelectedTable(table.number)} className="bg-surface-container rounded-3xl p-6 border border-outline-variant/30 flex items-center gap-6 cursor-pointer hover:bg-white transition-all">
                         <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center font-serif font-black text-2xl italic">{table.number}</div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-primary/40">{table.currentCustomerId ? '이용 중' : '공석'}</p>
                            <p className="text-sm font-black text-primary">{table.currentCustomerId ? users.find(u => u.id === table.currentCustomerId)?.name : '비어 있음'}</p>
                         </div>
                      </div>
                   ))}
                </div>
             )}

             {isLayoutMode && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-primary p-3 rounded-[2.5rem] shadow-3xl z-50 animate-in fade-in slide-in-from-bottom-8">
                   <div className="flex items-center bg-white/10 rounded-2xl p-1">
                      <button onClick={() => addTable(currentUser.id, 'table')} className="px-5 py-2.5 text-white hover:bg-white/10 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"><Utensils className="w-4 h-4" /> 테이블</button>
                      <div className="w-[1px] h-4 bg-white/10"></div>
                      <button onClick={() => addTable(currentUser.id, 'room')} className="px-5 py-2.5 text-white hover:bg-white/10 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"><Maximize2 className="w-4 h-4" /> 룸</button>
                      <div className="w-[1px] h-4 bg-white/10"></div>
                      <button onClick={() => addTable(currentUser.id, 'door')} className="px-5 py-2.5 text-white hover:bg-white/10 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"><LogOut className="w-4 h-4 rotate-90" /> 문</button>
                      <div className="w-[1px] h-4 bg-white/10"></div>
                      <button onClick={() => addTable(currentUser.id, 'pos')} className="px-5 py-2.5 text-white hover:bg-white/10 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"><Monitor className="w-4 h-4" /> 포스기</button>
                   </div>
                   <div className="w-[1px] h-8 bg-white/20 mx-1"></div>
                   <button onClick={() => initTables(currentUser.id)} className="p-3 bg-burgundy/10 text-white hover:bg-burgundy/20 rounded-[1.25rem] transition-all" title="초기화"><History className="w-5 h-5" /></button>
                </div>
             )}
          </div>
        </div>

        {selectedTable && (
           <aside className="fixed inset-y-0 right-0 w-96 bg-white shadow-[-30px_0_60px_rgba(0,0,0,0.1)] z-[60] p-10 flex flex-col border-l border-outline-variant/20 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-start mb-10">
                 <div>
                    <h2 className="text-3xl font-serif font-black text-primary italic mb-1">{activeTable?.type === 'room' ? '프라이빗 룸' : (activeTable?.type === 'table' ? `${selectedTable}번 테이블` : '실내 인테리어')}</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">상태: {activeTable?.currentCustomerId ? '이용 중' : (activeTable?.type === 'table' || activeTable?.type === 'room' ? '사용 가능' : '인테리어 요소')}</p>
                 </div>
                 <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-surface-container rounded-full"><X className="w-6 h-6 text-on-surface-variant/30" /></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
                 {activeCustomer ? (
                    <div className="space-y-6">
                       <div className="bg-surface-container p-8 rounded-[3rem] border-l-8 border-primary space-y-4">
                          <h3 className="text-2xl font-serif font-black text-primary">{activeCustomer.name}</h3>
                          <p className="text-xs font-bold text-on-surface-variant/60">{activeCustomer.phone}</p>
                          <div className="flex gap-2">
                             <span className="px-3 py-1 bg-primary text-white text-[9px] font-black rounded-full uppercase tracking-tighter">단골 마스터</span>
                          </div>
                       </div>
                       <button onClick={() => leaveTable(selectedTable!, currentUser.id)} className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">이용 종료</button>
                    </div>
                 ) : (
                    <div className="space-y-8">
                       {isLayoutMode ? (
                          <div className="space-y-6">
                             <div className="bg-surface-container p-8 rounded-[2.5rem] space-y-6">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/40">레이아웃 및 설정</h4>
                                <div className="space-y-4">
                                   {[
                                      { label: '가로 크기', field: 'width', val: activeTable?.width || 80 },
                                      { label: '세로 크기', field: 'height', val: activeTable?.height || 80 },
                                      { label: '수용 좌석', field: 'seats', val: activeTable?.seats || 4 }
                                   ].map(f => (
                                      <div key={f.field} className="flex justify-between items-center">
                                         <span className="text-xs font-bold text-primary/60">{f.label}</span>
                                         <div className="flex items-center gap-4">
                                            <button onClick={() => updateTableLayout(currentUser.id, selectedTable!, { [f.field]: Math.max(1, f.val - (f.field === 'seats' ? 1 : 10)) })} className="p-2 bg-white rounded-lg shadow-sm"><Minus className="w-3 h-3" /></button>
                                            <span className="text-sm font-black w-8 text-center">{f.val}</span>
                                            <button onClick={() => updateTableLayout(currentUser.id, selectedTable!, { [f.field]: f.val + (f.field === 'seats' ? 1 : 10) })} className="p-2 bg-white rounded-lg shadow-sm"><Plus className="w-3 h-3" /></button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                             <button onClick={() => setSelectedTable(null)} className="w-full py-4 border-2 border-primary text-primary rounded-2xl font-black text-[10px] uppercase">설정 완료</button>
                          </div>
                       ) : (
                          <>
                             <div className="bg-white p-6 rounded-[2.5rem] border-2 border-outline-variant/30 shadow-inner flex flex-col items-center gap-6">
                                <div ref={qrRef}><QRCodeSVG value={`${window.location.origin}/customer/store/${currentUser.id}?table=${selectedTable}`} size={160} level="H" /></div>
                                <p className="text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.2em]">테이블 실시간 QR</p>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <button onClick={copyTableLink} className="p-5 bg-surface-container rounded-[2rem] flex flex-col items-center gap-3 text-primary transition-all hover:bg-primary hover:text-white">
                                   <Maximize2 className="w-6 h-6" /><span className="text-[9px] font-black uppercase">링크 복사</span>
                                </button>
                                <button onClick={downloadQR} className="p-5 bg-surface-container rounded-[2rem] flex flex-col items-center gap-3 text-primary transition-all hover:bg-primary hover:text-white">
                                   <Plus className="w-6 h-6" /><span className="text-[9px] font-black uppercase">QR 저장</span>
                                </button>
                             </div>
                          </>
                       )}
                    </div>
                 )}
              </div>
           </aside>
        )}
      </main>

      {/* Profile Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[110] flex items-center justify-center p-8 animate-in fade-in zoom-in-95">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-3xl flex flex-col gap-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-serif font-black text-primary italic">사장님 프로필 설정</h3>
                 <button onClick={() => setIsSettingsOpen(false)} className="p-3 bg-surface-container rounded-full"><X className="w-5 h-5 text-on-surface-variant/40" /></button>
              </div>

              <div className="space-y-6">
                 <div className="bg-surface-container p-6 rounded-3xl flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm"><User className="w-8 h-8" /></div>
                    <div>
                       <p className="text-xl font-serif font-black text-primary">{currentUser.name}</p>
                       <p className="text-xs font-bold text-on-surface-variant/40">{currentUser.phone || '소셜 계정 전용'}</p>
                       <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mt-1">{currentUser.restaurantName}</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary opacity-40">연동된 계정</p>
                    <div className="grid grid-cols-1 gap-3">
                       <div className="flex items-center justify-between p-4 bg-white border border-outline-variant/30 rounded-2xl">
                          <div className="flex items-center gap-3">
                             <Mail className="w-4 h-4 text-on-surface-variant/40" />
                             <span className="text-xs font-bold">기본 로그인</span>
                          </div>
                          <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-3 py-1 rounded-full">ACTIVE</span>
                       </div>
                       
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
                    사장님 계정 해지 (매장 데이터 유지)
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
              <h3 className="text-2xl font-serif font-black text-primary italic mb-2">프랜차이즈 해지 확인</h3>
              <p className="text-xs text-on-surface-variant/60 leading-relaxed mb-6">결 플랫폼 가맹을 해지하시겠습니까? 데이터는 보존되지만 개인 정보는 즉시 파기됩니다.</p>
              
              <div className="mb-10 text-left">
                 <p className="text-[10px] font-black text-primary/40 uppercase mb-2 ml-2">해지 승인 코드 입력</p>
                 <input 
                   type="text" 
                   placeholder='"DELETE" 라고 입력하세요'
                   value={confirmDeleteText}
                   onChange={(e) => setConfirmDeleteText(e.target.value)}
                   className="w-full px-5 py-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-xs font-black placeholder:text-on-surface-variant/20 focus:border-burgundy transition-all"
                 />
              </div>

              <div className="flex gap-4">
                 <button onClick={() => { setIsDeletingAccount(false); setConfirmDeleteText(''); }} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">취소</button>
                 <button 
                   disabled={confirmDeleteText !== 'DELETE'}
                   onClick={() => {
                      deleteAccount();
                      setIsDeletingAccount(false);
                      setIsSettingsOpen(false);
                      setConfirmDeleteText('');
                   }}
                   className={`flex-[2] py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all ${confirmDeleteText === 'DELETE' ? 'bg-burgundy text-white' : 'bg-surface-container text-on-surface-variant/20 cursor-not-allowed'}`}
                 >해지 실행</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
