import { useMemo, useState } from "react";
import { TrendingUp, Users, ShoppingBag } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { useStore } from "../../store/store";
import { getEffectiveTier, TIER_ORDER, TIER_BADGE } from "../../lib/tier";

type Range = "day" | "week" | "month";

export default function OwnerStatistics() {
  const { currentUser, visits, orders, tierOverrides } = useStore();
  const storeId = currentUser?.id ?? "";
  const [range, setRange] = useState<Range>("week");

  const stats = useMemo(() => {
    const now = Date.now();
    // "오늘"은 캘린더 기준 자정부터, 주/월은 N일 전부터
    let cutoff: number;
    if (range === "day") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      cutoff = start.getTime();
    } else {
      const ms = range === "week" ? 7 : 30;
      cutoff = now - ms * 86_400_000;
    }
    const periodVisits = visits.filter(
      (v) => v.storeId === storeId && new Date(v.date).getTime() >= cutoff
    );
    const periodOrders = orders.filter(
      (o) =>
        o.storeId === storeId &&
        o.status !== "cancelled" &&
        new Date(o.createdAt).getTime() >= cutoff
    );
    // 매출은 주문 합계로만 산정 (visit.totalAmount는 사용처 없음)
    const revenue = periodOrders.reduce((s, o) => s + o.totalAmount, 0);
    const uniqueCustomers = new Set(periodVisits.map((v) => v.customerId)).size;
    const avg = uniqueCustomers > 0 ? Math.round(revenue / uniqueCustomers) : 0;

    // hour heatmap
    const hourly: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourly[i] = 0;
    periodVisits.forEach((v) => {
      const h = new Date(v.date).getHours();
      hourly[h]++;
    });

    // day-of-week
    const weekday: Record<number, number> = {};
    for (let i = 0; i < 7; i++) weekday[i] = 0;
    periodVisits.forEach((v) => {
      weekday[new Date(v.date).getDay()]++;
    });

    // menu ranking
    const menuCount: Record<string, { name: string; count: number; revenue: number }> = {};
    periodOrders.forEach((o) => {
      o.items.forEach((it) => {
        menuCount[it.menuId] ??= { name: it.name, count: 0, revenue: 0 };
        menuCount[it.menuId].count += it.quantity;
        menuCount[it.menuId].revenue += it.quantity * it.price;
      });
    });
    const topMenus = Object.values(menuCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { revenue, periodVisits, uniqueCustomers, avg, hourly, weekday, topMenus };
  }, [visits, orders, storeId, range]);

  // tier distribution (all customers)
  const tierDist = useMemo(() => {
    const counts: Record<string, number> = {};
    TIER_ORDER.forEach((t) => (counts[t] = 0));
    const customers = new Set(visits.filter((v) => v.storeId === storeId).map((v) => v.customerId));
    customers.forEach((cid) => {
      const cv = visits.filter((v) => v.customerId === cid && v.storeId === storeId);
      const uniqueDays = new Set(cv.map((v) => new Date(v.date).toDateString())).size;
      const override = tierOverrides.find((o) => o.customerId === cid)?.tier;
      const t = getEffectiveTier(uniqueDays, override);
      counts[t]++;
    });
    return counts;
  }, [visits, tierOverrides, storeId]);

  const maxHour = Math.max(...Object.values(stats.hourly), 1);
  const maxWeek = Math.max(...Object.values(stats.weekday), 1);
  const totalTierUsers = Object.values(tierDist).reduce((a, b) => a + b, 0) || 1;

  return (
    <OwnerShell title="통계">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[14px] max-w-md">
          {(["day", "week", "month"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`h-10 rounded-[10px] text-[12px] font-bold ${
                range === r ? "bg-white text-[var(--color-navy-800)]" : "text-[var(--color-ink-500)]"
              }`}
            >
              {r === "day" ? "오늘" : r === "week" ? "이번 주" : "한 달"}
            </button>
          ))}
        </div>

        <Card className="mt-4 bg-[var(--color-navy-700)] border-transparent text-white p-6 lg:p-8 shadow-[var(--shadow-navy)]">
          <p className="label-xs text-white/70">기간 총 매출</p>
          <p className="mt-2 text-[36px] lg:text-[48px] font-extrabold tracking-tighter tabular-nums">₩ {stats.revenue.toLocaleString()}</p>
          <div className="grid grid-cols-3 mt-5 pt-5 border-t border-white/15 text-[13px]">
            <Stat label="방문" value={`${stats.periodVisits.length}건`} />
            <Stat label="순방문자" value={`${stats.uniqueCustomers}명`} />
            <Stat label="객단가" value={`₩ ${stats.avg.toLocaleString()}`} />
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 mt-6">
          <div>
        <SectionTitle icon={<TrendingUp className="w-4 h-4" />}>시간대별 방문</SectionTitle>
        <Card padding="md">
          <div className="flex gap-[3px] h-32 items-end">
            {Array.from({ length: 24 }).map((_, h) => {
              const v = stats.hourly[h];
              const pct = (v / maxHour) * 100;
              return (
                <div key={h} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t bg-[var(--color-navy-700)]/80 transition-all"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    title={`${h}시 ${v}건`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-[var(--color-ink-500)] font-semibold mt-1">
            <span>0시</span>
            <span>6시</span>
            <span>12시</span>
            <span>18시</span>
            <span>23시</span>
          </div>
        </Card>

        </div>
          <div>
        <SectionTitle icon={<Users className="w-4 h-4" />}>요일별 방문</SectionTitle>
        <Card padding="md">
          <div className="grid grid-cols-7 gap-2">
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => {
              const v = stats.weekday[i];
              const pct = (v / maxWeek) * 100;
              return (
                <div key={d} className="flex flex-col items-center">
                  <div className="w-full h-16 bg-[var(--color-navy-50)] rounded-lg flex items-end overflow-hidden">
                    <div
                      className="w-full bg-[var(--color-mint-500)]"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-bold text-[var(--color-ink-700)] mt-1">{d}</p>
                  <p className="text-[10px] text-[var(--color-ink-500)]">{v}</p>
                </div>
              );
            })}
          </div>
        </Card>

        </div>
          <div>
        <SectionTitle icon={<ShoppingBag className="w-4 h-4" />}>메뉴 판매 TOP 5</SectionTitle>
        {stats.topMenus.length === 0 ? (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
            기간 내 주문이 없습니다.
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.topMenus.map((m, i) => (
              <Card key={m.name} padding="md" className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[var(--color-navy-700)] text-white text-[12px] font-extrabold inline-flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-[var(--color-navy-900)]">{m.name}</p>
                  <p className="text-[12px] text-[var(--color-ink-500)]">
                    {m.count}개 · ₩ {m.revenue.toLocaleString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        </div>
          <div>
        <SectionTitle>등급 분포</SectionTitle>
        <Card padding="md">
          <div className="flex h-4 rounded-full overflow-hidden bg-[var(--color-ink-50)]">
            {TIER_ORDER.map((t) => {
              const count = tierDist[t];
              if (count === 0) return null;
              const w = (count / totalTierUsers) * 100;
              return <div key={t} className={TIER_BADGE[t].bg} style={{ width: `${w}%` }} />;
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {TIER_ORDER.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${TIER_BADGE[t].bg}`} />
                <span className="text-[11px] text-[var(--color-ink-700)] font-semibold">{t}</span>
                <span className="text-[11px] text-[var(--color-ink-500)] ml-auto">{tierDist[t]}</span>
              </div>
            ))}
          </div>
        </Card>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="opacity-70 text-[11px] mb-0.5">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mt-5 mb-2 px-1 text-[13px] font-bold text-[var(--color-navy-900)] flex items-center gap-1.5">
      {icon}
      {children}
    </h2>
  );
}
