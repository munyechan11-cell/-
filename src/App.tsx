import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
    let loginPath = allowed.includes("owner") || allowed.includes("staff") ? "/owner/login" : "/customer/login";
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
        ? "/owner"
        : currentUser.role === "staff"
        ? "/staff"
        : "/customer";
    return <Navigate to={dest} replace />;
  }

  // 직원 추가 가드
  if (currentUser.role === "staff") {
    if (!currentUser.employerStoreId) return <Navigate to="/staff/store-search" replace />;
    if (currentUser.employerStatus !== "approved") return <Navigate to="/staff/pending" replace />;
    if (requiresClockIn && !activeShift) return <Navigate to="/staff" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isReady } = useStore();

  if (!isReady) return <PageLoader />;

  return (
    <BrowserRouter>
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

          <Route path="/owner/login" element={<OwnerLogin />} />
          <Route path="/staff/login" element={<StaffLogin />} />

          <Route
            path="/owner"
            element={
              <PrivateRoute role="owner">
                <OwnerDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/brand-settings"
            element={
              <PrivateRoute role="owner">
                <BrandSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/customers"
            element={
              <PrivateRoute role="owner">
                <OwnerCustomers />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/statistics"
            element={
              <PrivateRoute role="owner">
                <OwnerStatistics />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/staff"
            element={
              <PrivateRoute role="owner">
                <OwnerStaff />
              </PrivateRoute>
            }
          />
          {/* 운영 페이지: 사장님 + (출근한) 직원 모두 접근 */}
          <Route
            path="/owner/qr-print"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <QrPrint />
              </PrivateRoute>
            }
          />
          {/* 예약: 직원은 출근 안 해도 추가 가능 */}
          <Route
            path="/owner/reservations"
            element={
              <PrivateRoute role={["owner", "staff"]}>
                <OwnerReservations />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/photos"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerPhotoVault />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/tables"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerTables />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/menus"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerMenus />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/orders"
            element={
              <PrivateRoute role={["owner", "staff"]} requiresClockIn>
                <OwnerOrders />
              </PrivateRoute>
            }
          />

          {/* ===== Staff ===== */}
          <Route path="/staff/store-search" element={<StaffStoreSearch />} />
          <Route path="/staff/pending" element={<StaffPending />} />
          <Route
            path="/staff"
            element={
              <PrivateRoute role="staff">
                <StaffDashboard />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
