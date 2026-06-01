import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { useStore } from "./store/store";
import { ToastHost } from "./components/ui/Toast";
import { PageLoader } from "./components/ui/PageLoader";
import { GlobalOrderNotifier } from "./components/layout/GlobalOrderNotifier";
import { InstallPrompt } from "./components/ui/InstallPrompt";

const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Master = lazy(() => import("./pages/Master"));

const CustomerLogin = lazy(() => import("./pages/customer/Login"));
const CustomerHome = lazy(() => import("./pages/customer/Home"));
const CustomerStoreDashboard = lazy(() => import("./pages/customer/Dashboard"));
const CustomerScanner = lazy(() => import("./pages/customer/Scanner"));
const TableEntry = lazy(() => import("./pages/customer/TableEntry"));

const OwnerLogin = lazy(() => import("./pages/owner/Login"));
const StaffLogin = lazy(() => import("./pages/staff/Login"));
const OwnerDashboard = lazy(() => import("./pages/owner/Dashboard"));
const OwnerCustomers = lazy(() => import("./pages/owner/Customers"));
const OwnerStatistics = lazy(() => import("./pages/owner/Statistics"));
const BrandSettings = lazy(() => import("./pages/owner/BrandSettings"));
const QrPrint = lazy(() => import("./pages/owner/QrPrint"));
const OwnerReservations = lazy(() => import("./pages/owner/Reservations"));
const OwnerPhotoVault = lazy(() => import("./pages/owner/PhotoVault"));
const OwnerTables = lazy(() => import("./pages/owner/Tables"));
const OwnerMenus = lazy(() => import("./pages/owner/Menus"));
const OwnerOrders = lazy(() => import("./pages/owner/Orders"));
const OwnerStaff = lazy(() => import("./pages/owner/Staff"));

const StaffStoreSearch = lazy(() => import("./pages/staff/StoreSearch"));
const StaffPending = lazy(() => import("./pages/staff/Pending"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));

type Roles = "customer" | "owner" | "staff" | Array<"customer" | "owner" | "staff">;

function PrivateRoute({
  children,
  role,
  requiresClockIn,
}: {
  children: React.ReactNode;
  role: Roles;
  /** 직원일 때 출근 상태가 아니면 대시보드로 돌려보냄 */
  requiresClockIn?: boolean;
}) {
  const { currentUser, users, logout, activeShift } = useStore();
  const location = useLocation();

  React.useEffect(() => {
    if (!currentUser) return;
    const fresh = users.find((u) => u.id === currentUser.id);
    if (fresh && fresh.status === "deleted") {
      logout();
    }
  }, [currentUser, users, logout]);

  const allowed = Array.isArray(role) ? role : [role];

  if (!currentUser) {
    let loginPath = allowed.includes("owner") || allowed.includes("staff") ? "/biz/owner/login" : "/customer/login";
    if (allowed.includes("customer")) {
      const m = location.pathname.match(/\/customer\/store\/([^/]+)/);
      if (m?.[1]) loginPath = `/customer/store/${m[1]}/login`;
    }
    return <Navigate to={`${loginPath}${location.search}`} replace />;
  }

  // 로그인은 됐지만 권한이 없는 라우트 → 자기 대시보드로
  if (!allowed.includes(currentUser.role)) {
    const dest =
      currentUser.role === "owner"
        ? "/biz/owner"
        : currentUser.role === "staff"
        ? "/biz/staff"
        : "/customer";
    return <Navigate to={dest} replace />;
  }

  // 직원 추가 가드
  if (currentUser.role === "staff") {
    if (!currentUser.employerStoreId) return <Navigate to="/biz/staff/store-search" replace />;
    if (currentUser.employerStatus !== "approved") return <Navigate to="/biz/staff/pending" replace />;
    if (requiresClockIn && !activeShift) return <Navigate to="/biz/staff" replace />;
  }

  return <>{children}</>;
}

// 운영 영역 (/biz/*) 검색엔진 차단 — useLocation 의존이라 라우터 컨텍스트 내부에서 작동
function BizNoIndex() {
  const loc = useLocation();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const inBiz = loc.pathname.startsWith("/biz");
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (inBiz) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        document.head.appendChild(meta);
      }
      meta.content = "noindex,nofollow";
    } else if (meta) {
      meta.remove();
    }
  }, [loc.pathname]);
  return null;
}

// 손님에겐 노출하지 않는 운영자 입구
function BizEntry() {
  const { currentUser } = useStore();
  if (currentUser?.role === "owner") return <Navigate to="/biz/owner" replace />;
  if (currentUser?.role === "staff") return <Navigate to="/biz/staff" replace />;

  return (
    <div className="min-h-screen bg-[var(--color-navy-900)] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <span className="w-11 h-11 rounded-xl bg-white text-[var(--color-navy-900)] text-xl font-extrabold flex items-center justify-center">
            결
          </span>
          <div>
            <p className="text-[11px] font-bold opacity-60 uppercase tracking-widest">Gyeol Business</p>
            <p className="text-[18px] font-extrabold tracking-tight">운영자 콘솔</p>
          </div>
        </div>
        <p className="text-[13.5px] opacity-70 font-medium leading-relaxed mb-7">
          매장 운영자 전용 입구입니다. 손님이라면 <Link to="/" className="underline font-bold">홈으로 돌아가세요</Link>.
        </p>
        <div className="space-y-3">
          <Link
            to="/biz/owner/login"
            className="block rounded-2xl bg-white text-[var(--color-navy-900)] p-5 font-extrabold text-[16px] tracking-tight hover:-translate-y-0.5 transition-transform"
          >
            사장님 로그인 →
          </Link>
          <Link
            to="/biz/staff/login"
            className="block rounded-2xl bg-white/10 border border-white/15 text-white p-5 font-extrabold text-[16px] tracking-tight hover:bg-white/15 transition-colors"
          >
            직원 로그인 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// 레거시 /owner/* /staff/* → /biz/owner/* /biz/staff/* 영구 이전
// 앵커는 `^/owner(?=/|$)` 형태로 정확히 매칭 — `/ownerships` 같은 경로 오작동 방지
function LegacyBizRedirect({ prefix }: { prefix: "owner" | "staff" }) {
  const loc = useLocation();
  const sub = loc.pathname.replace(new RegExp(`^/${prefix}(?=/|$)`), "");
  return <Navigate to={`/biz/${prefix}${sub}${loc.search}`} replace />;
}

export default function App() {
  const { isReady } = useStore();

  if (!isReady) return <PageLoader />;

  return (
    <BrowserRouter>
      <BizNoIndex />
      <ToastHost />
      <GlobalOrderNotifier />
      <InstallPrompt />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/master" element={<Master />} />
          <Route path="/scan" element={<CustomerScanner />} />

          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/store/:storeId/login" element={<CustomerLogin />} />
          <Route
            path="/customer/store/:storeId/table/:tableNumber"
            element={<TableEntry />}
          />
          <Route
            path="/customer"
            element={
              <PrivateRoute role="customer">
                <CustomerHome />
              </PrivateRoute>
            }
          />
          <Route
            path="/customer/store/:storeId"
            element={
              <PrivateRoute role="customer">
                <CustomerStoreDashboard />
              </PrivateRoute>
            }
          />

          <Route path="/biz/owner/login" element={<OwnerLogin />} />
          <Route path="/biz/staff/login" element={<StaffLogin />} />

          <Route
            path="/biz/owner"
            element={
              <PrivateRoute role="owner">
                <OwnerDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/brand-settings"
            element={
              <PrivateRoute role="owner">
                <BrandSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/customers"
            element={
              <PrivateRoute role="owner">
                <OwnerCustomers />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/statistics"
            element={
              <PrivateRoute role="owner">
                <OwnerStatistics />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/staff"
            element={
              <PrivateRoute role="owner">
                <OwnerStaff />
              </PrivateRoute>
            }
          />
          {/* 운영 페이지: 사장님 + (출근한) 직원 모두 접근 */}
          <Route
            path="/biz/owner/qr-print"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <QrPrint />
              </PrivateRoute>
            }
          />
          {/* 예약: 직원은 출근 안 해도 추가 가능 */}
          <Route
            path="/biz/owner/reservations"
            element={
              <PrivateRoute role={["owner", "staff"]}>
                <OwnerReservations />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/photos"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerPhotoVault />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/tables"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerTables />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/menus"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerMenus />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/orders"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerOrders />
              </PrivateRoute>
            }
          />

          {/* ===== Staff ===== */}
          <Route path="/biz/staff/store-search" element={<StaffStoreSearch />} />
          <Route path="/biz/staff/pending" element={<StaffPending />} />
          <Route
            path="/biz/staff"
            element={
              <PrivateRoute role="staff">
                <StaffDashboard />
              </PrivateRoute>
            }
          />

          {/* 운영 영역 입구 — 사장님/직원 분기 */}
          <Route path="/biz" element={<BizEntry />} />

          {/* 레거시 경로 호환: 기존 북마크/링크 보존 */}
          <Route path="/owner/*" element={<LegacyBizRedirect prefix="owner" />} />
          <Route path="/staff/*" element={<LegacyBizRedirect prefix="staff" />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
