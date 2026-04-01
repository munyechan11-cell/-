import { useState, useEffect, useRef } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Plus, 
  Minus, Trash2, Layers, Clock, Maximize2,
  TrendingUp, Calendar, History, Store,
  Utensils, Hourglass, GripVertical
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
    
    const occupiedTables = myTables.filter(t => t.currentCustomerId);
    const occupancyRate = myTables.length > 0 ? Math.round((occupiedTables.length / myTables.length) * 100) : 0;
    
    const counts: Record<number, number> = {};
    visits.filter(v => v.storeId === currentUser.id).forEach(v => {
      const hour = new Date(v.date).getHours();
      counts[hour] = (counts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';
    
    const currentDurations = occupiedTables.map(t => (currentTime.getTime() - new Date(t.sessionStartTime!).getTime()) / 60000);
    const avgUsage = currentDurations.length > 0 ? Math.round(currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length) : 45;

    return { newCustomers, occupancyRate, peakTime: `${peakHour}:00`, avgUsage };
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
          <Link to="/owner" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4">
            <LayoutGrid className="w-5 h-5" /><span className="text-xs hidden lg:block">대시보드</span>
          </Link>
          <Link to="/owner/customers" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5">
            <Users className="w-5 h-5" /><span className="text-xs hidden lg:block">단골 관리</span>
          </Link>
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
             <button onClick={() => setIsLayoutMode(!isLayoutMode)} className={`px-8 py-3 rounded-full font-serif text-sm shadow-xl ${isLayoutMode ? 'bg-primary text-white' : 'bg-surface-container-highest text-primary hover:shadow-2xl transition-all active:scale-[0.98]'}`}>
                {isLayoutMode ? '배치 저장 (완료)' : '테이블 배치변경 (이동)'}
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-8 space-y-8">
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: '신규 단골 (7일)', value: `${stats.newCustomers}명`, icon: TrendingUp },
              { label: '평균 이용 시간', value: `${stats.avgUsage}분`, icon: Hourglass },
              { label: '현재 가동률', value: `${stats.occupancyRate}%`, icon: BarChart3 },
              { label: '피크 타임', value: stats.peakTime, icon: Clock }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-[2rem] border border-outline-variant/30 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1">{s.label}</p>
                  <p className="text-3xl font-serif font-black text-primary italic">{s.value}</p>
                </div>
                <div className="p-4 bg-primary/5 rounded-2xl text-primary"><s.icon className="w-6 h-6" /></div>
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
                            onClick={() => setSelectedTable(table.number)}
                            className={`absolute flex flex-col items-center justify-center group cursor-pointer ${isOccupied ? 'shadow-lg shadow-primary/20' : 'hover:shadow-xl'} ${isBeingDragged ? 'scale-[1.05] shadow-3xl z-[100] cursor-grabbing !transition-none' : 'duration-300 transition-all'}`}
                            style={{
                              left: isBeingDragged ? dragPosition?.x : table.x,
                              top: isBeingDragged ? dragPosition?.y : table.y,
                              width: table.width || 80,
                              height: table.height || 80,
                              backgroundColor: isOccupied ? '#261c1a' : (table.status === 'dirty' ? '#fdf2f2' : (isBeingDragged ? '#ffffff' : '#ffffff')),
                              border: isOccupied ? 'none' : `3px solid ${selectedTable === table.number ? '#261c1a' : (isBeingDragged ? '#4285F4' : '#e5dcd3')}`,
                              borderRadius: table.shape === 'circle' ? '50%' : '1.5rem',
                              zIndex: isBeingDragged ? 100 : (selectedTable === table.number ? 40 : 10),
                              touchAction: 'none'
                            }}
                          >
                            {isLayoutMode && !isOccupied && (
                               <>
                                  <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 transition-opacity">
                                     <GripVertical className="w-4 h-4 text-primary" />
                                  </div>
                                  {!isBeingDragged && (
                                     <>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} 
                                          className="absolute top-2 left-2 p-1.5 bg-burgundy/10 text-burgundy rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-burgundy hover:text-white"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setSelectedTable(table.number); }} 
                                          className={`absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${selectedTable === table.number ? 'bg-primary text-white opacity-100' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}
                                        >
                                          <Settings className="w-3 h-3" />
                                        </button>
                                     </>
                                  )}
                               </>
                            )}
                            <span className={`text-xl font-serif font-black italic ${isOccupied ? 'text-white' : 'text-primary'}`}>{table.number}</span>
                            {isOccupied && <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full"></div>}
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
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-primary p-4 rounded-2xl shadow-3xl z-50">
                   <button onClick={() => addTable(currentUser.id, 'table')} className="flex items-center gap-2 px-6 py-2 bg-white text-primary rounded-xl font-black text-[10px] uppercase"><Plus className="w-4 h-4" /> 테이블 추가</button>
                   <button onClick={() => initTables(currentUser.id)} className="p-2 bg-white/10 text-white rounded-xl"><History className="w-5 h-5" /></button>
                </div>
             )}
          </div>
        </div>

        {selectedTable && (
           <aside className="fixed inset-y-0 right-0 w-96 bg-white shadow-[-30px_0_60px_rgba(0,0,0,0.1)] z-[60] p-10 flex flex-col border-l border-outline-variant/20 animate-in slide-in-from-right duration-500">
              <div className="flex justify-between items-start mb-10">
                 <div>
                    <h2 className="text-3xl font-serif font-black text-primary italic mb-1">{selectedTable}번 테이블</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">상태: {activeTable?.currentCustomerId ? '이용 중' : '사용 가능'}</p>
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
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/40">테이블 커스터마이징</h4>
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
    </div>
  );
}
