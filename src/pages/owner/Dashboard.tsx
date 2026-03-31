import { useState, useEffect, useRef } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Check, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Square, Plus, 
  Minus, Trash2, Circle, GripVertical, Layers, Palette, 
  MoreVertical, Edit2, CheckCircle2, AlertCircle, Clock, Maximize2,
  TrendingUp, Calendar, Heart, ShieldCheck, History, HelpCircle, Store
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
  const [zoom, setZoom] = useState(1); // Zoom state for large maps
  const [isMoveOnlyMode, setIsMoveOnlyMode] = useState(false); // New: Move Only Mode
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null); // New: Live drag position
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // New: Initial click offset within table
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
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
    
    // Calculate new position based on pointer and initial offset
    const rawX = (e.clientX - rect.left + scrollX) / zoom - dragOffset.x;
    const rawY = (e.clientY - rect.top + scrollY) / zoom - dragOffset.y;
    
    // 10px Grid Snapping
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
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface hanji-texture relative">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
      
      {/* SideNavBar - Simplified for Owner */}
      <aside className="h-screen w-20 md:w-64 border-r border-primary/5 bg-primary shadow-2xl flex flex-col py-8 z-50 transition-all duration-500">
        <div className="px-6 md:px-8 mb-12">
          <h1 className="text-surface-bright font-serif italic text-2xl md:text-3xl tracking-tighter hidden md:block">결 (Gyeol)</h1>
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3 md:hidden mx-auto">
             <span className="text-white font-serif italic text-xl">결</span>
          </div>
          <div className="mt-8 hidden md:flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3">
              <Store className="text-white w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-serif italic text-sm truncate">{currentUser.restaurantName || 'My Atelier'}</p>
              <p className="font-black uppercase tracking-widest text-[9px] text-white/40">Owner Oversight</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <Link 
            to="/owner"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 bg-primary-container text-white border-l-4 border-white"
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">Floor Plan</span>
          </Link>
          
          <Link 
            to="/owner/customers"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">Guest Book</span>
          </Link>
          
          <Link 
            to="/owner/statistics"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">Insights</span>
          </Link>

          <Link 
            to="/owner/brand-settings"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">Heritage Settings</span>
          </Link>
        </nav>
        
        <div className="px-4 md:px-8 mt-auto pt-8 space-y-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center space-x-4 px-2 md:px-0 py-3.5 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-bold">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-bright/50 backdrop-blur-sm">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-6 md:px-10 py-5 border-b border-primary/5">
          <div className="flex items-center space-x-4 md:space-x-12">
            <div className="font-serif text-xl md:text-2xl font-black text-primary tracking-tighter">Floor Governance</div>
            <div className="h-6 w-px bg-primary/10 hidden md:block"></div>
            <div className="hidden lg:flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Live Flow</span>
              </div>
              <div className="text-primary/40 text-[10px] font-black uppercase tracking-widest">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6">
            <div className="flex bg-primary/5 p-1 rounded-xl">
               <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-primary/30'}`}><List className="w-4 h-4" /></button>
               <button onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-primary' : 'text-primary/30'}`}><MapIcon className="w-4 h-4" /></button>
            </div>
            
            <button 
              onClick={() => setIsLayoutMode(!isLayoutMode)}
              className={`flex items-center justify-center w-10 h-10 md:w-auto md:px-5 md:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLayoutMode ? 'bg-burgundy text-white border-burgundy shadow-xl shadow-burgundy/20' : 'bg-white text-primary/40 border-primary/10 hover:border-primary/30'}`}
            >
              {isLayoutMode ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              <span className="hidden md:block ml-2">{isLayoutMode ? 'FINISH' : 'EDIT MAP'}</span>
            </button>
            
            <div className="h-6 w-px bg-primary/10"></div>
            
            <button className="relative text-primary/40 hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-burgundy text-white text-[8px] font-black flex items-center justify-center rounded-full border border-white">{pendingRequests.length}</span>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Section Tabs & Detailed Controls */}
          <div className="px-6 md:px-10 py-4 flex justify-between items-center bg-white/40 backdrop-blur-sm border-b border-primary/5 z-20">
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar max-w-[70%]">
              <button 
                onClick={() => setActiveSectionId('all')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeSectionId === 'all' ? 'bg-primary text-white shadow-lg' : 'text-primary/40 hover:text-primary hover:bg-primary/5'}`}
              >
                Overview
              </button>
              {currentStoreSections.map(section => (
                <button 
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeSectionId === section.id ? 'bg-primary text-white shadow-lg' : 'text-primary/40 hover:text-primary hover:bg-primary/5'}`}
                >
                  {section.name}
                </button>
              ))}
              <button 
                onClick={() => setActiveSectionId('unassigned')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeSectionId === 'unassigned' ? 'bg-primary text-white shadow-lg' : 'text-primary/40 hover:text-primary hover:bg-primary/5'}`}
              >
                Unallocated
              </button>
              <button onClick={() => setIsEditingSections(true)} className="p-2 text-primary/20 hover:text-burgundy transition-colors"><Plus className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center space-x-4">
               {isLayoutMode && (
                 <div className="flex bg-primary/5 p-1 rounded-xl">
                    <button 
                      onClick={() => setIsMoveOnlyMode(!isMoveOnlyMode)} 
                      className={`p-1.5 rounded-lg transition-all ${isMoveOnlyMode ? 'bg-white shadow-sm text-primary' : 'text-primary/30'}`}
                      title="Toggle Drag Move"
                    >
                      <Move className="w-4 h-4" />
                    </button>
                 </div>
               )}
               <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-primary/30">
                  <span>Zoom: {Math.round(zoom * 100)}%</span>
               </div>
            </div>
          </div>

          {/* Main Map Workspace */}
          <div className="flex-1 relative overflow-hidden bg-surface-bright/30 p-6 md:p-10">
             <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
          {viewMode === 'map' ? (
            <div 
                ref={mapContainerRef}
                className="relative w-full h-full bg-white dark:bg-black/20 rounded-[3rem] border border-ink-light/10 shadow-inner overflow-auto no-scrollbar"
                onPointerMove={handlePointerMove}
              >
                {/* Zoom Controls */}
                <div className="sticky top-4 right-4 z-[60] flex flex-col gap-2 float-right mr-4">
                  {[1, 0.8, 0.6].map(z => (
                    <button 
                      key={z}
                      onClick={() => setZoom(z)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[10px] shadow-lg transition-all ${zoom === z ? 'bg-burgundy text-white scale-110' : 'bg-white text-ink-light/40 hover:bg-zinc-50'}`}
                    >
                      {z * 100}%
                    </button>
                  ))}
                </div>

                {/* Layout Helper Grid */}
                {isLayoutMode && <div className="absolute inset-0 bg-[radial-gradient(#888_1px,transparent_1px)] [background-size:30px_30px] opacity-10 pointer-events-none"></div>}
                
                <div 
                  className="relative origin-top-left transition-transform duration-300 ease-out"
                  style={{ 
                    minWidth: '1200px', 
                    minHeight: '900px',
                    transform: `scale(${zoom})`
                  }}
                >
                {filteredTables.map((table) => {
                  const isOccupied = table.currentCustomerId !== null;
                  const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                  const isCorridor = table.type === 'corridor';
                  const currentStatus = isOccupied ? 'occupied' : (table.status || 'available');
                  
                  return (
                    <div
                      key={table.number}
                      onPointerDown={(e) => handlePointerDown(e, table)}
                      onPointerUp={handlePointerUp}
                      onClick={() => (!isCorridor && !isMoveOnlyMode) && setSelectedTable(table.number)}
                      className={`absolute flex flex-col items-center justify-center p-3 transition-all duration-500 group ${table.shape === 'circle' ? 'rounded-full' : (table.isRoom ? 'rounded-[2rem]' : (isCorridor ? 'rounded-lg border-dashed opacity-30 shadow-none' : 'rounded-2xl'))} ${isOccupied ? 'bg-primary text-white shadow-xl shadow-primary/20 border-primary' : (table.status === 'dirty' ? 'bg-burgundy/10 border-burgundy/20 text-burgundy' : 'bg-white border-primary/5 text-primary shadow-sm hover:shadow-md hover:border-primary/20')} ${(selectedTable === table.number && !isMoveOnlyMode) ? 'ring-4 ring-primary/10 border-primary scale-105 z-40' : ''} ${draggedTable === table.number ? 'opacity-0 scale-95' : 'border-2'} ${isLayoutMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                      style={{ 
                        left: `${table.x}px`, 
                        top: `${table.y}px`, 
                        width: `${table.width || 80}px`, 
                        height: `${table.height || 80}px`,
                        zIndex: (selectedTable === table.number) ? 40 : (table.isRoom ? 1 : 10),
                        touchAction: 'none'
                      }}
                    >
                      {!isCorridor && (
                        <div className={`flex flex-col items-center select-none transition-opacity duration-300 ${isMoveOnlyMode ? 'opacity-20' : ''}`}>
                          <span className="text-xl font-serif font-black tracking-tighter leading-none">{table.number}</span>
                          <div className="flex items-center space-x-1 mt-1.5 opacity-40">
                            <Users className="w-2.5 h-2.5" />
                            <span className="font-black text-[9px] uppercase tracking-widest">{table.seats || 4}</span>
                          </div>
                          
                          {isOccupied && (
                            <div className="mt-2 flex flex-col items-center">
                               <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                               {table.sessionStartTime && (
                                 <div className="mt-1.5 font-black text-[8px] bg-white/10 px-2 py-0.5 rounded-full flex items-center space-x-1">
                                   <Clock className="w-2 h-2" />
                                   <span>{(() => {
                                     const diff = Math.floor((currentTime.getTime() - new Date(table.sessionStartTime).getTime()) / 60000);
                                     return diff > 60 ? `${Math.floor(diff/60)}h` : `${diff}m`;
                                   })()}</span>
                                 </div>
                               )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status Tags */}
                      {isOccupied && customer && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1 rounded-full text-[9px] font-black shadow-xl border border-white/20 whitespace-nowrap z-50 animate-in fade-in slide-in-from-bottom-1">
                          {customer.name}
                        </div>
                      )}
                      {!isOccupied && table.status === 'dirty' && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-burgundy text-white px-3 py-1 rounded-full text-[9px] font-black shadow-xl border border-white/20 whitespace-nowrap z-50 flex items-center space-x-1.5 animate-in fade-in slide-in-from-bottom-1">
                          <AlertCircle className="w-3 h-3" /> 
                          <span className="uppercase tracking-widest">Needs Care</span>
                        </div>
                      )}

                      {/* Control Overlays */}
                      {isLayoutMode && !draggedTable && (
                        <div className="absolute inset-0 bg-primary/95 rounded-inherit flex flex-col items-center justify-center p-2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm pointer-events-auto">
                           <div className="flex space-x-1 mb-1">
                              <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { width: (table.width || 80) + 10, height: (table.height || 80) + 10 }); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"><Maximize2 className="w-3 h-3" /></button>
                              <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { width: Math.max(40, (table.width || 80) - 10), height: Math.max(40, (table.height || 80) - 10) }); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"><Minus className="w-3 h-3" /></button>
                           </div>
                           <div className="flex space-x-1">
                              <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); updateTableLayout(currentUser.id, table.number, { shape: table.shape === 'circle' ? 'square' : 'circle' }); }} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">{table.shape === 'circle' ? <Square className="w-3 h-3" /> : <Circle className="w-3 h-3" />}</button>
                              <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} className="p-1.5 bg-burgundy/40 hover:bg-burgundy rounded-lg text-white transition-colors"><Trash2 className="w-3 h-3" /></button>
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Live Drag Shadow/Ghost */}
                {(() => {
                  const draggedT = draggedTable !== null ? myTables.find(t => t.number === draggedTable) : null;
                  if (draggedT && dragPosition) {
                    return (
                      <div 
                        className={`absolute pointer-events-none flex flex-col items-center justify-center p-4 bg-primary text-white shadow-3xl z-[100] border-4 border-white/20 scale-110 transition-transform duration-200 ${draggedT.shape === 'circle' ? 'rounded-full' : (draggedT.isRoom ? 'rounded-[2rem]' : 'rounded-2xl')}`}
                        style={{ 
                          left: `${dragPosition.x}px`, 
                          top: `${dragPosition.y}px`, 
                          width: `${draggedT.width || 80}px`, 
                          height: `${draggedT.height || 80}px`,
                        }}
                      >
                         <span className="text-2xl font-serif font-black">{draggedT.number}</span>
                         <Move className="w-4 h-4 mt-2 opacity-50 animate-pulse" />
                      </div>
                    );
                  }
                  return null;
                })()}
                </div>
              </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 overflow-y-auto h-full pr-4 no-scrollbar pb-32">
              {filteredTables.map(table => {
                 const isOccupied = table.currentCustomerId !== null;
                 const customer = isOccupied ? users.find(u => u.id === table.currentCustomerId) : null;
                 return (
                   <div 
                    key={table.number}
                    onClick={() => setSelectedTable(table.number)}
                    className={`bg-white p-8 rounded-[2.5rem] border-2 transition-all duration-500 cursor-pointer hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden ${isOccupied ? 'border-primary bg-primary text-white' : (table.status === 'dirty' ? 'border-burgundy/20 bg-burgundy/[0.02]' : 'border-primary/5 hover:border-primary/20')}`}
                   >
                     {isOccupied && (
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                     )}
                     <div className="flex justify-between items-start mb-10 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-serif text-3xl font-black shadow-xl transition-transform group-hover:scale-110 ${isOccupied ? 'bg-white/10 border border-white/20 text-white' : (table.status === 'dirty' ? 'bg-burgundy text-white' : 'bg-primary text-white')}`}>
                          {table.number}
                        </div>
                        {isOccupied && table.sessionStartTime && (
                          <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full flex items-center space-x-2 border border-white/10">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {(() => {
                                const diff = Math.floor((currentTime.getTime() - new Date(table.sessionStartTime).getTime()) / 60000);
                                return diff > 60 ? `${Math.floor(diff/60)}h ${diff%60}m` : `${diff}m`;
                              })()}
                            </span>
                          </div>
                        )}
                     </div>
                     
                     <div className="relative z-10 space-y-2">
                        {isOccupied && customer ? (
                          <>
                             <p className="text-2xl font-serif font-black tracking-tight">{customer.name}</p>
                             <div className="flex items-center space-x-2 opacity-60">
                               <Users className="w-4 h-4" />
                               <span className="text-xs font-bold uppercase tracking-widest">{table.seats || 4} Guests</span>
                             </div>
                          </>
                        ) : (
                          <>
                             <p className={`text-xl font-serif font-black tracking-tight ${table.status === 'dirty' ? 'text-burgundy' : 'text-primary'}`}>
                               {table.status === 'dirty' ? 'Maintenance' : 'Ready for Service'}
                             </p>
                             <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">Table Tier: Standard</p>
                          </>
                        )}
                     </div>
                   </div>
                 );
              })}
            </div>
          )}

          {/* Premium Quick Add controls */}
          {isLayoutMode && (
            <div className="absolute top-1/2 -translate-y-1/2 left-10 flex flex-col space-y-4 z-[60] animate-in slide-in-from-left-4 duration-500">
               <div className="bg-primary/95 backdrop-blur-xl border border-white/10 p-3 rounded-3xl shadow-2xl space-y-4">
                  <button 
                    onClick={() => addTable(currentUser.id, 'table', activeSectionId !== 'all' ? activeSectionId : undefined)}
                    className="w-14 h-14 flex flex-col items-center justify-center space-y-1 text-white/40 hover:text-white transition-all group"
                  >
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Store</span>
                  </button>
                  <button 
                    onClick={() => addTable(currentUser.id, 'room', activeSectionId !== 'all' ? activeSectionId : undefined)}
                    className="w-14 h-14 flex flex-col items-center justify-center space-y-1 text-white/40 hover:text-white transition-all group"
                  >
                    <Square className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Priv</span>
                  </button>
                  <button 
                    onClick={() => addTable(currentUser.id, 'corridor', activeSectionId !== 'all' ? activeSectionId : undefined)}
                    className="w-14 h-14 flex flex-col items-center justify-center space-y-1 text-white/40 hover:text-white transition-all group"
                  >
                    <Layers className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Expan</span>
                  </button>
               </div>
               
               <button 
                onClick={() => {
                  if (window.confirm('Notice: This will restore the palace layout to its original 12-atelier configuration. Proceed?')) {
                    initTables(currentUser.id);
                  }
                }}
                className="w-14 h-14 bg-white text-primary rounded-2xl shadow-xl flex items-center justify-center border border-primary/5 hover:scale-105 active:scale-95 transition-all"
               >
                 <History className="w-6 h-6" />
               </button>
            </div>
          )}
        </div>
      </div>
    </main>

      {/* RIGHT SIDE PANEL (Customer Insights Detail) */}
      <aside className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-3xl z-[100] border-l border-primary/5 transform transition-transform duration-700 ease-in-out flex flex-col ${selectedTable ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedTable && activeTable ? (
          <>
            <div className="p-10 border-b border-primary/5 flex justify-between items-center bg-primary/5 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-full lattice-overlay opacity-5"></div>
               <div className="flex items-center space-x-6 relative z-10">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl font-serif font-black text-white shadow-2xl transition-all duration-500 ${activeTable.currentCustomerId ? 'bg-primary' : 'bg-primary/40'}`}>
                  {selectedTable}
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-black text-primary tracking-tighter italic">Atelier {selectedTable}</h2>
                  <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em] mt-1">
                    {activeTable.sectionId ? (currentStoreSections.find(s => s.id === activeTable.sectionId)?.name) : 'Central Court'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTable(null)} 
                className="p-3 bg-white rounded-2xl border border-primary/5 hover:bg-primary/5 transition-all shadow-sm"
              >
                <X className="w-6 h-6 text-primary/40" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar">
              {activeCustomer ? (
                (() => {
                  const stats = getCustomerStats(activeCustomer.id);
                  return (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                      {/* Identity Card */}
                      <div className="bg-primary p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-700"></div>
                        <div className="flex justify-between items-start mb-10 relative z-10">
                          <div className="flex items-center space-x-6">
                            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-2xl font-serif italic border border-white/20">
                              {activeCustomer.name.charAt(0)}
                            </div>
                            <div>
                              <h3 className="text-3xl font-serif font-black tracking-tight">{activeCustomer.name}</h3>
                              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">{activeCustomer.phone}</p>
                            </div>
                          </div>
                          <span className={`px-4 py-2 rounded-xl text-[10px] font-black border-2 uppercase tracking-widest ${getTierColor(stats.tier)}`}>
                            {getTierCustomName(stats.tier, currentUser.tierNames)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/5 relative z-10">
                          <div className="text-center">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Visits</p>
                            <p className="text-2xl font-serif font-black">{stats.totalVisits}</p>
                          </div>
                          <div className="text-center border-x border-white/10 px-2">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Loyalty</p>
                            <p className="text-2xl font-serif font-black text-emerald-400">84%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Frequency</p>
                            <p className="text-2xl font-serif font-black text-burgundy">{stats.frequencyPerMonth}x</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Detailed Insights */}
                      <div className="space-y-6">
                        <span className="font-black uppercase tracking-[0.3em] text-[10px] text-primary/30">Guest Heritage</span>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-6 bg-primary/5 rounded-3xl border border-primary/5">
                              <Calendar className="w-5 h-5 text-primary mb-3 opacity-30" />
                              <p className="text-[9px] font-black text-primary/30 uppercase mb-2">Last Presence</p>
                              <p className="text-sm font-bold text-primary">
                                {stats.daysSinceLastVisit !== null ? (stats.daysSinceLastVisit === 0 ? 'Solar Day' : `${stats.daysSinceLastVisit} Days Past`) : 'None Recorded'}
                              </p>
                           </div>
                           <div className="p-6 bg-primary/5 rounded-3xl border border-primary/5">
                              <Heart className="w-5 h-5 text-burgundy mb-3 opacity-30" />
                              <p className="text-[9px] font-black text-primary/30 uppercase mb-2">Social Bond</p>
                              <p className="text-sm font-bold text-primary">Traditional</p>
                           </div>
                        </div>

                        {activeCustomer.memo && (
                          <div className="p-8 bg-surface-bright rounded-3xl border border-primary/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                               <Edit2 className="w-12 h-12 text-primary" />
                            </div>
                            <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] mb-4">Master's Note</p>
                            <p className="text-sm text-primary leading-relaxed font-serif italic serif">
                              {formatMemoDisplay(activeCustomer.memo)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-10 py-20 opacity-20 hover:opacity-100 transition-opacity duration-1000">
                   <div className="p-12 bg-white rounded-[4rem] border-4 border-primary/5 shadow-inner">
                      <QRCodeSVG value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} size={200} level="H" />
                   </div>
                   <div className="space-y-4 max-w-[240px]">
                      <h3 className="text-2xl font-serif font-black text-primary italic">Assign Citizen</h3>
                      <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.2em] leading-relaxed">
                        Scanning this cipher will bind a citizen record to this atelier.
                      </p>
                   </div>
                </div>
              )}
            </div>

            <div className="p-10 border-t border-primary/5 bg-primary/2 px-10">
              {activeCustomer ? (
                <button 
                  onClick={() => { 
                    updateTableStatus(currentUser.id, selectedTable, 'dirty');
                    leaveTable(selectedTable, currentUser.id); 
                    setSelectedTable(null); 
                  }} 
                  className="w-full bg-burgundy text-white font-black py-5 rounded-[2rem] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-burgundy/20 uppercase tracking-[0.2em] text-xs"
                >
                  Terminate Session
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => { updateTableStatus(currentUser.id, selectedTable, 'available'); setSelectedTable(null); }}
                    className={`flex flex-col items-center justify-center space-y-3 p-6 rounded-3xl border-2 transition-all ${activeTable.status === 'available' ? 'border-primary bg-primary text-white shadow-xl' : 'border-primary/5 text-primary opacity-30 hover:opacity-100'}`}
                   >
                     <CheckCircle2 className="w-8 h-8" />
                     <span className="text-[9px] font-black uppercase tracking-[0.2em]">Operational</span>
                   </button>
                   <button 
                    onClick={() => { updateTableStatus(currentUser.id, selectedTable, 'dirty'); setSelectedTable(null); }}
                    className={`flex flex-col items-center justify-center space-y-3 p-6 rounded-3xl border-2 transition-all ${activeTable.status === 'dirty' ? 'border-burgundy bg-burgundy/10 text-burgundy shadow-xl shadow-burgundy/5' : 'border-primary/5 text-primary opacity-30 hover:opacity-100'}`}
                   >
                     <AlertCircle className="w-8 h-8" />
                     <span className="text-[9px] font-black uppercase tracking-[0.2em]">Care Required</span>
                   </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
             <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center border border-primary/5 opacity-40">
                <LayoutGrid className="w-10 h-10 text-primary" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/20 max-w-[200px] leading-relaxed">
               Select an atelier on the governance map to view its current state.
             </p>
          </div>
        )}
      </aside>

      {/* Section Editor Modal */}
      {isEditingSections && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-3xl border border-primary/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            
            <div className="flex justify-between items-center mb-10 relative z-10">
              <h2 className="text-3xl font-serif font-black text-primary tracking-tighter">District Protocols</h2>
              <button 
                onClick={() => { setIsEditingSections(false); setEditingSectionId(null); }}
                className="p-3 bg-primary/5 rounded-2xl hover:bg-primary/10 transition-colors"
                ><X className="w-6 h-6 text-primary/40" /></button>
            </div>
            
            <div className="space-y-4 max-h-80 overflow-y-auto no-scrollbar pr-2 relative z-10">
              {currentStoreSections.map(section => (
                <div key={section.id} className="flex items-center space-x-4 p-5 bg-primary/5 rounded-2xl border border-primary/5 group">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20"></div>
                  {editingSectionId === section.id ? (
                    <input 
                      autoFocus
                      className="flex-1 bg-white px-3 py-1 rounded-lg border-2 border-primary focus:outline-none font-bold text-primary text-sm"
                      value={section.name}
                      onBlur={() => setEditingSectionId(null)}
                      onChange={(e) => updateSection(section.id, e.target.value)}
                    />
                  ) : (
                    <span className="flex-1 font-black text-primary text-sm uppercase tracking-widest">{section.name}</span>
                  )}
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingSectionId(section.id)} className="p-2 hover:bg-white rounded-xl transition-colors text-primary/20 hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteSection(currentUser.id, section.id)} className="p-2 hover:bg-white rounded-xl transition-colors text-burgundy/40 hover:text-burgundy"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-primary/5 relative z-10">
              <div className="flex space-x-3">
                <input 
                  className="flex-1 bg-primary/5 border border-primary/5 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 font-black text-primary placeholder:text-primary/20 text-sm"
                  placeholder="NEW DISTRICT NAME..."
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
                  className="px-8 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest text-[10px]"
                >
                  Append
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
