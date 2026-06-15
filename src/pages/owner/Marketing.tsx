/**
 * 마케팅 자동화 — 사장님이 한 화면에서:
 *   1) 이탈 위험 손님(최근 N일 무방문 단골)
 *   2) 이번 달 생일 손님
 *   3) 최근 등급이 올라간 신규 단골
 * 후보를 보고 일괄 쿠폰을 발급할 수 있다.
 *
 * 데이터 출처:
 *   - users (role=customer, birthday="YYYY-MM-DD")
 *   - visits (customerId + storeId 기준 일자별 방문)
 *   - getCustomerTier(uniqueDays) — lib/tier 로직 재사용
 */
import { useMemo, useState } from "react";
import { TrendingDown, Cake, Crown, Ticket, AlertTriangle } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import type { User } from "../../lib/types";
import { getCustomerTier, TIER_ORDER, TIER_BADGE } from "../../lib/tier";
import { useLanguage, t } from "../../lib/i18n";
import { useModalChrome } from "../../lib/useModalChrome";

interface Candidate {
  user: User;
  // 이탈: 마지막 방문 이후 경과일
  lastVisitDaysAgo?: number;
  // 생일: 일(day) — 이번달 안에서 정렬
  birthDay?: number;
  // 등급: 현재 티어
  tier?: string;
  // 등급 진입일(가장 최근 visit로 임계점 통과한 날)
  tieredAt?: string;
}

type Bucket = "slipping" | "birthday" | "tier";

const DEFAULT_SLIPPING_DAYS = 30;
const RECENT_TIER_DAYS = 14;

export default function OwnerMarketing() {
  const { effectiveStoreId, users, visits, bulkIssueCoupon } = useStore();
  // effectiveStoreId 가 비어 있으면(직원 미승인 등) 잘못된 매장에 쿠폰이 박히므로
  // currentUser.id 폴백 금지. 빈 문자열이면 후보 계산이 0건으로 나와 안전 차단.
  const storeId = effectiveStoreId;
  const lang = useLanguage();

  // 사장님이 이탈 기준 일수를 즉석에서 조정 (기본 30일)
  const [slippingDays, setSlippingDays] = useState(DEFAULT_SLIPPING_DAYS);
  // 쿠폰 발급 모달 상태
  const [bulkModal, setBulkModal] = useState<{
    bucket: Bucket;
    customers: User[];
  } | null>(null);

  // ============ 후보 계산 ============
  // 매장 손님 + 방문 통계 인덱스
  const customers = useMemo(() => {
    const visitedIds = new Set(visits.filter((v) => v.storeId === storeId).map((v) => v.customerId));
    return users
      .filter((u) => u.role === "customer" && u.status !== "deleted" && visitedIds.has(u.id))
      .map((u) => {
        const myVisits = visits
          .filter((v) => v.customerId === u.id && v.storeId === storeId)
          .map((v) => new Date(v.date).getTime())
          .sort((a, b) => a - b);
        const uniqueDays = new Set(
          myVisits.map((t) => new Date(t).toDateString())
        ).size;
        const tier = getCustomerTier(uniqueDays);
        const lastVisit = myVisits[myVisits.length - 1];
        // 등급 진입일: 현재 티어 임계점에 도달한 visit (uniqueDays 기준 단순 추정 — 가장 최근 visit 사용)
        const tieredAt = lastVisit ? new Date(lastVisit).toISOString() : undefined;
        return { user: u, lastVisit, uniqueDays, tier, tieredAt };
      });
  }, [users, visits, storeId]);

  // 1) 이탈 위험: 2회+ 방문이지만 최근 slippingDays 동안 무방문
  const slipping = useMemo<Candidate[]>(() => {
    // 자정 기준 일수 차 — ms 차/86400000 을 floor 하면 방문 시각이 늦을수록 하루 적게 세어
    // slippingDays 경계(예: 30일)가 실제 31일째에 잡히던 off-by-one 이 있었음.
    const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const today0 = startOfDay(Date.now());
    return customers
      .filter((c) => c.uniqueDays >= 2 && c.lastVisit)
      .map((c) => ({
        user: c.user,
        lastVisitDaysAgo: Math.round((today0 - startOfDay(c.lastVisit ?? today0)) / 86_400_000),
        tier: c.tier,
      }))
      .filter((c) => (c.lastVisitDaysAgo ?? 0) >= slippingDays)
      .sort((a, b) => (b.lastVisitDaysAgo ?? 0) - (a.lastVisitDaysAgo ?? 0));
  }, [customers, slippingDays]);

  // 2) 이번 달 생일: birthday 의 월이 이번 달인 손님
  const birthday = useMemo<Candidate[]>(() => {
    const now = new Date();
    const thisMonth = now.getMonth() + 1; // 1~12
    const today = now.getDate();
    // 이번달 일수 — 28/29/30/31 분기. 정렬에서 다음달 환산 시 사용.
    const daysInThisMonth = new Date(now.getFullYear(), thisMonth, 0).getDate();
    return customers
      .filter((c) => {
        if (!c.user.birthday) return false;
        const parts = c.user.birthday.split("-");
        if (parts.length !== 3) return false;
        const m = Number(parts[1]);
        return Number.isFinite(m) && m === thisMonth;
      })
      .map((c) => {
        const day = Number(c.user.birthday!.split("-")[2]);
        return {
          user: c.user,
          birthDay: Number.isFinite(day) ? day : undefined,
          tier: c.tier,
        };
      })
      .filter((c) => c.birthDay !== undefined)
      .sort((a, b) => {
        // 오늘=0, 다가오는 생일 오름차순, 지난 생일은 순환시켜 뒤로 (모듈러 거리)
        const d = (bd: number) => (bd - today + daysInThisMonth) % daysInThisMonth;
        return d(a.birthDay ?? 0) - d(b.birthDay ?? 0);
      });
  }, [customers]);

  // 3) 신규 단골: 등급이 일반(0회) 외이면서 최근 RECENT_TIER_DAYS일 안에 단골 진입한 손님
  // 단순 추정 — 가장 최근 visit 기준
  const newTier = useMemo<Candidate[]>(() => {
    const cutoff = Date.now() - RECENT_TIER_DAYS * 86_400_000;
    return customers
      .filter((c) => c.tier !== "일반" && (c.lastVisit ?? 0) >= cutoff)
      .map((c) => ({ user: c.user, tier: c.tier, tieredAt: c.tieredAt }))
      .sort((a, b) => {
        const ta = TIER_ORDER.indexOf((a.tier ?? "일반") as any);
        const tb = TIER_ORDER.indexOf((b.tier ?? "일반") as any);
        return tb - ta;
      });
  }, [customers]);

  const openBulk = (bucket: Bucket, cands: Candidate[]) => {
    if (cands.length === 0) return;
    setBulkModal({ bucket, customers: cands.map((c) => c.user) });
  };

  return (
    <OwnerShell title={t("mkt.title", lang)}>
      <div className="max-w-[900px] mx-auto pb-12">
        <p className="text-[13px] text-[var(--color-ink-600)] mb-4 leading-relaxed">
          {t("mkt.subtitle", lang)}
        </p>

        {/* 1) 이탈 위험 */}
        <Section
          icon={<TrendingDown className="w-4 h-4 text-[var(--color-danger)]" />}
          title={t("mkt.section.slipping.title", lang)}
          desc={t("mkt.section.slipping.desc", lang, { n: slippingDays })}
          tone="danger"
          count={slipping.length}
          right={
            <div className="flex items-center gap-1.5 ml-auto">
              <label className="text-[11.5px] font-bold text-[var(--color-ink-500)]">
                {t("mkt.daysInput", lang)}
              </label>
              <input
                type="number"
                min={7}
                max={365}
                inputMode="numeric"
                value={slippingDays}
                onChange={(e) => {
                  // 빈 문자열은 그대로 두지 못함(state 가 number) — blur 시 보정.
                  const v = Number(e.target.value);
                  if (e.target.value === "") return; // 입력 도중엔 즉시 30 으로 점프 안 함
                  if (Number.isFinite(v)) setSlippingDays(Math.max(1, Math.min(365, v)));
                }}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v < 7) setSlippingDays(30);
                }}
                className="w-16 h-9 px-2 rounded-[10px] border border-[var(--color-line)] text-[13px] font-bold tabular-nums text-center"
              />
            </div>
          }
        >
          <CandidateList
            list={slipping}
            empty={t("mkt.empty", lang)}
            badge={(c) =>
              c.lastVisitDaysAgo !== undefined ? t("mkt.lastVisit", lang, { n: c.lastVisitDaysAgo }) : null
            }
          />
          <BulkBtn
            count={slipping.length}
            onClick={() => openBulk("slipping", slipping)}
          />
        </Section>

        {/* 2) 이번달 생일 */}
        <Section
          icon={<Cake className="w-4 h-4 text-[#f59e0b]" />}
          title={t("mkt.section.birthday.title", lang)}
          desc={t("mkt.section.birthday.desc", lang)}
          tone="birthday"
          count={birthday.length}
        >
          <CandidateList
            list={birthday}
            empty={t("mkt.empty", lang)}
            badge={(c) => {
              const today = new Date().getDate();
              const isToday = c.birthDay === today;
              if (isToday) return t("mkt.bday.todayBadge", lang);
              return t("mkt.bday.day", lang, { n: c.birthDay ?? 0 });
            }}
          />
          <BulkBtn
            count={birthday.length}
            onClick={() => openBulk("birthday", birthday)}
          />
        </Section>

        {/* 3) 신규 단골 */}
        <Section
          icon={<Crown className="w-4 h-4 text-[var(--color-mint-700)]" />}
          title={t("mkt.section.tier.title", lang)}
          desc={t("mkt.section.tier.desc", lang)}
          tone="ok"
          count={newTier.length}
          rightSub={t("mkt.tier.recentDays", lang, { n: RECENT_TIER_DAYS })}
        >
          <CandidateList
            list={newTier}
            empty={t("mkt.empty", lang)}
            badge={(c) => {
              const tier = c.tier as keyof typeof TIER_BADGE | undefined;
              return tier ? TIER_BADGE[tier].label : null;
            }}
            badgeTone={(c) => {
              const tier = c.tier as keyof typeof TIER_BADGE | undefined;
              if (!tier) return undefined;
              const bd = TIER_BADGE[tier];
              return { bg: bd.bg, text: bd.text };
            }}
          />
          <BulkBtn
            count={newTier.length}
            onClick={() => openBulk("tier", newTier)}
          />
        </Section>
      </div>

      {bulkModal && (
        <BulkCouponModal
          bucket={bulkModal.bucket}
          customers={bulkModal.customers}
          storeId={storeId}
          onClose={() => setBulkModal(null)}
          onConfirm={async (type, desc, amount) => {
            await bulkIssueCoupon(
              bulkModal.customers.map((u) => u.id),
              storeId,
              type,
              desc,
              amount
            );
            setBulkModal(null);
          }}
        />
      )}
    </OwnerShell>
  );
}

// ============================================================
// Section — 자동화 카드 스켈레톤
// ============================================================
function Section({
  icon,
  title,
  desc,
  count,
  tone,
  right,
  rightSub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  count: number;
  tone?: "danger" | "birthday" | "ok";
  right?: React.ReactNode;
  rightSub?: string;
  children: React.ReactNode;
}) {
  const lang = useLanguage();
  const toneBg =
    tone === "danger"
      ? "bg-[#fff1f0] border-[#ffd1cc]"
      : tone === "birthday"
        ? "bg-[#fff8e6] border-[#ffe7a1]"
        : "bg-[var(--color-mint-50)] border-[var(--color-mint-200)]";
  return (
    <Card padding="lg" className={`mt-4 ${toneBg} border-[1.5px]`}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        {icon}
        <h2 className="text-[15.5px] font-extrabold text-[var(--color-navy-900)]">{title}</h2>
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--color-ink-500)] bg-white px-1.5 py-0.5 rounded">
          {t("mkt.candidateN", lang, { n: count })}
        </span>
        {right}
      </div>
      <p className="text-[12.5px] text-[var(--color-ink-600)] mb-3 leading-relaxed">{desc}</p>
      {rightSub && (
        <p className="text-[11px] font-bold text-[var(--color-ink-500)] mb-2">{rightSub}</p>
      )}
      {children}
    </Card>
  );
}

// ============================================================
// CandidateList — 후보 손님 칩 리스트
// ============================================================
function CandidateList({
  list,
  empty,
  badge,
  badgeTone,
}: {
  list: Candidate[];
  empty: string;
  badge: (c: Candidate) => string | null;
  badgeTone?: (c: Candidate) => { bg: string; text: string } | undefined;
}) {
  if (list.length === 0) {
    return <p className="text-[13px] text-[var(--color-ink-500)] py-1.5">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {list.slice(0, 30).map((c) => {
        const b = badge(c);
        const tone = badgeTone?.(c);
        return (
          <div
            key={c.user.id}
            className="inline-flex items-center gap-1.5 bg-white border border-[var(--color-line)] rounded-full pl-2 pr-2.5 py-1"
          >
            <span className="w-5 h-5 rounded-full bg-[var(--color-navy-50)] inline-flex items-center justify-center text-[11px] font-extrabold text-[var(--color-navy-700)]">
              {c.user.name?.[0] ?? "?"}
            </span>
            <span className="text-[12px] font-bold text-[var(--color-navy-900)] truncate max-w-[80px]">
              {c.user.name}
            </span>
            {b && (
              <span
                className="text-[10.5px] font-bold px-1.5 rounded-full"
                style={
                  tone
                    ? { backgroundColor: tone.bg, color: tone.text }
                    : { backgroundColor: "var(--color-bg)", color: "var(--color-ink-600)" }
                }
              >
                {b}
              </span>
            )}
          </div>
        );
      })}
      {list.length > 30 && (
        <span className="text-[11.5px] font-bold text-[var(--color-ink-500)] self-center">
          +{list.length - 30}
        </span>
      )}
    </div>
  );
}

// ============================================================
// BulkBtn — 일괄 쿠폰 발급 버튼
// ============================================================
function BulkBtn({ count, onClick }: { count: number; onClick: () => void }) {
  const lang = useLanguage();
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="mt-3 h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-extrabold shadow-[var(--shadow-navy)]"
    >
      <Ticket className="w-4 h-4" />
      {t("mkt.bulkBtn", lang, { n: count })}
    </button>
  );
}

// ============================================================
// BulkCouponModal — 쿠폰 종류/설명 입력 모달
// ============================================================
function BulkCouponModal({
  bucket,
  customers,
  onClose,
  onConfirm,
}: {
  bucket: Bucket;
  customers: User[];
  storeId: string;
  onClose: () => void;
  onConfirm: (type: string, desc: string, amount?: number) => Promise<void> | void;
}) {
  const lang = useLanguage();
  // busy 중엔 onClose 가 차단되므로 useModalChrome 의 ESC 도 안전.
  useModalChrome(true, onClose);
  // 종류 기본값: 버킷별로 다르게
  const defaultType = bucket === "birthday" ? "birthday" : bucket === "tier" ? "welcome" : "winback";
  const defaultDesc =
    bucket === "slipping"
      ? t("mkt.coupon.descPh.slipping", lang)
      : bucket === "birthday"
        ? t("mkt.coupon.descPh.birthday", lang)
        : t("mkt.coupon.descPh.tier", lang);
  const [type, setType] = useState(defaultType);
  const [desc, setDesc] = useState(defaultDesc);
  const [amount, setAmount] = useState(""); // 금액 쿠폰(8-7) — 비우면 일반 쿠폰
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !desc.trim()) return;
    setBusy(true);
    try {
      await onConfirm(type.trim() || defaultType, desc.trim(), Math.max(0, Number(amount) || 0));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] sm:pb-6"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-5" />
        <h2 className="text-[18px] font-extrabold text-[var(--color-navy-900)] mb-1">
          {t("mkt.bulkBtn", lang, { n: customers.length })}
        </h2>
        <p className="text-[12.5px] text-[var(--color-ink-500)] mb-4 truncate">
          {customers
            .slice(0, 5)
            .map((c) => c.name)
            .join(", ")}
          {customers.length > 5 ? ` +${customers.length - 5}` : ""}
        </p>
        <div className="space-y-3">
          <Input
            label={t("mkt.coupon.type", lang)}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <Input
            label={t("mkt.coupon.desc", lang)}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div>
            <Input
              label={t("mkt.coupon.amount", lang)}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="0"
            />
            <p className="text-[11px] text-[var(--color-ink-500)] mt-1 leading-relaxed">{t("mkt.coupon.amountHint", lang)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t("mkt.coupon.cancel", lang)}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!desc.trim()}>
            {t("mkt.coupon.confirm", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}
