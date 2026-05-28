import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useStore } from "./store/store";
import { ToastHost } from "./components/ui/Toast";
import { PageLoader } from "./components/ui/PageLoader";
import { GlobalOrderNotifier } from "./components/layout/GlobalOrderNotifier";

const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Master = lazy(() => import("./pages/Master"));

const CustomerLogin = lazy(() => import("./pages/customer/Login"));
const CustomerHome = lazy(() => import("./pages/customer/Home"));
const CustomerStoreDashboard = lazy(() => import("./pages/customer/Dashboard"));
const CustomerScanner = lazy(() => import("./pages/customer/Scanner"));
const TableEntry = lazy(() => import("./pages/customer/TableEntry"));

const OwnerLogin = lazy(() => import("./pages/owner/Login"));
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

function PrivateRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "customer" | "owner";
}) {
  const { currentUser, users, logout } = useStore();
  const location = useLocation();

  // 소프트삭제된 계정이 로컬스토리지에 남아있을 수 있음 → 자동 로그아웃
  React.useEffect(() => {
    if (!currentUser) return;
    const fresh = users.find((u) => u.id === currentUser.id);
    if (fresh && fresh.status === "deleted") {
      logout();
    }
  }, [currentUser, users, logout]);

  if (!currentUser || currentUser.role !== role) {
    let loginPath = `/${role}/login`;
    if (role === "customer") {
      const m = location.pathname.match(/\/customer\/store\/([^/]+)/);
      if (m?.[1]) loginPath = `/customer/store/${m[1]}/login`;
    }
    return <Navigate to={`${loginPath}${location.search}`} replace />;
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
            path="/owner/qr-print"
            element={
              <PrivateRoute role="owner">
                <QrPrint />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/reservations"
            element={
              <PrivateRoute role="owner">
                <OwnerReservations />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/photos"
            element={
              <PrivateRoute role="owner">
                <OwnerPhotoVault />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/tables"
            element={
              <PrivateRoute role="owner">
                <OwnerTables />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/menus"
            element={
              <PrivateRoute role="owner">
                <OwnerMenus />
              </PrivateRoute>
            }
          />
          <Route
            path="/owner/orders"
            element={
              <PrivateRoute role="owner">
                <OwnerOrders />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
