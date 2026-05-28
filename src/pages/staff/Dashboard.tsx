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

function fmtDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}시간 ${m}분`;
}

export default function StaffDashboard() {
  const { currentUser, users, shifts, activeShift, clockIn, clockOut } = useStore();

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

  if (!currentUser) return <Navigate to="/owner/login" replace />;
  if (currentUser.role !== "staff") {
    return <Navigate to={currentUser.role === "owner" ? "/owner" : "/customer"} replace />;
  }
  if (!currentUser.employerStoreId) return <Navigate to="/staff/store-search" replace />;
  if (currentUser.employerStatus !== "approved") return <Navigate to="/staff/pending" replace />;

  const owner = users.find((u) => u.id === currentUser.employerStoreId);
  const onDuty = !!activeShift;

  const LINKS = [
    { to: "/owner/reservations", icon: Calendar, label: "예약", free: true },
    { to: "/owner/orders", icon: ChefHat, label: "주문·쿠폰", free: false },
    { to: "/owner/tables", icon: LayoutGrid, label: "테이블", free: false },
    { to: "/owner/menus", icon: UtensilsCrossed, label: "메뉴 관리", free: false },
    { to: "/owner/photos", icon: ImageIcon, label: "사진 보관소", free: false },
    { to: "/owner/qr-print", icon: QrCode, label: "QR 인쇄", free: false },
  ];

  return (
    <OwnerShell title="직원 대시보드">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-5">
        <Card
          className={`lg:col-span-2 border-transparent text-white p-7 lg:p-8 shadow-[var(--shadow-navy)] relative overflow-hidden ${
            onDuty ? "bg-[var(--color-mint-600)]" : "bg-[var(--color-navy-700)]"
          }`}
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10" />
          <p className="text-[12px] font-bold uppercase tracking-wider text-white/75">
            {owner?.restaurantName ?? "매장"} · {currentUser.position || "직원"}
          </p>
          <p className="mt-3 text-[28px] lg:text-[34px] font-extrabold tracking-tighter">
            {onDuty ? "근무 중" : "근무 시작 전"}
          </p>
          {activeShift && (
            <p className="text-[14px] lg:text-[15px] text-white/85 mt-2 font-semibold tabular-nums">
              출근 {new Date(activeShift.clockInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
              {fmtDuration(Date.now() - new Date(activeShift.clockInAt).getTime())} 경과
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
                퇴근
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
                출근
              </Button>
            )}
          </div>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-mint-700)]">
            <Clock className="w-4 h-4" />
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-mint-700)]">
              오늘 근무
            </p>
          </div>
          <p className="mt-2 text-[30px] lg:text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter tabular-nums">
            {fmtDuration(stats.todayMs)}
          </p>
          <p className="text-[13px] text-[var(--color-ink-600)] font-medium">현재 진행 포함</p>
        </Card>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-center gap-2 text-[var(--color-navy-700)]">
            <Clock className="w-4 h-4" />
            <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-navy-700)]">
              최근 7일
            </p>
          </div>
          <p className="mt-2 text-[30px] lg:text-[34px] font-extrabold text-[var(--color-navy-900)] tracking-tighter tabular-nums">
            {fmtDuration(stats.weekMs)}
          </p>
          <p className="text-[13px] text-[var(--color-ink-600)] font-medium">총 근무 시간</p>
        </Card>
      </div>

      <div className="mt-8 lg:mt-10">
        <h2 className="headline-sub mb-3 px-1">매장 기능</h2>
        {!onDuty && (
          <p className="body-md text-[var(--color-ink-600)] mb-4 px-1">
            예약 추가는 출근 전에도 가능하고, 나머지 기능은 출근 후에 열려요.
          </p>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {LINKS.map(({ to, icon: Icon, label, free }) => {
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
                    {label}
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
                onClick={() => showToast("출근 후 이용할 수 있어요.", "info")}
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
