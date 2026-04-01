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
   const { currentUser, visits, coupons, tables, users } = useStore();
   const [selectedRange, setSelectedRange] = useState<DateRange>('7일');
   const navigate = useNavigate();

   if (!currentUser) return null;

   const myTables = tables.filter(t => t.storeId === currentUser.id);

   // Real-time calculation for Stats Cards
   const { newCustomersInWeek, avgUsageTime, peakTimeString, occupancyRate } = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // 1. 신규 단골 (Last 7 days)
    const newCustomers = users.filter(u => 
      u.role === 'customer' && 
      u.storeId === currentUser.id && 
      visits.some(v => v.customerId === u.id && new Date(v.date) >= weekAgo)
    ).length;

    // 2. 평균 이용시간
    const occupiedTables = myTables.filter(t => t.currentCustomerId && t.sessionStartTime);
    const currentDurations = occupiedTables.map(t => (Date.now() - new Date(t.sessionStartTime!).getTime()) / 60000);
    const avgUsage = currentDurations.length > 0 ? Math.round(currentDurations.reduce((a, b) => a + b, 0) / currentDurations.length) : 45;

    // 3. 피크 시간대
    const storeVisits = visits.filter(v => v.storeId === currentUser.id);
    const hourCounts: Record<number, number> = {};
    storeVisits.forEach(v => {
      const hour = new Date(v.date).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';

    // 4. 가동률
    const occupancy = myTables.length > 0 ? Math.round((occupiedTables.length / myTables.length) * 100) : 0;

    return { 
      newCustomersInWeek: newCustomers, 
      avgUsageTime: avgUsage, 
      peakTimeString: `${peakHour}:30`, 
      occupancyRate: occupancy 
    };
   }, [users, visits, tables, currentUser.id]);

  const handleLogout = () => {
    navigate('/');
  };

  const storeVisits = useMemo(() => visits.filter(v => v.storeId === currentUser.id), [visits, currentUser.id]);
  const storeCoupons = useMemo(() => coupons.filter(c => c.storeId === currentUser.id), [coupons, currentUser.id]);

  const { chartDays, visitsPerDay } = useMemo(() => {
    let dayCount = 7;
    if (selectedRange === '30일') dayCount = 30;
    else if (selectedRange === '전체') {
      if (storeVisits.length === 0) dayCount = 7;
      else {
        const earliest = new Date(Math.min(...storeVisits.map(v => new Date(v.date).getTime())));
        dayCount = Math.max(7, Math.ceil((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        dayCount = Math.min(dayCount, 90);
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
  const usedCouponsCount = useMemo(() => storeCoupons.filter(c => c.status === 'used').length, [storeCoupons]);

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
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20">
      
      {/* Sidebar - Consistent */}
      <aside className="h-screen w-20 lg:w-64 fixed left-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl">결</Link>
          <div className="mt-8 hidden lg:block">
            <p className="text-[#fcfcfc] font-serif italic text-sm">{currentUser.restaurantName}</p>
            <p className="text-[#fcfcfc]/50 uppercase tracking-widest text-[10px]">실시간 매장 관리</p>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/owner" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <LayoutGrid className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">대시보드</span>
          </Link>
          <Link to="/owner/customers" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <Users className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">단골 관리</span>
          </Link>
          <Link to="/owner/statistics" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4 transition-all">
            <BarChart3 className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">매장 통계</span>
          </Link>
          <Link to="/owner/brand-settings" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
            <Settings className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">매장 설정</span>
          </Link>
        </nav>
        <button onClick={handleLogout} className="px-8 mt-auto text-white/40 hover:text-white text-[10px] flex items-center gap-2 uppercase tracking-widest">
          <LogOut className="w-4 h-4" /> <span className="hidden lg:block">로그아웃</span>
        </button>
      </aside>

      {/* Main Workspace Area */}
      <main className="ml-20 lg:ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-12">
            <span className="font-serif text-2xl font-bold text-primary">매장 통계</span>
            <div className="flex bg-surface-container p-1 rounded-xl">
              {rangeOptions.map(range => (
                <button
                  key={range}
                  onClick={() => setSelectedRange(range)}
                  className={`px-6 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${selectedRange === range ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40 hover:text-primary'}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="p-8 space-y-12 flex-1 overflow-y-auto no-scrollbar">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
               <h2 className="text-4xl font-serif font-black text-primary tracking-tight italic">성과의 기록</h2>
               <p className="text-on-surface-variant/60 text-[11px] font-bold uppercase tracking-widest mt-2">{currentUser.restaurantName}의 비즈니스 인사이트입니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
            {/* Main Bar Chart */}
            <div className="xl:col-span-2 bg-white rounded-[2rem] p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden group">
               <div className="flex justify-between items-start mb-12">
                  <div>
                     <h3 className="text-2xl font-serif font-black text-primary italic">손님 방문 추이</h3>
                     <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">{selectedRange}간의 방문 횟수 집계</p>
                  </div>
                  <div className="text-right">
                     <p className="text-3xl font-serif font-black text-primary">{totalVisitsInRange}</p>
                     <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">총 방문</p>
                  </div>
               </div>

               <div className="flex items-end justify-between h-64 gap-4 mt-6">
                 {chartBuckets.map((bucket, i) => {
                   const heightPercentage = Math.round((bucket.count / maxBucketCount) * 100);
                   return (
                     <div key={i} className="flex flex-col items-center flex-1 h-full group">
                       <div className="w-full relative flex justify-center items-end flex-1 bg-surface-container rounded-2xl overflow-hidden hover:bg-surface-container-highest transition-colors">
                         <div 
                           className="w-full bg-primary transition-all duration-1000 ease-out"
                           style={{ height: bucket.count > 0 ? `${heightPercentage}%` : '4px' }}
                         ></div>
                         {bucket.count > 0 && (
                           <div className="absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[9px] font-black text-primary/40">{bucket.count}</span>
                           </div>
                         )}
                       </div>
                       <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-4">{bucket.label}</span>
                     </div>
                   );
                 })}
               </div>
            </div>

            {/* Side Stats */}
            <div className="space-y-8">
               <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                  <div>
                    <Ticket className="w-10 h-10 text-primary opacity-20 mb-6" />
                    <h3 className="text-xl font-serif font-black text-primary italic mb-6">쿠폰 이용률</h3>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30">
                        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase mb-1">발급</p>
                        <p className="text-2xl font-serif font-black text-primary">{storeCoupons.length}</p>
                      </div>
                      <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30">
                        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase mb-1">사용</p>
                        <p className="text-2xl font-serif font-black text-primary">{usedCouponsCount}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-on-surface-variant/40 uppercase">
                      <span>전환 효율</span>
                      <span>{storeCoupons.length > 0 ? Math.round((usedCouponsCount / storeCoupons.length) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                       <div className="h-full bg-primary" style={{ width: `${storeCoupons.length > 0 ? (usedCouponsCount / storeCoupons.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>
               </div>

               <div className="bg-primary p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="text-xl font-serif font-black italic mb-6">사장님을 위한 제안</h3>
                    <p className="text-sm font-sans leading-relaxed opacity-80">
                      최근 7일간 단골 손님의 방문 비율이 12% 증가했습니다. 저녁 시간대의 회전율을 높여보세요.
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-16 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
             {[
               { icon: Users, label: '신규 단골', value: `${newCustomersInWeek}명`, trend: '최근' },
               { icon: Clock, label: '평균 이용시간', value: `${avgUsageTime}분`, trend: '안정' },
               { icon: MapPin, label: '피크 시간대', value: peakTimeString, trend: '예측' },
               { icon: Activity, label: '매장 가동률', value: `${occupancyRate}%`, icon2: Activity, trend: '양호' }
             ].map((item, idx) => (
               <div key={idx} className="bg-white p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col group hover:border-primary transition-all duration-500">
                  <item.icon className="w-8 h-8 text-primary opacity-20 group-hover:opacity-100 transition-opacity mb-6" />
                  <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase mb-2">{item.label}</p>
                  <div className="flex items-end justify-between">
                     <p className="text-2xl font-serif font-black text-primary italic">{item.value}</p>
                     <p className={`text-[10px] font-bold text-on-surface-variant/40`}>{item.trend}</p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </main>
    </div>
  );
}
