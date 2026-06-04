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
} from "lucide-react";
import { cn } from "../../lib/cn";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { useStore } from "../../store/store";
import { STATUS_LABEL, STATUS_BADGE, STATUS_STEP, nextManualTransitions, normalizeStatus } from "../../lib/tableFlow";
import type { TableStatus } from "../../lib/types";

const QUICK_LINKS = [
  { to: "/biz/owner/orders", icon: ChefHat, label: "주문·쿠폰", color: "mint" },
  { to: "/biz/owner/tables", icon: LayoutGrid, label: "테이블 편집", color: "navy" },
  { to: "/biz/owner/menus", icon: UtensilsCrossed, label: "메뉴 관리", color: "navy" },
  { to: "/biz/owner/customers", icon: Users, label: "고객 관리", color: "mint" },
  { to: "/biz/owner/statistics", icon: BarChart3, label: "통계", color: "sky" },
  { to: "/biz/owner/reservations", icon: Calendar, label: "예약", color: "sky" },
  { to: "/biz/owner/photos", icon: ImageIcon, label: "사진 보관소", color: "navy" },
  { to: "/biz/owner/qr-print", icon: QrCode, label: "QR 인쇄", color: "mint" },
  { to: "/biz/owner/staff", icon: Briefcase, label: "직원 관리", color: "sky" },
  { to: "/biz/owner/brand-settings", icon: Settings, label: "브랜드 설정", color: "navy" },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  navy: "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]",
  mint: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  sky: "bg-[#e6f0fb] text-[#1a5fa8]",
};

const TABLE_VIEW_KEY = "gyeol:dashboard-tables-view";

export default function OwnerDashboard() {
  const { tables, orders, visits } = useStore();

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

  return (
    <OwnerShell title="대시보드">
      {/* Top stats — desktop은 4열, 모바일은 매출 카드 + 작은 stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-2 bg-[var(--color-navy-700)] border-transparent text-white p-6 lg:p-7 shadow-[var(--shadow-navy)] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[var(--color-mint-500)]/15" />
          <div className="flex items-center justify-between mb-2">
            <p className="label-xs text-white/70">오늘 매출</p>
            {revenueDelta !== null && (
              <DeltaPill value={revenueDelta} suffix="%" />
            )}
          </div>
          <p className="text-[38px] lg:text-[48px] font-extrabold tracking-tighter tabular-nums leading-none">
            ₩ {todaysRevenue.toLocaleString()}
          </p>
          {yesterdaysRevenue > 0 && (
            <p className="mt-1.5 text-[12px] opacity-70">
              어제 같은 시간 ₩ {yesterdaysRevenue.toLocaleString()}
            </p>
          )}
          <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-3 gap-3 text-[13px]">
            <Inline
              label="방문 손님"
              value={`${todaysVisits.length}명`}
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
            <Inline label="진행 주문" value={`${activeOrders}건`} />
            <Inline label="점유 테이블" value={`${occupied}/${tables.length}`} />
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-mint-700)]">
            <TrendingUp className="w-4 h-4" />
            <p className="label-xs text-[var(--color-mint-700)]">실시간 진행</p>
          </div>
          <p className="mt-2 text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter">
            {activeOrders}
          </p>
          <p className="body-sm text-[var(--color-ink-500)]">처리할 주문</p>
          <Link to="/biz/owner/orders" className="mt-auto text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1 pt-3">
            관리하기 <ChevronRight className="w-4 h-4" />
          </Link>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-warn)]">
            <Receipt className="w-4 h-4" />
            <p className="label-xs text-[var(--color-warn)]">알림</p>
          </div>
          <p className="mt-2 text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter">
            {dirty}
          </p>
          <p className="body-sm text-[var(--color-ink-500)]">정리 필요 테이블</p>
          <Link to="/biz/owner/tables" className="mt-auto text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1 pt-3">
            테이블로 <ChevronRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>

      {/* Tables + Quick links */}
      <div className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 px-1 gap-2">
            <h2 className="headline-sub">테이블 현황 ({tables.length})</h2>
            <div className="flex items-center gap-1.5">
              {/* 리스트 / 배치도 토글 — 부모 state로 동기화 */}
              <DashboardTableViewToggle view={tableView} onChange={changeTableView} />
              <Link to="/biz/owner/tables" className="text-[13px] font-bold text-[var(--color-navy-700)] hidden sm:inline">
                편집 →
              </Link>
            </div>
          </div>
          {tables.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid className="w-6 h-6" />}
              title="아직 테이블이 없어요"
              description="테이블 편집에서 매장에 맞는 테이블을 추가해 주세요."
              action={
                <Link to="/biz/owner/tables" className="h-10 px-5 rounded-full bg-[var(--color-navy-700)] text-white text-[13px] font-bold inline-flex items-center">
                  테이블 추가하기
                </Link>
              }
              tone="navy"
            />
          ) : (
            <DashboardTableArea tables={tables} view={tableView} />
          )}
        </div>

        <div>
          <h2 className="headline-sub mb-3 px-1">빠른 메뉴</h2>
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
            {QUICK_LINKS.map(({ to, icon: Icon, label, color }) => (
              <Link key={to} to={to}>
                <Card padding="md" interactive className="h-[124px] flex flex-col justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${COLOR_CLASSES[color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-extrabold text-[var(--color-navy-900)] tracking-tight">{label}</span>
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
  return (
    <div className="inline-flex p-0.5 bg-[var(--color-navy-50)] rounded-full">
      <button
        onClick={() => onChange("list")}
        className={cn(
          "h-7 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 transition-all",
          view === "list" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
        )}
      >
        <List className="w-3 h-3" /> 리스트
      </button>
      <button
        onClick={() => onChange("layout")}
        className={cn(
          "h-7 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 transition-all",
          view === "layout" ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"
        )}
      >
        <Move className="w-3 h-3" /> 배치도
      </button>
    </div>
  );
}

function DashboardTableArea({ tables, view }: { tables: TableLite[]; view: "list" | "layout" }) {
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
          .map((t) => (
            <Card
              key={t.id}
              padding="md"
              className={cn(
                "flex items-center gap-3",
                t.type !== "door" && "cursor-pointer hover:bg-[var(--color-navy-50)]/40 active:scale-[0.99] transition-all"
              )}
              onClick={() => {
                if (t.type === "door") return;
                setDetailTable(t);
              }}
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] font-extrabold inline-flex items-center justify-center">
                {t.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[var(--color-navy-900)]">
                  {t.type === "room" ? "룸" : t.type === "door" ? "출입구" : "테이블"} {t.number}
                </p>
                {t.type !== "door" && (
                  <p className="body-sm truncate">
                    {(t.status === "occupied" || t.status === "dining") && t.currentCustomerName
                      ? `${t.currentCustomerName}님${t.partySize ? ` · ${t.partySize}명` : ""}`
                      : `${t.seats}인`}
                  </p>
                )}
              </div>
              <StatusBadge status={t.status ?? "available"} />
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

  // 항상 store 의 최신 테이블 상태를 사용 — 클릭 시점 스냅샷에 갇히지 않도록.
  // 같은 id 가 있으면 그걸, 없으면(삭제됨 등) 초기 prop 으로 fallback.
  const table = tables.find((t) => t.id === initialTable.id) ?? initialTable;
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
      ? `${elapsed}분`
      : `${Math.floor(elapsed / 60)}시간 ${elapsed % 60}분`
    : "—";

  const handleEvict = async () => {
    if (!confirm(`테이블 ${table.number}번 손님을 퇴장 처리할까요?\n미결제 주문은 자동으로 취소됩니다.`)) return;
    try {
      await evictTable(table.number, storeId);
      onClose();
    } catch (e: any) {
      console.warn("[evictTable]", e?.message);
    }
  };

  const handleApprove = async () => {
    const msg = hasPaymentRequest
      ? `손님이 ₩ ${unpaidTotal.toLocaleString()} 결제를 요청했어요. 승인 + 영수증 출력할까요?`
      : `₩ ${unpaidTotal.toLocaleString()} 결제 승인 + 영수증 출력할까요?`;
    if (!confirm(msg)) return;
    try {
      await approvePayment(storeId, table.number);
      // 모달은 닫지 않음 — 사장님이 그 다음 '계산 완료' 누르도록 같은 화면에서
    } catch (e: any) {
      console.warn("[approvePayment]", e?.message);
    }
  };

  const handleComplete = async () => {
    if (!confirm(`테이블 ${table.number}번을 비어있음으로 정리할까요?`)) return;
    try {
      await completeTable(storeId, table.number);
      onClose();
    } catch (e: any) {
      console.warn("[completeTable]", e?.message);
    }
  };

  const handleInterim = async () => {
    try {
      await printInterimReceipt(storeId, table.number);
    } catch (e: any) {
      console.warn("[interim receipt]", e?.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
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
                테이블 {table.number}
              </p>
              <p className="text-[12px] text-[var(--color-ink-500)] truncate">
                {table.type === "room" ? "룸" : "일반"} · {table.seats}인석
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
                  title={`${step}단계`}
                />
              );
            })}
          </div>
          <p className="text-[10.5px] text-[var(--color-ink-500)] mt-1.5 text-center font-semibold">
            {STATUS_STEP[curStatus]}/7 · {STATUS_LABEL[curStatus]}
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
                  결제 요청 ({requestedOrders.length}건)
                </p>
                <p className="text-[12.5px] text-[var(--color-ink-700)] mt-0.5 leading-relaxed">
                  손님이 ₩ {unpaidTotal.toLocaleString()} 결제를 요청했어요.
                  <br />아래 '결제 승인' 을 누르면 영수증이 출력됩니다.
                </p>
              </div>
            </div>
          )}

          {/* 점유 정보 */}
          {table.status === "occupied" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <DetailStat label="체류 시간" value={elapsedLabel} />
                <DetailStat label="인원" value={table.partySize ? `${table.partySize}명` : "—"} />
              </div>
              {/* 손님 명단 */}
              {occupants.length > 0 ? (
                <div>
                  <p className="text-[11.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5">손님</p>
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
                <p className="text-[13.5px] font-bold text-[var(--color-navy-900)]">{table.currentCustomerName}님</p>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-[var(--color-ink-500)] py-4 text-center">
              {table.status === "dirty" ? "정리 후 비워주세요." : "현재 손님이 없습니다."}
            </p>
          )}

          {/* 주문 목록 */}
          {tableOrders.length > 0 && (
            <div>
              <p className="text-[11.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-1.5">
                주문 ({tableOrders.length}건)
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
                        {o.paymentStatus === "paid" ? "결제완료" : "미결제"}
                      </span>
                    </div>
                    <ul className="text-[13px] space-y-0.5">
                      {o.items.map((it, i) => (
                        <li key={i} className="flex justify-between text-[var(--color-navy-900)]">
                          <span className="truncate mr-2">{it.name} × {it.quantity}</span>
                          <span className="font-semibold tabular-nums">
                            ₩{(it.price * it.quantity).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-baseline border-t border-[var(--color-line)] pt-3">
                <span className="text-[12px] text-[var(--color-ink-500)]">
                  미결제 {unpaidOrders.length}건 / 총 {tableOrders.length}건
                </span>
                <div className="text-right">
                  <p className="text-[11px] text-[var(--color-ink-500)]">합계</p>
                  <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                    ₩ {total.toLocaleString()}
                  </p>
                  {unpaidTotal > 0 && unpaidTotal !== total && (
                    <p className="text-[11px] text-[var(--color-warn)] font-bold mt-0.5">
                      미결제 ₩ {unpaidTotal.toLocaleString()}
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
              {transitions.map((t) => (
                <button
                  key={t.to}
                  onClick={async () => {
                    try { await updateTableStatus(storeId, table.number, t.to as TableStatus); }
                    catch (e: any) { console.warn("[setStatus]", e?.message); }
                  }}
                  className={cn(
                    "h-11 rounded-[12px] font-bold text-[13px] transition-all active:scale-[0.98]",
                    t.tone === "primary" && "bg-[var(--color-navy-700)] text-white",
                    t.tone === "mint" && "bg-[var(--color-mint-500)] text-white",
                    t.tone === "warn" && "bg-[var(--color-warn)] text-white",
                    t.tone === "outline" && "bg-white border-[1.5px] border-[var(--color-line)] text-[var(--color-navy-800)]"
                  )}
                >
                  {t.label}
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
                ? `결제 승인 + 영수증 출력 (₩ ${unpaidTotal.toLocaleString()})`
                : `결제 승인 (₩ ${unpaidTotal.toLocaleString()})`}
            </button>
          )}

          {/* 2) 계산 완료 — paid 상태일 때 (테이블 비우기) */}
          {table.status === "paid" && (
            <button
              onClick={handleComplete}
              className="w-full h-12 rounded-[12px] bg-[var(--color-mint-500)] text-white font-extrabold text-[14px]"
            >
              계산 완료 → 테이블 비우기
            </button>
          )}

          {/* 3) 부가 액션 — 중간 영수증 / 닫기 / 퇴장처리 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-[12px] bg-[var(--color-ink-50)] text-[var(--color-ink-700)] font-bold text-[12.5px]"
            >
              닫기
            </button>
            {tableOrders.length > 0 && (
              <button
                onClick={handleInterim}
                className="flex-1 h-10 rounded-[12px] bg-white border border-[var(--color-line)] text-[var(--color-navy-700)] font-bold text-[12.5px]"
              >
                중간 영수증
              </button>
            )}
            {table.status === "occupied" && unpaidOrders.length === 0 && (
              <button
                onClick={handleEvict}
                className="flex-1 h-10 rounded-[12px] bg-white border border-[var(--color-danger)]/40 text-[var(--color-danger)] font-bold text-[12.5px]"
              >
                퇴장
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
  const maxX = tables.reduce((m, t) => Math.max(m, (t.x ?? 0) + (t.width ?? 70)), 0);
  const maxY = tables.reduce((m, t) => Math.max(m, (t.y ?? 0) + (t.height ?? 70)), 0);
  const W = Math.max(600, maxX + 60);
  const H = Math.max(400, maxY + 60);

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-3 py-2 bg-[var(--color-navy-50)] border-b border-[var(--color-line)] flex items-center gap-2 text-[11.5px] font-semibold text-[var(--color-ink-700)]">
        <Move className="w-3.5 h-3.5" />
        실시간 배치도 (탭하면 편집)
        <div className="ml-auto flex items-center gap-2 text-[10.5px]">
          <Dot color="bg-[var(--color-mint-500)]" /> 사용 중
          <Dot color="bg-[var(--color-warn)]" /> 정리
          <Dot color="bg-[var(--color-navy-300)]" /> 결제완료
        </div>
      </div>
      <Link to="/biz/owner/tables" className="block">
        <div className="relative overflow-auto bg-white h-[300px] sm:h-[380px] lg:h-[500px]">
          <div
            className="relative bg-[repeating-linear-gradient(0deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px),repeating-linear-gradient(90deg,transparent,transparent_39px,#eef2f8_39px,#eef2f8_40px)]"
            style={{ width: W, height: H }}
          >
            {tables.map((t) => {
              const w = t.width ?? (t.type === "room" ? 150 : 70);
              const h = t.height ?? (t.type === "room" ? 80 : 70);
              const color =
                t.type === "door"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/40"
                  : t.status === "occupied"
                  ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)] border-[var(--color-mint-400)]"
                  : t.status === "dirty"
                  ? "bg-[#fff1e0] text-[var(--color-warn)] border-[var(--color-warn)]/40"
                  : t.status === "paid"
                  ? "bg-[var(--color-navy-100)] text-[var(--color-navy-700)] border-[var(--color-navy-300)]"
                  : "bg-white text-[var(--color-navy-800)] border-[var(--color-line)]";
              const shape = t.shape === "circle" ? "rounded-full" : "rounded-[12px]";
              return (
                <div
                  key={t.id}
                  className={cn("absolute border-2 flex flex-col items-center justify-center", color, shape)}
                  style={{ left: t.x ?? 40, top: t.y ?? 40, width: w, height: h }}
                  title={`${t.type === "room" ? "룸" : t.type === "door" ? "출입구" : "테이블"} ${t.number}`}
                >
                  <p className="text-[16px] font-extrabold leading-none">
                    {t.type === "door" ? "출입" : t.number}
                  </p>
                  {t.type !== "door" && (
                    <p className="text-[10px] font-semibold opacity-80 mt-0.5">{t.seats}인</p>
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
