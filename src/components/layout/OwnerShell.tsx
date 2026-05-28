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
} from "lucide-react";
import { useState } from "react";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";

interface Props {
  children: React.ReactNode;
  title?: string;
  /** 모바일 페이지 헤더에 표시할 우측 액션 */
  headerRight?: React.ReactNode;
  /** 콘텐츠 가로 폭 변형 */
  width?: "default" | "narrow" | "full";
}

const NAV = [
  { to: "/owner", label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/owner/orders", label: "주문·쿠폰", icon: ChefHat },
  { to: "/owner/tables", label: "테이블 편집", icon: LayoutGrid },
  { to: "/owner/menus", label: "메뉴 관리", icon: UtensilsCrossed },
  { to: "/owner/customers", label: "고객 관리", icon: Users },
  { to: "/owner/reservations", label: "예약", icon: Calendar },
  { to: "/owner/statistics", label: "통계", icon: BarChart3 },
  { to: "/owner/photos", label: "사진 보관소", icon: ImageIcon },
  { to: "/owner/qr-print", label: "QR 인쇄", icon: QrCode },
  { to: "/owner/brand-settings", label: "브랜드 설정", icon: Settings },
];

export function OwnerShell({ children, title, headerRight, width = "default" }: Props) {
  const { currentUser, logout } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const active = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  const heading = title ?? active?.label ?? "대시보드";

  const widthClass =
    width === "narrow" ? "max-w-[760px]" : width === "full" ? "max-w-[1400px]" : "max-w-[1200px]";

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* ===== Desktop sidebar ===== */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] flex-col bg-white border-r border-[var(--color-line)] z-30">
        <Link to="/owner" className="flex items-center gap-2.5 px-6 h-[72px] border-b border-[var(--color-line-soft)]">
          <span className="w-10 h-10 rounded-xl bg-[var(--color-navy-700)] text-white text-xl font-extrabold flex items-center justify-center shadow-[var(--shadow-navy)]">
            결
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">
              {currentUser?.restaurantName ?? "결"}
            </p>
            <p className="text-[11px] text-[var(--color-ink-500)] font-semibold">사장님 콘솔</p>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 h-11 px-3.5 rounded-xl text-[14px] font-semibold transition-colors",
                  isActive
                    ? "bg-[var(--color-navy-700)] text-white shadow-[var(--shadow-navy)]"
                    : "text-[var(--color-ink-700)] hover:bg-[var(--color-navy-50)] hover:text-[var(--color-navy-800)]"
                )
              }
            >
              <n.icon className="w-[18px] h-[18px] shrink-0" />
              {n.label}
            </NavLink>
          ))}
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
            로그아웃
          </button>
        </div>
      </aside>

      {/* ===== Mobile drawer ===== */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)}>
          <aside
            className="absolute inset-y-0 left-0 w-[280px] bg-white flex flex-col animate-[gyeol-slide-up_.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-[64px] border-b border-[var(--color-line-soft)]">
              <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">
                {currentUser?.restaurantName ?? "결"}
              </p>
              <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 h-12 px-3.5 rounded-xl text-[15px] font-semibold transition-colors",
                      isActive
                        ? "bg-[var(--color-navy-700)] text-white"
                        : "text-[var(--color-ink-700)] hover:bg-[var(--color-navy-50)]"
                    )
                  }
                >
                  <n.icon className="w-5 h-5 shrink-0" />
                  {n.label}
                </NavLink>
              ))}
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
                로그아웃
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ===== Main ===== */}
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-[var(--color-line)]">
          <div className={cn("mx-auto flex items-center gap-2 h-[60px] lg:h-[72px] px-4 lg:px-8", widthClass)}>
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden w-10 h-10 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center -ml-2"
              aria-label="메뉴 열기"
            >
              <MenuIcon className="w-5 h-5 text-[var(--color-navy-800)]" />
            </button>
            <h1 className="text-[16px] lg:text-[20px] font-extrabold tracking-tight text-[var(--color-navy-900)] truncate">
              {heading}
            </h1>
            <div className="ml-auto flex items-center gap-2">{headerRight}</div>
          </div>
        </header>

        <main className={cn("mx-auto px-4 lg:px-8 py-5 lg:py-8 pb-12", widthClass)}>{children}</main>
      </div>
    </div>
  );
}
