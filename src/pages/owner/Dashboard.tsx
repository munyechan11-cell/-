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
  Receipt,
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { useStore } from "../../store/store";

const QUICK_LINKS = [
  { to: "/owner/orders", icon: ChefHat, label: "주문·쿠폰", color: "mint" },
  { to: "/owner/tables", icon: LayoutGrid, label: "테이블 편집", color: "navy" },
  { to: "/owner/menus", icon: UtensilsCrossed, label: "메뉴 관리", color: "navy" },
  { to: "/owner/customers", icon: Users, label: "고객 관리", color: "mint" },
  { to: "/owner/statistics", icon: BarChart3, label: "통계", color: "sky" },
  { to: "/owner/reservations", icon: Calendar, label: "예약", color: "sky" },
  { to: "/owner/photos", icon: ImageIcon, label: "사진 보관소", color: "navy" },
  { to: "/owner/qr-print", icon: QrCode, label: "QR 인쇄", color: "mint" },
  { to: "/owner/brand-settings", icon: Settings, label: "브랜드 설정", color: "navy" },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  navy: "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]",
  mint: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  sky: "bg-[#e6f0fb] text-[#1a5fa8]",
};

export default function OwnerDashboard() {
  const { tables, orders, visits } = useStore();

  const today = new Date().toDateString();
  const todaysVisits = visits.filter((v) => new Date(v.date).toDateString() === today);
  const todaysRevenue = orders
    .filter((o) => new Date(o.createdAt).toDateString() === today && o.status !== "cancelled")
    .reduce((s, o) => s + o.totalAmount, 0);
  const activeOrders = orders.filter((o) => o.status !== "served" && o.status !== "cancelled").length;
  const occupied = tables.filter((t) => t.status === "occupied").length;
  const dirty = tables.filter((t) => t.status === "dirty").length;

  return (
    <OwnerShell title="대시보드">
      {/* Top stats — desktop은 4열, 모바일은 매출 카드 + 작은 stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-2 bg-[var(--color-navy-700)] border-transparent text-white p-6 lg:p-7 shadow-[var(--shadow-navy)] relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[var(--color-mint-500)]/15" />
          <p className="label-xs text-white/70">오늘 매출</p>
          <p className="mt-2 text-[36px] lg:text-[44px] font-extrabold tracking-tighter tabular-nums">
            ₩ {todaysRevenue.toLocaleString()}
          </p>
          <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-3 gap-3 text-[13px]">
            <Inline label="방문 손님" value={`${todaysVisits.length}명`} />
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
          <Link to="/owner/orders" className="mt-auto text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1 pt-3">
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
          <Link to="/owner/tables" className="mt-auto text-[13px] font-bold text-[var(--color-navy-700)] inline-flex items-center gap-1 pt-3">
            테이블로 <ChevronRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>

      {/* Tables + Quick links */}
      <div className="mt-6 lg:mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="headline-sub">테이블 현황 ({tables.length})</h2>
            <Link to="/owner/tables" className="text-[13px] font-bold text-[var(--color-navy-700)]">
              편집 →
            </Link>
          </div>
          {tables.length === 0 ? (
            <Card padding="lg" className="text-center body-md">
              아직 등록된 테이블이 없습니다.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[...tables]
                .sort((a, b) => {
                  const order = { occupied: 0, dirty: 1, paid: 2, available: 3 } as const;
                  return (
                    order[a.status ?? "available"] - order[b.status ?? "available"] || a.number - b.number
                  );
                })
                .map((t) => (
                  <Card key={t.id} padding="md" className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)] font-extrabold inline-flex items-center justify-center">
                      {t.number}
                    </div>
                    <div className="flex-1">
                      <p className="text-[14px] font-bold text-[var(--color-navy-900)]">테이블 {t.number}</p>
                      <p className="body-sm">
                        {t.seats}인 · {t.type ?? "table"}
                      </p>
                    </div>
                    <StatusBadge status={t.status ?? "available"} />
                  </Card>
                ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="headline-sub mb-3 px-1">빠른 메뉴</h2>
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
            {QUICK_LINKS.map(({ to, icon: Icon, label, color }) => (
              <Link key={to} to={to}>
                <Card padding="md" interactive className="h-[110px] flex flex-col justify-between">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${COLOR_CLASSES[color]}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[var(--color-navy-900)] tracking-tight">{label}</span>
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

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="opacity-70 text-[11px] mb-0.5">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "available" | "occupied" | "paid" | "dirty" }) {
  const map = {
    available: { label: "비어있음", cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-600)]" },
    occupied: { label: "사용 중", cls: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" },
    paid: { label: "결제 완료", cls: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]" },
    dirty: { label: "정리 필요", cls: "bg-[#fff1e0] text-[var(--color-warn)]" },
  } as const;
  const s = map[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.cls}`}>{s.label}</span>;
}
