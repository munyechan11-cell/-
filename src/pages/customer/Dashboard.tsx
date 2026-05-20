import React, { useState, useEffect } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits, getTierCustomName, showToast, calculateRFMValue, getRFMCluster, calculateDistance } from '../../store';
import {
  LogOut, Ticket, Award, Calendar, X, ArrowLeft,
  LogOut as LeaveIcon, MessageSquare, Bell, Edit3,
  Send, Loader2, Star, ShieldCheck, Heart,
  TrendingUp, Clock, MapPin, Search, Filter,
  ChevronRight, Activity, Zap, Store as StoreIcon,
  ArrowUpRight, QrCode, User, Settings as SettingsIcon,
  ShieldAlert, Trash2, Mail, History, Leaf, Coins,
  Sparkles, Trophy, Globe, Wifi, WifiOff, Utensils,
  Camera as CameraIcon, ShieldOff, Image as ImageIcon
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';
import Skeleton, { CustomerCardSkeleton } from '../../components/Skeleton';
import OrderingSystem from '../../components/OrderingSystem';
import PhotoCaptureModal from '../../components/PhotoCaptureModal';

export default function CustomerDashboard() {
  const { 
    isReady = false, 
    currentUser = null, 
    visits = [], 
    coupons = [], 
    users = [], 
    tables = [], 
    logout = () => {}, 
    leaveTable = () => {}, 
    communications = [], 
    tierOverrides = [], 
    requestCouponUse = () => {}, 
    cancelCouponRequest = () => {}, 
    updateUserMemo = () => {}, 
    recordCommunication = async () => {}, 
    firebaseStatus = 'offline',
    orders = [],
    photos = [],
    addPhoto = async () => {},
    updatePhoto = async () => {}
  } = useStore();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [cancelingCoupon, setCancelingCoupon] = useState<string | null>(null);
  const [editingMemo, setEditingMemo] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showReviewReward, setShowReviewReward] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<'welcome' | 'tutorial' | null>(null);
  const [tutorialPage, setTutorialPage] = useState(0);
  const [isLocationAllowed, setIsLocationAllowed] = useState<boolean | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distanceAway, setDistanceAway] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'coupon'>('home');
  const [reviewingPhoto, setReviewingPhoto] = useState<any | null>(null);
  const [snsConsent, setSnsConsent] = useState<boolean | null>(null);
  const [showCustomerPhotoModal, setShowCustomerPhotoModal] = useState(false);
  const [pendingMenuPhotoId, setPendingMenuPhotoId] = useState<string | null>(null);
  const { linkSocialAccount, deleteAccount } = useStore();

  useEffect(() => {
    if (storeId) {
      setShowOnboarding(true);
      setTutorialStep('welcome');
    }
  }, [storeId]);

  useEffect(() => {
    if (currentUser && storeId && currentUser.storeId !== storeId) {
      logout();
      navigate(`/customer/store/${storeId}/login${window.location.search}`);
    }
  }, [currentUser, storeId, logout, navigate]);

  useEffect(() => {
    // Show review prompt for frequent visitors who haven't seen it recently
    const hasLastVisitToday = (visits || []).some(v => v.customerId === currentUser?.id && new Date(v.date).toDateString() === new Date().toDateString());
    if (hasLastVisitToday && Math.random() > 0.7) {
       const timer = setTimeout(() => setShowReviewReward(true), 2000);
       return () => clearTimeout(timer);
    }
  }, [visits, currentUser]);

  const owner = (users || []).find(u => u.id === storeId && u.role === 'owner');

  // 내게 도착한 메뉴 사진 (사장님이 서빙 시 촬영)
  const myMenuPhotos = (photos || [])
    .filter((p: any) => p.type === 'menu'
                     && p.storeId === storeId
                     && p.customerId === currentUser?.id)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pendingMenuPhotos = myMenuPhotos.filter((p: any) => p.snsConsent === undefined || p.snsConsent === false);

  // --- GEOFENCING PROTECTION LOGIC ---
  useEffect(() => {
    if (owner?.storeConfig?.locationAccessOnly && owner.lat && owner.lng) {
      if (!navigator.geolocation) {
        setLocationError('브라우저가 위치 정보를 지원하지 않습니다.');
        setIsLocationAllowed(false);
        return;
      }

      const checkLocation = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, owner.lat!, owner.lng!);
            const radius = owner.storeConfig?.allowedRadius || 50;
            setDistanceAway(Math.round(dist));
            setIsLocationAllowed(dist <= radius);
          },
          (err) => {
            console.error('Location error:', err);
            if (err.code === 1) setLocationError('위치 권한을 허용해 주세요.');
            else setLocationError('위치 정보를 가져올 수 없습니다.');
            setIsLocationAllowed(false);
          },
          { enableHighAccuracy: true }
        );
      };

      checkLocation();
      const interval = setInterval(checkLocation, 30000); // Check every 30s
      return () => clearInterval(interval);
    } else {
      setIsLocationAllowed(true);
    }
  }, [owner, calculateDistance]);

  if (!currentUser || currentUser.storeId !== storeId) {
    return (
      <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary/20 mx-auto mb-6"><Loader2 className="w-10 h-10 animate-spin" /></div>
        <h3 className="text-xl font-serif font-black text-primary italic mb-2">세션 확인 중...</h3>
        <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em] mb-8">로그인 정보를 확인하고 있습니다</p>
        <button onClick={() => navigate(`/customer/store/${storeId}/login`)} className="px-8 py-4 bg-primary text-white rounded-2xl text-sm font-black">로그인 화면으로 이동</button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-surface-bright p-8 space-y-12 max-w-md mx-auto">
        <div className="flex justify-between items-center py-4">
           <Skeleton width={120} height={40} />
           <Skeleton variant="circle" width={48} height={48} />
        </div>
        <Skeleton height={256} className="rounded-[3rem]" />
        <div className="grid grid-cols-2 gap-6">
           <Skeleton height={160} />
           <Skeleton height={160} />
        </div>
        <div className="space-y-6">
           <Skeleton width={100} height={20} />
           <Skeleton height={80} />
           <Skeleton height={80} />
        </div>
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary/20 mx-auto mb-6"><Loader2 className="w-10 h-10 animate-spin" /></div>
        <h3 className="text-xl font-serif font-black text-primary italic mb-2">매장 정보 로딩 중...</h3>
        <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em] mb-8">데이터베이스에서 매장 정보를 불러오고 있습니다</p>
      </div>
    );
  }

  const restaurantName = owner.restaurantName || '단골 매장';
  const myVisits = (visits || []).filter(v => v.customerId === currentUser.id && v.storeId === storeId);
  const myCoupons = (coupons || []).filter(c => c.customerId === currentUser.id && c.storeId === storeId && (c.status === 'available' || c.status === 'pending'));
  const myCommunications = (communications || []).filter(c => c.customerId === currentUser.id && c.storeId === storeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const currentTable = (tables || []).find(t => t.currentCustomerId === currentUser.id && t.storeId === storeId);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentVisits = myVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
  const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;
  
  const override = (tierOverrides || []).find(t => t.customerId === currentUser.id && t.storeId === storeId);
  const currentTier = getEffectiveTier(uniqueVisitDays, override?.tier);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLeaveStore = () => {
    if (currentTable && storeId) {
      leaveTable(currentTable.number, storeId);
      navigate('/scan');
    }
  };

  const rfm = calculateRFMValue(myVisits, currentUser.id, storeId!);
  const cluster = getRFMCluster(rfm.r, rfm.f, rfm.m);
  const activeCoupon = myCoupons.find(c => c.id === selectedCoupon);

  // --- LOCATION BLOCKING OVERLAY ---
  if (isLocationAllowed === false) {
    return (
      <div className="min-h-screen bg-sidebar-bg flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gyeol-pattern opacity-10"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 space-y-12 max-w-sm"
        >
           <div className="relative">
              <div className="absolute inset-0 bg-burgundy/20 rounded-full blur-3xl animate-pulse"></div>
              <div className="w-24 h-24 bg-burgundy/10 rounded-[2.5rem] flex items-center justify-center text-burgundy mx-auto relative border border-burgundy/20">
                 <ShieldAlert className="w-12 h-12" />
              </div>
           </div>
           
           <div className="space-y-4">
              <h2 className="text-3xl font-serif font-black text-white italic">접근이 제한되었습니다</h2>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed px-4">
                {locationError ? locationError : `${owner.restaurantName}의 보안 정책에 따라 매장 근처(50m)에서만 서비스 이용이 가능합니다.`}
              </p>
           </div>

           {distanceAway !== null && (
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
                 <p className="text-[9px] font-black text-gold uppercase tracking-widest mb-1">현재 내 위치와 매장의 거리</p>
                 <p className="text-2xl font-serif font-black text-white italic">약 {distanceAway}m 떨어짐</p>
              </div>
           )}

           <button 
             onClick={() => window.location.reload()}
             className="w-full py-6 bg-white text-primary rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] shadow-premium active:scale-95 transition-all"
           >
             새로고침하여 다시 확인
           </button>
           
           <button 
             onClick={handleLogout}
             className="text-white/20 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
           >
             다른 매장으로 이동하기
           </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-surface-bright text-on-surface font-sans selection:bg-primary/10 flex flex-col items-center overflow-x-hidden"
    >
      <div className="w-full max-w-md min-h-screen flex flex-col relative pb-40">
        
        {/* Elite Header */}
        <header className="px-8 pb-8 pt-[calc(env(safe-area-inset-top)+2rem)] flex justify-between items-center bg-surface-bright/80 backdrop-blur-xl sticky top-0 z-40 border-b border-primary/5">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-gyeol-wood flex items-center justify-center text-white font-serif italic text-2xl shadow-premium">결</div>
             <div>
                <h1 className="font-serif font-black text-xl italic tracking-tight text-primary">{restaurantName}</h1>
                <div className="flex items-center gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${firebaseStatus === 'stable' ? 'bg-emerald-500' : 'bg-primary'} animate-pulse shadow-sm`}></div>
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 leading-none">
                      {firebaseStatus === 'stable' ? 'Connected' : 'Offline Mode'}
                   </p>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-3">
             {firebaseStatus !== 'stable' && <WifiOff className="w-4 h-4 text-burgundy opacity-40 mr-2" />}
             <motion.button 
               whileTap={{ scale: 0.9 }}
               onClick={() => setIsSettingsOpen(true)} 
               className="p-3 bg-white rounded-2xl text-primary/30 border border-primary/5 shadow-sm hover:text-primary transition-all"
             >
               <SettingsIcon className="w-5 h-5" />
             </motion.button>
          </div>
        </header>

        {/* Concierge Welcome Note - Proactive Intelligence */}
        <div className="px-8 mb-10">
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-sidebar-bg border border-white/10 rounded-[3rem] p-10 relative overflow-hidden group shadow-heavy"
           >
              <div className="absolute inset-0 bg-gyeol-pattern opacity-10"></div>
              <div className="relative z-10 flex flex-col gap-6">
                 <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse shadow-[0_0_15px_rgba(198,163,79,0.8)]"></div>
                       <p className="text-[10px] font-black text-gold uppercase tracking-[0.5em]">{cluster.name} Concierge</p>
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-serif font-black italic text-white tracking-tight leading-[1.2]">
                       {cluster.id === 'vip' ? `${currentUser.name}님은 이 매장의 상징적인 존재입니다.` : 
                        cluster.id === 'whale' ? `${currentUser.name}님, 오늘 특별한 큰손 대우를 약속합니다.` :
                        cluster.id === 'new' ? `환영합니다 ${currentUser.name}님! 첫 인연을 소중히 모시겠습니다.` :
                        `${currentUser.name}님을 위한 ‘결’의 맞춤형 서비스가 준비되었습니다.`}
                    </h3>
                    
                    {/* Proactive Tip */}
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
                       <div className="flex items-center gap-3 mb-2">
                          <Zap className="w-3.5 h-3.5 text-gold" />
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Smart Activity Tip</p>
                       </div>
                       <p className="text-[11px] font-medium text-white/80 leading-relaxed">
                          {cluster.id === 'slipping' ? '오랜만에 뵙네요! 오늘은 따뜻한 차 한 잔 어떠세요?' :
                           cluster.id === 'new' ? '첫 방문 기념 웰컴 쿠폰 보관함을 꼭 확인해 보세요.' :
                           '사장님이 오늘 신선한 재료가 준비되었다고 전하셨습니다.'}
                       </p>
                    </div>
                 </div>

                 {/* Road to Royal Progress Overlay */}
                 <div className="pt-2">
                    <div className="flex justify-between items-end mb-3">
                       <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Membership Path</p>
                       <p className="text-[10px] font-black text-gold uppercase tracking-tighter">
                          {currentTier === 'gold' ? 'ROYAL STATUS' : 
                           `${getNextTierVisits(uniqueVisitDays)?.remaining} more to next rank`}
                       </p>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${(uniqueVisitDays / (getNextTierVisits(uniqueVisitDays)?.total || uniqueVisitDays)) * 100}%` }}
                         className={`h-full rounded-full ${currentTier === 'gold' ? 'bg-gold shadow-[0_0_15px_rgba(198,163,79,0.5)]' : 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'}`}
                       />
                    </div>
                 </div>
              </div>
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-gold/5 rounded-full blur-[60px]"></div>
           </motion.div>
        </div>

        {/* Content Flow */}
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          {activeTab === 'home' && (
            <div className="px-6 lg:px-12 pt-10 space-y-16 pb-32">

               {/* 메뉴 사진 알림 — 사장님이 서빙한 사진을 손님이 확인 + SNS 동의 */}
               {myMenuPhotos.length > 0 && (
                 <section className="space-y-3">
                   <div className="flex items-center justify-between px-2">
                     <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">
                       <CameraIcon className="w-3.5 h-3.5 inline mr-2 -mt-0.5" />
                       매장에서 보내온 사진
                     </h3>
                     {pendingMenuPhotos.length > 0 && (
                       <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-burgundy/10 text-burgundy border border-burgundy/20">
                         확인 필요 {pendingMenuPhotos.length}
                       </span>
                     )}
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     {myMenuPhotos.slice(0, 4).map((p: any) => (
                       <button
                         key={p.id}
                         onClick={() => { setReviewingPhoto(p); setSnsConsent(p.snsConsent ?? null); }}
                         className="group relative aspect-square bg-white rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-premium transition-all border border-primary/5 text-left"
                       >
                         <img src={p.imageData} alt={p.menuName || ''} className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
                         <div className="absolute top-2 left-2">
                           {p.snsConsent ? (
                             <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-gold/90 text-white backdrop-blur-md flex items-center gap-1">
                               <ShieldCheck className="w-2.5 h-2.5" /> 동의 완료
                             </span>
                           ) : (
                             <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-burgundy/90 text-white backdrop-blur-md animate-pulse">
                               확인 필요
                             </span>
                           )}
                         </div>
                         <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
                           {p.menuName && <p className="text-[11px] font-black truncate">{p.menuName}</p>}
                           <p className="text-[9px] font-bold opacity-70">
                             {new Date(p.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                           </p>
                         </div>
                       </button>
                     ))}
                   </div>
                 </section>
               )}

               {/* Identity Section: The Status Symbol */}
               <section className="relative perspective-1000 group/card">
                  <motion.div 
                    whileHover={{ rotateY: 5, rotateX: -5 }}
                    onMouseMove={(e) => {
                       const card = e.currentTarget;
                       const rect = card.getBoundingClientRect();
                       const x = e.clientX - rect.left;
                       const y = e.clientY - rect.top;
                       card.style.setProperty('--mouse-x', `${x}px`);
                       card.style.setProperty('--mouse-y', `${y}px`);
                    }}
                    className="relative h-[22rem] w-full rounded-[3.5rem] bg-[#1c1412] p-12 text-white shadow-premium overflow-hidden border border-white/10 flex flex-col justify-between transition-all duration-300"
                  >
                     {/* Dynamic Reflection Layer */}
                     <div className="absolute inset-0 opacity-0 group-hover/card:opacity-30 pointer-events-none transition-opacity duration-500 bg-[radial-gradient(circle_at_var(--mouse-x)_var(--mouse-y),rgba(198,163,79,0.4),transparent_40%)]"></div>
                     <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 opacity-50"></div>
                     
                     <div className="relative z-10 flex flex-col h-full justify-between">
                        {/* Tier-based Holographic Glow */}
                        {currentTier === 'gold' && <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold/20 rounded-full blur-[80px] animate-pulse"></div>}
                        {currentTier === 'silver' && <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-[80px] animate-pulse"></div>}

                        <div className="flex justify-between items-start">
                           <div className="flex gap-6 items-center">
                              <div className="w-20 h-20 rounded-[2rem] bg-white/10 border border-white/20 p-1 flex items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
                                 {currentUser.avatarUrl ? (
                                    <img src={currentUser.avatarUrl} className="w-full h-full object-cover" alt="" />
                                 ) : (
                                    <User className="w-10 h-10 text-white/40" />
                                 )}
                              </div>
                              <div>
                                 <h2 className="text-2xl font-serif font-black italic tracking-tight leading-tight">{currentUser.name}</h2>
                                 <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.4em] mt-1">
                                   {currentTier === 'gold' ? 'Royal Legend' : currentTier === 'silver' ? 'Elite Member' : 'Welcome Star'}
                                 </p>
                              </div>
                           </div>
                           <div className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl ${getTierColor(currentTier)} border border-white/20 backdrop-blur-lg`}>
                              {getTierCustomName(currentTier, owner?.tierNames)}
                           </div>
                        </div>

                        <div className="space-y-6 pt-8 border-t border-white/10">
                           <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                              <span className="flex items-center gap-2 text-gold/80"><Sparkles className="w-3 h-3 text-gold" /> 멤버십 정체성</span>
                              {getNextTierVisits(uniqueVisitDays) ? (
                                 <span className="text-white/60">NEXT: {getTierCustomName(getNextTierVisits(uniqueVisitDays)!.next, owner?.tierNames)}까지 {getNextTierVisits(uniqueVisitDays)?.remaining}회</span>
                              ) : (
                                 <span className="flex items-center gap-2 text-gold"><Trophy className="w-3 h-3" /> MASTER STATUS</span>
                              )}
                           </div>
                           
                           <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: getNextTierVisits(uniqueVisitDays) 
                                    ? `${(uniqueVisitDays / getNextTierVisits(uniqueVisitDays)!.total) * 100}%` 
                                    : '100%' 
                                }}
                                className={`h-full rounded-full ${currentTier === 'gold' ? 'bg-gold shadow-[0_0_20px_rgba(198,163,79,0.8)]' : 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'}`}
                              />
                           </div>
                           
                           <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                 <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Monthly Influence</p>
                                 <p className="text-4xl font-serif font-black italic leading-none">{myVisits.length}<span className="text-[12px] ml-2 opacity-30 uppercase font-sans not-italic tracking-[0.2em]">Visits</span></p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/20 italic font-sans">#ST_{currentUser.id.slice(0, 8).toUpperCase()}</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               </section>

               {/* Table Active Session HUD */}
               {currentTable ? (
                 <motion.div 
                   initial={{ scale: 0.95, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   className="bg-primary/5 border border-primary/20 rounded-[3rem] p-8 lg:p-10 flex justify-between items-center relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-2 h-full bg-primary/20"></div>
                    <div className="flex items-center gap-8">
                       <div className="relative">
                         <div className="absolute inset-0 bg-primary/20 rounded-3xl animate-ping opacity-40"></div>
                         <div className="w-16 h-16 bg-primary rounded-[1.5rem] flex items-center justify-center text-white shadow-xl relative z-10"><MapPin className="w-7 h-7" /></div>
                       </div>
                       <div>
                          <div className="flex items-center gap-3 mb-2">
                             <span className="text-[9px] lg:text-[10px] font-black uppercase text-primary tracking-[0.2em] opacity-60 whitespace-nowrap">현재 이용 중</span>
                             <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                          </div>
                          <p className="text-3xl font-serif font-black text-primary italic leading-none">{currentTable.number}번 테이블</p>
                       </div>
                    </div>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={handleLeaveStore} 
                      className="p-5 bg-white rounded-2xl text-burgundy shadow-sm border border-burgundy/10 hover:bg-burgundy hover:text-white transition-all group"
                    >
                      <LeaveIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                    </motion.button>
                 </motion.div>
               ) : (
                 <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate('/scan')}
                    className="bg-surface-container rounded-[3rem] p-12 text-center border-2 border-dashed border-primary/10 cursor-pointer hover:border-primary/30 transition-all group"
                 >
                    <div className="w-20 h-20 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary/20 mx-auto mb-6 group-hover:bg-primary group-hover:text-white transition-all">
                      <QrCode className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-serif font-black text-primary italic mb-2">테이블 연동이 필요합니다</h3>
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">이곳을 터치하거나 하단의 QR 스캐너를 실행하세요</p>
                 </motion.div>
               )}

                {/* ═══ ORDER STATUS TRACKING ═══ */}
                {(() => {
                  const myOrders = (orders || []).filter((o: any) => o.customerId === currentUser.id && o.storeId === storeId && o.status !== 'served' && o.status !== 'cancelled');
                  if (myOrders.length === 0) return null;
                  const statusSteps = ['pending', 'accepted', 'cooking', 'served'] as const;
                  const statusLabels: Record<string, string> = { pending: '접수 대기', accepted: '확인 완료', cooking: '조리 중', served: '서빙 완료' };
                  return myOrders.map((order: any) => {
                    const currentStepIdx = statusSteps.indexOf(order.status);
                    return (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[3rem] p-8 border border-gold/20 shadow-premium"
                      >
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Utensils className="w-5 h-5" /></div>
                            <div>
                              <p className="text-sm font-black text-primary">내 주문 현황</p>
                              <p className="text-[9px] font-bold text-primary/30">{order.items.map((i: any) => i.name).join(', ')}</p>
                            </div>
                          </div>
                          <p className="text-lg font-serif font-black italic text-primary">₩{order.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusSteps.map((step, idx) => (
                            <div key={step} className={`flex-1 h-2 rounded-full transition-all ${idx <= currentStepIdx ? 'bg-gold shadow-[0_0_8px_rgba(198,163,79,0.4)]' : 'bg-primary/5'}`} />
                          ))}
                        </div>
                        <div className="flex justify-between mt-3">
                          {statusSteps.map((step, idx) => (
                            <span key={step} className={`text-[8px] font-black uppercase tracking-widest ${idx <= currentStepIdx ? 'text-gold' : 'text-primary/15'}`}>{statusLabels[step]}</span>
                          ))}
                        </div>
                      </motion.div>
                    );
                  });
                })()}

               {/* Chronicles: Visit History */}
               <section className="space-y-8 pb-10">
                  <div className="flex items-center gap-4 px-4">
                     <History className="w-6 h-6 text-primary opacity-30" />
                     <h3 className="font-serif font-black text-xl italic text-primary uppercase tracking-tight">방문의 기록</h3>
                  </div>
                  
                  {myVisits.length === 0 ? (
                     <div className="bg-white py-20 rounded-[4rem] border border-dashed border-primary/10 text-center">
                        <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.3em]">역사가 시작되기를 기다립니다.</p>
                     </div>
                  ) : (
                     <div className="bg-white rounded-[3.5rem] border border-primary/5 overflow-hidden shadow-premium">
                        {myVisits.slice(0, 5).map((visit, idx) => (
                           <div key={visit.id} className={`p-8 flex justify-between items-center ${idx !== 0 ? 'border-t border-primary/5' : ''} hover:bg-primary/[0.01] transition-colors`}>
                              <div className="flex items-center gap-6">
                                 <div className="w-12 h-12 rounded-2xl bg-surface-bright flex items-center justify-center text-primary/30 border border-primary/5 shadow-inner"><Clock className="w-6 h-6" /></div>
                                 <div>
                                    <p className="text-base font-black text-primary italic mb-0.5">{new Date(visit.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
                                    <p className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">{visit.tableNumber}번 테이블 (오후 {new Date(visit.date).getHours()}:{new Date(visit.date).getMinutes() < 10 ? '0' : ''}{new Date(visit.date).getMinutes()})</p>
                                 </div>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-[11px] font-black text-primary/30 italic ring-1 ring-primary/10">#{myVisits.length - idx}</div>
                           </div>
                        ))}
                        <button className="w-full py-6 bg-surface-bright/50 text-center block border-t border-primary/5 group transition-all">
                           <p className="text-[10px] font-black uppercase text-primary/20 tracking-[0.3em] group-hover:text-primary group-hover:tracking-[0.4em] transition-all">지난 기록 보기</p>
                        </button>
                     </div>
                  )}
               </section>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="h-full">
              <OrderingSystem storeId={storeId!} tableNumber={currentTable?.number || 0} />
            </div>
          )}

          {activeTab === 'coupon' && (
            <div className="px-6 lg:px-12 pt-10 pb-32 space-y-10">
               <div className="flex items-center gap-4 px-2">
                  <Ticket className="w-6 h-6 text-gold" />
                  <h3 className="font-serif font-black text-xl italic text-primary">나의 특권</h3>
                  <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest">{myCoupons.length}장 보유</span>
               </div>

               {myCoupons.length === 0 ? (
                  <div className="bg-white py-20 rounded-[4rem] border border-dashed border-primary/10 text-center">
                     <div className="w-16 h-16 bg-gold/5 rounded-[2rem] flex items-center justify-center text-gold/30 mx-auto mb-6"><Ticket className="w-8 h-8" /></div>
                     <p className="text-[11px] font-black text-primary/30 uppercase tracking-[0.3em]">아직 보유한 쿠폰이 없습니다</p>
                     <p className="text-[10px] text-primary/20 mt-2">방문 횟수에 따라 자동으로 쿠폰이 발행됩니다</p>
                  </div>
               ) : (
                  <div className="space-y-4">
                     {myCoupons.map((coupon) => (
                        <motion.div
                          key={coupon.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-white rounded-[3rem] p-8 border shadow-premium relative overflow-hidden ${
                            coupon.status === 'pending' ? 'border-gold/30' : 'border-primary/5'
                          }`}
                        >
                           {coupon.status === 'pending' && <div className="absolute top-0 left-0 right-0 h-1 bg-gold animate-pulse" />}
                           <div className="flex justify-between items-center">
                              <div className="flex items-center gap-5">
                                 <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg ${
                                   coupon.status === 'pending' ? 'bg-gold' : 'bg-primary'
                                 }`}>
                                    <Ticket className="w-7 h-7" />
                                 </div>
                                 <div>
                                    <p className="text-base font-black text-primary mb-1">{coupon.description || '특별 혜택 쿠폰'}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary/30">
                                      {coupon.status === 'pending' ? '사장님 승인 대기 중...' : '사용 가능'}
                                    </p>
                                 </div>
                              </div>
                              {coupon.status === 'available' ? (
                                 <button
                                   onClick={() => setSelectedCoupon(coupon.id)}
                                   className="px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                                 >사용하기</button>
                              ) : coupon.status === 'pending' ? (
                                 <button
                                   onClick={() => { cancelCouponRequest(coupon.id); setCancelingCoupon(null); }}
                                   className="px-6 py-3 bg-burgundy/10 text-burgundy rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-burgundy hover:text-white transition-all"
                                 >취소</button>
                              ) : null}
                           </div>
                        </motion.div>
                     ))}
                  </div>
               )}
            </div>
          )}
        </div>

        {/* Floating Bottom Navigator - Premium Tab-based Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-primary/5 px-8 pt-4 pb-10 z-[100] flex justify-between items-center safe-area-bottom">
           {[
             { id: 'home', icon: Heart, label: '단골홈' },
             { id: 'menu', icon: Utensils, label: '메뉴판' },
             { id: 'coupon', icon: Ticket, label: '특권쿠폰' },
             { id: 'settings', icon: SettingsIcon, label: '나의정보', onClick: () => setIsSettingsOpen(true) }
           ].map((tab) => (
             <button 
               key={tab.id}
               onClick={() => tab.onClick ? tab.onClick() : setActiveTab(tab.id as any)}
               className={`flex flex-col items-center gap-2 transition-all ${activeTab === tab.id ? 'text-primary scale-110' : 'text-primary/20 hover:text-primary/40'}`}
             >
                <div className={`p-4 rounded-3xl transition-all ${activeTab === tab.id ? 'bg-primary/5 shadow-premium' : ''}`}>
                  <tab.icon className="w-6 h-6" />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'opacity-100' : 'opacity-0 scale-0'}`}>{tab.label}</span>
             </button>
           ))}
        </nav>

        <div style={{display:'none'}} className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] bg-sidebar-bg/95 backdrop-blur-2xl px-12 py-7 rounded-[3rem] flex justify-between items-center z-50 shadow-3xl border border-white/10 ring-1 ring-white/5">
           <Link to={`/customer/store/${storeId}`} className="flex flex-col items-center gap-2 text-gold transition-all group">
              <Zap className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">홈</span>
           </Link>
           <motion.button 
             whileHover={{ scale: 1.1, y: -10 }}
             whileTap={{ scale: 0.9 }}
             onClick={() => navigate('/scan')} 
             className="w-24 h-24 -mt-24 bg-primary text-white rounded-[2.5rem] shadow-premium flex items-center justify-center border-[10px] border-surface-bright active:scale-95 transition-all outline-none"
           >
              <QrCode className="w-10 h-10" />
           </motion.button>
           <button onClick={() => setSendingMessage(true)} className="flex flex-col items-center gap-2 text-white/30 hover:text-white transition-all group">
              <div className="relative">
                <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
                {myCommunications.length > 0 && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full shadow-lg ring-2 ring-sidebar-bg"></div>}
              </div>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">메시지</span>
           </button>
        </div>

        {/* Cinematic Modals */}
        <AnimatePresence>
          {selectedCoupon && activeCoupon && (
            <div className="fixed inset-0 bg-primary/60 backdrop-blur-2xl flex items-center justify-center p-8 z-[100]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 30 }}
                className="bg-white rounded-[4rem] p-12 w-full max-w-sm text-center shadow-3xl border border-white/10"
              >
                 <div className="w-28 h-28 bg-primary rounded-[3rem] flex items-center justify-center text-white mx-auto mb-10 shadow-premium rotate-12 group overflow-hidden">
                    <Ticket className="w-14 h-14" />
                 </div>
                 <h3 className="text-2xl font-serif font-black text-primary italic mb-4">혜택 사용하기</h3>
                 <p className="text-sm text-on-surface-variant/60 leading-relaxed mb-10 px-6 italic">"{activeCoupon.description}" 혜택을 사용하시겠습니까? 사장님께 승인 요청이 실시간으로 전송됩니다.</p>
                 <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => {
                        if (currentTable) {
                           requestCouponUse(activeCoupon.id, currentTable.number);
                           setSelectedCoupon(null);
                        } else {
                           setSelectedCoupon(null);
                           showToast('테이블 연동이 필요합니다. QR을 먼저 스캔해 주세요.', 'error');
                        }
                      }}
                      className="w-full py-7 bg-primary text-white rounded-[2rem] font-bold uppercase tracking-widest text-[11px] shadow-3xl active:scale-95 transition-all outline-none"
                    >실시간 요청 전송</button>
                    <button onClick={() => setSelectedCoupon(null)} className="w-full py-5 text-[10px] font-black uppercase tracking-[0.5em] text-primary/20 hover:text-primary transition-all">다음 기회에</button>
                 </div>
              </motion.div>
            </div>
          )}

          {sendingMessage && (
            <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl flex items-end justify-center z-[100]">
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-white w-full max-w-md rounded-t-[5rem] p-14 shadow-3xl flex flex-col gap-12"
              >
                 <div className="flex justify-between items-center">
                    <div className="space-y-1">
                       <h3 className="text-3xl font-serif font-black text-primary italic tracking-tight">다이렉트 소통</h3>
                       <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em]">실시간 피드백 전송</p>
                    </div>
                    <button onClick={() => setSendingMessage(false)} className="p-4 bg-surface-container rounded-full hover:bg-primary/5 transition-colors outline-none"><X className="w-5 h-5 text-primary/20" /></button>
                 </div>
                 <textarea 
                   autoFocus
                   rows={6}
                   className="w-full bg-surface-container border-none rounded-[3rem] p-10 text-lg font-serif italic text-primary focus:ring-4 focus:ring-primary/10 resize-none shadow-inner"
                   placeholder="사장님께 전하고 싶은 특별한 메시지나 피드백을 남겨주세요..."
                   value={messageContent}
                   onChange={e => setMessageContent(e.target.value)}
                 />
                 <button 
                   onClick={async (e) => {
                     e.preventDefault();
                     if (!messageContent.trim() || isSending) return;
                     setIsSending(true);
                     try {
                       await recordCommunication(currentUser.id, storeId!, 'message', messageContent.trim(), 'customer');
                       setMessageContent('');
                       setSendingMessage(false);
                       showToast('정성이 담긴 피드백이 전송되었습니다.', 'success');
                     } catch (err) {
                       console.error(err);
                     } finally {
                       setIsSending(false);
                     }
                   }}
                   disabled={isSending || !messageContent.trim()}
                   className="w-full py-7 bg-primary text-white rounded-[2.5rem] font-bold uppercase tracking-widest text-[12px] disabled:opacity-30 shadow-3xl flex items-center justify-center gap-5 active:scale-[0.98] transition-all outline-none"
                 >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    피드백 전송하기
                 </button>
              </motion.div>
            </div>
          )}

          {showReviewReward && (
             <div className="fixed inset-0 bg-gold/20 backdrop-blur-xl flex items-center justify-center p-8 z-[150]">
                <motion.div 
                   initial={{ opacity: 0, scale: 0.9, y: 50 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.9, y: 50 }}
                   className="bg-sidebar-bg rounded-[4rem] p-14 text-white text-center shadow-premium relative overflow-hidden"
                >
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold via-white to-gold"></div>
                   <Sparkles className="w-12 h-12 text-gold mx-auto mb-8 animate-bounce" />
                   <h3 className="text-2xl font-serif font-black italic mb-4">리뷰 남기고 혜택 받기</h3>
                   <p className="text-sm text-white/60 mb-10 leading-relaxed px-4">
                      오늘의 경험을 리뷰로 남겨주시면 <span className="text-gold font-black">서비스 쿠폰</span>을 즉시 지급해 드립니다. 사장님께 로열티를 증명해 보세요!
                   </p>
                   <div className="flex flex-col gap-4">
                      <button 
                         onClick={() => {
                            showToast('리뷰 연동 기능은 준비 중입니다.', 'info');
                            setShowReviewReward(false);
                         }}
                         className="w-full py-7 bg-gold text-sidebar-bg rounded-[2rem] font-black uppercase tracking-widest text-[12px] shadow-2xl active:scale-95 transition-all"
                      >리뷰 남기고 선물 받기</button>
                      <button onClick={() => setShowReviewReward(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-white/30 italic">나중에 할게요</button>
                   </div>
                </motion.div>
             </div>
          )}
        </AnimatePresence>

        <MemoModal
          isOpen={editingMemo}
          onClose={() => setEditingMemo(false)}
          initialMemo={currentUser.memo || ''}
          onSave={memo => updateUserMemo(currentUser.id, storeId!, memo)}
        />

        {/* Elite Profile Settings */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 bg-primary/40 backdrop-blur-2xl z-[110] flex items-end sm:items-center justify-center p-0 sm:p-8">
               <motion.div 
                 initial={{ y: "100%" }}
                 animate={{ y: 0 }}
                 exit={{ y: "100%" }}
                 className="bg-white w-full max-w-md rounded-t-[5rem] sm:rounded-[5rem] p-14 shadow-3xl flex flex-col gap-12 max-h-[90vh] overflow-y-auto no-scrollbar"
               >
                  <div className="flex justify-between items-center">
                     <div>
                        <h3 className="text-2xl font-serif font-black text-primary italic tracking-tight">내 정보 관리</h3>
                        <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em]">프로필 및 보안 설정</p>
                     </div>
                     <button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-surface-container rounded-full hover:bg-primary/5 transition-colors outline-none"><X className="w-5 h-5 text-primary/20" /></button>
                  </div>

                  <div className="space-y-12">
                     <div className="bg-surface-container p-10 rounded-[3.5rem] flex items-center gap-8 border border-primary/5 shadow-inner">
                        <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-primary shadow-2xl p-1 overflow-hidden">
                           {currentUser.avatarUrl ? (
                             <img src={currentUser.avatarUrl} className="w-full h-full object-cover rounded-[1.5rem]" alt="" />
                           ) : (
                             <User className="w-12 h-12 opacity-20" />
                           )}
                        </div>
                        <div>
                           <p className="text-3xl font-sans font-black text-primary leading-tight mb-1">{currentUser.name}</p>
                           <p className="text-xs font-black text-primary/30 uppercase tracking-[0.2em]">{currentUser.phone || '디지털 본인 인증 완료'}</p>
                        </div>
                     </div>

                     <div className="space-y-8">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/20 px-4">소셜 계정 연동</p>
                        <div className="grid grid-cols-1 gap-5">
                           <div className="flex items-center justify-between p-8 bg-surface-bright border border-primary/10 rounded-[2.5rem] shadow-sm">
                              <div className="flex items-center gap-5">
                                 <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary/30"><Smartphone className="w-6 h-6" /></div>
                                 <span className="text-base font-sans font-black text-primary/80">기본 전화번호</span>
                              </div>
                              <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-5 py-2 rounded-full ring-1 ring-primary/20">활성화됨</span>
                           </div>
                           
                           {['google', 'kakao'].map(provider => (
                             <button 
                               key={provider}
                               onClick={async () => {
                                 if (currentUser.linkedProviders?.includes(provider as any)) return;
                                 try {
                                   await linkSocialAccount(provider as any);
                                 } catch (error: any) {
                                   showToast(error.message || 'Identity synchronization failed.', 'error');
                                 }
                               }}
                               className={`flex items-center justify-between p-8 rounded-[2.5rem] border transition-all ${currentUser.linkedProviders?.includes(provider as any) ? 'bg-white border-primary/10 shadow-sm' : 'bg-surface-container border-transparent hover:border-primary/20 hover:scale-[1.02] active:scale-[0.98]'}`}
                             >
                                 <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-white/50 rounded-2xl flex items-center justify-center text-primary/30 border border-primary/5">
                                       {provider === 'google' ? <Globe className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                                    </div>
                                    <span className="text-base font-black italic capitalize text-primary/60">{provider} 계정</span>
                                 </div>
                                 {currentUser.linkedProviders?.includes(provider as any) ? (
                                   <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-5 py-2 rounded-full ring-1 ring-emerald-200">
                                      <ShieldCheck className="w-3 h-3" />
                                      <span className="text-[10px] font-black uppercase">Verified</span>
                                   </div>
                                 ) : (
                                   <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em] group-hover:text-primary transition-colors italic">연동하기</span>
                                 )}
                             </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="pt-12 border-t border-primary/5 flex flex-col gap-6">
                     <button 
                       onClick={handleLogout}
                       className="w-full py-6 text-primary font-black uppercase tracking-[0.4em] text-[11px] flex items-center justify-center gap-4 hover:bg-primary/5 rounded-[2.5rem] transition-all"
                     >
                        <LogOut className="w-5 h-5 opacity-30" /> 로그아웃
                     </button>
                     <button 
                       onClick={() => setIsDeletingAccount(true)}
                       className="w-full py-4 text-burgundy/20 font-black uppercase tracking-[0.5em] text-[9px] hover:text-burgundy transition-colors"
                     >
                        Purge Digital Identity Permanently
                     </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Deletion Modal */}
        <AnimatePresence>
          {isDeletingAccount && (
            <div className="fixed inset-0 bg-burgundy/10 backdrop-blur-3xl z-[150] flex items-center justify-center p-10">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0, y: 50 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.9, opacity: 0, y: 50 }}
                 className="bg-white rounded-[5rem] p-16 w-full max-w-sm text-center shadow-3xl border border-burgundy/10"
               >
                  <div className="w-28 h-28 bg-burgundy/5 rounded-[3rem] flex items-center justify-center text-burgundy mx-auto mb-12 shadow-inner"><Trash2 className="w-14 h-14" /></div>
                  <h3 className="text-4xl font-sans font-black text-primary mb-6 tracking-tight">계정 탈퇴 확인</h3>
                  <p className="text-base text-on-surface-variant/60 leading-relaxed mb-14 px-4">모든 데이터가 영구적으로 파기되어 복구가 불가능합니다. 시스템에서의 영구 삭제를 승인하시겠습니까?</p>
                  <div className="flex flex-col gap-4">
                     <button 
                       onClick={() => {
                          deleteAccount();
                          setIsDeletingAccount(false);
                          setIsSettingsOpen(false);
                       }}
                       className="w-full py-8 bg-burgundy text-white rounded-[2rem] font-black uppercase tracking-widest text-[12px] shadow-3xl active:scale-95 transition-all outline-none"
                     >삭제 승인</button>
                     <button onClick={() => setIsDeletingAccount(false)} className="w-full py-5 text-[11px] font-black uppercase tracking-[0.5em] text-primary/20 outline-none">탈퇴 취소</button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Onboarding Welcome Overlay */}
        <AnimatePresence>
          {showOnboarding && tutorialStep === 'welcome' && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-primary/20 backdrop-blur-2xl">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[4rem] shadow-3xl text-center relative overflow-hidden flex flex-col items-center"
                style={{ maxHeight: '90vh', overflowY: 'auto' }}
              >
                 <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold via-white to-gold animate-shimmer z-10"></div>

                 {/* 첫 번째 사진: 테이블 리스트뷰 목업 (리스트 위) */}
                 <div className="w-full bg-[#1c1412] rounded-t-[4rem] overflow-hidden relative" style={{ height: '180px' }}>
                   <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(198,163,79,0.3) 0%, transparent 70%)' }}></div>
                   {/* 매장 현황 목업 */}
                   <div className="p-6 pt-8">
                     <p className="text-[8px] font-black text-gold/60 uppercase tracking-[0.4em] mb-3">실시간 매장 현황</p>
                     <div className="grid grid-cols-4 gap-1.5">
                       {[1,2,3,4,5,6,7,8].map(n => (
                         <div key={n} className={`rounded-xl p-2 text-center ${n === 2 || n === 5 ? 'bg-gold/30 border border-gold/40' : 'bg-white/10 border border-white/10'}`}>
                           <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-[8px] font-black ${n === 2 || n === 5 ? 'bg-gold text-primary' : 'bg-white/20 text-white/60'}`}>{n}</div>
                           <p className="text-[6px] font-black text-white/40">{n === 2 || n === 5 ? '이용중' : '없음'}</p>
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>

                 {/* 환영 텍스트 및 설명 */}
                 <div className="px-10 pt-8 pb-4">
                   <div className="w-16 h-16 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-6 relative mx-auto">
                     <Sparkles className="w-8 h-8 text-gold animate-pulse" />
                     <div className="absolute inset-0 bg-gold/10 rounded-full blur-2xl animate-pulse"></div>
                   </div>
                   <h2 className="text-2xl font-serif font-black italic text-primary mb-3 leading-tight">
                     환영합니다!<br/>{restaurantName}입니다.
                   </h2>
                   <p className="text-xs font-medium text-primary/40 mb-8 leading-relaxed text-center">
                     사장님이 정성껏 준비한 단골 서비스를<br/>
                     이제 '결'에서 스마트하게 관리해 보세요.
                   </p>
                 </div>

                 {/* 가이드 리스트 */}
                 <div className="w-full px-10 space-y-3 mb-6">
                   {[
                     { icon: QrCode, text: '테이블 QR로 즉시 입장' },
                     { icon: Ticket, text: '방문 시마다 포인트/스탬프 적립' },
                     { icon: Award, text: '등급별 특별한 단골 혜택' }
                   ].map((guide, i) => (
                     <div key={i} className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/5 text-left w-full">
                        <guide.icon className="w-5 h-5 text-primary/40 shrink-0" />
                        <span className="text-[11px] font-black text-primary/60 uppercase tracking-tight">{guide.text}</span>
                     </div>
                   ))}
                 </div>

                 {/* 2번째 사진: 메뉴 목업 (리스트 아래) */}
                 <div className="w-full mx-0 px-4 mb-3">
                   <div className="w-full bg-[#1c1412] rounded-[2rem] overflow-hidden relative" style={{ height: '110px' }}>
                     <div className="p-4 flex gap-3 items-stretch h-full">
                       <div className="text-left">
                         <p className="text-[7px] font-black text-gold/60 uppercase tracking-[0.3em] mb-2">고객가지 메뉴판</p>
                         <div className="flex gap-1.5">
                           {['VIP레전드', '유행선글', '이별', '잠재관주', '성기변민'].map((cat, i) => (
                             <div key={i} className={`rounded-xl px-2 py-3 flex flex-col items-center justify-end gap-1 text-center flex-shrink-0 ${i===0?'bg-yellow-700/80':i===1?'bg-blue-900/80':i===2?'bg-red-900/80':i===3?'bg-gray-700/80':'bg-gray-600/80'}`} style={{minWidth:36, height:62}}>
                               <p className="text-[8px] font-black text-white leading-none">{i===0?'1':`0`}</p>
                               <p className="text-[5px] font-black text-white/60 leading-tight">{cat}</p>
                             </div>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* 3번째 사진: KPI 목업 (리스트 아래) */}
                 <div className="w-full mx-0 px-4 mb-8">
                   <div className="w-full bg-white rounded-[2rem] overflow-hidden border border-primary/10" style={{ height: '100px' }}>
                     <div className="p-4">
                       <p className="text-[7px] font-black text-primary/30 uppercase tracking-[0.3em] mb-3">매장 성과 지표</p>
                       <div className="grid grid-cols-4 gap-2">
                         {[
                           { label: '매장 건강 지수', value: '100pt', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                           { label: '실시간 현황율', value: '0%', color: 'text-primary', bg: 'bg-surface-container' },
                           { label: '방문 일일 회전률', value: '2.4회', color: 'text-amber-600', bg: 'bg-amber-50' },
                           { label: '전문관리필요', value: '0명', color: 'text-primary', bg: 'bg-surface-container' },
                         ].map((kpi, i) => (
                           <div key={i} className={`${kpi.bg} rounded-xl p-2 text-center`}>
                             <p className="text-[5px] font-black text-primary/30 mb-1 uppercase leading-tight">{kpi.label}</p>
                             <p className={`text-[11px] font-black ${kpi.color}`}>{kpi.value}</p>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* 튜토리얼 시작 버튼 */}
                 <div className="w-full px-10 pb-10 space-y-3">
                   <button 
                     onClick={() => { setTutorialStep('tutorial'); setTutorialPage(0); }}
                     className="w-full py-6 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all outline-none"
                   >튜토리얼 시작하기</button>
                   <button 
                     onClick={() => { setShowOnboarding(false); setTutorialStep(null); }}
                     className="w-full py-3 text-primary/30 font-black text-[10px] uppercase tracking-[0.4em] transition-all"
                   >건너뛰기</button>
                 </div>
              </motion.div>
              
              {/* Confetti-like background elements */}
              {[...Array(6)].map((_, i) => (
                 <motion.div
                   key={i}
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 0.1, y: [0, -100, 0], x: [0, i % 2 === 0 ? 50 : -50, 0] }}
                   transition={{ repeat: Infinity, duration: 3 + i, delay: i * 0.5 }}
                   className="absolute w-2 h-2 bg-gold rounded-full"
                   style={{ left: `${15 + i * 15}%`, top: '80%' }}
                 />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Tutorial Step Overlay */}
        <AnimatePresence>
          {showOnboarding && tutorialStep === 'tutorial' && (() => {
            const TUTORIAL_STEPS = [
              {
                step: 1,
                title: 'QR 스캔으로 입장하기',
                desc: '매장에 도착하면 테이블의 QR 코드를 스캔해 주세요. 자동으로 테이블에 연결되고 카운터가 시작됩니다.',
                illustration: (
                  <div className="w-full bg-[#1c1412] rounded-[2rem] overflow-hidden relative flex flex-col items-center justify-center" style={{ height: 200 }}>
                    <div className="absolute inset-0 opacity-10 bg-gradient-radial from-gold to-transparent"></div>
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <div className="w-28 h-28 border-4 border-gold/60 rounded-3xl flex items-center justify-center relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-gold rounded-tl-xl -translate-x-1 -translate-y-1"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-gold rounded-tr-xl translate-x-1 -translate-y-1"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-gold rounded-bl-xl -translate-x-1 translate-y-1"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-gold rounded-br-xl translate-x-1 translate-y-1"></div>
                        <QrCode className="w-12 h-12 text-gold" />
                      </div>
                      <p className="text-[10px] font-black text-gold/70 uppercase tracking-[0.3em]">QR 스캔 중...</p>
                    </div>
                  </div>
                ),
                hint: '📱 화면 하단의 QR 버튼을 누르면 테이블 연동이 가능합니다'
              },
              {
                step: 2,
                title: '멤버십 카드 & 방문 기록',
                desc: '방문할 때마다 자动으로 기록됩니다. 단골 등급이 올라갈수록 더 많은 특별 혜택을 받을 수 있어요.',
                illustration: (
                  <div className="w-full bg-[#1c1412] rounded-[2rem] overflow-hidden relative" style={{ height: 200 }}>
                    <div className="p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                          <User className="w-6 h-6 text-white/40" />
                        </div>
                        <div>
                          <p className="text-white font-black text-sm">단골 회원</p>
                          <p className="text-[9px] font-black text-gold/70 uppercase tracking-widest">GOLD MEMBER</p>
                        </div>
                        <div className="ml-auto px-4 py-2 bg-gold/30 rounded-xl border border-gold/50">
                          <span className="text-[9px] font-black text-gold uppercase">GOLD</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gold rounded-full shadow-[0_0_10px_rgba(198,163,79,0.5)]"></div>
                      </div>
                      <div className="flex justify-between">
                        <div className="text-center">
                          <p className="text-[8px] font-black text-white/30 uppercase mb-1">총 방문</p>
                          <p className="text-2xl font-black text-white italic font-serif">12<span className="text-[10px] ml-1 opacity-30">회</span></p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-black text-white/30 uppercase mb-1">다음 등급까지</p>
                          <p className="text-2xl font-black text-gold italic font-serif">3<span className="text-[10px] ml-1 opacity-70">회</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
                hint: '⭐ 브론즈 → 실버 → 골드 순으로 등급이 올라갑니다'
              },
              {
                step: 3,
                title: '사장님 특별 혜택 받기',
                desc: '쿠폰함에 적립된 쿠폰을 사용하거나, 사장님께 직접 메시지를 보낼 수 있습니다. 단골일수록 더 특별한 관계가 만들어집니다.',
                illustration: (
                  <div className="w-full rounded-[2rem] overflow-hidden relative" style={{ height: 200 }}>
                    <div className="p-5 grid grid-cols-2 gap-3 h-full">
                      <div className="bg-primary rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-lg">
                        <Ticket className="w-8 h-8 text-white" />
                        <p className="text-[8px] font-black text-white uppercase tracking-widest">쿠폰함</p>
                        <div className="bg-white/20 px-3 py-1 rounded-full">
                          <p className="text-[9px] font-black text-white">2장 보유</p>
                        </div>
                      </div>
                      <div className="bg-sidebar-bg rounded-[1.5rem] flex flex-col items-center justify-center gap-2 border border-white/10">
                        <MessageSquare className="w-8 h-8 text-gold" />
                        <p className="text-[8px] font-black text-gold uppercase tracking-widest">메시지</p>
                        <div className="bg-gold/20 px-3 py-1 rounded-full">
                          <p className="text-[9px] font-black text-gold">사장님께 전달</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
                hint: '🎁 쿠폰은 테이블 연동 후 사장님 승인으로 사용됩니다'
              }
            ];

            const currentTutorial = TUTORIAL_STEPS[tutorialPage];
            const isLast = tutorialPage === TUTORIAL_STEPS.length - 1;

            return (
              <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-sidebar-bg/80 backdrop-blur-2xl">
                <motion.div
                  key={tutorialPage}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="bg-white w-full max-w-sm rounded-[4rem] p-8 shadow-3xl relative overflow-hidden flex flex-col"
                >
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-gold via-white to-gold"></div>

                  {/* 진행 표시 */}
                  <div className="flex items-center justify-between mb-6">
                    <button 
                      onClick={() => tutorialPage > 0 ? setTutorialPage(p => p - 1) : setTutorialStep('welcome')}
                      className="p-3 bg-surface-container rounded-2xl text-primary/30 hover:text-primary transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-2">
                      {TUTORIAL_STEPS.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === tutorialPage ? 'w-8 bg-primary' : i < tutorialPage ? 'w-4 bg-primary/40' : 'w-4 bg-primary/10'}`}></div>
                      ))}
                    </div>
                    <button 
                      onClick={() => { setShowOnboarding(false); setTutorialStep(null); }}
                      className="p-3 bg-surface-container rounded-2xl text-primary/20 hover:text-primary transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 일러스트 */}
                  {currentTutorial.illustration}

                  {/* 콘텐츠 */}
                  <div className="mt-6 mb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[9px] font-black text-primary/30 uppercase tracking-[0.4em]">STEP {currentTutorial.step} / {TUTORIAL_STEPS.length}</span>
                    </div>
                    <h3 className="text-2xl font-serif font-black italic text-primary mb-3 leading-tight">{currentTutorial.title}</h3>
                    <p className="text-[12px] text-primary/50 leading-relaxed mb-4">{currentTutorial.desc}</p>
                    <div className="bg-primary/5 rounded-2xl p-4 border border-primary/5">
                      <p className="text-[11px] font-black text-primary/60 leading-relaxed">{currentTutorial.hint}</p>
                    </div>
                  </div>

                  {/* 버튼 */}
                  <button
                    onClick={() => {
                      if (isLast) {
                        setShowOnboarding(false);
                        setTutorialStep(null);
                      } else {
                        setTutorialPage(p => p + 1);
                      }
                    }}
                    className="w-full py-6 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all outline-none mt-2"
                  >
                    {isLast ? '✓ 이용 시작하기' : `다음 단계 →`}
                  </button>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

      </div>

      {/* 메뉴 사진 검토 + SNS 동의 모달 */}
      <AnimatePresence>
        {reviewingPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setReviewingPhoto(null)}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-end lg:items-center justify-center p-0 lg:p-6"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-t-[3rem] lg:rounded-[3rem] shadow-premium overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="px-7 pt-7 pb-4 flex justify-between items-start border-b border-primary/5">
                <div>
                  <h3 className="font-sans text-lg lg:text-xl font-black text-primary tracking-tight">매장에서 보내온 사진</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mt-1">
                    {reviewingPhoto.menuName || '메뉴 사진'} · {new Date(reviewingPhoto.createdAt).toLocaleString('ko-KR')}
                  </p>
                </div>
                <button onClick={() => setReviewingPhoto(null)} className="p-2 text-primary/40 hover:text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto no-scrollbar">
                <div className="bg-black flex items-center justify-center">
                  <img src={reviewingPhoto.imageData} alt="" className="max-w-full max-h-[55vh] object-contain" />
                </div>

                <div className="px-7 py-6 space-y-5">
                  <div>
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-3">SNS 사용 동의</h4>
                    <p className="text-xs text-primary/60 leading-relaxed mb-4">
                      이 사진을 매장 SNS·홍보용으로 사용해도 괜찮을까요? 동의하시면 방문 인증 사진 한 장을 함께 추가할 수 있어요.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSnsConsent(true)}
                        className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${snsConsent === true ? 'bg-emerald-500 text-white shadow-lg' : 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'}`}
                      >
                        <ShieldCheck className="w-4 h-4" /> 동의합니다
                      </button>
                      <button
                        onClick={() => setSnsConsent(false)}
                        className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${snsConsent === false ? 'bg-burgundy text-white shadow-lg' : 'bg-burgundy/10 text-burgundy hover:bg-burgundy/20'}`}
                      >
                        <ShieldOff className="w-4 h-4" /> 거절합니다
                      </button>
                    </div>
                  </div>

                  {snsConsent === true && (
                    <div className="bg-gold/5 border border-gold/20 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-gold" />
                        <h4 className="text-xs font-black text-primary uppercase tracking-widest">사진 한 장 추가 (선택)</h4>
                      </div>
                      <p className="text-[11px] text-primary/60 leading-relaxed mb-4">
                        함께 식사하신 모습이나 매장 분위기를 담은 사진을 한 장 추가해 주시면 매장에 더 큰 도움이 됩니다.
                      </p>
                      <button
                        onClick={() => { setPendingMenuPhotoId(reviewingPhoto.id); setShowCustomerPhotoModal(true); }}
                        className="w-full py-3.5 bg-white border border-gold/30 text-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                      >
                        <CameraIcon className="w-4 h-4" /> 내 사진 추가하기
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-7 py-5 border-t border-primary/5 flex gap-3 bg-surface-bright/50">
                <button
                  onClick={() => setReviewingPhoto(null)}
                  className="flex-1 py-3.5 bg-white border border-primary/10 text-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/5 transition-all"
                >
                  나중에
                </button>
                <button
                  disabled={snsConsent === null}
                  onClick={async () => {
                    if (snsConsent === null) return;
                    await updatePhoto(reviewingPhoto.id, {
                      snsConsent,
                      consentedAt: new Date().toISOString()
                    });
                    showToast(snsConsent ? '동의해 주셔서 감사합니다.' : '의견 감사합니다.', 'success');
                    setReviewingPhoto(null);
                    setSnsConsent(null);
                  }}
                  className="flex-[2] py-3.5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-accent-burgundy transition-all shadow-lg disabled:opacity-50"
                >
                  의견 제출
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 손님이 추가하는 본인 사진 */}
      <PhotoCaptureModal
        open={showCustomerPhotoModal}
        title="내 사진 한 장 추가"
        hint="매장 SNS에 함께 사용될 사진입니다"
        cameraFacing="user"
        submitLabel="사진 보내기"
        onClose={() => { setShowCustomerPhotoModal(false); setPendingMenuPhotoId(null); }}
        onCapture={async (dataUrl) => {
          if (!currentUser || !storeId || !pendingMenuPhotoId) return;
          await addPhoto({
            storeId,
            type: 'customer',
            imageData: dataUrl,
            customerId: currentUser.id,
            customerName: currentUser.name,
            pairedPhotoId: pendingMenuPhotoId,
            snsConsent: true,
            consentedAt: new Date().toISOString()
          });
          showToast('소중한 사진 감사합니다!', 'success');
          setShowCustomerPhotoModal(false);
          setPendingMenuPhotoId(null);
        }}
      />

    </motion.div>
  );
}

function Smartphone(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}
