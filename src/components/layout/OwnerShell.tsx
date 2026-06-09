import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ChefHat,
  Users,
  BarChart3,
  Calendar,
  Image as ImageIcon,
  QrCode,
  Settings,
  UtensilsCrossed,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  X,
  Briefcase,
  LogIn as ClockInIcon,
  LogOut as ClockOutIcon,
  Clock,
  Lock,
  HelpCircle,
  Megaphone,
  Package,
  Wallet,
  Monitor,
  Tablet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";
import { showToast } from "../../lib/toast";
import { getStoreOpenStatus, summarizeStatus } from "../../lib/businessHours";
import { useLanguage, t } from "../../lib/i18n";
import { canStaffAccess } from "../../lib/staffAccess";
import { PushOnboarding } from "../ui/PushOnboarding";

interface Props {
  children: React.ReactNode;
  title?: string;
  /** 모바일 페이지 헤더에 표시할 우측 액션 */
  headerRight?: React.ReactNode;
  /** 콘텐츠 가로 폭 변형 */
  width?: "default" | "narrow" | "full";
}

type NavItem = {
  to: string;
  /** i18n 키 — t(labelKey) 로 화면에 표시 */
  labelKey: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** staff가 출근하지 않아도 접근 가능한지 */
  staffFree?: boolean;
  /** 사이드바 그룹 — 사장님 메뉴 분류 */
  group?: NavGroup;
};

type NavGroup = "operation" | "customer" | "management" | "settings";
const NAV_GROUPS: NavGroup[] = ["operation", "customer", "management", "settings"];

const NAV: NavItem[] = [
  // 운영 — 매일 쓰는 현장 기능
  { to: "/biz/owner", labelKey: "ownerNav.dashboard", icon: LayoutDashboard, end: true, group: "operation" },
  { to: "/biz/owner/orders", labelKey: "ownerNav.orders", icon: ChefHat, group: "operation" },
  { to: "/biz/owner/quick-order", labelKey: "ownerNav.quickOrder", icon: Zap, group: "operation" },
  { to: "/biz/owner/kitchen", labelKey: "ownerNav.kitchen", icon: Monitor, group: "operation" },
  { to: "/biz/owner/kiosk", labelKey: "ownerNav.kiosk", icon: Tablet, group: "operation" },
  { to: "/biz/owner/tables", labelKey: "ownerNav.tables", icon: LayoutGrid, group: "operation" },
  { to: "/biz/owner/menus", labelKey: "ownerNav.menus", icon: UtensilsCrossed, group: "operation" },
  // 고객 — 고객관계·마케팅
  { to: "/biz/owner/customers", labelKey: "ownerNav.customers", icon: Users, group: "customer" },
  { to: "/biz/owner/marketing", labelKey: "ownerNav.marketing", icon: Megaphone, group: "customer" },
  { to: "/biz/owner/reservations", labelKey: "ownerNav.reservations", icon: Calendar, staffFree: true, group: "customer" },
  { to: "/biz/owner/photos", labelKey: "ownerNav.reviews", icon: ImageIcon, group: "customer" },
  // 경영 — 재고·정산·인사
  { to: "/biz/owner/inventory", labelKey: "ownerNav.inventory", icon: Package, group: "management" },
  { to: "/biz/owner/statistics", labelKey: "ownerNav.statistics", icon: BarChart3, group: "management" },
  { to: "/biz/owner/settlement", labelKey: "ownerNav.settlement", icon: Wallet, group: "management" },
  { to: "/biz/owner/staff", labelKey: "ownerNav.staff", icon: Briefcase, group: "management" },
  // 설정
  { to: "/biz/owner/qr-print", labelKey: "ownerNav.qrPrint", icon: QrCode, group: "settings" },
  { to: "/biz/owner/brand-settings", labelKey: "ownerNav.brand", icon: Settings, group: "settings" },
  { to: "/biz/owner/help", labelKey: "ownerNav.help", icon: HelpCircle, staffFree: true, group: "settings" },
];

const STAFF_DASHBOARD: NavItem = { to: "/biz/staff", labelKey: "ownerNav.dashboard", icon: LayoutDashboard, end: true, staffFree: true, group: "operation" };

export function OwnerShell({ children, title, headerRight, width = "default" }: Props) {
  const { currentUser, users, logout, activeShift, clockIn, clockOut, updateBrandSettings } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const lang = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isStaff = currentUser?.role === "staff";
  const onDuty = !!activeShift;

  // 키오스크는 사장님이 설정에서 켰을 때만 노출 (옵트인)
  const kioskOn = !isStaff && currentUser?.storeConfig?.kioskEnabled === true;
  const staffLevel = currentUser?.staffLevel ?? 1;
  const navItems: NavItem[] = isStaff
    ? [STAFF_DASHBOARD, ...NAV.filter((n) => canStaffAccess(n.to, staffLevel, currentUser?.extraPerms))]
    : NAV.filter((n) => n.to !== "/biz/owner/kiosk" || kioskOn);

  const active = navItems.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  const heading = title ?? (active ? t(active.labelKey, lang) : t("ownerNav.dashboard", lang));

  const employerName = isStaff
    ? users.find((u) => u.id === currentUser?.employerStoreId)?.restaurantName ?? t("common.store", lang)
    : currentUser?.restaurantName ?? "결";

  // 영업 상태 — 사장님 화면 헤더에 실시간 표시. 1분마다 자동 재계산.
  const storeOwner = isStaff
    ? users.find((u) => u.id === currentUser?.employerStoreId)
    : currentUser;
  const [openStatus, setOpenStatus] = useState(() => getStoreOpenStatus(storeOwner));
  useEffect(() => {
    setOpenStatus(getStoreOpenStatus(storeOwner));
    const id = setInterval(() => setOpenStatus(getStoreOpenStatus(storeOwner)), 60_000);
    return () => clearInterval(id);
  }, [storeOwner?.temporarilyClosed, storeOwner?.businessHours]);
  const ownerId = storeOwner?.id ?? "";
  const toggleTemporaryClose = async () => {
    if (!ownerId || isStaff) return;
    const next = !storeOwner?.temporarilyClosed;
    try {
      await updateBrandSettings(ownerId, { temporarilyClosed: next });
      showToast(next ? t("shell.tempClosed") : t("shell.tempOpened"), next ? "info" : "success");
    } catch (e: any) {
      showToast(t("shell.toggleFail", undefined, { msg: e?.message ?? "" }), "error");
    }
  };

  const handleStaffLinkClick = (item: NavItem, e: React.MouseEvent) => {
    if (!isStaff) return;
    if (!item.staffFree && !onDuty && !item.end) {
      e.preventDefault();
      showToast(t("shell.needClockIn"), "info");
    }
  };

  const widthClass =
    width === "narrow" ? "max-w-[760px]" : width === "full" ? "max-w-[1400px]" : "max-w-[1200px]";

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PushOnboarding />
      {/* ===== Desktop sidebar ===== */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] flex-col bg-white border-r border-[var(--color-line)] z-30">
        <Link to={isStaff ? "/biz/staff" : "/biz/owner"} className="flex items-center gap-2.5 px-6 h-[72px] border-b border-[var(--color-line-soft)]">
          <span className="w-10 h-10 rounded-xl bg-[var(--color-navy-700)] text-white text-xl font-extrabold flex items-center justify-center shadow-[var(--shadow-navy)]">
            결
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">
              {employerName}
            </p>
            <p className="text-[12px] text-[var(--color-ink-600)] font-semibold">
              {isStaff ? t("shell.staffRole", lang, { position: currentUser?.position || t("shell.staffDefault", lang) }) : t("shell.ownerConsole", lang)}
            </p>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto p-3 space-y-3">
          {NAV_GROUPS.map((g) => {
            const items = navItems.filter((n) => n.group === g);
            if (items.length === 0) return null;
            return (
              <div key={g} className="space-y-0.5">
                <p className="px-3.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">
                  {t(`navGroup.${g}`, lang)}
                </p>
                {items.map((n) => {
                  const locked = isStaff && !n.staffFree && !n.end && !onDuty;
                  return (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end={n.end}
                      onClick={(e) => handleStaffLinkClick(n, e)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 h-12 px-3.5 rounded-xl text-[14.5px] font-semibold transition-colors",
                          isActive
                            ? "bg-[var(--color-navy-700)] text-white shadow-[var(--shadow-navy)]"
                            : "text-[var(--color-ink-700)] hover:bg-[var(--color-navy-50)] hover:text-[var(--color-navy-800)]",
                          locked && "opacity-50"
                        )
                      }
                    >
                      <n.icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="flex-1">{t(n.labelKey, lang)}</span>
                      {locked && <Lock className="w-3.5 h-3.5" />}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-line-soft)] p-3">
          <button
            onClick={() => {
              logout();
              nav("/", { replace: true });
            }}
            className="flex items-center gap-3 h-11 w-full px-3.5 rounded-xl text-[14px] font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-navy-50)]"
          >
            <LogOut className="w-[18px] h-[18px]" />
            {t("shell.logout", lang)}
          </button>
        </div>
      </aside>

      {/* ===== Mobile drawer ===== */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)}>
          <aside
            className="absolute inset-y-0 left-0 w-[300px] max-w-[88vw] bg-white flex flex-col animate-[gyeol-slide-up_.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-[68px] border-b border-[var(--color-line-soft)]">
              <div className="leading-tight min-w-0 flex-1">
                <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] truncate">
                  {employerName}
                </p>
                <p className="text-[12px] text-[var(--color-ink-600)] font-semibold mt-0.5">
                  {isStaff ? t("shell.staffRole", lang, { position: currentUser?.position || t("shell.staffDefault", lang) }) : t("shell.ownerConsole", lang)}
                </p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-11 h-11 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center shrink-0" aria-label={t("shell.menuClose", lang)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-3">
              {NAV_GROUPS.map((g) => {
                const items = navItems.filter((n) => n.group === g);
                if (items.length === 0) return null;
                return (
                  <div key={g} className="space-y-0.5">
                    <p className="px-3.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)]">
                      {t(`navGroup.${g}`, lang)}
                    </p>
                    {items.map((n) => {
                      const locked = isStaff && !n.staffFree && !n.end && !onDuty;
                      return (
                        <NavLink
                          key={n.to}
                          to={n.to}
                          end={n.end}
                          onClick={(e) => {
                            handleStaffLinkClick(n, e);
                            if (!e.defaultPrevented) setDrawerOpen(false);
                          }}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 h-12 px-3.5 rounded-xl text-[15px] font-semibold transition-colors",
                              isActive
                                ? "bg-[var(--color-navy-700)] text-white"
                                : "text-[var(--color-ink-700)] hover:bg-[var(--color-navy-50)]",
                              locked && "opacity-50"
                            )
                          }
                        >
                          <n.icon className="w-5 h-5 shrink-0" />
                          <span className="flex-1">{t(n.labelKey, lang)}</span>
                          {locked && <Lock className="w-4 h-4" />}
                        </NavLink>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-[var(--color-line-soft)] p-3">
              <button
                onClick={() => {
                  logout();
                  nav("/", { replace: true });
                }}
                className="flex items-center gap-3 h-12 w-full px-3.5 rounded-xl text-[15px] font-semibold text-[var(--color-ink-700)] hover:bg-[var(--color-navy-50)]"
              >
                <LogOut className="w-5 h-5" />
                {t("shell.logout", lang)}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ===== Main ===== */}
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[var(--color-line)]">
          <div className={cn("mx-auto flex items-center gap-2 h-[64px] lg:h-[76px] px-4 lg:px-8", widthClass)}>
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden w-11 h-11 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center -ml-2"
              aria-label={t("shell.menuOpen", lang)}
            >
              <MenuIcon className="w-5 h-5 text-[var(--color-navy-800)]" />
            </button>
            <h1 className="text-[18px] lg:text-[22px] font-extrabold tracking-tight text-[var(--color-navy-900)] truncate">
              {heading}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              {/* 영업 상태 칩 — 사장님만 클릭 시 임시 마감 토글, 직원은 표시만 */}
              <button
                onClick={isStaff ? undefined : toggleTemporaryClose}
                disabled={isStaff}
                title={isStaff ? summarizeStatus(openStatus) : t("shell.toggleTooltip", lang)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full text-[11.5px] sm:text-[12px] font-extrabold transition-colors",
                  openStatus.open
                    ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] hover:bg-[var(--color-mint-200)]"
                    : "bg-[#fef2f2] text-[var(--color-danger)] hover:bg-[#fde2e2]",
                  isStaff && "cursor-default opacity-90"
                )}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  openStatus.open ? "bg-[var(--color-mint-500)] animate-pulse" : "bg-[var(--color-danger)]"
                )} />
                <span className="hidden sm:inline">{openStatus.open ? t("shell.open", lang) : t("shell.closed", lang)}</span>
                <span className="sm:hidden">{openStatus.open ? t("shell.openShort", lang) : t("shell.closedShort", lang)}</span>
              </button>
              {isStaff && (
                <button
                  onClick={async () => {
                    if (onDuty) await clockOut();
                    else await clockIn();
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-bold transition-colors",
                    onDuty
                      ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] hover:bg-[var(--color-mint-200)]"
                      : "bg-[var(--color-navy-50)] text-[var(--color-navy-700)] hover:bg-[var(--color-navy-100)]"
                  )}
                >
                  {onDuty ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t("shell.onDuty", lang)}</span>{t("shell.clockOut", lang)}
                    </>
                  ) : (
                    <>
                      <ClockInIcon className="w-3.5 h-3.5" />
                      {t("shell.clockIn", lang)}
                    </>
                  )}
                </button>
              )}
              {headerRight}
            </div>
          </div>
        </header>

        <main className={cn("mx-auto px-4 lg:px-8 py-5 lg:py-8 pb-12", widthClass)}>{children}</main>
      </div>
    </div>
  );
}
