import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  BarChart3,
  Calendar,
  Image as ImageIcon,
  QrCode,
  Settings,
  ChevronRight,
  LayoutGrid,
  UtensilsCrossed,
  ChefHat,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  Briefcase,
  List,
  Move,
  UserPlus,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { useStore } from "../../store/store";
import { STATUS_LABEL, STATUS_BADGE, STATUS_STEP, nextManualTransitions, normalizeStatus } from "../../lib/tableFlow";
import type { TableStatus } from "../../lib/types";
import { useEscapeClose } from "../../lib/useEscapeClose";
import { showToast } from "../../lib/toast";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";

const QUICK_LINKS = [
  { to: "/biz/owner/orders", icon: ChefHat, labelKey: "ownerNav.orders", color: "mint" },
  { to: "/biz/owner/tables", icon: LayoutGrid, labelKey: "ownerNav.tables", color: "navy" },
  { to: "/biz/owner/menus", icon: UtensilsCrossed, labelKey: "ownerNav.menus", color: "navy" },
  { to: "/biz/owner/customers", icon: Users, labelKey: "ownerNav.customers", color: "mint" },
  { to: "/biz/owner/statistics", icon: BarChart3, labelKey: "ownerNav.statistics", color: "sky" },
  { to: "/biz/owner/reservations", icon: Calendar, labelKey: "ownerNav.reservations", color: "sky" },
  { to: "/biz/owner/photos", icon: ImageIcon, labelKey: "ownerNav.reviews", color: "navy" },
  { to: "/biz/owner/qr-print", icon: QrCode, labelKey: "ownerNav.qrPrint", color: "mint" },
  { to: "/biz/owner/staff", icon: Briefcase, labelKey: "ownerNav.staff", color: "sky" },
  { to: "/biz/owner/brand-settings", icon: Settings, labelKey: "ownerNav.brand", color: "navy" },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  navy: "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]",
  mint: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  sky: "bg-[#e6f0fb] text-[#1a5fa8]",
};

const TABLE_VIEW_KEY = "gyeol:dashboard-tables-view";

export default function OwnerDashboard() {
  const { tables, orders, visits, currentUser } = useStore();
  const lang = useLanguage();

  // 부모에서 한 곳에서만 view state 보유 → 토글/영역 항상 동기화
  const [tableView, setTableView] = useState<"list" | "layout">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(TABLE_VIEW_KEY) as "list" | "layout") || "list";
  });
  const changeTableView = (v: "list" | "layout") => {
    setTableView(v);
    if (typeof window !== "undefined") localStorage.setItem(TABLE_VIEW_KEY, v);
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  const todaysVisits = visits.filter(
    (v) => new Date(v.date).getTime() >= todayStart.getTime()
  );
  const yesterdaysVisits = visits.filter((v) => {
    const t = new Date(v.date).getTime();
    return t >= yesterdayStart.getTime() && t < todayStart.getTime();
  });
  const todaysOrders = orders.filter(
    (o) =>
      new Date(o.createdAt).getTime() >= todayStart.getTime() && o.status !== "cancelled"
  );
  const yesterdaysOrders = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return (
      t >= yesterdayStart.getTime() &&
      t < todayStart.getTime() &&
      o.status !== "cancelled"
    );
  });
  const todaysRevenue = todaysOrders.reduce((s, o) => s + o.totalAmount, 0);
  const yesterdaysRevenue = yesterdaysOrders.reduce((s, o) => s + o.totalAmount, 0);
  const activeOrders = orders.filter(
    (o) => o.status !== "served" && o.status !== "cancelled"
  ).length;
  const occupied = tables.filter((t) => t.status === "occupied").length;
  const dirty = tables.filter((t) => t.status === "dirty").length;

  // 전일 대비 변화율
  const revenueDelta =
    yesterdaysRevenue === 0
      ? null
      : Math.round(((todaysRevenue - yesterdaysRevenue) / yesterdaysRevenue) * 100);
  const visitsDelta = todaysVisits.length - yesterdaysVisits.length;

  // 영업 시간 미설정 매장 — 신규 사장님 첫 셋업 안내
  const needsBusinessHoursSetup = currentUser?.role === "owner" && !currentUser.businessHours && !currentUser.temporarilyClosed;

  return (
    <OwnerShell title={t("ownerNav.dashboard", lang)}>
      {/* 영업 시간 미설정 안내 — 신규 매장 첫 진입 시 */}
      {needsBusinessHoursSetup && (
        <Card padding="md" className="mb-4 border-[1.5px] border-[var(--color-warn)]/40 bg-[#fff8e6]">
          <div className="flex items-start gap-2.5">
            <span className="text-[20px] shrink-0">⏰</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-extrabold text-[#b07b00]">
                {t("odash.bizHours.title", lang)}
              </p>
              <p className="text-[11.5px] text-[#8a5a00] font-semibold mt-0.5 leading-relaxed">
                {t("odash.bizHours.desc", lang)}
              </p>
              <Link
                to="/biz/owner/brand-settings"
                className="inline-flex items-center gap-1 mt-2 text-[12px] font-bold text-[var(--color-navy-700)] hover:underline"
              >
                {t("odash.bizHours.cta", lang)}
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Top stats — desktop은 4열, 모바일은 매출 카드 + 작은 stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-2 bg-[var(--color-navy-700)] border-transparent text-white p-6 lg:p-7 shadow-[var(--shadow-navy)] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[var(--color-mint-500)]/15" />
          <div className="flex items-center justify-between mb-2">
            <p className="label-xs text-white/70">{t("odash.todayRevenue", lang)}</p>
            {revenueDelta !== null && (
              <DeltaPill value={revenueDelta} suffix="%" />
            )}
          </div>
          <p className="text-[38px] lg:text-[48px] font-extrabold tracking-tighter tabular-nums leading-none">
            {fmtKRW(todaysRevenue, lang)}
          </p>
          {yesterdaysRevenue > 0 && (
            <p className="mt-1.5 text-[12px] opacity-70">
              {t("odash.vsYesterday", lang, { amount: fmtKRW(yesterdaysRevenue, lang) })}
            </p>
          )}
          <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-3 gap-3 text-[13px]">
            <Inline
              label={t("odash.stat.visitors", lang)}
              value={`${todaysVisits.length}${t("odash.unit.people", lang)}`}
              delta={
                yesterdaysVisits.length > 0
                  ? visitsDelta > 0
                    ? `+${visitsDelta}`
                    : visitsDelta < 0
                    ? `${visitsDelta}`
                    : ""
                  : undefined
              }
            />
            <Inline label={t("odash.stat.activeOrders", lang)} value={`${activeOrders}${t("odash.unit.orders", lang)}`} />
            <Inline label={t("odash.stat.occupied", lang)} value={`${occupied}/${tables.length}`} />
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-mint-700)]">
            <TrendingUp className="w-4 h-4" />
            <p className="label-xs text-[var(--color-mint-700)]">{t("odash.realtime", lang)}</p>
          </div>
          <p className="mt-2 text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter">
            {activeOrders}
          </p>
          <p className="body-sm text-[var(--color-ink-500)]">{t("odash.pending.desc", lang)}</p>
          <Link to="/biz/owner/orders" className="mt-auto text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1 pt-3">
            {t("odash.pending.cta", lang)} <ChevronRight className="w-4 h-4" />
          </Link>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-warn)]">
            <Receipt className="w-4 h-4" />
            <p className="label-xs text-[var(--color-warn)]">{t("odash.alert", lang)}</p>
          </div>
          <p className="mt-2 text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter">
            {dirty}
          </p>
          <p className="body-sm text-[var(--color-ink-500)]">{t("odash.dirty.desc", lang)}</p>
          <Link to="/biz/owner/tables" className="mt-auto text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1 pt-3">
            {t("odash.dirty.cta", lang)} <ChevronRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>

      {/* Tables + Quick links */}
      <div className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div className="lg:col-span-2">
          {/* 대기 주문 — 빠르게 받는 경우가 많아 테이블 위에 큼직하게 (탭 → 빠른 주문의 새 대기 탭) */}
          <Link
            to="/biz/owner/quick-order?newWait=1"
            className="flex items-center justify-center gap-2 h-12 mb-3 rounded-xl bg-[var(--color-navy-700)] text-white font-extrabold text-[14.5px] active:scale-[0.99] transition-transform shadow-[var(--shadow-navy)]"
          >
            <UserPlus className="w-5 h-5" />
            {t("odash.newWaitOrder", lang)}
          </Link>
          <div className="flex items-center justify-between mb-3 px-1 gap-2">
            <h2 className="headline-sub">{t("odash.tables.title", lang, { n: tables.length })}</h2>
            <div className="flex items-center gap-1.5">
              {/* 리스트 / 배치도 토글 — 부모 state로 동기화 */}
              <DashboardTableViewToggle view={tableView} onChange={changeTableView} />
              <Link to="/biz/owner/tables" className="text-[13px] font-bold text-[var(--color-navy-700)] hidden sm:inline">
                {t("odash.tables.edit", lang)}
              </Link>
            </div>
          </div>
          {tables.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid className="w-6 h-6" />}
              title={t("odash.tables.empty.title", lang)}
              description={t("odash.tables.empty.desc", lang)}
              action={
                <Link to="/biz/owner/tables" className="h-10 px-5 rounded-full bg-[var(--color-navy-700)] text-white text-[13px] font-bold inline-flex items-center">
                  {t("odash.tables.empty.cta", lang)}
                </Link>
              }
              tone="navy"
            />
          ) : (
            <DashboardTableArea tables={tables} view={tableView} />
          )}
        </div>

        <div>
          <h2 className="headline-sub mb-3 px-1">{t("odash.quickMenu", lang)}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
            {QUICK_LINKS.map(({ to, icon: Icon, labelKey, color }) => (
              <Link key={to} to={to}>
                <Card padding="md" interactive className="h-[124px] flex flex-col justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${COLOR_CLASSES[color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-extrabold text-[var(--color-navy-900)] tracking-tight">{t(labelKey, lang)}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--color-ink-300)]" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}

function Inline({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div>
      <p className="opacity-80 text-[12px] mb-0.5">{label}</p>
      <p className="font-bold flex items-center gap-1 tabular-nums">
        {value}
        {delta && (
          <span
            className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
              delta.startsWith("+")
                ? "bg-[var(--color-mint-400)]/30 text-[var(--color-mint-100)]"
                : "bg-white/15 text-white/70"
            }`}
          >
            {delta}
          </span>
        )}
      </p>
    </div>
  );
}

function DeltaPill({ value, suffix }: { value: number; suffix?: string }) {
  const positive = value > 0;
  const negative = value < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const cls = positive
    ? "bg-[var(--color-mint-400)]/25 text-[var(--color-mint-200)]"
    : negative
    ? "bg-white/15 text-white/85"
    : "bg-white/10 text-white/70";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-extrabold ${cls}`}>
      <Icon className="w-3 h-3" />
      {value > 0 ? "+" : ""}{value}
      {suffix}
    </span>
  );
}

// 대시보드 테이블 영역 — 리스트 또는 미니 배치도 (localStorage 유지)
type TableLite = {
  id: string;
  number: number;
  type?: string;
  status?: TableStatus;
  seats?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  shape?: "square" | "circle";
  currentCustomerId?: string | null;
  currentCustomerName?: string | null;
  occupantIds?: string[];
  partySize?: number | null;
  sessionStartTime?: string | null;
};

function DashboardTableViewToggle({
  view, onChange,
}: { view: "list" | "layout"; onChange: (v: "list" | "layout") => void }) {
  const lang = useLanguage();
  return (
    <div className="inline-flex p-0.5 bg-[var(--color-navy-50)] rounded-full">
      <button
        onClick={() => onChange("list")}
        className={cn(
          "h-7 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 transition-all",
          view === "list" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
        )}
      >
        <List className="w-3 h-3" /> {t("odash.view.list", lang)}
      </button>
      <button
        onClick={() => onChange("layout")}
        className={cn(
          "h-7 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 transition-all",
          view === "layout" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
        )}
      >
        <Move className="w-3 h-3" /> {t("odash.view.layout", lang)}
      </button>
    </div>
  );
}

function DashboardTableArea({ tables, view }: { tables: TableLite[]; view: "list" | "layout" }) {
  const lang = useLanguage();
  const [detailTable, setDetailTable] = useState<TableLite | null>(null);
  if (view === "layout") return <DashboardLayoutMini tables={tables} />;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[...tables]
          .sort((a, b) => {
            // tableFlow.STATUS_ORDER 와 일치 (cleaning/dirty 0, paid 1, dining 2, occupied 3...)
            const order: Record<string, number> = {
              cleaning: 0, dirty: 0, paid: 1, dining: 2, occupied: 3,
              setup: 4, reserved: 5, available: 6,
            };
            return (
              (order[a.status ?? "available"] ?? 6) - (order[b.status ?? "available"] ?? 6) || a.number - b.number
            );
          })
          .map((tbl) => (
            <Card
              key={tbl.id}
              padding="md"
              className={cn(
                "flex items-center gap-3",
                tbl.type !== "door" && "cursor-pointer hover:bg-[var(--color-navy-50)]/40 active:scale-[0.99] transition-all"
              )}
              onClick={() => {
                if (tbl.type === "door") return;
                setDetailTable(tbl);
              }}
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] font-extrabold inline-flex items-center justify-center">
                {tbl.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[var(--color-navy-900)]">
                  {tbl.type === "room"
                    ? t("odash.tableType.room", lang)
                    : tbl.type === "door"
                    ? t("odash.tableType.door", lang)
                    : t("odash.tableType.table", lang)} {tbl.number}
                </p>
                {tbl.type !== "door" && (
                  <p className="body-sm truncate">
                    {(tbl.status === "occupied" || tbl.status === "dining") && tbl.currentCustomerName
                      ? (tbl.partySize
                          ? t("odash.partySize", lang, { name: tbl.currentCustomerName, n: tbl.partySize })
                          : t("odash.partyOnly", lang, { name: tbl.currentCustomerName }))
                      : t("odash.seats", lang, { n: tbl.seats ?? 0 })}
                  </p>
                )}
              </div>
              <StatusBadge status={tbl.status ?? "available"} />
            </Card>
          ))}
      </div>
      {detailTable && (
        <TableDetailModal table={detailTable} onClose={() => setDetailTable(null)} />
      )}
    </>
  );
}

// ============================================================
// 테이블 상세 모달 — 누가, 얼마나 있었는지, 인원, 주문, 합계, 퇴장 처리
// ============================================================
function TableDetailModal({ table: initialTable, onClose }: { table: TableLite; onClose: () => void }) {
  const { users, orders, tables, evictTable, approvePayment, completeTable, printInterimReceipt, updateTableStatus, currentUser } = useStore();
  const storeId = currentUser?.id ?? "";
  const lang = useLanguage();

  // ESC 키로 닫기 + 접근성
  useEscapeClose(true, onClose);

  // 항상 store 의 최신 테이블 상태를 사용 — 클릭 시점 스냅샷에 갇히지 않도록.
  // 같은 id 가 있으면 그걸, 없으면(삭제됨 등) 초기 prop 으로 fallback.
  const table = tables.find((tbl) => tbl.id === initialTable.id) ?? initialTable;
  const curStatus = normalizeStatus(table.status);
  const transitions = nextManualTransitions(curStatus);

  // 현재 매장의 이 테이블 미결제 주문 (취소 제외)
  const tableOrders = orders
    .filter(
      (o) =>
        o.storeId === storeId &&
        o.tableNumber === table.number &&
        o.status !== "cancelled"
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unpaidOrders = tableOrders.filter((o) => o.paymentStatus !== "paid");
  const requestedOrders = tableOrders.filter((o) => o.paymentStatus === "requested");
  const total = tableOrders.reduce((s, o) => s + o.totalAmount, 0);
  const unpaidTotal = unpaidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const hasPaymentRequest = requestedOrders.length > 0;

  const occupants = (table.occupantIds ?? [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as { id: string; name: string; phone?: string }[];

  // 체류 시간
  const startMs = table.sessionStartTime ? new Date(table.sessionStartTime).getTime() : null;
  const elapsed = startMs ? Math.max(0, Math.floor((Date.now() - startMs) / 60000)) : null;
  const elapsedLabel = elapsed != null
    ? elapsed < 60
      ? t("tdetail.elapsedMin", lang, { n: elapsed })
      : t("tdetail.elapsedHourMin", lang, { h: Math.floor(elapsed / 60), m: elapsed % 60 })
    : "—";

  const handleEvict = async () => {
    if (!confirm(t("tdetail.evictConfirm", lang, { n: table.number }))) return;
    try {
      await evictTable(table.number, storeId);
      onClose();
    } catch (e: any) {
      console.warn("[evictTable]", e?.message);
      showToast(t("tdetail.evictFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  const handleApprove = async () => {
    const msg = hasPaymentRequest
      ? t("tdetail.approveReqMsg", lang, { amount: fmtKRW(unpaidTotal, lang) })
      : t("tdetail.approveMsg", lang, { amount: fmtKRW(unpaidTotal, lang) });
    if (!confirm(msg)) return;
    try {
      await approvePayment(storeId, table.number);
      // 모달은 닫지 않음 — 사장님이 그 다음 '계산 완료' 누르도록 같은 화면에서
    } catch (e: any) {
      console.warn("[approvePayment]", e?.message);
      showToast(t("tdetail.approveFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  const handleComplete = async () => {
    if (!confirm(t("tdetail.completeConfirm", lang, { n: table.number }))) return;
    try {
      await completeTable(storeId, table.number);
      onClose();
    } catch (e: any) {
      console.warn("[completeTable]", e?.message);
      showToast(t("tdetail.completeFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  const handleInterim = async () => {
    try {
      await printInterimReceipt(storeId, table.number);
    } catch (e: any) {
      console.warn("[interim receipt]", e?.message);
      showToast(t("tdetail.interimFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("tdetail.aria", lang, { n: table.number })}
        className="w-full sm:max-w-md bg-white sm:rounded-[18px] rounded-t-[18px] overflow-hidden shadow-[var(--shadow-lifted)] flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-[var(--color-line)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] font-extrabold text-[18px] inline-flex items-center justify-center">
              {table.number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-extrabold text-[var(--color-navy-900)]">
                {t("tdetail.tableN", lang, { n: table.number })}
              </p>
              <p className="text-[12px] text-[var(--color-ink-500)] truncate">
                {table.type === "room" ? t("odash.tableType.room", lang) : t("tdetail.normalType", lang)} · {t("tdetail.seatLabel", lang, { n: table.seats ?? 0 })}
              </p>
            </div>
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-[11.5px] font-extrabold inline-flex items-center gap-1.5 shrink-0",
                STATUS_BADGE[curStatus].bg,
                STATUS_BADGE[curStatus].text
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_BADGE[curStatus].dot)} />
              {STATUS_LABEL[curStatus]}
            </span>
          </div>

          {/* 8단계 진행 바 */}
          <div className="mt-3 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => {
              const isPast = STATUS_STEP[curStatus] >= step;
              const isCurrent = STATUS_STEP[curStatus] === step;
              return (
                <div
                  key={step}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-colors",
                    isCurrent
                      ? "bg-[var(--color-navy-700)]"
                      : isPast
                      ? "bg-[var(--color-navy-300)]"
                      : "bg-[var(--color-ink-100)]"
                  )}
                  title={`${step}`}
                />
              );
            })}
          </div>
          <p className="text-[10.5px] text-[var(--color-ink-500)] mt-1.5 text-center font-semibold">
            {t("tdetail.stepProgress", lang, { cur: STATUS_STEP[curStatus], label: STATUS_LABEL[curStatus] })}
          </p>
        </div>

        {/* 본문 — 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 결제 요청 배너 — 최우선 표시 */}
          {hasPaymentRequest && (
            <div className="p-3.5 rounded-[14px] bg-[#fff8e6] border-2 border-[var(--color-warn)] flex items-start gap-2.5">
              <Receipt className="w-5 h-5 text-[var(--color-warn)] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-extrabold text-[var(--color-warn)]">
                  {t("tdetail.payReq.title", lang, { n: requestedOrders.length })}
                </p>
                <p className="text-[12.5px] text-[var(--color-ink-700)] mt-0.5 leading-relaxed whitespace-pre-line">
                  {t("tdetail.payReq.desc", lang, { amount: fmtKRW(unpaidTotal, lang) })}
                </p>
              </div>
            </div>
          )}

          {/* 점유 정보 */}
          {table.status === "occupied" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <DetailStat label={t("tdetail.stat.elapsed", lang)} value={elapsedLabel} />
                <DetailStat label={t("tdetail.stat.party", lang)} value={table.partySize ? t("tdetail.partyN", lang, { n: table.partySize }) : "—"} />
              </div>
              {/* 손님 명단 */}
              {occupants.length > 0 ? (
                <div>
                  <p className="text-[11.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5">{t("tdetail.guestsLabel", lang)}</p>
                  <div className="space-y-1.5">
                    {occupants.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 text-[13.5px]">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)] font-extrabold inline-flex items-center justify-center text-[12px]">
                          {u.name?.[0] ?? "?"}
                        </div>
                        <span className="font-bold text-[var(--color-navy-900)]">{u.name}</span>
                        {u.phone && <span className="text-[var(--color-ink-500)] text-[12px] ml-auto">{u.phone}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : table.currentCustomerName ? (
                <p className="text-[13.5px] font-bold text-[var(--color-navy-900)]">{t("tdetail.guestNameOnly", lang, { name: table.currentCustomerName })}</p>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-[var(--color-ink-500)] py-4 text-center">
              {table.status === "dirty" ? t("tdetail.dirty", lang) : t("tdetail.empty", lang)}
            </p>
          )}

          {/* 주문 목록 */}
          {tableOrders.length > 0 && (
            <div>
              <p className="text-[11.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5">
                {t("tdetail.orders.title", lang, { n: tableOrders.length })}
              </p>
              <div className="space-y-2">
                {tableOrders.map((o) => (
                  <div key={o.id} className="rounded-[12px] border border-[var(--color-line)] p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-[var(--color-ink-600)]">
                        #{o.id.slice(-6).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "text-[10.5px] font-bold px-2 py-0.5 rounded-full",
                          o.paymentStatus === "paid"
                            ? "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]"
                            : "bg-[#fff1e0] text-[var(--color-warn)]"
                        )}
                      >
                        {o.paymentStatus === "paid" ? t("tdetail.payStatus.paid", lang) : t("tdetail.payStatus.unpaid", lang)}
                      </span>
                    </div>
                    <ul className="text-[13px] space-y-0.5">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between text-[var(--color-navy-900)]">
                          <span className="truncate mr-2">{it.name} × {it.quantity}</span>
                          <span className="font-semibold tabular-nums">
                            {fmtKRW(it.price * it.quantity, lang)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-baseline border-t border-[var(--color-line)] pt-3">
                <span className="text-[12px] text-[var(--color-ink-500)]">
                  {t("tdetail.unpaidVsTotal", lang, { u: unpaidOrders.length, n: tableOrders.length })}
                </span>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--color-ink-500)]">{t("tdetail.totalLabel", lang)}</p>
                  <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                    {fmtKRW(total, lang)}
                  </p>
                  {unpaidTotal > 0 && unpaidTotal !== total && (
                    <p className="text-[11px] text-[var(--color-warn)] font-bold mt-0.5">
                      {t("tdetail.unpaidLine", lang, { amount: fmtKRW(unpaidTotal, lang) })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 액션 — 상황별 노출 */}
        <div className="px-5 py-3 border-t border-[var(--color-line)] shrink-0 space-y-2">
          {/* 0) 8단계 수동 전이 버튼 — 가능한 전이만 노출 */}
          {transitions.length > 0 && (
            <div className={cn("grid gap-2", transitions.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {transitions.map((tr) => (
                <button
                  key={tr.to}
                  onClick={async () => {
                    try {
                      await updateTableStatus(storeId, table.number, tr.to as TableStatus);
                    } catch (e: any) {
                      console.warn("[setStatus]", e?.message);
                      showToast(t("tdetail.statusFail", lang, { msg: e?.message ?? "" }), "error");
                    }
                  }}
                  className={cn(
                    "h-11 rounded-[12px] font-bold text-[13px] transition-all active:scale-[0.98]",
                    tr.tone === "primary" && "bg-[var(--color-navy-700)] text-white",
                    tr.tone === "mint" && "bg-[var(--color-mint-500)] text-white",
                    tr.tone === "warn" && "bg-[var(--color-warn)] text-white",
                    tr.tone === "outline" && "bg-white border-[1.5px] border-[var(--color-line)] text-[var(--color-navy-800)]"
                  )}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          )}

          {/* 1) 결제 승인 — 미결제 주문이 있으면 (요청 여부 무관) */}
          {unpaidOrders.length > 0 && (
            <button
              onClick={handleApprove}
              className={cn(
                "w-full h-12 rounded-[12px] font-extrabold text-[14px]",
                hasPaymentRequest
                  ? "bg-[var(--color-warn)] text-white"
                  : "bg-[var(--color-navy-700)] text-white"
              )}
            >
              {hasPaymentRequest
                ? t("tdetail.approveBtnReq", lang, { amount: fmtKRW(unpaidTotal, lang) })
                : t("tdetail.approveBtn", lang, { amount: fmtKRW(unpaidTotal, lang) })}
            </button>
          )}

          {/* 2) 계산 완료 — paid 상태일 때 (테이블 비우기) */}
          {table.status === "paid" && (
            <button
              onClick={handleComplete}
              className="w-full h-12 rounded-[12px] bg-[var(--color-mint-500)] text-white font-extrabold text-[14px]"
            >
              {t("tdetail.completeBtn", lang)}
            </button>
          )}

          {/* 3) 부가 액션 — 중간 영수증 / 닫기 / 퇴장처리 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-[12px] bg-[var(--color-ink-50)] text-[var(--color-ink-700)] font-bold text-[12.5px]"
            >
              {t("tdetail.close", lang)}
            </button>
            {tableOrders.length > 0 && (
              <button
                onClick={handleInterim}
                className="flex-1 h-10 rounded-[12px] bg-white border border-[var(--color-line)] text-[var(--color-navy-700)] font-bold text-[12.5px]"
              >
                {t("tdetail.interim", lang)}
              </button>
            )}
            {table.status === "occupied" && unpaidOrders.length === 0 && (
              <button
                onClick={handleEvict}
                className="flex-1 h-10 rounded-[12px] bg-white border border-[var(--color-danger)]/40 text-[var(--color-danger)] font-bold text-[12.5px]"
              >
                {t("tdetail.evictBtn", lang)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-[var(--color-navy-50)] p-3">
      <p className="text-[10.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">{label}</p>
      <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] mt-0.5">{value}</p>
    </div>
  );
}

// 미니 배치도 — 읽기 전용. 상태 색상 표시. 클릭 → 편집 페이지
function DashboardLayoutMini({ tables }: { tables: TableLite[] }) {
  const lang = useLanguage();
  const maxX = tables.reduce((m, tbl) => Math.max(m, (tbl.x ?? 0) + (tbl.width ?? 70)), 0);
  const maxY = tables.reduce((m, tbl) => Math.max(m, (tbl.y ?? 0) + (tbl.height ?? 70)), 0);
  const W = Math.max(600, maxX + 60);
  const H = Math.max(400, maxY + 60);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-3 py-2 bg-[var(--color-navy-50)] border-b border-[var(--color-line)] flex items-center gap-2 text-[11.5px] font-semibold text-[var(--color-ink-700)]">
        <Move className="w-3.5 h-3.5" />
        {t("odash.realtimeLayout", lang)}
        <div className="ml-auto flex items-center gap-2 text-[10.5px]">
          <Dot color="bg-[var(--color-mint-500)]" /> {t("odash.dot.using", lang)}
          <Dot color="bg-[var(--color-warn)]" /> {t("odash.dot.cleaning", lang)}
          <Dot color="bg-[var(--color-navy-300)]" /> {t("odash.dot.paid", lang)}
        </div>
      </div>
      <Link to="/biz/owner/tables" className="block">
        <div className="relative overflow-auto bg-white h-[300px] sm:h-[380px] lg:h-[500px]">
          <div
            className="relative bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px)]"
            style={{ width: W, height: H }}
          >
            {tables.map((tbl) => {
              const w = tbl.width ?? (tbl.type === "room" ? 150 : 70);
              const h = tbl.height ?? (tbl.type === "room" ? 80 : 70);
              const color =
                tbl.type === "door"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/40"
                  : tbl.status === "occupied"
                  ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] border-[var(--color-mint-400)]"
                  : tbl.status === "dirty"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/40"
                  : tbl.status === "paid"
                  ? "bg-[var(--color-navy-100)] text-[var(--color-navy-700)] border-[var(--color-navy-300)]"
                  : "bg-white text-[var(--color-navy-800)] border-[var(--color-line)]";
              const shape = tbl.shape === "circle" ? "rounded-full" : "rounded-[12px]";
              const typeLabel =
                tbl.type === "room" ? t("odash.tableType.room", lang)
                : tbl.type === "door" ? t("odash.tableType.door", lang)
                : t("odash.tableType.table", lang);
              return (
                <div
                  key={tbl.id}
                  className={cn("absolute border-2 flex flex-col items-center justify-center", color, shape)}
                  style={{ left: tbl.x ?? 40, top: tbl.y ?? 40, width: w, height: h }}
                  title={`${typeLabel} ${tbl.number}`}
                >
                  <p className="text-[16px] font-extrabold leading-none">
                    {tbl.type === "door" ? t("odash.doorShort", lang) : tbl.number}
                  </p>
                  {tbl.type !== "door" && (
                    <p className="text-[10px] font-semibold opacity-80 mt-0.5">{t("odash.seats", lang, { n: tbl.seats ?? 0 })}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Link>
    </Card>
  );
}

function Dot({ color }: { color: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full", color)} />;
}

function StatusBadge({ status }: { status?: string }) {
  const s = normalizeStatus(status as any);
  const badge = STATUS_BADGE[s];
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1.5", badge.bg, badge.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
      {STATUS_LABEL[s]}
    </span>
  );
}
