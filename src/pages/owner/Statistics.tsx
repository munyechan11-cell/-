import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Users, LayoutGrid, BarChart3, TrendingUp, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

type DateRange = '7일' | '30일' | '전체';

export default function OwnerStatistics() {
  const { currentUser, visits, coupons } = useStore();
  const [selectedRange, setSelectedRange] = useState<DateRange>('7일');

  if (!currentUser) return null;

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

  const maxVisits = useMemo(() => Math.max(...visitsPerDay, 1), [visitsPerDay]);
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
    <div className="min-h-full bg-hanji-light dark:bg-hanji-dark pb-20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md text-ink-light dark:text-ink-dark p-6 pt-8 border-b border-ink-light/10 dark:border-ink-dark/10 sticky top-0 z-20">
        <h1 className="text-3xl font-serif font-bold tracking-tight">통계</h1>
        <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm mt-1 font-medium">매장 현황 요약</p>
      </div>

      <div className="p-4 space-y-6">

        {/* 날짜 범위 탭 */}
        <div className="flex gap-2">
          {rangeOptions.map(range => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`flex-1 py-2.5 rounded-2xl font-bold text-sm transition-colors ${
                selectedRange === range
                  ? 'bg-ink-light dark:bg-ink-dark text-hanji-light dark:text-hanji-dark shadow-sm'
                  : 'bg-white dark:bg-black/20 text-ink-light/60 dark:text-ink-dark/60 border border-ink-light/10 dark:border-ink-dark/10 hover:border-ink-light/20 dark:hover:border-ink-dark/20'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Visit Stats */}
        <div className="bg-white dark:bg-black/20 rounded-[2rem] p-6 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-burgundy dark:text-burgundy-light" />
              방문 통계 ({selectedRange})
            </h2>
            <span className="text-sm font-bold text-burgundy dark:text-burgundy-light bg-burgundy/10 dark:bg-burgundy/20 px-3 py-1 rounded-full">
              총 {totalVisitsInRange}회
            </span>
          </div>
          
          <div className="flex items-end justify-between h-40 mt-6 gap-1">
            {chartBuckets.map((bucket, i) => {
              const height = `${(bucket.count / maxBucketCount) * 100}%`;
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className="w-full relative flex justify-center items-end h-32 bg-ink-light/5 dark:bg-ink-dark/5 rounded-t-lg">
                    <div 
                      className="w-full bg-burgundy dark:bg-burgundy-light rounded-t-lg transition-all duration-500"
                      style={{ height: bucket.count > 0 ? height : '4px' }}
                    ></div>
                    {bucket.count > 0 && (
                      <span className="absolute -top-6 text-xs font-bold text-ink-light/70 dark:text-ink-dark/70">{bucket.count}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-ink-light/50 dark:text-ink-dark/50 mt-2 font-medium">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coupon Stats */}
        <div className="bg-white dark:bg-black/20 rounded-[2rem] p-6 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
          <h2 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark mb-4 flex items-center">
            <Ticket className="w-5 h-5 mr-2 text-burgundy dark:text-burgundy-light" />
            쿠폰 사용 내역 통계
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-ink-light/5 dark:bg-ink-dark/5 rounded-2xl p-4 border border-ink-light/10 dark:border-ink-dark/10 text-center">
              <p className="text-ink-light/60 dark:text-ink-dark/60 text-xs font-medium mb-1">총 발급 쿠폰</p>
              <p className="text-2xl font-bold text-ink-light dark:text-ink-dark">{storeCoupons.length}</p>
            </div>
            <div className="bg-burgundy/10 dark:bg-burgundy/20 rounded-2xl p-4 border border-burgundy/20 dark:border-burgundy/30 text-center">
              <p className="text-burgundy dark:text-burgundy-light text-xs font-medium mb-1">사용 완료</p>
              <p className="text-2xl font-bold text-burgundy dark:text-burgundy-light">{usedCouponsCount}</p>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ink-light/60 dark:text-ink-dark/60 font-medium">쿠폰 사용률</span>
              <span className="font-bold text-ink-light dark:text-ink-dark">
                {storeCoupons.length > 0 ? Math.round((usedCouponsCount / storeCoupons.length) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-ink-light/10 dark:bg-ink-dark/10 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-burgundy dark:bg-burgundy-light h-full rounded-full transition-all duration-1000"
                style={{ width: `${storeCoupons.length > 0 ? (usedCouponsCount / storeCoupons.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/80 backdrop-blur-md border-t border-ink-light/10 dark:border-ink-dark/10 flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light dark:hover:text-ink-dark transition-colors">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light dark:hover:text-ink-dark transition-colors">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
        <Link to="/owner/statistics" className="flex flex-col items-center text-burgundy dark:text-burgundy-light">
          <BarChart3 className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">통계</span>
        </Link>
      </div>
    </div>
  );
}
