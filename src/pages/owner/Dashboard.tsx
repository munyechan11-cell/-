import { useState, useEffect, useRef } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Check, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Square, Plus, 
  Minus, Trash2, Circle, GripVertical, Layers, Palette, 
  MoreVertical, Edit2, CheckCircle2, AlertCircle, Clock, Maximize2,
  TrendingUp, Calendar, Heart, ShieldCheck, History, HelpCircle, Store,
  Search, Notifications, ChairAlt, Schedule, Restaurant, HourglassBottom, WineBar, Celebration, VolumeMute
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
  const [zoom, setZoom] = useState(1);
  const [isMoveOnlyMode, setIsMoveOnlyMode] = useState(false);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
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

  const handlePointerDown = (e: React.PointerEvent, table: any) => {
    if (!isLayoutMode || !isMoveOnlyMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left) / zoom;
    const offsetY = (e.clientY - rect.top) / zoom;
    setDraggedTable(table.number);
    setDragOffset({ x: offsetX, y: offsetY });
    setDragPosition({ x: table.x, y: table.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedTable === null || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const scrollX = mapContainerRef.current.scrollLeft;
    const scrollY = mapContainerRef.current.scrollTop;
    const rawX = (e.clientX - rect.left + scrollX) / zoom - dragOffset.x;
    const rawY = (e.clientY - rect.top + scrollY) / zoom - dragOffset.y;
    const x = Math.round(rawX / 10) * 10;
    const y = Math.round(rawY / 10) * 10;
    setDragPosition({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedTable !== null && dragPosition) {
      updateTableLayout(currentUser.id, draggedTable, { x: dragPosition.x, y: dragPosition.y });
    }
    setDraggedTable(null);
    setDragPosition(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20">
      
      {/* SideNavBar - Simple Brown & Burgundy */}
      <aside className="h-screen w-20 lg:w-64 fixed left-0 border-r-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl tracking-tighter block">결</Link>
          <div className="mt-8 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden hidden lg:block">
                <Store className="w-full h-full p-2 text-white/40" />
             </div>
             <div className="hidden lg:block overflow-hidden">
                <p className="text-[#fcfcfc] font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 공방'}</p>
                <p className="text-[#fcfcfc]/50 font-sans uppercase tracking-widest text-[10px]">사장님 관리 시스템</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <Link to="/owner" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4 transition-transform ease-in-out">
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">대시보드</span>
          </Link>
          <Link to="/owner/customers" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">단골 관리</span>
          </Link>
          <Link to="/owner/statistics" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">매장 통계</span>
          </Link>
          <Link to="/owner/brand-settings" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">매장 설정</span>
          </Link>
        </nav>

        <div className="px-8 mt-auto space-y-4">
          <div className="pt-6 border-t border-white/10 space-y-2">
            <button onClick={handleLogout} className="text-[#fcfcfc]/40 hover:text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden lg:block">로그아웃</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="ml-20 lg:ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-12">
            <span className="font-serif text-2xl font-bold text-primary">결 관리자</span>
            <nav className="hidden xl:flex gap-8">
              <button onClick={() => setViewMode('map')} className={`font-serif text-lg tracking-wide ${viewMode === 'map' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary transition-colors'}`}>공방 배치</button>
              <button onClick={() => setViewMode('grid')} className={`font-serif text-lg tracking-wide ${viewMode === 'grid' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary transition-colors'}`}>리스트 뷰</button>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 w-4 h-4" />
              <input className="bg-surface-container border-none focus:ring-1 focus:ring-primary rounded-full pl-10 pr-4 py-2 text-sm w-64 font-body" placeholder="단골 또는 예약 검색..." type="text"/>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-on-surface-variant hover:text-primary transition-colors relative">
                <Notifications className="w-6 h-6" />
                {pendingRequests.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
                )}
              </button>
              <button 
                onClick={() => setIsLayoutMode(!isLayoutMode)}
                className={`px-6 py-2 rounded-full font-serif text-sm transition-all shadow-lg ${isLayoutMode ? 'bg-primary text-white hover:bg-accent-burgundy' : 'bg-surface-container-highest text-primary hover:bg-primary hover:text-white'}`}
              >
                {isLayoutMode ? '배치 저장' : '레이아웃 수정'}
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 space-y-8 flex-1 flex flex-col overflow-y-auto no-scrollbar">
          {/* Statistics Banner */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-shrink-0">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">일일 매출액</p>
                <h3 className="font-serif text-4xl text-primary font-bold">₩{visits.length * 150000 > 1000000 ? (visits.length * 0.15).toFixed(1) + 'M' : '4.2M'}</h3>
                <p className="text-xs text-primary/80 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> +12% 어제 대비
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Store className="w-32 h-32 text-primary" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">현재 공방 가동률</p>
                <h3 className="font-serif text-4xl text-primary font-bold">{Math.round((myTables.filter(t => t.currentCustomerId).length / (myTables.length || 1)) * 100)}%</h3>
                <p className="text-xs text-on-surface-variant mt-2">{myTables.filter(t => t.currentCustomerId).length} / {myTables.length} 공방 사용중</p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5">
                <ChairAlt className="w-32 h-32 text-primary" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">피크 예상 시간</p>
                <h3 className="font-serif text-4xl text-primary font-bold">19:30</h3>
                <p className="text-xs text-on-surface-variant mt-2">일반적인 회전율 기준</p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5">
                <Schedule className="w-32 h-32 text-primary" />
              </div>
            </div>
          </section>

          {/* Main Interactive Area */}
          <div className="flex flex-1 gap-8 min-h-0">
            {/* Table Area */}
            <div className="flex-[2] bg-white rounded-xl p-8 border border-outline-variant/20 shadow-sm relative flex flex-col min-h-[500px]">
              <div className="flex justify-between items-center mb-8 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="font-serif text-2xl text-primary italic">메인 홀 전도</h2>
                  <div className="flex bg-surface-container p-1 rounded-lg">
                    {currentStoreSections.map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => setActiveSectionId(s.id)}
                        className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${activeSectionId === s.id ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40 hover:text-primary'}`}
                      >
                        {s.name}
                      </button>
                    ))}
                    <button 
                      onClick={() => setActiveSectionId('all')}
                      className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${activeSectionId === 'all' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40 hover:text-primary'}`}
                    >전체</button>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">준비됨</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-surface-container-highest"></span>
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">공석</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">정리중</span>
                  </div>
                </div>
              </div>

              {/* Workspace Container */}
              <div className="flex-1 relative border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-low">
                {viewMode === 'map' ? (
                  <div 
                    ref={mapContainerRef}
                    className="w-full h-full overflow-auto no-scrollbar relative p-10"
                    onPointerMove={handlePointerMove}
                  >
                    {/* Zoom & Controls */}
                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                       <div className="flex bg-white/80 backdrop-blur shadow-sm rounded-xl border border-outline-variant/30 overflow-hidden">
                          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-2 hover:bg-primary/5 text-primary"><Minus className="w-4 h-4" /></button>
                          <div className="px-2 flex items-center text-[9px] font-black">{Math.round(zoom * 100)}%</div>
                          <button onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="p-2 hover:bg-primary/5 text-primary"><Plus className="w-4 h-4" /></button>
                       </div>
                    </div>

                    <div 
                      className="relative origin-top-left transition-transform duration-300"
                      style={{ 
                        minWidth: '1000px', 
                        minHeight: '800px',
                        transform: `scale(${zoom})`
                      }}
                    >
                      {filteredTables.map(table => {
                        const isOccupied = table.currentCustomerId !== null;
                        const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                        const isSelected = selectedTable === table.number;
                        const status = isOccupied ? 'occupied' : (table.status || 'available');

                        return (
                          <div
                            key={table.number}
                            onPointerDown={(e) => handlePointerDown(e, table)}
                            onPointerUp={handlePointerUp}
                            onClick={() => !isMoveOnlyMode && setSelectedTable(table.number)}
                            className={`absolute flex flex-col p-4 transition-all duration-300 cursor-pointer shadow-sm group
                              ${isSelected ? 'ring-4 ring-primary/20 z-30' : 'z-10'}
                              ${isOccupied ? 'bg-primary text-white shadow-xl' : (table.status === 'dirty' ? 'bg-tertiary text-white' : 'bg-white text-primary border border-outline-variant/50 hover:bg-surface-container')}
                              ${table.shape === 'circle' ? 'rounded-full' : (table.isRoom ? 'rounded-[2.5rem]' : 'rounded-2xl')}
                            `}
                            style={{
                              left: `${table.x}px`,
                              top: `${table.y}px`,
                              width: `${table.width || 80}px`,
                              height: `${table.height || 80}px`,
                              touchAction: 'none'
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-serif text-xl italic">{table.number}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${isOccupied ? 'bg-white/20' : 'bg-primary/5'}`}>{table.seats || 4}P</span>
                            </div>
                            
                            {isOccupied && customer && (
                              <div className="mt-auto">
                                <p className="text-[10px] uppercase tracking-tighter opacity-70 truncate">{customer.name}</p>
                                <div className="mt-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                                  <div className="h-full bg-white w-2/3"></div>
                                </div>
                              </div>
                            )}

                            {isLayoutMode && (
                              <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 rounded-inherit transition-opacity">
                                <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/30"><Trash2 className="w-3 h-3 text-white" /></button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setIsMoveOnlyMode(!isMoveOnlyMode); }} className={`p-1.5 rounded-lg ${isMoveOnlyMode ? 'bg-white text-primary' : 'bg-white/10 text-white'}`}><Move className="w-3 h-3" /></button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Live Ghost Drag */}
                      {draggedTable !== null && dragPosition && (
                        <div 
                          className="absolute pointer-events-none opacity-50 bg-primary/50 border-2 border-dashed border-white text-white flex items-center justify-center rounded-2xl z-[100]"
                          style={{
                            left: `${dragPosition.x}px`,
                            top: `${dragPosition.y}px`,
                            width: `${(myTables.find(t => t.number === draggedTable)?.width || 80)}px`,
                            height: `${(myTables.find(t => t.number === draggedTable)?.height || 80)}px`,
                          }}
                        >
                          <Move className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full overflow-y-auto p-10 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 no-scrollbar">
                    {filteredTables.map(table => {
                      const isOccupied = table.currentCustomerId !== null;
                      const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                      return (
                        <div 
                          key={table.number}
                          onClick={() => setSelectedTable(table.number)}
                          className={`aspect-square p-6 flex flex-col justify-between transition-all cursor-pointer shadow-sm relative overflow-hidden group
                            ${isOccupied ? 'bg-primary text-white' : (table.status === 'dirty' ? 'bg-tertiary text-white' : 'bg-white text-primary border border-outline-variant/50 hover:bg-surface-container')}
                            rounded-2xl
                          `}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-serif text-2xl italic">{table.number}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOccupied ? 'bg-white/20 text-white' : 'bg-primary/5 text-primary'}`}>{table.seats || 4}P</span>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-tighter opacity-70">
                              {isOccupied ? '현재 이용 중' : (table.status === 'dirty' ? '정리 필요' : '공석')}
                            </p>
                            <p className="text-sm font-semibold truncate">{isOccupied && customer ? customer.name : (table.status === 'dirty' ? '청소 정비' : '대기')}</p>
                            {isOccupied && (
                              <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white w-2/3"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Layout Editor Tools Overlay */}
              {isLayoutMode && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-primary p-4 rounded-2xl shadow-3xl z-50 animate-in fade-in slide-in-from-bottom-4">
                  <button onClick={() => addTable(currentUser.id, 'table', activeSectionId !== 'all' ? activeSectionId : undefined)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                    <Plus className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-widest">일반 탁자 추가</span>
                  </button>
                  <button onClick={() => addSection(currentUser.id, '새로운 구역')} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                    <Layers className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-widest">구역 확장</span>
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-2"></div>
                  <button 
                    onClick={() => {
                       if (window.confirm('전체 배치를 초기화하시겠습니까?')) initTables(currentUser.id);
                    }}
                    className="p-2 bg-white/5 hover:bg-burgundy text-white rounded-xl transition-all"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Side Panel: Guest Insights (Live CRM Feed) */}
            <aside className="flex-1 bg-white rounded-xl p-8 flex flex-col border border-outline-variant/20 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-8 flex-shrink-0">
                <h3 className="font-serif text-xl text-primary italic">손님 통찰 (LIVE)</h3>
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
                {selectedTable && activeTable ? (
                  <div className="animate-in fade-in duration-500 space-y-8">
                    {activeCustomer ? (
                      (() => {
                        const stats = getCustomerStats(activeCustomer.id);
                        return (
                          <>
                            <div className="bg-surface-container p-6 rounded-2xl border-l-4 border-primary shadow-sm space-y-4">
                              <div className="flex justify-between items-start">
                                <p className="font-bold text-lg text-primary">{activeCustomer.name}</p>
                                <span className={`text-[10px] px-3 py-1 bg-primary text-white rounded-full font-bold uppercase tracking-widest`}>
                                  {getTierCustomName(stats.tier, currentUser.tierNames)}
                                </span>
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                                  <Restaurant className="w-4 h-4 opacity-40 text-primary" />
                                  <span>단골 메모: {activeCustomer.memo ? formatMemoDisplay(activeCustomer.memo) : '기록된 메모 없음'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                                  <HourglassBottom className="w-4 h-4 opacity-40 text-primary" />
                                  <span>방문 시간: {activeTable.sessionStartTime ? Math.floor((currentTime.getTime() - new Date(activeTable.sessionStartTime).getTime()) / 60000) : 0}분 경과</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                                  <Heart className="w-4 h-4 opacity-40 text-burgundy" />
                                  <span>총 방문 횟수: {stats.totalVisits}회</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <button 
                                onClick={() => {
                                  updateTableStatus(currentUser.id, selectedTable, 'dirty');
                                  leaveTable(selectedTable, currentUser.id);
                                  setSelectedTable(null);
                                }}
                                className="col-span-2 py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-accent-burgundy transition-all shadow-lg"
                              >이용 종료 및 정비 요청</button>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-8">
                         <div className="p-8 bg-surface-container rounded-[2.5rem] border-2 border-outline-variant/30">
                            <QRCodeSVG value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} size={160} level="H" />
                         </div>
                         <p className="text-xs text-on-surface-variant/60 leading-relaxed font-serif italic">
                            공방 {selectedTable}번용 QR 코드입니다.<br/>
                            손님이 스캔 시 자동으로 정보가 등록됩니다.
                         </p>
                         <div className="grid grid-cols-2 gap-4 w-full">
                           <button onClick={() => updateTableStatus(currentUser.id, selectedTable, 'available')} className="p-4 rounded-xl border border-outline-variant/50 text-[10px] font-bold text-primary flex flex-col items-center gap-2 hover:bg-surface-container transition-all">
                              <CheckCircle2 className="w-6 h-6 opacity-30" /> 사용 가용
                           </button>
                           <button onClick={() => updateTableStatus(currentUser.id, selectedTable, 'dirty')} className="p-4 rounded-xl border border-outline-variant/50 text-[10px] font-bold text-burgundy flex flex-col items-center gap-2 hover:bg-surface-container transition-all">
                              <AlertCircle className="w-6 h-6 opacity-30" /> 정비 필요
                           </button>
                         </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                    <ChairAlt className="w-16 h-16 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">전도에서 공방을 선택해 주세요</p>
                  </div>
                )}
              </div>

              {/* Bottom Quick Status */}
              <div className="mt-auto pt-8 flex-shrink-0">
                <div className="bg-primary p-6 rounded-xl text-white text-center shadow-lg relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="font-serif italic text-lg mb-1">매장 현황 요약</p>
                    <p className="text-[10px] font-sans uppercase tracking-[0.2em] opacity-80 mb-4">{pendingRequests.length}개의 미승인 쿠폰 요청</p>
                    <Link to="/owner/customers" className="block w-full py-2.5 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-xs font-bold uppercase tracking-widest border border-white/20">
                        단골 장부 확인
                    </Link>
                  </div>
                  <div className="absolute top-0 left-0 w-full h-full bg-accent-burgundy/20 group-hover:bg-accent-burgundy/40 transition-colors pointer-events-none"></div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Floating Action Button for Store-wide actions */}
      <button 
        onClick={() => setIsEditingSections(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 hover:bg-accent-burgundy transition-all z-50 ring-4 ring-primary/5"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Section Editor Modal */}
      {isEditingSections && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-10 shadow-3xl border border-outline-variant/30 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-10">
              <h2 className="font-serif text-2xl text-primary italic">매장 구역 거버넌스</h2>
              <button onClick={() => setIsEditingSections(false)} className="p-2 hover:bg-surface-container rounded-full transition-colors"><X className="w-6 h-6 text-on-surface-variant/40" /></button>
            </div>
            
            <div className="space-y-4 max-h-80 overflow-y-auto no-scrollbar">
              {currentStoreSections.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 group">
                  {editingSectionId === s.id ? (
                    <input 
                      autoFocus
                      className="flex-1 bg-white px-2 py-1 border border-primary rounded text-sm font-bold"
                      value={s.name}
                      onBlur={() => setEditingSectionId(null)}
                      onChange={e => updateSection(s.id, e.target.value)}
                    />
                  ) : (
                    <p className="font-serif font-bold text-primary">{s.name}</p>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingSectionId(s.id)} className="p-1.5 hover:bg-white rounded text-on-surface-variant/40 hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteSection(currentUser.id, s.id)} className="p-1.5 hover:bg-white rounded text-on-surface-variant/40 hover:text-burgundy"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-outline-variant/30 flex gap-2">
               <input 
                 className="flex-1 bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-primary font-body"
                 placeholder="새로운 구역 이름..."
                 value={newSectionName}
                 onChange={e => setNewSectionName(e.target.value)}
               />
               <button 
                 onClick={() => {
                   if (newSectionName.trim()) { addSection(currentUser.id, newSectionName); setNewSectionName(''); }
                 }}
                 className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold font-sans uppercase tracking-widest hover:bg-accent-burgundy transition-all"
               >추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
