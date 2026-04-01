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
   const actualTables = myTables.filter(t => t.type === 'table');

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
    const occupiedTables = actualTables.filter(t => t.currentCustomerId && t.sessionStartTime);
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
    const occupancy = actualTables.length > 0 ? Math.round((occupiedTables.length / actualTables.length) * 100) : 0;

    return { 
      newCustomersInWeek: newCustomers, 
      avgUsageTime: avgUsage, 
      peakTimeString: `${peakHour}:30`, 
      occupancyRate: occupancy 
    };
   }, [users, visits, tables, currentUser.id, actualTables]);

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
      buckets.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        count
      });
    }
    return buckets;
  }, [chartDays, visitsPerDay]);

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
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-4">
             <span className="font-serif text-2xl font-bold text-primary">매장 비즈니스 리포트</span>
             <div className="hidden sm:flex bg-surface-container p-1 rounded-lg ml-6">
                {['7일', '30일', '전체'].map(range => (
                   <button
                     key={range}
                     onClick={() => setSelectedRange(range as DateRange)}
                     className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${selectedRange === range ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40 hover:text-primary'}`}
                   >
                      {range}
                   </button>
                ))}
             </div>
          </div>
          <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors">
            보고서 추출 <ChevronRight className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-12 pb-24">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-outline-variant/30 shadow-sm space-y-10">
                <div className="flex justify-between items-start">
                   <div>
                      <h3 className="text-2xl font-serif font-black text-primary italic">방문 트렌드</h3>
                      <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">최근 요일별 방문자 현황</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-primary">{totalVisitsInRange} Visits</p>
                      <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">Growth: +12.4%</p>
                   </div>
                </div>
                
                <div className="h-64 flex items-end justify-between gap-2 px-2">
                   {chartBuckets.map((bucket, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-4 group">
                         <div className="relative w-full flex flex-col items-center justify-end h-48">
                            <div 
                              className="w-full bg-surface-container group-hover:bg-primary/20 rounded-t-xl transition-all duration-500 relative"
                              style={{ 
                                height: totalVisitsInRange > 0 ? `${(bucket.count / Math.max(...chartBuckets.map(b => b.count))) * 100}%` : '4px' 
                              }}
                            >
                               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {bucket.count}명
                               </div>
                            </div>
                         </div>
                         <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{bucket.label}</span>
                      </div>
                   ))}
                </div>
             </div>

             <div className="bg-primary p-12 rounded-[2.5rem] text-white flex flex-col gap-10 shadow-2xl relative overflow-hidden group">
                <div className="relative z-10">
                   <h3 className="text-3xl font-serif font-black italic">Marketing Effect</h3>
                   <p className="text-sm opacity-60 mt-2 font-serif">쿠폰 발행을 통한 방문 유도 효과</p>
                </div>
                
                <div className="relative z-10 flex-1 flex flex-col justify-center gap-12">
                   <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">쿠폰 회수 현황</p>
                      <div className="flex items-end gap-3">
                         <span className="text-6xl font-serif font-black italic">{usedCouponsCount}</span>
                         <span className="text-sm font-serif mb-2 opacity-60">Collects</span>
                      </div>
                   </div>
                   
                   <div className="space-y-6">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-white transition-all duration-1000 ease-out" 
                           style={{ width: `${Math.min(100, (usedCouponsCount / Math.max(1, storeCoupons.length)) * 100)}%` }}
                         />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-40">
                         <span>Active Potential</span>
                         <span>{Math.round((usedCouponsCount / Math.max(1, storeCoupons.length)) * 100)}%</span>
                      </div>
                   </div>
                </div>

                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
