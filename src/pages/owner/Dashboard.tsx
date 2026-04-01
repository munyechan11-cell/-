import { useState, useEffect, useRef } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Check, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Square, Plus, 
  Minus, Trash2, Circle, GripVertical, Layers, Palette, 
  MoreVertical, Edit2, CheckCircle2, AlertCircle, Clock, Maximize2,
  TrendingUp, Calendar, Heart, ShieldCheck, History, HelpCircle, Store,
  Search, Armchair, Utensils, Hourglass, Wine, PartyPopper, VolumeX
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerDashboard() {
  const { 
    currentUser, tables, users, visits, coupons, sections, logout, leaveTable, 
    initTables, tierOverrides, approveCouponUse, rejectCouponUse, 
    updateTableLayout, addTable, deleteTable, addSection, updateSection, 
    deleteSection, updateTableStatus, recordVisit 
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
  const [showNotifications, setShowNotifications] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  
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
    const zoomFactor = zoom;
    
    // Global shift mode logic (Batch Move)
    if (isMoveOnlyMode && draggedTable === -1) {
       const dx = (e.clientX - rect.left + scrollX) / zoomFactor - dragOffset.x;
       const dy = (e.clientY - rect.top + scrollY) / zoomFactor - dragOffset.y;
       
       myTables.forEach(t => {
          updateTableLayout(currentUser.id, t.number, { x: t.x + dx, y: t.y + dy });
       });
       setDragOffset({ x: (e.clientX - rect.left + scrollX) / zoomFactor, y: (e.clientY - rect.top + scrollY) / zoomFactor });
       return;
    }

    const rawX = (e.clientX - rect.left + scrollX) / zoomFactor - dragOffset.x;
    const rawY = (e.clientY - rect.top + scrollY) / zoomFactor - dragOffset.y;
    
    // Grid snapping
    let x = Math.round(rawX / 10) * 10;
    let y = Math.round(rawY / 10) * 10;
    
    // Simple anti-overlap (Check against other tables)
    const currentTable = myTables.find(t => t.number === draggedTable);
    if (currentTable) {
      const isOverlapping = myTables.some(other => {
        if (other.number === draggedTable) return false;
        const otherWidth = other.width || 80;
        const otherHeight = other.height || 80;
        return (
          x < other.x + otherWidth &&
          x + (currentTable.width || 80) > other.x &&
          y < other.y + otherHeight &&
          y + (currentTable.height || 80) > other.y
        );
      });
      if (!isOverlapping) {
        setDragPosition({ x, y });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedTable !== null && dragPosition && draggedTable !== -1) {
      updateTableLayout(currentUser.id, draggedTable, { x: dragPosition.x, y: dragPosition.y });
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

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20">
      
      {/* SideNavBar */}
      <aside className="h-screen w-20 lg:w-64 fixed left-0 border-r-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl tracking-tighter block">결</Link>
          <div className="mt-8 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden hidden lg:block">
                <Store className="w-full h-full p-2 text-white/40" />
             </div>
             <div className="hidden lg:block overflow-hidden">
                <p className="text-[#fcfcfc] font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 매장'}</p>
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
              <button onClick={() => setViewMode('map')} className={`font-serif text-lg tracking-wide ${viewMode === 'map' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary transition-colors'}`}>매장 배치도</button>
              <button onClick={() => setViewMode('grid')} className={`font-serif text-lg tracking-wide ${viewMode === 'grid' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary transition-colors'}`}>리스트 뷰</button>
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block text-on-surface-variant text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-surface-container rounded-full">
              오늘의 실시간 요약
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-on-surface-variant hover:text-primary transition-colors relative"
                >
                  <Bell className="w-6 h-6" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-ping"></span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-4 w-80 bg-white rounded-3xl shadow-3xl border border-outline-variant/30 p-6 z-[100] animate-in zoom-in-95 duration-200">
                    <h4 className="font-serif font-black italic text-primary mb-4">알림 센터</h4>
                    <div className="space-y-4 max-h-60 overflow-y-auto no-scrollbar">
                      {pendingRequests.map(req => (
                        <div key={req.id} className="p-4 bg-surface-container rounded-2xl flex flex-col gap-3">
                          <p className="text-xs font-bold text-primary">{req.type} 요청</p>
                          <p className="text-[10px] text-on-surface-variant/60">{req.description}</p>
                          <div className="flex gap-2">
                            <button onClick={() => approveCouponUse(req.id)} className="flex-1 py-2 bg-primary text-white text-[9px] font-bold rounded-lg">승인</button>
                            <button onClick={() => rejectCouponUse(req.id)} className="flex-1 py-2 bg-surface-bright text-primary text-[9px] font-bold rounded-lg border">거절</button>
                          </div>
                        </div>
                      ))}
                      {pendingRequests.length === 0 && <p className="text-[10px] text-on-surface-variant/40 text-center py-6">새로운 알림이 없습니다.</p>}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsMoveOnlyMode(!isMoveOnlyMode)}
                  className={`p-2 rounded-xl transition-all ${isMoveOnlyMode ? 'bg-primary text-white shadow-lg' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}
                  title="전체 레이아웃 이동"
                >
                  <Move className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsLayoutMode(!isLayoutMode)}
                  className={`px-6 py-2 rounded-full font-serif text-sm transition-all shadow-lg ${isLayoutMode ? 'bg-primary text-white hover:bg-accent-burgundy' : 'bg-surface-container-highest text-primary hover:bg-primary hover:text-white'}`}
                >
                  {isLayoutMode ? '배치 저장' : '테이블 배치변경'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 space-y-8 flex-1 flex flex-col overflow-y-auto no-scrollbar">
          {/* Statistics Banner */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-shrink-0">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">신규 단골 (7일)</p>
                <h3 className="font-serif text-4xl text-primary font-bold">
                  {new Set(visits.filter(v => v.storeId === currentUser.id && new Date(v.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).map(v => v.customerId)).size}명
                </h3>
                <p className="text-xs text-primary/80 mt-2 flex items-center gap-1 font-bold">
                  <TrendingUp className="w-3 h-3" /> 최근 유입 증가세
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5 group-hover:opacity-10 transition-opacity">
                 <Users className="w-32 h-32 text-primary" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">평균 이용 시간</p>
                <h3 className="font-serif text-4xl text-primary font-bold">
                  {(() => {
                    const storeVisits = visits.filter(v => v.storeId === currentUser.id);
                    const occupiedTables = myTables.filter(t => t.currentCustomerId && t.sessionStartTime);
                    
                    // Current sessions duration
                    const currentDurations = occupiedTables.map(t => 
                      (currentTime.getTime() - new Date(t.sessionStartTime!).getTime()) / 60000
                    );
                    
                    // If no data, return default estimate
                    if (currentDurations.length === 0 && storeVisits.length === 0) return '0분';
                    
                    // Simple avg of current active sessions (or fallback to 50 min)
                    const avg = currentDurations.length > 0 
                      ? currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length 
                      : 50;
                    
                    return `${Math.round(avg)}분`;
                  })()}
                </h3>
                <p className="text-xs text-on-surface-variant mt-2 font-bold">실시간 세션 집계</p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5">
                <Hourglass className="w-32 h-32 text-primary" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">현재 매장 가동률</p>
                <h3 className="font-serif text-4xl text-primary font-bold">{Math.round((myTables.filter(t => t.currentCustomerId).length / (myTables.length || 1)) * 100)}%</h3>
                <p className="text-xs text-on-surface-variant mt-2 font-bold">{myTables.filter(t => t.currentCustomerId).length} / {myTables.length} 사용 중</p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5">
                <Armchair className="w-32 h-32 text-primary" />
              </div>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-outline-variant/20 relative overflow-hidden group">
              <div className="relative z-10">
                <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant mb-2">오늘의 피크 타임</p>
                <h3 className="font-serif text-4xl text-primary font-bold">
                  {(() => {
                    const today = new Date().toDateString();
                    const todayVisits = visits.filter(v => v.storeId === currentUser.id && new Date(v.date).toDateString() === today);
                    if (todayVisits.length === 0) {
                      const allVisits = visits.filter(v => v.storeId === currentUser.id);
                      if (allVisits.length === 0) return '없음';
                      const hours = allVisits.map(v => new Date(v.date).getHours());
                      const counts = hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {} as Record<number, number>);
                      const peakHour = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                      return `${peakHour}:00`;
                    }
                    const hours = todayVisits.map(v => new Date(v.date).getHours());
                    const counts = hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {} as Record<number, number>);
                    const peakHour = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                    return `${peakHour}:00`;
                  })()}
                </h3>
                <p className="text-xs text-on-surface-variant mt-2 font-bold">실시간 방문량 기준</p>
              </div>
              <div className="absolute bottom-0 right-0 w-32 h-16 opacity-5">
                <Clock className="w-32 h-32 text-primary" />
              </div>
            </div>
          </section>

          {/* Main Interactive Area */}
          <div className="flex flex-1 gap-8 min-h-0">
            <div className="flex-1 bg-white rounded-xl p-8 border border-outline-variant/20 shadow-sm relative flex flex-col min-h-[500px]">
              <div className="flex justify-between items-center mb-8 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="font-serif text-2xl text-primary italic">메인 홀 배치도</h2>
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
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">준비됨</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-surface-container-highest"></span>
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">공석</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                    <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">정리중</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 relative border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-low">
                {viewMode === 'map' ? (
                  <div 
                    ref={mapContainerRef}
                    className="w-full h-full overflow-auto no-scrollbar relative p-10"
                    onPointerMove={handlePointerMove}
                  >
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
                      {isMoveOnlyMode && (
                        <div 
                          onPointerDown={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDraggedTable(-1);
                            setDragOffset({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
                            e.currentTarget.setPointerCapture(e.pointerId);
                          }}
                          className="absolute top-0 left-0 w-full h-full cursor-move z-[100] flex items-center justify-center bg-primary/5 border-4 border-dashed border-primary/20 rounded-3xl group animate-pulse"
                        >
                          <div className="bg-white p-8 rounded-full shadow-2xl flex flex-col items-center gap-4">
                            <Move className="w-12 h-12 text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">이곳을 드래그하여 전체 이동</p>
                          </div>
                        </div>
                      )}
                      {filteredTables.map(table => {
                        const isOccupied = table.currentCustomerId !== null;
                        const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                        const isSelected = selectedTable === table.number;

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
                                <p className="text-[10px] uppercase tracking-tighter opacity-70 truncate font-bold">{customer.name}</p>
                                <p className="text-[8px] opacity-60">이용 중</p>
                              </div>
                            )}

                            {isLayoutMode && !isOccupied && !isMoveOnlyMode && (
                              <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 rounded-inherit transition-opacity">
                                <button onClick={e => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/30"><Trash2 className="w-3 h-3 text-white" /></button>
                                <button onClick={e => { e.stopPropagation(); setSelectedTable(table.number); }} className="p-1.5 bg-white/10 text-white rounded-lg hover:bg-white/30"><Settings className="w-3 h-3" /></button>
                              </div>
                            )}
                            
                            {isMoveOnlyMode && (
                              <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-inherit"></div>
                            )}
                          </div>
                        );
                      })}

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
                            <p className="text-[10px] uppercase tracking-tighter opacity-70 font-bold">
                              {isOccupied ? '현재 이용 중' : (table.status === 'dirty' ? '정리 필요' : '공석')}
                            </p>
                            <p className="text-sm font-black truncate">{isOccupied && customer ? customer.name : '시스템 관리기'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isLayoutMode && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-primary p-4 rounded-2xl shadow-3xl z-50 animate-in fade-in slide-in-from-bottom-4">
                  <button onClick={() => addTable(currentUser.id, 'table', activeSectionId !== 'all' ? activeSectionId : undefined)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                    <Plus className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-widest">일반 탁자 추가</span>
                  </button>
                  <button onClick={() => addSection(currentUser.id, '새로운 구역')} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                    <Layers className="w-4 h-4" /> <span className="text-[10px] font-bold uppercase tracking-widest">구역 확장</span>
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-2"></div>
                  <button onClick={() => { if (window.confirm('전체 배치를 초기화하시겠습니까?')) initTables(currentUser.id); }} className="p-2 bg-white/5 hover:bg-burgundy text-white rounded-xl transition-all">
                    <History className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Selection Interaction Panel */}
            {selectedTable && (
               <aside className="w-96 bg-white rounded-xl p-8 border border-outline-variant/20 shadow-sm flex flex-col animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-start mb-8">
                     <div>
                        <h3 className="font-serif text-2xl font-black italic text-primary">{selectedTable}번 매장</h3>
                        <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">상태: {activeTable?.currentCustomerId ? '사용 중' : (activeTable?.status === 'dirty' ? '정리 필요' : '공석')}</p>
                     </div>
                     <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-surface-container rounded-full transition-colors"><X className="w-5 h-5 text-on-surface-variant/30" /></button>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                     {activeCustomer ? (
                        (() => {
                           const stats = getCustomerStats(activeCustomer.id);
                           return (
                              <div className="space-y-6">
                                 <div className="bg-surface-container p-6 rounded-[2rem] border-l-4 border-primary space-y-4">
                                    <div className="flex justify-between items-center">
                                       <span className="font-serif text-xl font-black text-primary">{activeCustomer.name}</span>
                                       <span className={`text-[8px] font-bold px-3 py-1 bg-primary text-white rounded-full uppercase tracking-widest`}>
                                          {getTierCustomName(stats.tier, currentUser.tierNames)}
                                       </span>
                                    </div>
                                    <div className="space-y-2">
                                       <p className="text-[10px] font-bold text-on-surface-variant/60 flex items-center gap-2"><Utensils className="w-3 h-3" /> 방문 횟수: {stats.totalVisits}회</p>
                                       <p className="text-[10px] font-bold text-on-surface-variant/60 flex items-center gap-2"><Clock className="w-3 h-3" /> 이용 시간: {activeTable?.sessionStartTime ? Math.floor((currentTime.getTime() - new Date(activeTable.sessionStartTime).getTime()) / 60000) : 0}분 경과</p>
                                    </div>
                                 </div>
                                 <button 
                                    onClick={() => {
                                       updateTableStatus(currentUser.id, selectedTable, 'dirty');
                                       leaveTable(selectedTable, currentUser.id);
                                       setSelectedTable(null);
                                    }}
                                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all hover:bg-accent-burgundy"
                                 >이용 종료 및 정비 요청</button>
                              </div>
                           )
                        })()
                     ) : (
                        <div className="flex flex-col gap-6 py-4">
                           {isLayoutMode ? (
                              <div className="space-y-6 animate-in slide-in-from-top-4">
                                 <div className="bg-surface-container p-6 rounded-3xl border border-outline-variant/30">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-6">테이블 속성 변경</h4>
                                    <div className="space-y-4">
                                       <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-on-surface-variant/60">좌석 수</span>
                                          <div className="flex items-center gap-4">
                                             <button onClick={() => updateTableLayout(currentUser.id, selectedTable, { seats: Math.max(1, (activeTable?.seats || 4) - 1) })} className="p-2 bg-white rounded-lg shadow-sm"><Minus className="w-3 h-3" /></button>
                                             <span className="text-sm font-black">{activeTable?.seats || 4}</span>
                                             <button onClick={() => updateTableLayout(currentUser.id, selectedTable, { seats: (activeTable?.seats || 4) + 1 })} className="p-2 bg-white rounded-lg shadow-sm"><Plus className="w-3 h-3" /></button>
                                          </div>
                                       </div>
                                       <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-on-surface-variant/60">가로 크기</span>
                                          <div className="flex items-center gap-4">
                                             <button onClick={() => updateTableLayout(currentUser.id, selectedTable, { width: Math.max(40, (activeTable?.width || 80) - 10) })} className="p-2 bg-white rounded-lg shadow-sm"><Minus className="w-3 h-3" /></button>
                                             <span className="text-xs font-bold">{activeTable?.width || 80}</span>
                                             <button onClick={() => updateTableLayout(currentUser.id, selectedTable, { width: Math.min(200, (activeTable?.width || 80) + 10) })} className="p-2 bg-white rounded-lg shadow-sm"><Plus className="w-3 h-3" /></button>
                                          </div>
                                       </div>
                                       <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-on-surface-variant/60">세로 크기</span>
                                          <div className="flex items-center gap-4">
                                             <button onClick={() => updateTableLayout(currentUser.id, selectedTable, { height: Math.max(40, (activeTable?.height || 80) - 10) })} className="p-2 bg-white rounded-lg shadow-sm"><Minus className="w-3 h-3" /></button>
                                             <span className="text-xs font-bold">{activeTable?.height || 80}</span>
                                             <button onClick={() => updateTableLayout(currentUser.id, selectedTable, { height: Math.min(200, (activeTable?.height || 80) + 10) })} className="p-2 bg-white rounded-lg shadow-sm"><Plus className="w-3 h-3" /></button>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                                 <button onClick={() => setSelectedTable(null)} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">설정 완료</button>
                              </div>
                           ) : (
                              <>
                                 <div className="bg-white p-6 rounded-[2.5rem] border-2 border-outline-variant/30 shadow-inner flex flex-col items-center gap-6">
                                    <div ref={qrRef} className="qr-container">
                                       <QRCodeSVG value={`${window.location.origin}/customer/store/${currentUser.id}?table=${selectedTable}`} size={160} level="H" />
                                    </div>
                                    <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">실시간 접속 고유 QR</p>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-3">
                                    <button onClick={copyTableLink} className="p-5 bg-surface-container hover:bg-white border border-outline-variant/30 rounded-[2rem] flex flex-col items-center gap-3 transition-all group">
                                       <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                          <Maximize2 className="w-5 h-5" />
                                       </div>
                                       <span className="text-[9px] font-black uppercase tracking-widest text-primary">링크 복사</span>
                                    </button>
                                    <button onClick={downloadQR} className="p-5 bg-surface-container hover:bg-white border border-outline-variant/30 rounded-[2rem] flex flex-col items-center gap-3 transition-all group">
                                       <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                          <Plus className="w-5 h-5" />
                                       </div>
                                       <span className="text-[9px] font-black uppercase tracking-widest text-primary">QR 저장</span>
                                    </button>
                                 </div>
                                 
                                 <div className="w-full h-px bg-outline-variant/20 my-2"></div>
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => updateTableStatus(currentUser.id, selectedTable, 'available')} className="p-4 border rounded-2xl text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-colors">사용 가능</button>
                                    <button onClick={() => updateTableStatus(currentUser.id, selectedTable, 'dirty')} className="p-4 border rounded-2xl text-[9px] font-black uppercase tracking-widest text-burgundy hover:bg-burgundy/5 transition-colors">청소 중</button>
                                 </div>
                              </>
                           )}
                        </div>
                     )}
                  </div>

                  <div className="mt-8 pt-8 border-t border-outline-variant/20">
                     <Link to="/owner/customers" className="block w-full py-4 bg-on-surface-variant/5 hover:bg-on-surface-variant/10 transition-colors rounded-2xl text-center text-[10px] font-black uppercase tracking-widest text-primary">단골 관리 시스템</Link>
                  </div>
               </aside>
            )}
          </div>
        </div>
      </main>

      {/* Floating Section Adder */}
      <button 
        onClick={() => setIsEditingSections(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 hover:bg-accent-burgundy transition-all z-[60] ring-4 ring-white"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Section Editor Modal */}
      {isEditingSections && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-3xl border border-outline-variant/30 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-10">
              <h2 className="font-serif text-2xl text-primary italic font-black">매장 구역 관리</h2>
              <button onClick={() => setIsEditingSections(false)} className="p-2 hover:bg-surface-container rounded-full transition-colors"><X className="w-6 h-6 text-on-surface-variant/40" /></button>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar">
              {currentStoreSections.map(s => (
                <div key={s.id} className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/30 group">
                  {editingSectionId === s.id ? (
                    <input 
                      autoFocus
                      className="flex-1 bg-white px-2 py-1 border border-primary rounded text-sm font-bold"
                      value={s.name}
                      onBlur={() => setEditingSectionId(null)}
                      onChange={e => updateSection(s.id, e.target.value)}
                    />
                  ) : (
                    <p className="font-serif font-black text-primary italic">{s.name}</p>
                  )}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingSectionId(s.id)} className="p-2 hover:bg-white rounded-xl text-on-surface-variant/40 hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteSection(currentUser.id, s.id)} className="p-2 hover:bg-white rounded-xl text-on-surface-variant/40 hover:text-burgundy"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-outline-variant/30 flex gap-2">
               <input 
                 className="flex-1 bg-surface-container-low border-none rounded-2xl px-6 py-4 text-sm focus:ring-1 focus:ring-primary font-body"
                 placeholder="새 구역 테마..."
                 value={newSectionName}
                 onChange={e => setNewSectionName(e.target.value)}
               />
               <button 
                 onClick={() => {
                   if (newSectionName.trim()) { addSection(currentUser.id, newSectionName); setNewSectionName(''); }
                 }}
                 className="px-6 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent-burgundy transition-all"
               >추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
