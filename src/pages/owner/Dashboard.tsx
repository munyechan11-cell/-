import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore, getEffectiveTier, getTierColor, getTierCustomName, showToast, calculateRFMValue, getRFMCluster, getActionableInsights } from '../../store';
import { 
  Users, LayoutGrid, LogOut, X, Bell, BarChart3, 
  Settings, Map as MapIcon, List, Move, Plus, 
  Minus, Trash2, Layers, Clock, Maximize2,
  TrendingUp, Calendar, History, Store,
  Utensils, Hourglass, GripVertical, Monitor,
  User, Mail, Settings as SettingsIcon, ShieldAlert,
  Send, ChevronRight, Activity, Zap, Sparkles,
  Trophy, Globe, Leaf, Target, ArrowRight, MessageSquare, Ticket,
  TrendingUp as TrendingUpIcon, AlertCircle, Gift, AlertTriangle, Coins, ShieldCheck, Printer
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { formatMemoDisplay } from '../../components/MemoModal';
import Skeleton, { DashboardStatsSkeleton } from '../../components/Skeleton';

export default function OwnerDashboard() {
  const { 
    isReady = true, 
    currentUser = null, 
    tables = [], 
    users = [], 
    visits = [], 
    coupons = [], 
    sections = [], 
    communications = [], 
    logout = () => {}, 
    leaveTable = () => {}, 
    initTables = () => {}, 
    tierOverrides = [], 
    approveCouponUse = () => {}, 
    rejectCouponUse = () => {}, 
    issueCoupon = () => {},
    updateTableLayout = () => {}, 
    addTable = () => {}, 
    deleteTable = () => {}, 
    addSection = () => {}, 
    updateSection = () => {}, 
    deleteSection = () => {}, 
    updateTableStatus = () => {}, 
    linkSocialAccount = () => {}, 
    deleteAccount = () => {},
    ownerViewMode = 'desktop', 
    sendPhysicalSms = async () => {}, 
    sendKakaoMessage = async () => {}
  } = useStore();
  
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isInitialViewModeSet, setIsInitialViewModeSet] = useState(false);
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [draggedTable, setDraggedTable] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoom, setZoom] = useState(1);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [tableStart, setTableStart] = useState<{x: number, y: number} | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
   const mapContainerRef = useRef<HTMLDivElement>(null);
   const mapInnerRef = useRef<HTMLDivElement>(null);
   const qrRef = useRef<HTMLDivElement>(null);
  
  const currentStoreSections = (sections || []).filter(s => s.storeId === currentUser?.id);
  const [activeSectionId, setActiveSectionId] = useState<string | 'all' | 'unassigned'>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  interface NotificationItem {
    id: string;
    name: string;
    type: 'entrance' | 'message' | 'coupon';
    time: string;
    table?: number;
    avatar?: string;
    tier?: string;
    content?: string;
  }
  
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);
  const processedVisitIds = useRef<Set<string>>(new Set());
  const processedCommIds = useRef<Set<string>>(new Set());
  const processedCouponIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);
  const [highlightedTable, setHighlightedTable] = useState<number | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // 알림창이 닫혀있을 때만 미확인 카운트 증가
    if (!showNotifications) {
       setUnreadCount(localNotifications.length);
    } else {
       setUnreadCount(0);
    }
  }, [localNotifications, showNotifications]);

  // CRM 데이터 계산 (RFM 세그먼트 분포)
  const crmSegments = useMemo(() => {
    const segments = { 'vip': 0, 'new': 0, 'slipping': 0, 'cold': 0, 'whale': 0, 'general': 0 };
    if (!currentUser || !users) return segments;

    const myUsers = (users || []).filter(u => u.role === 'customer' && u.storeId === currentUser.id);
    myUsers.forEach(u => {
      const userVisits = (visits || []).filter(v => v.customerId === u.id);
      const rfm = calculateRFMValue(userVisits, u.id, currentUser.id);
      const cluster = getRFMCluster(rfm.r, rfm.f, rfm.m);
      if (segments[cluster.id as keyof typeof segments] !== undefined) {
        segments[cluster.id as keyof typeof segments]++;
      }
    });
    return segments;
  }, [users, visits, currentUser]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role === 'owner') {
      const myTables = (tables || []).filter(t => t.storeId === currentUser.id);
      if (myTables.length === 0) {
        initTables(currentUser.id);
      }
      
      // 설정된 기본 뷰모드로 초기화 (한 번만)
      if (!isInitialViewModeSet && currentUser.storeConfig?.defaultDashboardView) {
        setViewMode(currentUser.storeConfig.defaultDashboardView as 'grid' | 'map');
        setIsInitialViewModeSet(true);
      }
    }
  }, [currentUser, tables, isInitialViewModeSet]);

  const updateZoomToFit = () => {
    if (!mapContainerRef.current) return;
    const { clientWidth, clientHeight } = mapContainerRef.current;
    
    // 배치도 영역(1400x1200)이 컨테이너에 딱 맞도록 배율 계산
    const padding = ownerViewMode === 'mobile' ? 20 : 40;
    const scaleX = (clientWidth - padding) / 1400;
    const scaleY = (clientHeight - padding) / 1200;
    
    const newZoom = Math.min(scaleX, scaleY, 1.2); // 최대 1.2배까지만
    setZoom(Math.max(newZoom, ownerViewMode === 'mobile' ? 0.1 : 0.45)); // 데스크톱 최소배율 상향
  };

  useEffect(() => {
    if (viewMode === 'map') {
      // 렌더링 후 약간의 지연을 두어 정확한 너비 계산
      const timer = setTimeout(updateZoomToFit, 100);
      window.addEventListener('resize', updateZoomToFit);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateZoomToFit);
      };
    }
  }, [viewMode, ownerViewMode, isReady]);

  // Combined Smart Notification Engine
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'owner' || !isReady) return;

    const myId = currentUser.id;
    const playSound = (type: 'info' | 'success' | 'alert' = 'info') => {
       try {
         const urls = {
           info: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
           success: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
           alert: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'
         };
         const audio = new Audio(urls[type]);
         audio.volume = 0.4;
         audio.play();
       } catch (e) {}
    };

    // 1. Entrance Notifications
    const myVisits = visits.filter(v => v.storeId === myId);
    if (isInitialLoad.current) {
      myVisits.forEach(v => processedVisitIds.current.add(v.id));
    } else {
      const newVisits = myVisits.filter(v => !processedVisitIds.current.has(v.id));
      newVisits.forEach(v => {
        processedVisitIds.current.add(v.id);
        const customer = users.find(u => u.id === v.customerId);
        const name = customer?.name || '신규 고객';
        setHighlightedTable(v.tableNumber);
        setTimeout(() => setHighlightedTable(null), 10000);
        playSound('info');
        showToast(`${name}님이 ${v.tableNumber}번 테이블에 입장하셨습니다!`, 'info');
        setLocalNotifications(prev => [{ id: v.id, type: 'entrance' as const, name, avatar: customer?.avatarUrl, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), table: v.tableNumber }, ...prev].slice(0, 15));
      });
    }

    // 2. Real-time Message Notifications
    const myComms = communications.filter(c => c.storeId === myId && c.senderRole === 'customer');
    if (isInitialLoad.current) {
      myComms.forEach(c => processedCommIds.current.add(c.id));
    } else {
      const newComms = myComms.filter(c => !processedCommIds.current.has(c.id));
      newComms.forEach(c => {
        processedCommIds.current.add(c.id);
        const customer = users.find(u => u.id === c.customerId);
        playSound('alert');
        showToast(`${customer?.name || '고객'}님의 새로운 메시지: ${c.content.slice(0, 15)}...`, 'success');
        setLocalNotifications(prev => [{ id: c.id, type: 'message' as const, name: customer?.name || '고객', content: c.content, avatar: customer?.avatarUrl, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 15));
      });
    }

    // 3. Coupon Usage Request Notifications
    const myPendingCoupons = coupons.filter(cp => cp.storeId === myId && cp.status === 'pending');
    if (isInitialLoad.current) {
      myPendingCoupons.forEach(cp => processedCouponIds.current.add(cp.id));
    } else {
      const newReqs = myPendingCoupons.filter(cp => !processedCouponIds.current.has(cp.id));
      newReqs.forEach(cp => {
        processedCouponIds.current.add(cp.id);
        const customer = users.find(u => u.id === cp.customerId);
        playSound('success');
        showToast(`${customer?.name || '고객'}님이 쿠폰 사용을 요청했습니다 (${cp.description})`, 'info');
        if (cp.usedAtTable) {
           setHighlightedTable(cp.usedAtTable);
           setTimeout(() => setHighlightedTable(null), 15000);
        }
        setLocalNotifications(prev => [{ id: cp.id, type: 'coupon' as const, name: customer?.name || '고객', content: cp.description, time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), table: cp.usedAtTable }, ...prev].slice(0, 15));
      });
    }

    if (isInitialLoad.current) isInitialLoad.current = false;
  }, [visits, communications, coupons, currentUser, users, isReady]);

  if (!currentUser) return null;

  if (!isReady) {
    return (
      <div className="flex h-screen bg-surface-bright p-12 lg:pl-80 space-y-12 flex-col">
        <div className="flex justify-between items-center py-6">
           <div>
              <Skeleton width={300} height={40} />
              <Skeleton width={150} height={20} className="mt-2" />
           </div>
           <Skeleton variant="circle" width={56} height={56} />
        </div>
        <DashboardStatsSkeleton />
        <Skeleton height="60vh" className="rounded-[4rem]" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const myTables = tables.filter(t => t.storeId === currentUser.id);
  const actualTables = myTables.filter(t => t.type === 'table');
  
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
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    setDragPosition({ x: tableStart.x + dx, y: tableStart.y + dy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedTable !== null && dragPosition) {
      const snappedX = Math.round(dragPosition.x / 10) * 10;
      const snappedY = Math.round(dragPosition.y / 10) * 10;
      updateTableLayout(currentUser.id, draggedTable, { x: snappedX, y: snappedY });
    }
    setDraggedTable(null);
    setDragPosition(null);
  };

  const stats = (() => {
    if (!currentUser) return { newCustomers: 0, occupancyRate: 0, avgUsage: 45, rfmSegments: crmSegments, healthScore: 0, atRisk: 0, inactiveCustomers: 0 };
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const newCustomers = new Set((visits || []).filter(v => v.storeId === currentUser.id && new Date(v.date) >= weekAgo).map(v => v.customerId)).size;
    const myTables = (tables || []).filter(t => t.storeId === currentUser.id);
    const actualTables = myTables.filter(t => t.type === 'table');
    const occupiedTables = actualTables.filter(t => t.currentCustomerId);
    const occupancyRate = actualTables.length > 0 ? Math.round((occupiedTables.length / actualTables.length) * 100) : 0;
    const currentDurations = occupiedTables.map(t => (currentTime.getTime() - new Date(t.sessionStartTime!).getTime()) / 60000);
    const avgUsage = currentDurations.length > 0 ? Math.round(currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length) : 45;
    
    const turnoverRate = 2.4; 
    const healthScore = Math.min(100, Math.round((occupancyRate * 0.4) + (turnoverRate * 30) + (100 - (crmSegments.slipping * 5))));

    return { 
      newCustomers, occupancyRate, avgUsage, 
      rfmSegments: crmSegments, 
      healthScore,
      atRisk: crmSegments.slipping + crmSegments.cold,
      inactiveCustomers: crmSegments.slipping + crmSegments.cold
    };
  })();

  const turnoverRate = 2.4; // Simulated real-time turnover

  return (
    <div className={`flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface ${ownerViewMode === 'mobile' ? 'flex-col' : ''}`}>
      {/* Elite Sidebar */}
      {ownerViewMode === 'desktop' && (
        <aside className="h-screen w-20 lg:w-72 fixed left-0 bg-sidebar-bg shadow-premium flex flex-col py-10 z-50 border-r border-white/5">
          <div className="px-10 mb-16">
            <Link to="/" className="text-white font-sans text-4xl font-black tracking-tighter drop-shadow-xl">결</Link>
            <div className="mt-6 hidden lg:block opacity-60">
              <p className="text-white font-sans text-sm font-bold">{currentUser.restaurantName}</p>
              <p className="text-gold uppercase tracking-[0.3em] text-[9px] font-black mt-1">결 공식 인증 매장</p>
            </div>
          </div>
          
          <nav className="flex-1 space-y-1">
            {[
              { to: '/owner', icon: LayoutGrid, label: '대시보드', active: true },
              { to: '/owner/customers', icon: Users, label: '단골 관리' },
              { to: '/owner/statistics', icon: BarChart3, label: '매장 현황 분석' },
              { to: '/owner/brand-settings', icon: Settings, label: '매장 프로필 관리' }
            ].map((item, idx) => (
              <Link 
                key={idx}
                to={item.to} 
                className={`group flex items-center gap-4 px-10 py-5 transition-all relative ${item.active ? 'text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                {item.active && <motion.div layoutId="nav-glow" className="absolute left-0 w-1.5 h-8 bg-gold rounded-r-full shadow-[0_0_15px_rgba(198,163,79,0.5)]" />}
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform ${item.active ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="text-xs font-black uppercase tracking-[0.2em] hidden lg:block">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="px-10 mt-auto space-y-6">
             <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-4 text-white/40 hover:text-white transition-all group">
                <User className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">프로필 설정</span>
             </button>
             <button onClick={handleLogout} className="flex items-center gap-4 text-burgundy/40 hover:text-burgundy transition-all group">
                <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">로그아웃</span>
             </button>
          </div>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {ownerViewMode === 'mobile' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-sidebar-bg/95 backdrop-blur-xl border-t border-white/5 z-[100] px-6 py-4 flex justify-between items-center safe-area-bottom">
           {([
             { to: '/owner', icon: LayoutGrid, label: '홈', active: true },
             { to: '/owner/customers', icon: Users, label: '단골' },
             { to: '/owner/statistics', icon: BarChart3, label: '통계' },
             { onClick: () => setIsSettingsOpen(true), icon: Settings, label: '설정' }
           ] as any[]).map((item, idx) => {
             const Comp = (item.to ? Link : 'button') as any;
             return (
               <Comp 
                 key={idx}
                 {...(item.to ? { to: item.to } : { onClick: item.onClick })}
                 className={`flex flex-col items-center gap-1.5 transition-all ${item.active ? 'text-gold' : 'text-white/40'}`}
               >
                 <item.icon className="w-5 h-5" />
                 <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
               </Comp>
             );
           })}
        </nav>
      )}

      <main className={`${ownerViewMode === 'desktop' ? 'ml-20 lg:ml-72' : 'flex-1 pb-24'} flex-1 h-screen flex flex-col overflow-hidden`}>
        {/* Intelligence Header */}
        <header className="bg-white/80 backdrop-blur-xl px-4 lg:px-12 py-4 lg:py-8 border-b border-primary/5 flex justify-between items-center z-40">
          <div className="flex items-center gap-6 lg:gap-10">
            <div>
                <div className="flex items-center gap-2 mb-0.5 lg:mb-1">
                  <h1 className="text-lg lg:text-3xl font-sans font-black text-primary tracking-tight">실시간 매장 현황</h1>
                  <div className="px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10 text-[7px] lg:text-[8px] font-black text-primary uppercase tracking-widest">LIVE</div>
                </div>
               <div className="flex items-center gap-2 lg:gap-3">
                  <div className="w-1.5 lg:w-2 h-1.5 lg:h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-[8px] lg:text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">현재 시각: {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
               </div>
            </div>
            
            <nav className="hidden lg:flex gap-10">
               <button onClick={() => setViewMode('map')} className={`text-[11px] font-black uppercase tracking-[0.3em] transition-all px-4 py-2 rounded-xl ${viewMode === 'map' ? 'text-primary bg-primary/5' : 'text-primary/30 hover:text-primary'}`}>테이블 배치도</button>
               <button onClick={() => setViewMode('grid')} className={`text-[11px] font-black uppercase tracking-[0.3em] transition-all px-4 py-2 rounded-xl ${viewMode === 'grid' ? 'text-primary bg-primary/5' : 'text-primary/30 hover:text-primary'}`}>리스트 현황</button>
               <Link to="/owner/qr-print" className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 hover:text-primary px-4 py-2 flex items-center gap-2 group">
                  <Printer className="w-3.5 h-3.5 group-hover:animate-bounce" />
                  QR 프린트 키트
               </Link>
            </nav>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
                <div className="flex flex-col items-end hidden md:flex">
                   <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Live Sync Active</span>
                   <span className="text-[7px] font-bold text-primary/30 uppercase">Secure Cloud Link</span>
                </div>
                
                {/* Notification Hub */}
                <div className="relative">
                   <button 
                     onClick={() => setShowNotifications(!showNotifications)}
                     className={`p-3 lg:p-4 rounded-2xl transition-all relative shadow-sm ${showNotifications ? 'bg-primary text-white' : 'bg-surface-bright border border-primary/5 text-primary hover:bg-primary/5'}`}
                   >
                      <Bell className="w-5 h-5" />
                      {localNotifications.length > 0 && (
                         <motion.div 
                           initial={{ scale: 0 }}
                           animate={{ scale: 1 }}
                           className="absolute -top-1 -right-1 w-6 h-6 bg-burgundy text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xl z-10"
                         >
                            {localNotifications.length}
                         </motion.div>
                      )}
                   </button>

                   <AnimatePresence>
                     {showNotifications && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10, scale: 0.95 }}
                         animate={{ opacity: 1, y: 0, scale: 1 }}
                         exit={{ opacity: 0, y: 10, scale: 0.95 }}
                         className="absolute top-20 right-0 w-96 bg-white rounded-[3rem] shadow-premium border border-primary/5 overflow-hidden z-[100]"
                       >
                           <div className="p-8 border-b border-primary/5 flex justify-between items-center bg-surface-bright/50">
                              <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/40">최근 도착 알림</h4>
                              {localNotifications.length > 0 && (
                                 <button onClick={() => setLocalNotifications([])} className="text-[10px] font-black text-burgundy/40 hover:text-burgundy uppercase">알림 모두 삭제</button>
                              )}
                           </div>
                           <div className="max-h-[500px] overflow-y-auto no-scrollbar">
                              {localNotifications.length > 0 ? (
                                 localNotifications.map(notification => (
                                    <motion.div 
                                      initial={{ opacity: 0, x: 10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      key={notification.id} 
                                      onClick={() => { setHighlightedTable(notification.table); setShowNotifications(false); }} 
                                      className="p-8 border-b border-primary/5 hover:bg-primary/5 transition-all flex items-center gap-6 cursor-pointer group"
                                    >
                                       <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-primary overflow-hidden shadow-premium border border-primary/5">
                                          {notification.avatar ? (
                                             <img src={notification.avatar} className="w-full h-full object-cover" alt="" />
                                          ) : (
                                             <User className="w-6 h-6 opacity-20" />
                                          )}
                                       </div>
                                       <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-1">
                                             <p className="text-sm font-black text-primary">{notification.name}</p>
                                             <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border shadow-sm ${getTierColor(notification.tier)} uppercase tracking-tighter opacity-80`}>{notification.tier}</span>
                                          </div>
                                          <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">{notification.table}번 테이블 입장 • {notification.time}</p>
                                       </div>
                                       <ChevronRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-40 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </motion.div>
                                 ))
                              ) : (
                                 <div className="p-16 text-center">
                                    <Bell className="w-10 h-10 text-primary/10 mx-auto mb-6" />
                                    <p className="text-[11px] font-black text-primary/20 uppercase tracking-[0.4em]">새로운 알림이 없습니다</p>
                                 </div>
                              )}
                           </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
             </div>

             <motion.button 
               whileTap={{ scale: 0.95 }}
               onClick={() => setIsLayoutMode(!isLayoutMode)} 
               className={`px-6 lg:px-10 py-3 lg:py-4 rounded-[1.2rem] lg:rounded-[1.5rem] font-sans font-black text-[11px] lg:text-sm transition-all shadow-xl whitespace-nowrap flex-shrink-0 ${isLayoutMode ? 'bg-primary text-white ring-8 ring-primary/10' : 'bg-surface-bright border border-primary/10 text-primary hover:shadow-premium'}`}
             >
                {isLayoutMode ? '배치 저장 완료' : '테이블 배치 수정'}
             </motion.button>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-6 lg:p-12 space-y-8 lg:space-y-12 bg-gyeol-pattern ${ownerViewMode === 'mobile' ? 'no-scrollbar' : ''}`}>
               {/* Proactive Operational HUD - Top Intelligence Bar */}
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8 lg:mb-12">
                  {[
                    { label: '매장 건강 지수', val: `${stats.healthScore}pt`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+5%' },
                    { label: '실시간 점유율', val: `${stats.occupancyRate}%`, icon: Users, color: 'text-primary', bg: 'bg-primary/5', trend: 'STABLE' },
                    { label: '예상 일일 회전율', val: `${turnoverRate}회`, icon: History, color: 'text-gold', bg: 'bg-gold/10', trend: 'HIGH' },
                    { label: '집중 관리 필요', val: `${stats.atRisk}명`, icon: ShieldAlert, color: 'text-burgundy', bg: 'bg-burgundy/5', trend: 'ACTION REQ' }
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`${stat.bg} p-8 lg:p-11 rounded-[2.5rem] lg:rounded-[4rem] border border-primary/5 shadow-premium flex flex-col justify-between group overflow-hidden relative min-h-[160px] lg:min-h-[220px]`}
                    >
                      <stat.icon className={`absolute -right-4 -bottom-4 w-28 h-28 ${stat.color} opacity-[0.03] group-hover:scale-110 transition-transform`} />
                      <div className="relative z-10 flex flex-col h-full justify-between">
                         <div className="flex justify-between items-start">
                            <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{stat.label}</p>
                            <span className={`text-[7px] font-black px-2 py-0.5 rounded-full bg-white/50 border border-current/10 ${stat.color}`}>{stat.trend}</span>
                         </div>
                         <p className={`text-3xl lg:text-5xl font-sans font-black italic tracking-tighter ${stat.color}`}>{stat.val}</p>
                      </div>
                    </motion.div>
                  ))}
               </div>

               {/* CRM Insight Matrix - Advanced Segment View */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 mb-12">
                  <div className="lg:col-span-2 bg-sidebar-bg rounded-[4rem] p-10 lg:p-16 text-white relative overflow-hidden shadow-heavy">
                     <div className="absolute inset-0 bg-gyeol-pattern opacity-10"></div>
                     <div className="relative z-10 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-12">
                           <div>
                              <h3 className="text-2xl lg:text-4xl font-sans font-black italic tracking-tight mb-2">고객 가치 매트릭스 (CRM)</h3>
                              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Advanced RFM Analytics Engine</p>
                           </div>
                           <div className="flex gap-4">
                              <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                                 <Users className="w-4 h-4 text-gold" />
                                 <span className="text-[11px] font-black">{users.filter(u => u.role === 'customer' && u.storeId === currentUser.id).length}명 분석 중</span>
                              </div>
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 lg:gap-6 flex-1">
                           {[
                             { label: 'VIP 레전드', id: 'vip', color: 'from-gold/40 to-white/5', icon: Trophy },
                             { label: '유망 신규', id: 'new', color: 'from-blue-500/20 to-white/5', icon: Sparkles },
                             { label: '이탈 위험', id: 'slipping', color: 'from-burgundy/40 to-white/5', icon: AlertTriangle },
                             { label: '잠재 큰손', id: 'whale', color: 'from-primary/40 to-white/5', icon: Coins },
                             { label: '장기 휴면', id: 'cold', color: 'from-white/10 to-white/5', icon: History }
                           ].map((item, idx) => (
                              <div key={idx} className={`p-6 lg:p-10 rounded-[2.5rem] bg-white/5 border border-white/10 flex flex-col justify-between bg-gradient-to-br ${item.color} group hover:scale-[1.02] transition-all cursor-default`}>
                                 <div className="flex justify-between items-start mb-6">
                                    <item.icon className="w-6 h-6 opacity-40 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                                 </div>
                                 <div>
                                    <p className="text-4xl lg:text-5xl font-serif font-black italic mb-2 tracking-tighter">{stats.rfmSegments[item.id as keyof typeof stats.rfmSegments] || 0}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{item.label}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-[4rem] p-10 lg:p-16 shadow-premium border border-primary/5 flex flex-col justify-between relative overflow-hidden">
                     <div className="relative z-10 h-full flex flex-col">
                        <div className="flex justify-between items-start mb-8">
                           <h3 className="text-2xl font-serif font-black italic tracking-tight text-primary">Proactive Insight</h3>
                           <Zap className="w-6 h-6 text-gold animate-pulse" />
                        </div>
                        
                        <div className="space-y-6 flex-1">
                           {stats.atRisk > 0 ? (
                              <div className="flex gap-5 items-start p-8 bg-burgundy/5 rounded-[2.5rem] border border-burgundy/10">
                                 <AlertTriangle className="w-8 h-8 text-burgundy flex-shrink-0" />
                                 <div>
                                    <p className="text-sm font-black text-primary mb-2">이탈 가능성 감지 ({stats.atRisk}명)</p>
                                    <p className="text-[11px] font-medium text-primary/40 leading-relaxed">
                                       {getActionableInsights([], '', '', currentUser.storeConfig?.crmCustomInsights) || '최근 활동이 급감한 고객들이 포착되었습니다. 지금 즉시 특별 혜택을 제안하여 재방문을 유도하세요.'}
                                    </p>
                                    <Link to="/owner/customers" className="inline-flex items-center gap-2 mt-5 text-[10px] font-black text-burgundy uppercase tracking-widest group">
                                       즉시 캠페인 실행 <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                 </div>
                              </div>
                           ) : (
                              <div className="flex gap-5 items-start p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100">
                                 <ShieldCheck className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                                 <div>
                                    <p className="text-sm font-black text-primary mb-2">고객 유지도 안정적</p>
                                    <p className="text-[11px] font-medium text-primary/40 leading-relaxed">현재 위험군 고객이 없습니다. 기존 단골 고객들을 위한 보상 체계 강화를 권장합니다.</p>
                                 </div>
                              </div>
                           )}

                           <div className="flex gap-5 items-start p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10">
                              <Target className="w-8 h-8 text-primary flex-shrink-0" />
                              <div>
                                 <p className="text-sm font-black text-primary mb-2">성장 전략 제안</p>
                                 <p className="text-[11px] font-medium text-primary/40 leading-relaxed">{stats.rfmSegments.new}명의 신규 고객을 단골로 만들기 위한 '두 번째 방문' 이벤트를 활성화하세요.</p>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gold/5 rounded-full blur-[60px]"></div>
                  </div>
               </div>

          {/* Main Content Area: Table Map or List Grid */}
          <div className="relative bg-white rounded-[3rem] lg:rounded-[4rem] shadow-premium overflow-hidden border border-primary/5 min-h-[600px] lg:min-h-[800px] flex flex-col">
             <div className="p-8 border-b border-primary/5 flex justify-between items-center bg-surface-bright/30">
                <div className="flex items-center gap-6">
                   <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/40">라이브 모니터링</h4>
                   {viewMode === 'map' && <div className="text-[9px] font-black text-gold/60 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3" /> 인터랙티브 캔버스</div>}
                </div>
             </div>
             {viewMode === 'map' ? (
                <div className="flex-1 relative">
                   {/* FIXED Zoom Controls - Always visible in the top-right of the white box */}
                   <div className="flex flex-col gap-3 absolute top-6 right-6 lg:top-10 lg:right-10 z-[100]">
                      <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))} className="w-10 h-10 lg:w-12 lg:h-12 bg-white/90 backdrop-blur-md rounded-xl lg:rounded-2xl shadow-premium border border-primary/5 flex items-center justify-center text-primary/40 hover:text-primary transition-all active:scale-90"><Plus className="w-5 h-5" /></button>
                      <button onClick={updateZoomToFit} className="w-10 h-10 lg:w-12 lg:h-12 bg-primary text-white rounded-xl lg:rounded-2xl shadow-premium border border-primary/5 flex items-center justify-center hover:scale-105 transition-all active:scale-90" title="화면에 맞춤"><Maximize2 className="w-5 h-5" /></button>
                      <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.1))} className="w-10 h-10 lg:w-12 lg:h-12 bg-white/90 backdrop-blur-md rounded-xl lg:rounded-2xl shadow-premium border border-primary/5 flex items-center justify-center text-primary/40 hover:text-primary transition-all active:scale-90"><Minus className="w-5 h-5" /></button>
                   </div>

                   <div ref={mapContainerRef} className={`absolute inset-0 overflow-auto ${ownerViewMode === 'mobile' ? 'p-4' : 'p-20'} bg-[radial-gradient(#4a0e0e15_2px,transparent_2px)] [background-size:40px_40px] no-scrollbar cursor-crosshair`}>
                      <div 
                       ref={mapInnerRef}
                       className="relative origin-top-left transition-transform duration-500" 
                       style={{ minWidth: '1400px', minHeight: '1200px', transform: `scale(${zoom})` }}
                      >
                         {/* Decorative Compass Label */}
                         <div className="absolute -top-20 -left-20 flex flex-col gap-2 opacity-10">
                            <Globe className="w-12 h-12 text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">결 배치 구조도</p>
                         </div>
                      
                        {filteredTables.map(table => {
                          const isOccupied = table.currentCustomerId !== null;
                          const isBeingDragged = draggedTable === table.number;
                          const isHighlighted = highlightedTable === table.number;
                          
                          return (
                            <motion.div
                              key={table.number}
                              layout
                              onPointerDown={(e) => handlePointerDown(e, table)}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onClick={() => (isLayoutMode || table.type === 'table' || table.type === 'room') && setSelectedTable(table.number)}
                              className={`absolute flex flex-col items-center justify-center group ${isOccupied ? 'shadow-[0_20px_50px_rgba(74,14,14,0.15)]' : 'shadow-sm hover:shadow-xl'} ${isBeingDragged ? 'z-[100] cursor-grabbing !transition-none' : 'duration-500 transition-all'} ${isHighlighted ? 'ring-4 ring-gold animate-pulse-premium z-50' : ''} ${table.type !== 'table' && table.type !== 'room' && !isLayoutMode ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}
                              style={{
                                left: isBeingDragged ? dragPosition?.x : table.x,
                                top: isBeingDragged ? dragPosition?.y : table.y,
                                width: table.width || 80,
                                height: table.height || 80,
                                backgroundColor: table.type === 'room' ? 'transparent' : (isOccupied ? '#1c1412' : (table.status === 'dirty' ? '#fcf1f1' : '#ffffff')),
                                border: table.type === 'room' 
                                  ? `8px solid ${isOccupied ? '#1c1412' : '#f0e6dd'}` 
                                  : `3px solid ${isOccupied ? '#1c1412' : (selectedTable === table.number ? '#4a0e0e' : (isLayoutMode ? '#e5ddd6' : '#f0e6dd'))}`,
                                borderRadius: table.type === 'room' ? '4rem' : '1.2rem',
                                zIndex: isBeingDragged ? 100 : (selectedTable === table.number ? 40 : 10),
                                touchAction: 'none'
                              }}
                            >
                              {table.type === 'pos' && <Monitor className="w-8 h-8 text-primary/10" />}
                              {table.type === 'door' && <ArrowRight className="w-8 h-8 text-primary/10 rotate-90" />}
                              
                              {table.type === 'table' && (
                                 <div className="flex flex-col items-center">
                                    <span className={`text-2xl font-black ${isOccupied ? 'text-white' : 'text-primary/70'}`}>{table.number}</span>
                                    {isOccupied && (
                                       <div className="mt-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 backdrop-blur-md">
                                          <p className="text-[9px] font-black text-white/50 tracking-[0.2em] uppercase">
                                             {(() => {
                                                const start = new Date(table.sessionStartTime!);
                                                const diff = Math.floor((currentTime.getTime() - start.getTime()) / 60000);
                                                return `${diff}m`;
                                             })()}
                                          </p>
                                       </div>
                                    )}
                                 </div>
                              )}

                              {isOccupied && (
                                 <div className="absolute -top-3 -right-3 w-8 h-8 bg-gold rounded-full border-4 border-white flex items-center justify-center text-white shadow-xl animate-bounce">
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </div>
                              )}

                              {isLayoutMode && !isOccupied && (
                                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-[inherit] z-20">
                                    <button 
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => { e.stopPropagation(); deleteTable(currentUser.id, table.number); }} 
                                      className="p-3 bg-burgundy/10 text-burgundy rounded-2xl hover:bg-burgundy hover:text-white transition-all mx-1"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                    <button className="p-3 bg-primary/10 text-primary rounded-2xl cursor-move mx-1"><GripVertical className="w-5 h-5" /></button>
                                 </div>
                              )}
                            </motion.div>
                          );
                        })}
                     </div>
                   </div>
                </div>
             ) : (
                <div className="flex-1 p-4 lg:p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 overflow-y-auto no-scrollbar bg-surface-bright/30">
                   {filteredTables.map(table => (
                      <motion.div 
                        whileHover={{ y: -3 }}
                        key={table.number} 
                        onClick={() => setSelectedTable(table.number)} 
                        className={`bg-white rounded-[1.5rem] lg:rounded-[2.5rem] ${ownerViewMode === 'mobile' ? 'p-4' : 'p-6'} border border-primary/5 flex flex-col gap-3 lg:gap-4 cursor-pointer shadow-premium relative min-h-[120px] lg:min-h-[150px] flex-shrink-0 animate-in fade-in zoom-in-95 duration-500`}
                      >
                         <div className="flex justify-between items-start">
                            <div className="w-8 h-8 lg:w-14 lg:h-14 bg-gyeol-wood text-white rounded-lg lg:rounded-2xl flex items-center justify-center font-black text-sm lg:text-xl shadow-premium">{table.number}</div>
                            <div className={`px-2 py-0.5 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest ${table.currentCustomerId ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/5 text-primary/30'}`}>
                               {table.currentCustomerId ? '이용중' : '가능'}
                            </div>
                         </div>
                         <div className="space-y-0.5">
                            <p className="text-[7px] lg:text-[8px] font-black uppercase text-primary/30 tracking-widest">손님</p>
                            <p className="text-xs lg:text-base font-sans font-black text-primary leading-tight truncate">{table.currentCustomerId ? users.find(u => u.id === table.currentCustomerId)?.name : '없음'}</p>
                         </div>
                      </motion.div>
                   ))}
                </div>
             )}

             {isLayoutMode && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-sidebar-bg p-4 rounded-[3rem] shadow-3xl z-50 animate-in slide-in-from-bottom-12 outline outline-8 outline-white/20">
                   <div className="flex items-center bg-white/5 rounded-[2.5rem] p-1">
                      {[
                        { label: '테이블', icon: Utensils, type: 'table' },
                        { label: '룸/보석함', icon: Maximize2, type: 'room' },
                        { label: '출입문', icon: LogOut, type: 'door' },
                        { label: '주방/포스', icon: Monitor, type: 'pos' }
                      ].map((btn, idx) => (
                        <button key={idx} onClick={() => addTable(currentUser.id, btn.type as any)} className="px-8 py-3 text-white hover:bg-white/10 rounded-[2rem] flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all"><btn.icon className="w-4 h-4 opacity-40" /> {btn.label}</button>
                      ))}
                   </div>
                   <button onClick={() => initTables(currentUser.id)} className="p-4 bg-white/5 text-white/40 hover:bg-burgundy hover:text-white rounded-full transition-all" title="초기화"><History className="w-6 h-6" /></button>
                </div>
             )}
          </div>

          {/* Real-time Summary HUD */}
          <div className={`grid ${ownerViewMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-4'} gap-3 lg:gap-8`}>
            <motion.div 
               whileHover={{ y: -5 }}
               className="col-span-1 bg-white p-6 rounded-[2.5rem] border border-primary/5 shadow-premium flex flex-col justify-between group overflow-hidden relative"
            >
               <Activity className="absolute -top-6 -right-6 w-24 h-24 text-primary opacity-[0.02] group-hover:scale-110 transition-transform" />
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.3em]">실시간 좌석 점유</p>
                  <p className="text-3xl font-sans font-black text-primary leading-tight">{stats.occupancyRate}%</p>
               </div>
               <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-primary/5 rounded-full overflow-hidden">
                     <motion.div initial={{ width: 0 }} animate={{ width: `${stats.occupancyRate}%` }} className="h-full bg-primary" />
                  </div>
                  <span className="text-[8px] font-black text-primary/40">{actualTables.filter(t => t.currentCustomerId).length}개 사용 중</span>
               </div>
            </motion.div>

            <motion.div 
               whileHover={{ y: -5 }}
               className="col-span-1 bg-white p-6 rounded-[2.5rem] border border-primary/5 shadow-premium flex flex-col justify-between group overflow-hidden relative"
            >
               <Hourglass className="absolute -top-6 -right-6 w-24 h-24 text-primary opacity-[0.02] group-hover:scale-110 transition-transform" />
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.3em]">평균 머문 시간</p>
                  <p className="text-3xl font-sans font-black text-primary leading-tight">{stats.avgUsage}<span className="text-xs ml-1 font-sans font-black text-primary/30">분</span></p>
               </div>
               <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 self-start px-3 py-1 rounded-full">회전율 원활</p>
            </motion.div>

            <motion.div 
               whileHover={{ y: -5 }}
               className={`${ownerViewMode === 'mobile' ? 'col-span-2' : 'col-span-2'} bg-white p-6 lg:p-10 rounded-[2.5rem] lg:rounded-[4rem] border border-primary/5 shadow-premium flex flex-col justify-between group relative overflow-hidden`}
            >
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary"><Target className="w-5 h-5" /></div>
                     <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.4em]">고객 세그먼트 시각화</p>
                  </div>
                  <TrendingUpIcon className="w-5 h-5 text-emerald-500" />
               </div>
               
               <div className="flex items-end gap-3 lg:gap-5 h-32 pb-4">
                  {[
                    { label: 'VIP', id: 'vip', color: 'bg-gold' },
                    { label: '유망', id: 'new', color: 'bg-blue-500' },
                    { label: '큰손', id: 'whale', color: 'bg-primary' },
                    { label: '위험', id: 'slipping', color: 'bg-burgundy' },
                    { label: '휴면', id: 'cold', color: 'bg-surface-container' }
                  ].map(segment => {
                    const val = stats.rfmSegments[segment.id as keyof typeof stats.rfmSegments] || 0;
                    const maxVal = Math.max(...Object.values(stats.rfmSegments), 1);
                    const height = Math.max(10, (val / maxVal) * 100);
                    return (
                      <div key={segment.label} className="flex-1 flex flex-col items-center gap-3 group/bar">
                         <div className="relative w-full flex items-end justify-center h-full">
                            <motion.div 
                               initial={{ height: 0 }}
                               animate={{ height: `${height}%` }}
                               className={`w-full max-w-[50px] rounded-t-2xl ${segment.color} opacity-80 group-hover/bar:opacity-100 transition-all shadow-sm`}
                            />
                            <div className="absolute -top-8 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap bg-primary text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-xl z-20">{val}명</div>
                         </div>
                         <span className="text-[10px] font-bold text-primary/30 uppercase tracking-tighter">{segment.label}</span>
                      </div>
                    );
                  })}
               </div>
            </motion.div>
          </div>

          {/* Trigger Awareness Bar */}
          {stats.inactiveCustomers > 0 && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-burgundy p-6 lg:p-8 rounded-[2rem] lg:rounded-[3rem] text-white flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group"
             >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-wood.png')] opacity-10"></div>
                <div className="flex items-center gap-6 relative z-10">
                   <div className="w-16 h-16 rounded-[1.5rem] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 animate-pulse">
                      <AlertCircle className="w-8 h-8 text-white" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 mb-1">타겟 마케팅 기회 포착</p>
                      <h3 className="text-xl lg:text-3xl font-sans font-black tracking-tight underline decoration-white/20 underline-offset-8">
                        {stats.inactiveCustomers}명의 고객이 '이탈 위험' 단계입니다.
                      </h3>
                   </div>
                </div>
                <div className="flex gap-4 relative z-10 w-full lg:w-auto">
                   <Link 
                     to="/owner/customers" 
                     className="flex-1 lg:flex-none px-10 py-5 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl font-sans font-black text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-4"
                   >
                      명부 확인 <ArrowRight className="w-5 h-5" />
                   </Link>
                   <button 
                     onClick={async () => {
                        const confirmSend = window.confirm(`${stats.inactiveCustomers}명의 고객에게 복귀 권유 문자와 카카오톡을 즉시 발송하시겠습니까?`);
                        if (confirmSend) {
                           const msg = `[${currentUser.restaurantName}] 고객님, 오랜만이에요! 재방문 시 사용 가능한 특별 쿠폰이 발송되었습니다.`;
                           if (currentUser.role === 'owner') {
                              // 사장님 폰에서 직접 보낼 수 있도록 번호가 없으면 알림만, 있으면 실제 전송 루틴으로 연결
                              await sendPhysicalSms('', msg, 'device');
                           }
                           await sendKakaoMessage(msg, currentUser.restaurantName || '매장', currentUser.id);
                        }
                     }}
                     className="flex-1 lg:flex-none px-10 py-5 bg-white text-burgundy rounded-2xl font-sans font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-3xl flex items-center justify-center gap-4"
                   >
                      <Zap className="w-5 h-5" /> 즉시 문자 & 카톡 발송
                   </button>
                </div>
             </motion.div>
          )}
        </div>

        {/* Cinematic Detail Panel */}
        <AnimatePresence>
          {selectedTable && (
             <motion.aside 
                initial={{ x: "100%", y: ownerViewMode === 'mobile' ? "100%" : 0 }}
                animate={{ x: 0, y: 0 }}
                exit={{ x: "100%", y: ownerViewMode === 'mobile' ? "100%" : 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className={`fixed inset-y-0 right-0 ${ownerViewMode === 'mobile' ? 'left-0 top-0 w-full rounded-t-[4rem]' : 'w-[480px]'} bg-white shadow-[-40px_0_100px_rgba(74,14,14,0.15)] z-[110] p-8 lg:p-16 flex flex-col border-l border-primary/5 overflow-y-auto no-scrollbar`}
             >
                <div className="flex justify-between items-start mb-8 lg:mb-16">
                   <div>
                      <h2 className="text-2xl lg:text-4xl font-sans font-black text-primary mb-2 leading-none">{activeTable?.type === 'room' ? '프라이빗 룸' : `${selectedTable}번 테이블`}</h2>
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${activeTable?.currentCustomerId ? 'bg-emerald-500' : (activeTable?.status === 'dirty' ? 'bg-burgundy' : 'bg-primary/20')}`}></div>
                         <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.4em] text-primary/40">{activeTable?.currentCustomerId ? '이용 중' : (activeTable?.status === 'dirty' ? '청소 필요' : '입장 대기')}</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedTable(null)} className="p-4 bg-surface-bright rounded-full hover:bg-primary/5 transition-all outline-none"><X className="w-6 h-6 text-primary/20" /></button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-12">
                   {activeCustomer ? (
                      <div className="space-y-10">
                         <div className="bg-gyeol-pattern p-10 rounded-[4rem] border border-primary/5 space-y-6 shadow-premium relative overflow-hidden group">
                           <User className="absolute -top-10 -right-10 w-40 h-40 text-primary opacity-[0.03] group-hover:scale-110 transition-transform" />
                           <div className="flex items-center gap-6 relative z-10">
                              <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl p-1 overflow-hidden">
                                 {activeCustomer.avatarUrl ? (
                                    <img src={activeCustomer.avatarUrl} className="w-full h-full object-cover rounded-[1.5rem]" alt="" />
                                 ) : (
                                    <User className="w-10 h-10 text-primary/10 mx-auto" />
                                 )}
                              </div>
                              <div>
                                 <h3 className="text-2xl font-sans font-black text-primary tracking-tight">{activeCustomer.name}</h3>
                                 <p className="text-xs font-bold text-primary/40 tracking-widest">{activeCustomer.phone}</p>
                              </div>
                           </div>
                           <div className="flex flex-wrap gap-2 relative z-10">
                              <span className={`px-4 py-1.5 text-[9px] font-black rounded-full border border-primary/10 uppercase tracking-widest shadow-sm ${getTierColor(getCustomerStats(activeCustomer.id).tier)}`}>
                                 {getCustomerStats(activeCustomer.id).tier} 우수고객
                              </span>
                              <span className="px-4 py-1.5 bg-white/80 text-[9px] font-black rounded-full border border-primary/5 uppercase tracking-widest text-primary/40">방문 횟수: {getCustomerStats(activeCustomer.id).totalVisits}회</span>
                           </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-6">
                            <button onClick={() => activeCustomer?.phone && sendPhysicalSms(activeCustomer.phone, `[${currentUser.restaurantName}] 고객님, 매장 이용 안내를 위해 문자 드립니다.`, 'device')} className="p-8 bg-surface-bright rounded-[3rem] border border-primary/5 flex flex-col items-center gap-4 text-primary hover:bg-primary hover:text-white transition-all group">
                               <MessageSquare className="w-6 h-6 opacity-40 group-hover:opacity-100" />
                               <span className="text-[10px] font-black uppercase tracking-widest">문자/알림 전송</span>
                            </button>
                            <button onClick={() => activeCustomer?.id && issueCoupon(activeCustomer.id, currentUser.id, '사장님 특별 서비스', '재방문 시 사용 가능한 특별 서비스 쿠폰이 발송되었습니다.')} className="p-8 bg-surface-bright rounded-[3rem] border border-primary/5 flex flex-col items-center gap-4 text-primary hover:bg-primary hover:text-white transition-all group">
                               <Ticket className="w-6 h-6 opacity-40 group-hover:opacity-100" />
                               <span className="text-[10px] font-black uppercase tracking-widest">쿠폰/서비스 증정</span>
                            </button>
                         </div>
                         
                         <button onClick={() => leaveTable(selectedTable!, currentUser.id)} className="w-full py-6 bg-primary text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-3xl hover:scale-[1.02] active:scale-95 transition-all">이용 완료 (결제 처리)</button>
                      </div>
                   ) : (
                      <div className="space-y-10">
                         {isLayoutMode ? (
                            <div className="space-y-10">
                               <div className="bg-surface-bright p-10 rounded-[4rem] space-y-10 border border-primary/5">
                                  <div className="flex items-center gap-3 mb-6">
                                     <Settings className="w-5 h-5 text-primary opacity-30" />
                                     <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/40">배치 상세 설정</h4>
                                  </div>
                                  <div className="space-y-8">
                                     {[
                                        { label: '가로 길이', field: 'width', val: activeTable?.width || 80 },
                                        { label: '세로 길이', field: 'height', val: activeTable?.height || 80 },
                                        { label: '최대 좌석', field: 'seats', val: activeTable?.seats || 4 }
                                     ].map(f => (
                                        <div key={f.field} className="flex justify-between items-center">
                                           <span className="text-xs font-black text-primary/60 uppercase tracking-widest">{f.label}</span>
                                           <div className="flex items-center gap-6">
                                              <button onClick={() => updateTableLayout(currentUser.id, selectedTable!, { [f.field]: Math.max(1, f.val - (f.field === 'seats' ? 1 : 10)) })} className="p-3 bg-white rounded-2xl shadow-premium hover:bg-primary/5 transition-all"><Minus className="w-4 h-4 text-primary" /></button>
                                              <span className="text-lg font-black w-10 text-center text-primary">{f.val}</span>
                                              <button onClick={() => updateTableLayout(currentUser.id, selectedTable!, { [f.field]: f.val + (f.field === 'seats' ? 1 : 10) })} className="p-3 bg-white rounded-2xl shadow-premium hover:bg-primary/5 transition-all"><Plus className="w-4 h-4 text-primary" /></button>
                                           </div>
                                        </div>
                                     ))}
                                  </div>
                               </div>
                               <button onClick={() => setSelectedTable(null)} className="w-full py-6 bg-gyeol-wood text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-3xl transition-all">설정 저장 완료</button>
                            </div>
                         ) : (
                            <div className="space-y-10">
                               <div className="bg-gyeol-pattern p-10 rounded-[4rem] border-4 border-white shadow-premium flex flex-col items-center gap-10">
                                  <div className="p-6 bg-white rounded-3xl shadow-xl" ref={qrRef}><QRCodeSVG value={`${window.location.origin}/customer/store/${currentUser.id}/table/${selectedTable}`} size={200} level="H" /></div>
                                  <p className="text-[11px] font-black text-primary uppercase tracking-[0.5em] opacity-40">디지털 입장 QR 코드</p>
                                </div>
                               <div className="grid grid-cols-2 gap-6">
                                  <button onClick={() => {
                                      const url = `${window.location.origin}/customer/store/${currentUser.id}?table=${selectedTable}`;
                                      navigator.clipboard.writeText(url);
                                      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '테이블 접속 링크가 복사되었습니다.', type: 'success' } }));
                                  }} className="p-8 bg-surface-bright rounded-[3rem] border border-primary/5 flex flex-col items-center gap-4 text-primary hover:bg-primary hover:text-white transition-all group">
                                     <Target className="w-6 h-6 opacity-40 group-hover:opacity-100" /><span className="text-[10px] font-black uppercase tracking-widest font-sans">링크 복사</span>
                                  </button>
                                  <button onClick={() => {
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
                                        downloadLink.download = `결_QR_${selectedTable}번.png`;
                                        downloadLink.href = pngFile;
                                        downloadLink.click();
                                      };
                                      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                                  }} className="p-8 bg-surface-bright rounded-[3rem] border border-primary/5 flex flex-col items-center gap-4 text-primary hover:bg-primary hover:text-white transition-all group">
                                     <Maximize2 className="w-6 h-6 opacity-40 group-hover:opacity-100" /><span className="text-[10px] font-black uppercase tracking-widest font-sans">QR 저장</span>
                                  </button>
                               </div>
                            </div>
                         )}
                      </div>
                   )}
                </div>
             </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Elite Profile Settings */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-primary/40 backdrop-blur-2xl z-[150] flex items-center justify-center p-8">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="bg-white w-full max-w-xl rounded-[4rem] p-16 shadow-3xl flex flex-col gap-12 max-h-[90vh] overflow-y-auto no-scrollbar border border-white/10"
             >
                <div className="flex justify-between items-center">
                   <div>
                      <h3 className="text-3xl font-sans font-black text-primary">매장 관리 설정</h3>
                      <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.5em]">System Governance</p>
                   </div>
                   <button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-surface-bright rounded-full hover:bg-primary/5 transition-all"><X className="w-5 h-5 text-primary/30" /></button>
                </div>

                <div className="space-y-10">
                   <div className="bg-gyeol-pattern p-10 rounded-[3rem] flex items-center gap-10 border border-primary/5 shadow-premium">
                      <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-primary shadow-xl border border-primary/5 p-1 overflow-hidden relative group">
                         <User className="w-12 h-12 opacity-10" />
                         <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-60 flex items-center justify-center text-white transition-all cursor-pointer"><Settings className="w-6 h-6" /></div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-2xl font-sans font-black text-primary">{currentUser.name}</p>
                         <p className="text-xs font-black text-primary/40 uppercase tracking-widest">{currentUser.restaurantName}</p>
                         <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-2">정식 파트너 인증 사장님</p>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/20 px-4">계정 연동 정보</p>
                      <div className="grid grid-cols-1 gap-4">
                         <div className="flex justify-between items-center p-8 bg-surface-bright rounded-[2.5rem] border border-primary/5">
                            <div className="flex items-center gap-5">
                               <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm"><Mail className="w-5 h-5 text-primary/40" /></div>
                               <span className="text-sm font-black text-primary/60">기본 이메일 로그인</span>
                            </div>
                            <span className="text-[9px] font-black text-primary bg-primary/5 px-4 py-2 rounded-full uppercase tracking-widest">사용 중</span>
                         </div>
                         
                         {['google', 'kakao'].map(provider => (
                           <button 
                             key={provider}
                             onClick={() => !currentUser.linkedProviders?.includes(provider as any) && linkSocialAccount(provider as any)}
                             className={`flex justify-between items-center p-8 rounded-[2.5rem] border transition-all ${currentUser.linkedProviders?.includes(provider as any) ? 'bg-white border-primary/10 shadow-sm' : 'bg-surface-bright border-transparent hover:border-primary/20'}`}
                           >
                              <div className="flex items-center gap-5">
                                 <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm"><Globe className="w-5 h-5 text-primary/40" /></div>
                                 <span className="text-sm font-black capitalize text-primary/60">{provider} 연동</span>
                              </div>
                              {currentUser.linkedProviders?.includes(provider as any) ? (
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full uppercase tracking-widest">연동됨</span>
                              ) : (
                                <span className="text-[10px] font-black text-primary/20 uppercase tracking-widest">연동하기</span>
                              )}
                           </button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="pt-10 border-t border-primary/5 flex flex-col gap-4">
                   <button 
                     onClick={handleLogout}
                     className="w-full py-6 text-primary font-black uppercase tracking-[0.5em] text-[11px] flex items-center justify-center gap-4 hover:bg-primary/5 rounded-[2rem] transition-all"
                   >
                      <LogOut className="w-5 h-5 opacity-30" /> 시스템 로그아웃
                   </button>
                   <button 
                     onClick={() => setIsDeletingAccount(true)}
                     className="w-full py-4 text-burgundy/20 font-black uppercase tracking-[0.5em] text-[9px] hover:text-burgundy transition-colors"
                   >
                      계정 탈퇴 (영구 삭제)
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
