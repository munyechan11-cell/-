import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { 
  Users, LayoutGrid, BarChart3, TrendingUp, Ticket, 
  LogOut, Store as StoreIcon, ShieldCheck, Heart, 
  Calendar, ArrowUpRight, Clock, MapPin, Search, Filter,
  ChevronRight, Activity, Settings
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type DateRange = '7일' | '30일' | '전체';

export default function OwnerStatistics() {
  const { currentUser, visits, coupons } = useStore();
  const [selectedRange, setSelectedRange] = useState<DateRange>('7일');
  const navigate = useNavigate();

  if (!currentUser) return null;

  const handleLogout = () => {
    navigate('/');
  };

  const storeVisits = useMemo(() => visits.filter(v => v.storeId === currentUser.id), [visits, currentUser.id]);
  const storeCoupons = useMemo(() => coupons.filter(c => c.storeId === currentUser.id), [coupons, currentUser.id]);

  // 선택한 날짜 범위에 따라 방문수/날짜 레이블 배열 생성
  const { chartDays, visitsPerDay } = useMemo(() => {
    let dayCount = 7;
    if (selectedRange === '30일') dayCount = 30;
    else if (selectedRange === '전체') {
      if (storeVisits.length === 0) dayCount = 7;
      else {
        const earliest = new Date(Math.min(...storeVisits.map(v => new Date(v.date).getTime())));
        dayCount = Math.max(7, Math.ceil((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        dayCount = Math.min(dayCount, 90); // 최대 90일
      }
    }

    const days = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dayCount - 1 - i));
      return d.toDateString();
    });

    const perDay = days.map(dateStr =>
      storeVisits.filter(v => new Date(v.date).toDateString() === dateStr).length
    );

    return { chartDays: days, visitsPerDay: perDay };
  }, [storeVisits, selectedRange]);

  const totalVisitsInRange = useMemo(() => visitsPerDay.reduce((a, b) => a + b, 0), [visitsPerDay]);

  // 쿠폰 통계
  const usedCouponsCount = useMemo(() => storeCoupons.filter(c => c.status === 'used').length, [storeCoupons]);

  // 바 차트에서 보여줄 날짜 수 제한 (7일은 전부, 30일 이상은 7개 버킷으로 그룹화)
  const chartBuckets = useMemo(() => {
    const bucketSize = Math.ceil(chartDays.length / 7);
    const buckets: { label: string; count: number }[] = [];
    for (let i = 0; i < chartDays.length; i += bucketSize) {
      const slice = visitsPerDay.slice(i, i + bucketSize);
      const count = slice.reduce((a, b) => a + b, 0);
      const date = new Date(chartDays[i]);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      buckets.push({ label, count });
    }
    return buckets;
  }, [chartDays, visitsPerDay]);

  const maxBucketCount = useMemo(() => Math.max(...chartBuckets.map(b => b.count), 1), [chartBuckets]);

  const rangeOptions: DateRange[] = ['7일', '30일', '전체'];

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface hanji-texture relative">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
      
      {/* Sidebar - Consistent with Owner Suite */}
      <aside className="h-screen w-20 md:w-64 border-r border-primary/5 bg-primary shadow-2xl flex flex-col py-8 z-50 transition-all duration-500">
        <div className="px-6 md:px-8 mb-12">
          <h1 className="text-surface-bright font-serif italic text-2xl md:text-3xl tracking-tighter hidden md:block">결 (Gyeol)</h1>
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3 md:hidden mx-auto">
             <span className="text-white font-serif italic text-xl">결</span>
          </div>
          <div className="mt-8 hidden md:flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3">
              <StoreIcon className="text-white w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 공방'}</p>
              <p className="font-black uppercase tracking-widest text-[9px] text-white/40">장인 관리자</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <Link 
            to="/owner"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">매장 전도</span>
          </Link>
          
          <Link 
            to="/owner/customers"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">단골 장부</span>
          </Link>
          
          <Link 
            to="/owner/statistics"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 bg-primary-container text-white border-l-4 border-white"
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">분석 및 통계</span>
          </Link>

          <Link 
            to="/owner/brand-settings"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">브랜드 설정</span>
          </Link>
        </nav>
        
        <div className="px-4 md:px-8 mt-auto pt-8 space-y-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center space-x-4 px-2 md:px-0 py-3.5 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-bold">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:block">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-bright/50 backdrop-blur-sm">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-6 md:px-10 py-5 border-b border-primary/5">
          <div className="flex items-center space-x-4 md:space-x-12">
            <div className="font-serif text-xl md:text-2xl font-black text-primary tracking-tighter italic">공방 통찰 (Analytics)</div>
            <div className="h-6 w-px bg-primary/10 hidden md:block"></div>
            <div className="hidden lg:flex items-center space-x-4">
               <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">거버넌스 데이터 분석</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
             <div className="flex bg-primary/10 p-1 rounded-2xl">
               {rangeOptions.map(range => (
                 <button
                   key={range}
                   onClick={() => setSelectedRange(range)}
                   className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                     selectedRange === range 
                       ? 'bg-primary text-white shadow-xl' 
                       : 'text-primary/30 hover:text-primary'
                   }`}
                 >
                   {range}
                 </button>
               ))}
             </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6 md:p-10">
          <div className="mb-12">
             <h2 className="text-4xl font-serif font-black text-primary tracking-tight italic">성과의 기록 (Performance)</h2>
             <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{currentUser.restaurantName || '공방'}의 번영을 관찰합니다.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
            {/* Main Growth Chart */}
            <div className="xl:col-span-2 bg-white rounded-[3rem] p-10 shadow-sm border border-primary/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Activity className="w-32 h-32 text-primary" strokeWidth={1} />
               </div>
               
               <div className="flex justify-between items-start mb-12 relative z-10">
                  <div>
                     <h3 className="text-2xl font-serif font-black text-primary tracking-tight">방문 시민 추이</h3>
                     <p className="text-[9px] font-black text-primary/30 uppercase tracking-widest mt-1">{selectedRange} 동안의 성장 흐름</p>
                  </div>
                  <div className="text-right">
                     <p className="text-3xl font-serif font-black text-burgundy">{totalVisitsInRange}</p>
                     <p className="text-[9px] font-black text-primary/30 uppercase tracking-widest mt-1">총 방문 횟수</p>
                  </div>
               </div>

               <div className="flex items-end justify-between h-64 mt-10 gap-4 relative z-10">
                 {chartBuckets.map((bucket, i) => {
                   const height = `${(bucket.count / maxBucketCount) * 100}%`;
                   return (
                     <div key={i} className="flex flex-col items-center flex-1 group">
                       <div className="w-full relative flex justify-center items-end h-56 bg-primary/[0.02] rounded-[1.5rem] transition-all duration-700 hover:bg-primary/[0.05]">
                         <div 
                           className="w-full bg-primary rounded-[1.5rem] transition-all duration-1000 ease-out shadow-2xl shadow-primary/20"
                           style={{ height: bucket.count > 0 ? height : '8px' }}
                         >
                            <div className="absolute top-0 left-0 w-full h-full lattice-overlay opacity-10"></div>
                         </div>
                         {bucket.count > 0 && (
                           <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                              <span className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-lg shadow-xl">{bucket.count}</span>
                           </div>
                         )}
                       </div>
                       <span className="text-[9px] font-black text-primary/30 uppercase tracking-widest mt-4">{bucket.label}</span>
                     </div>
                   );
                 })}
               </div>
            </div>

            {/* Right Side Cards */}
            <div className="space-y-10">
               {/* Coupon Utility */}
               <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-primary/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
                  <Ticket className="w-10 h-10 text-burgundy mb-8 opacity-20" />
                  <h3 className="text-xl font-serif font-black text-primary tracking-tight mb-6 italic">혜택 집계 (Rewards)</h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                      <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest mb-1">발행됨</p>
                      <p className="text-2xl font-black text-primary">{storeCoupons.length}</p>
                    </div>
                    <div className="p-6 bg-burgundy/5 rounded-3xl border border-burgundy/10">
                      <p className="text-[8px] font-black text-burgundy/40 uppercase tracking-widest mb-1">사용됨</p>
                      <p className="text-2xl font-black text-burgundy">{usedCouponsCount}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-[9px] font-black text-primary/30 uppercase tracking-widest">사용 효율</p>
                      <p className="text-lg font-serif font-black text-primary">
                        {storeCoupons.length > 0 ? Math.round((usedCouponsCount / storeCoupons.length) * 100) : 0}%
                      </p>
                    </div>
                    <div className="w-full bg-primary/5 rounded-full h-4 overflow-hidden p-1 border border-primary/5 shadow-inner">
                      <div 
                        className="bg-burgundy h-full rounded-full transition-all duration-1000 shadow-lg shadow-burgundy/20"
                        style={{ width: `${storeCoupons.length > 0 ? (usedCouponsCount / storeCoupons.length) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
               </div>

               {/* Quick Insights */}
               <div className="bg-primary p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-1000"></div>
                  <h3 className="text-xl font-serif font-black text-white tracking-tight mb-8 relative z-10 italic">핵심 요약 (Executive)</h3>
                  <div className="space-y-6 relative z-10">
                     <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/10">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">시민 유지율</span>
                        <span className="text-lg font-serif font-black text-white italic">84.2%</span>
                     </div>
                     <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/10">
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">성장 속도</span>
                        <span className="text-lg font-serif font-black text-emerald-400 italic">+12.4%</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Secondary Details */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
             {[
               { icon: Users, label: '활동 시민', value: '1,284', trend: '+5.2%', color: 'text-primary' },
               { icon: Clock, label: '평균 머무름', value: '54분', trend: '-2.1%', color: 'text-primary' },
               { icon: Heart, label: '공감 점수', value: '4.9', trend: '+0.1', color: 'text-burgundy' },
               { icon: MapPin, label: '지역 도달', value: '18', trend: '안정', color: 'text-primary' }
             ].map((stat, idx) => (
               <div key={idx} className="bg-white p-8 rounded-[2rem] border border-primary/5 shadow-sm hover:shadow-md transition-all">
                  <stat.icon className={`w-8 h-8 ${stat.color} opacity-20 mb-6`} />
                  <p className="text-[9px] font-black text-primary/30 uppercase tracking-widest mb-2">{stat.label}</p>
                  <div className="flex items-baseline justify-between">
                     <p className="text-2xl font-serif font-black text-primary">{stat.value}</p>
                     <p className={`text-[9px] font-black ${stat.trend.startsWith('+') ? 'text-emerald-500' : stat.trend.startsWith('-') ? 'text-burgundy' : 'text-primary/30'}`}>{stat.trend}</p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </main>
    </div>
  );
}
