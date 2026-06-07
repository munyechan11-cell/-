import { useMemo, useState } from "react";
import { TrendingUp, Users, ShoppingBag, Sparkles, RefreshCw } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { useStore } from "../../store/store";
import { getEffectiveTier, TIER_ORDER, TIER_BADGE } from "../../lib/tier";
import { QUESTIONS, buildContext, askInsight, type InsightKey } from "../../lib/aiInsight";
import { cn } from "../../lib/cn";
import { showToast } from "../../lib/toast";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";

type Range = "day" | "week" | "month";

export default function OwnerStatistics() {
  const { currentUser, visits, orders, tierOverrides, users } = useStore();
  const storeId = currentUser?.id ?? "";
  const lang = useLanguage();
  const [range, setRange] = useState<Range>("week");

  // AI 인사이트 상태 — 질문별 답변 캐시
  const [activeInsight, setActiveInsight] = useState<InsightKey | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightCache, setInsightCache] = useState<Record<string, string>>({});
  const [insightError, setInsightError] = useState<string>("");

  const askAi = async (key: InsightKey, force = false) => {
    const q = QUESTIONS.find((x) => x.key === key);
    if (!q) return;
    setActiveInsight(key);
    setInsightError("");
    if (!force && insightCache[key]) return; // 이미 답변 있음
    setInsightLoading(true);
    try {
      const context = buildContext({
        storeId,
        storeName: currentUser?.restaurantName,
        orders,
        visits,
        users,
      });
      // 빈 데이터 가드 — AI 호출 비용 절약 + 사장님께 친화 메시지
      if ((context.orderCount ?? 0) === 0 && (context.customerCount ?? 0) === 0) {
        setInsightCache((c) => ({
          ...c,
          [key]: t("ostat.ai.emptyData", lang),
        }));
        return;
      }
      const answer = await askInsight({
        storeId,
        question: q.question,
        context,
      });
      setInsightCache((c) => ({ ...c, [key]: answer }));
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("AI_NOT_CONFIGURED")) {
        setInsightError(t("ostat.ai.notConfigured", lang));
      } else if (msg.includes("429") || msg.includes("분당")) {
        setInsightError(t("ostat.ai.rateLimit", lang));
      } else {
        setInsightError(t("ostat.ai.failed", lang, { msg: msg.slice(0, 80) || "" }));
      }
    } finally {
      setInsightLoading(false);
    }
  };

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

    // 직전 동기간 매출 → 전기 대비 증감(%) (ERP 차용: 비교 인사이트)
    const periodMs = (range === "day" ? 1 : range === "week" ? 7 : 30) * 86_400_000;
    const prevCutoff = cutoff - periodMs;
    const prevRevenue = orders
      .filter(
        (o) =>
          o.storeId === storeId &&
          o.status !== "cancelled" &&
          new Date(o.createdAt).getTime() >= prevCutoff &&
          new Date(o.createdAt).getTime() < cutoff
      )
      .reduce((s, o) => s + o.totalAmount, 0);
    const changeRate = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;

    return { revenue, periodVisits, uniqueCustomers, avg, hourly, weekday, topMenus, changeRate };
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
  // 가장 바쁜 시간대 (ERP 차용: 피크 강조 → 인력배치·이벤트 타이밍)
  const peakHour = Array.from({ length: 24 }, (_, h) => h).reduce(
    (mx, h) => (stats.hourly[h] > stats.hourly[mx] ? h : mx),
    0
  );
  const maxWeek = Math.max(...Object.values(stats.weekday), 1);
  const totalTierUsers = Object.values(tierDist).reduce((a, b) => a + b, 0) || 1;

  return (
    <OwnerShell title={t("ostat.title", lang)}>
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
              {r === "day" ? t("ostat.range.day", lang) : r === "week" ? t("ostat.range.week", lang) : t("ostat.range.month", lang)}
            </button>
          ))}
        </div>

        <Card className="mt-4 bg-[var(--color-navy-700)] border-transparent text-white p-6 lg:p-8 shadow-[var(--shadow-navy)]">
          <p className="label-xs text-white/70">{t("ostat.totalRev", lang)}</p>
          <p className="mt-2 text-[36px] lg:text-[48px] font-extrabold tracking-tighter tabular-nums">{fmtKRW(stats.revenue, lang)}</p>
          {stats.changeRate != null && (
            <p className={`mt-1 text-[13px] font-bold ${stats.changeRate >= 0 ? "text-[#7be8c4]" : "text-[#ffb4b4]"}`}>
              {stats.changeRate >= 0 ? "▲" : "▼"} {Math.abs(stats.changeRate)}% · {t("ostat.vsPrev", lang)}
            </p>
          )}
          <div className="grid grid-cols-3 mt-5 pt-5 border-t border-white/15 text-[13px]">
            <Stat label={t("ostat.stat.visits", lang)} value={`${stats.periodVisits.length}${t("ostat.unit.count", lang)}`} />
            <Stat label={t("ostat.stat.unique", lang)} value={`${stats.uniqueCustomers}${t("ostat.unit.people", lang)}`} />
            <Stat label={t("ostat.stat.avg", lang)} value={fmtKRW(stats.avg, lang)} />
          </div>
        </Card>

        {/* ===== AI 매장 분석 — 탭형 질문 ===== */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-mint-500)] to-[var(--color-navy-700)] text-white inline-flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="text-[15.5px] font-extrabold text-[var(--color-navy-900)]">
                {t("ostat.ai.title", lang)}
              </h2>
              <p className="text-[11.5px] text-[var(--color-ink-500)] font-medium">
                {t("ostat.ai.subtitle", lang)}
              </p>
            </div>
          </div>

          {/* 질문 탭 — 가로 스크롤 */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {QUESTIONS.map((q) => {
              const isActive = activeInsight === q.key;
              const hasAnswer = !!insightCache[q.key];
              return (
                <button
                  key={q.key}
                  onClick={() => askAi(q.key)}
                  className={cn(
                    "shrink-0 rounded-[14px] px-3.5 py-2.5 text-left border-[1.5px] transition-all min-w-[140px]",
                    isActive
                      ? "bg-[var(--color-navy-700)] text-white border-[var(--color-navy-700)] shadow-[var(--shadow-press)]"
                      : "bg-white border-[var(--color-line)] hover:border-[var(--color-navy-300)] hover:bg-[var(--color-navy-50)]/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[16px]">{q.emoji}</span>
                    <span className={cn(
                      "text-[12.5px] font-extrabold truncate",
                      isActive ? "text-white" : "text-[var(--color-navy-900)]"
                    )}>
                      {q.title}
                    </span>
                    {hasAnswer && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint-500)] ml-auto shrink-0" />
                    )}
                  </div>
                  <p className={cn(
                    "text-[10.5px] font-medium leading-tight",
                    isActive ? "text-white/80" : "text-[var(--color-ink-500)]"
                  )}>
                    {q.shortHint}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 답변 카드 */}
          {activeInsight && (
            <Card padding="md" className="mt-3 border-[1.5px] border-[var(--color-mint-200)] bg-gradient-to-br from-[var(--color-mint-50)]/40 to-white">
              {(() => {
                const q = QUESTIONS.find((x) => x.key === activeInsight);
                if (!q) return null;
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--color-mint-200)]">
                      <span className="text-[18px]">{q.emoji}</span>
                      <p className="text-[13px] font-extrabold text-[var(--color-navy-900)] flex-1">
                        {q.title}
                      </p>
                      <button
                        onClick={() => askAi(activeInsight, true)}
                        disabled={insightLoading}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-navy-700)] hover:bg-[var(--color-navy-50)] px-2 py-1 rounded-md disabled:opacity-40"
                        title={t("ostat.ai.reanalyze", lang)}
                      >
                        <RefreshCw className={cn("w-3 h-3", insightLoading && "animate-spin")} />
                        {t("ostat.ai.reanalyze", lang)}
                      </button>
                    </div>

                    {insightLoading ? (
                      <div className="py-6 text-center">
                        <div className="inline-flex items-center gap-2 text-[12.5px] text-[var(--color-ink-500)] font-semibold">
                          <span className="w-2 h-2 bg-[var(--color-mint-500)] rounded-full animate-pulse" />
                          {t("ostat.ai.loading", lang)}
                        </div>
                      </div>
                    ) : insightError ? (
                      <p className="py-4 text-[12.5px] text-[var(--color-danger)] font-semibold">
                        {insightError}
                      </p>
                    ) : insightCache[activeInsight] ? (
                      <p className="text-[13.5px] text-[var(--color-navy-900)] leading-relaxed whitespace-pre-wrap font-medium">
                        {insightCache[activeInsight]}
                      </p>
                    ) : (
                      <p className="py-4 text-[12.5px] text-[var(--color-ink-500)] text-center">
                        {t("ostat.ai.tapToStart", lang)}
                      </p>
                    )}

                    <p className="text-[10px] text-[var(--color-ink-400)] mt-3 pt-2 border-t border-[var(--color-mint-200)] font-medium">
                      {t("ostat.ai.disclaimer", lang)}
                    </p>
                  </>
                );
              })()}
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 mt-6">
          <div>
        <SectionTitle icon={<TrendingUp className="w-4 h-4" />}>{t("ostat.hourly.title", lang)}</SectionTitle>
        <Card padding="md">
          <div className="flex gap-[3px] h-32 items-end">
            {Array.from({ length: 24 }).map((_, h) => {
              const v = stats.hourly[h];
              const pct = (v / maxHour) * 100;
              return (
                <div key={h} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={`w-full rounded-t transition-all ${h === peakHour && v > 0 ? "bg-[var(--color-mint-700)]" : "bg-[var(--color-navy-700)]/80"}`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    title={t("ostat.hourly.tip", lang, { h, n: v })}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-[var(--color-ink-600)] font-semibold mt-1.5 tabular-nums">
            <span>{t("ostat.hour0", lang)}</span>
            <span>{t("ostat.hour6", lang)}</span>
            <span>{t("ostat.hour12", lang)}</span>
            <span>{t("ostat.hour18", lang)}</span>
            <span>{t("ostat.hour23", lang)}</span>
          </div>
          {stats.periodVisits.length > 0 && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-mint-50)] text-[var(--color-mint-700)] text-[11.5px] font-bold">
                🔥 {t("ostat.peakHour", lang, { h: peakHour })}
              </span>
            </div>
          )}
        </Card>

        </div>
          <div>
        <SectionTitle icon={<Users className="w-4 h-4" />}>{t("ostat.weekly.title", lang)}</SectionTitle>
        <Card padding="md">
          <div className="grid grid-cols-7 gap-2">
            {[
              t("ostat.weekday.sun", lang),
              t("ostat.weekday.mon", lang),
              t("ostat.weekday.tue", lang),
              t("ostat.weekday.wed", lang),
              t("ostat.weekday.thu", lang),
              t("ostat.weekday.fri", lang),
              t("ostat.weekday.sat", lang),
            ].map((d, i) => {
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
                  <p className="text-[12px] font-bold text-[var(--color-ink-700)] mt-1">{d}</p>
                  <p className="text-[11px] text-[var(--color-ink-600)] tabular-nums">{v}</p>
                </div>
              );
            })}
          </div>
        </Card>

        </div>
          <div>
        <SectionTitle icon={<ShoppingBag className="w-4 h-4" />}>{t("ostat.menu.title", lang)}</SectionTitle>
        {stats.topMenus.length === 0 ? (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
            {t("ostat.menu.empty", lang)}
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
                    {t("ostat.menu.line", lang, { n: m.count, amount: fmtKRW(m.revenue, lang) })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        </div>
          <div>
        <SectionTitle>{t("ostat.tier.title", lang)}</SectionTitle>
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
                <span className="text-[12px] text-[var(--color-ink-700)] font-semibold">{t}</span>
                <span className="text-[12px] text-[var(--color-ink-600)] ml-auto tabular-nums">{tierDist[t]}</span>
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
      <p className="opacity-80 text-[12px] mb-0.5">{label}</p>
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
