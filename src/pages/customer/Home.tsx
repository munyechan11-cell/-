import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  QrCode,
  LogOut,
  Trash2,
  User as UserIcon,
  Sparkles,
  Ticket,
  Store as StoreIcon,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { getEffectiveTier, TIER_BADGE } from "../../lib/tier";
import { useLanguage, t, getLocale } from "../../lib/i18n";

export default function CustomerHome() {
  const nav = useNavigate();
  const { currentUser, users, visits, coupons, tierOverrides, logout, deleteAccount } = useStore();
  const lang = useLanguage();
  const locale = getLocale(lang);

  // 본인이 방문했던 매장 리스트 + 매장별 등급 계산
  const storesUsed = useMemo(() => {
    if (!currentUser) return [];
    const map: Record<string, { storeId: string; lastVisit: string; visitCount: number; uniqueDays: number }> = {};
    visits
      .filter((v) => v.customerId === currentUser.id)
      .forEach((v) => {
        const entry = map[v.storeId] ?? { storeId: v.storeId, lastVisit: v.date, visitCount: 0, uniqueDays: 0 };
        entry.visitCount += 1;
        if (v.date > entry.lastVisit) entry.lastVisit = v.date;
        map[v.storeId] = entry;
      });
    // uniqueDays 계산
    Object.values(map).forEach((m) => {
      const days = new Set(
        visits
          .filter((v) => v.customerId === currentUser.id && v.storeId === m.storeId)
          .map((v) => new Date(v.date).toDateString())
      );
      m.uniqueDays = days.size;
    });
    return Object.values(map).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
  }, [visits, currentUser]);

  const activeCoupons = useMemo(
    () => coupons.filter((c) => c.status !== "used" && c.customerId === currentUser?.id),
    [coupons, currentUser?.id]
  );

  if (!currentUser) return null;

  return (
    <MobileShell>
      <TopBar
        title={t("chome.title", lang)}
        back={() => nav("/")}
        right={
          <button
            onClick={() => {
              if (confirm(t("chome.logoutConfirm", lang))) {
                logout();
                nav("/", { replace: true });
              }
            }}
            className="w-10 h-10 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
            aria-label={t("profile.logout", lang)}
          >
            <LogOut className="w-4 h-4 text-[var(--color-navy-800)]" />
          </button>
        }
      />

      <div className="px-5 pt-2 pb-10">
        {/* Profile card */}
        <Card className="bg-[var(--color-navy-700)] text-white border-transparent shadow-[var(--shadow-navy)] p-6 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-[var(--color-mint-500)]/15" />
          <div className="flex items-center gap-3">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 text-white font-extrabold text-lg inline-flex items-center justify-center">
                {currentUser.name?.[0] ?? "결"}
              </div>
            )}
            <div className="flex-1">
              <p className="text-[12px] opacity-85 font-bold uppercase tracking-wider">{t("chome.role", lang)}</p>
              <p className="text-[22px] font-extrabold tracking-tight">{currentUser.name}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 mt-5 pt-5 border-t border-white/15 text-[12px]">
            <Stat label={t("chome.stat.stores", lang)} value={`${storesUsed.length}${t("chome.unit.store", lang)}`} />
            <Stat label={t("chome.stat.visits", lang)} value={`${visits.filter((v) => v.customerId === currentUser.id).length}${t("home.unit.visit", lang)}`} />
            <Stat label={t("chome.stat.coupons", lang)} value={`${activeCoupons.length}${t("home.unit.coupon", lang)}`} />
          </div>
        </Card>

        {/* QR Scan CTA */}
        <Link
          to="/scan"
          className="mt-4 block rounded-2xl bg-white border-2 border-dashed border-[var(--color-navy-200)] p-5 flex items-center gap-4 hover:border-[var(--color-navy-700)] hover:bg-[var(--color-navy-50)] transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--color-mint-100)] flex items-center justify-center">
            <QrCode className="w-6 h-6 text-[var(--color-mint-700)]" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">{t("chome.scanCta", lang)}</p>
            <p className="text-[12px] text-[var(--color-ink-500)] font-medium">{t("chome.scanCtaDesc", lang)}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--color-ink-400)]" />
        </Link>

        {/* 이용 매장 리스트 */}
        <SectionTitle icon={<StoreIcon className="w-4 h-4" />}>{t("chome.usedStores", lang)}</SectionTitle>
        {storesUsed.length === 0 ? (
          <Card padding="lg" className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-mint-100)] mx-auto mb-3 inline-flex items-center justify-center">
              <QrCode className="w-7 h-7 text-[var(--color-mint-700)]" />
            </div>
            <p className="text-[15px] text-[var(--color-navy-900)] font-bold mb-1">
              {t("chome.noStores", lang)}
            </p>
            <p className="text-[13px] text-[var(--color-ink-600)] mb-4">
              {t("chome.noStoresDesc", lang)}
            </p>
            <Button block onClick={() => nav("/scan")} leftIcon={<QrCode className="w-4 h-4" />}>
              {t("chome.scanStart", lang)}
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {storesUsed.map((s) => {
              const owner = users.find((u) => u.id === s.storeId && u.role === "owner");
              const override = tierOverrides.find(
                (o) => o.customerId === currentUser.id && o.storeId === s.storeId
              )?.tier;
              const tier = getEffectiveTier(s.uniqueDays, override);
              const tierName = owner?.tierNames?.[tier] ?? tier;
              const badge = TIER_BADGE[tier];
              return (
                <Link key={s.storeId} to={`/customer/store/${s.storeId}`}>
                  <Card padding="md" interactive className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-navy-100)] text-[var(--color-navy-700)] font-extrabold inline-flex items-center justify-center">
                      {(owner?.restaurantName ?? "?").slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-bold text-[var(--color-navy-900)] truncate">
                          {owner?.restaurantName ?? t("chome.unknownStore", lang)}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>
                          {tierName}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--color-ink-600)] mt-0.5">
                        {t("chome.visitCount", lang, { n: s.visitCount, date: new Date(s.lastVisit).toLocaleDateString(locale) })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--color-ink-400)] shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* 보유 쿠폰 요약 */}
        <SectionTitle icon={<Ticket className="w-4 h-4" />}>{t("chome.couponsTitle", lang, { n: activeCoupons.length })}</SectionTitle>
        {activeCoupons.length === 0 ? (
          <Card padding="lg" className="text-center">
            <Ticket className="w-7 h-7 text-[var(--color-ink-300)] mx-auto mb-2" />
            <p className="text-[14px] text-[var(--color-ink-600)] font-medium">
              {t("chome.noCoupons", lang)}
            </p>
            <p className="text-[12px] text-[var(--color-ink-500)] mt-1">
              {t("chome.noCouponsDesc", lang)}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {activeCoupons.slice(0, 5).map((c) => {
              const owner = users.find((u) => u.id === c.storeId && u.role === "owner");
              const badge =
                TIER_BADGE[c.type as keyof typeof TIER_BADGE] ?? {
                  label: c.type,
                  bg: "bg-[var(--color-navy-50)]",
                  text: "text-[var(--color-navy-700)]",
                };
              return (
                <Card key={c.id} padding="md">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-[12px] text-[var(--color-ink-600)] font-semibold truncate">
                      {owner?.restaurantName ?? t("common.store", lang)}
                    </span>
                    {c.status === "pending" && (
                      <span className="ml-auto text-[11px] text-[var(--color-warn)] font-bold">{t("chome.couponPending", lang)}</span>
                    )}
                  </div>
                  <p className="text-[14px] font-bold text-[var(--color-navy-900)]">{c.description}</p>
                  {owner && (
                    <Link
                      to={`/customer/store/${c.storeId}`}
                      className="mt-2 inline-block text-[12px] font-bold text-[var(--color-navy-700)]"
                    >
                      {t("chome.viewStore", lang)}
                    </Link>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* 최근 방문 */}
        <SectionTitle icon={<Calendar className="w-4 h-4" />}>{t("chome.recentVisits", lang)}</SectionTitle>
        <Card padding="md">
          {(() => {
            const recent = visits
              .filter((v) => v.customerId === currentUser.id)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5);
            if (recent.length === 0) {
              return <p className="text-[13px] text-[var(--color-ink-500)] text-center">{t("chome.noRecent", lang)}</p>;
            }
            return (
              <ul className="space-y-2">
                {recent.map((v) => {
                  const owner = users.find((u) => u.id === v.storeId && u.role === "owner");
                  return (
                    <li key={v.id} className="flex items-center gap-3 text-[13px]">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center font-bold text-[11px]">
                        T{v.tableNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--color-navy-900)] truncate">
                          {owner?.restaurantName ?? t("common.store", lang)}
                        </p>
                        <p className="text-[12px] text-[var(--color-ink-600)]">
                          {new Date(v.date).toLocaleString(locale, { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </Card>

        {/* Account actions */}
        <div className="mt-8 space-y-2.5">
          <Button block variant="ghost" leftIcon={<UserIcon className="w-4 h-4" />}>
            {currentUser.phone || t("chome.noPhone", lang)}
          </Button>
          <Button
            block
            variant="outline"
            className="text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:border-[var(--color-danger)]"
            leftIcon={<Trash2 className="w-4 h-4" />}
            onClick={async () => {
              if (confirm(t("profile.deleteConfirm", lang))) {
                await deleteAccount();
                nav("/", { replace: true });
              }
            }}
          >
            {t("profile.deleteAccount", lang)}
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="opacity-80 text-[12px] mb-0.5 font-semibold">{label}</p>
      <p className="font-extrabold text-[16px] tabular-nums">{value}</p>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mt-7 mb-2 px-1 text-[14px] font-bold text-[var(--color-navy-900)] flex items-center gap-1.5">
      {icon}
      {children}
    </h2>
  );
}
