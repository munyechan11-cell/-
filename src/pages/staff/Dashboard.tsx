import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Clock,
  LogIn,
  LogOut as ClockOutIcon,
  ChefHat,
  LayoutGrid,
  UtensilsCrossed,
  Calendar,
  Image as ImageIcon,
  QrCode,
  ChevronRight,
  Lock,
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { showToast } from "../../lib/toast";
import { useLanguage, t, type Lang } from "../../lib/i18n";

function fmtDuration(ms: number, lang: Lang) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return t("sdash.hourMin", lang, { h, m });
}

export default function StaffDashboard() {
  const { currentUser, users, shifts, activeShift, clockIn, clockOut } = useStore();
  const lang = useLanguage();
  const locale = lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "vi" ? "vi-VN" : "en-US";

  // 1분마다 갱신해 경과 시간/오늘 누적이 살아 움직이게
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activeShift) return;
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, [activeShift]);

  const stats = useMemo(() => {
    if (!currentUser || currentUser.role !== "staff") return { todayMs: 0, weekMs: 0 };
    const now = Date.now();
    const todayKey = new Date().toDateString();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    let todayMs = 0;
    let weekMs = 0;
    for (const s of shifts.filter((s) => s.staffId === currentUser.id)) {
      const inT = new Date(s.clockInAt).getTime();
      const outT = s.clockOutAt ? new Date(s.clockOutAt).getTime() : now;
      const dur = Math.max(0, outT - inT);
      if (new Date(s.clockInAt).toDateString() === todayKey) todayMs += dur;
      if (inT >= weekAgo) weekMs += dur;
    }
    return { todayMs, weekMs };
    // tick은 갱신용 의존성
  }, [shifts, currentUser, tick]);

  if (!currentUser) return <Navigate to="/biz/owner/login" replace />;
  if (currentUser.role !== "staff") {
    return <Navigate to={currentUser.role === "owner" ? "/biz/owner" : "/customer"} replace />;
  }
  if (!currentUser.employerStoreId) return <Navigate to="/biz/staff/store-search" replace />;
  if (currentUser.employerStatus !== "approved") return <Navigate to="/biz/staff/pending" replace />;

  const owner = users.find((u) => u.id === currentUser.employerStoreId);
  const onDuty = !!activeShift;

  const LINKS = [
    { to: "/biz/owner/reservations", icon: Calendar, labelKey: "sdash.menu.reservations", free: true },
    { to: "/biz/owner/orders", icon: ChefHat, labelKey: "sdash.menu.orders", free: false },
    { to: "/biz/owner/tables", icon: LayoutGrid, labelKey: "sdash.menu.tables", free: false },
    { to: "/biz/owner/menus", icon: UtensilsCrossed, labelKey: "sdash.menu.menus", free: false },
    { to: "/biz/owner/photos", icon: ImageIcon, labelKey: "sdash.menu.photos", free: false },
    { to: "/biz/owner/qr-print", icon: QrCode, labelKey: "sdash.menu.qrPrint", free: false },
  ];

  return (
    <OwnerShell title={t("sdash.title", lang)}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-5">
        <Card
          className={`lg:col-span-2 border-transparent text-white p-7 lg:p-8 shadow-[var(--shadow-navy)] relative overflow-hidden ${
            onDuty ? "bg-[var(--color-mint-600)]" : "bg-[var(--color-navy-700)]"
          }`}
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10" />
          <p className="text-[12px] font-bold uppercase tracking-wider text-white/75">
            {t("sdash.storeRole", lang, { store: owner?.restaurantName ?? t("common.store", lang), role: currentUser.position || t("sdash.roleDefault", lang) })}
          </p>
          <p className="mt-3 text-[28px] lg:text-[34px] font-extrabold tracking-tighter">
            {onDuty ? t("sdash.onDuty", lang) : t("sdash.offDuty", lang)}
          </p>
          {activeShift && (
            <p className="text-[14px] lg:text-[15px] text-white/85 mt-2 font-semibold tabular-nums">
              {t("sdash.clockedSince", lang, {
                time: new Date(activeShift.clockInAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
                elapsed: fmtDuration(Date.now() - new Date(activeShift.clockInAt).getTime(), lang),
              })}
            </p>
          )}

          <div className="mt-6">
            {onDuty ? (
              <Button
                variant="outline"
                className="bg-white text-[var(--color-navy-800)] hover:bg-white/90 border-transparent"
                leftIcon={<ClockOutIcon className="w-4 h-4" />}
                onClick={async () => {
                  await clockOut();
                }}
              >
                {t("sdash.btn.clockOut", lang)}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="bg-white text-[var(--color-navy-800)] hover:bg-white/90 border-transparent"
                leftIcon={<LogIn className="w-4 h-4" />}
                onClick={async () => {
                  await clockIn();
                }}
              >
                {t("sdash.btn.clockIn", lang)}
              </Button>
            )}
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-mint-700)]">
            <Clock className="w-4 h-4" />
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-mint-700)]">
              {t("sdash.stat.today", lang)}
            </p>
          </div>
          <p className="mt-2 text-[30px] lg:text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter tabular-nums">
            {fmtDuration(stats.todayMs, lang)}
          </p>
          <p className="text-[13px] text-[var(--color-ink-600)] font-medium">{t("sdash.stat.todayDesc", lang)}</p>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-navy-700)]">
            <Clock className="w-4 h-4" />
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-navy-700)]">
              {t("sdash.stat.week", lang)}
            </p>
          </div>
          <p className="mt-2 text-[30px] lg:text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter tabular-nums">
            {fmtDuration(stats.weekMs, lang)}
          </p>
          <p className="text-[13px] text-[var(--color-ink-600)] font-medium">{t("sdash.stat.weekDesc", lang)}</p>
        </Card>
      </div>

      <div className="mt-8 lg:mt-10">
        <h2 className="headline-sub mb-3 px-1">{t("sdash.menu.title", lang)}</h2>
        {!onDuty && (
          <p className="body-md text-[var(--color-ink-600)] mb-4 px-1">
            {t("sdash.menu.guide", lang)}
          </p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {LINKS.map(({ to, icon: Icon, labelKey, free }) => {
            const locked = !onDuty && !free;
            const inner = (
              <Card
                padding="md"
                interactive={!locked}
                className={`h-[124px] lg:h-[130px] flex flex-col justify-between ${
                  locked ? "opacity-60" : ""
                }`}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-navy-50)] text-[var(--color-navy-700)]">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] lg:text-[15px] font-bold text-[var(--color-navy-900)] tracking-tight">
                    {t(labelKey, lang)}
                  </span>
                  {locked ? (
                    <Lock className="w-4 h-4 text-[var(--color-ink-400)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--color-ink-400)]" />
                  )}
                </div>
              </Card>
            );
            return locked ? (
              <button
                key={to}
                onClick={() => showToast(t("sdash.lockToast", lang), "info")}
                className="text-left"
              >
                {inner}
              </button>
            ) : (
              <Link key={to} to={to}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </OwnerShell>
  );
}
