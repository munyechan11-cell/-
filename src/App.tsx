import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { useStore } from "./store/store";
import { useLanguage, t } from "./lib/i18n";
import { ToastHost } from "./components/ui/Toast";
import { PageLoader } from "./components/ui/PageLoader";
import { GlobalOrderNotifier } from "./components/layout/GlobalOrderNotifier";
import { InstallPrompt } from "./components/ui/InstallPrompt";
import { PhoneVerifyGate } from "./components/ui/PhoneVerifyGate";

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
const OwnerMarketing = lazy(() => import("./pages/owner/Marketing"));
const OwnerInventory = lazy(() => import("./pages/owner/Inventory"));
const OwnerStatistics = lazy(() => import("./pages/owner/Statistics"));
const OwnerSettlement = lazy(() => import("./pages/owner/Settlement"));
const BrandSettings = lazy(() => import("./pages/owner/BrandSettings"));
const QrPrint = lazy(() => import("./pages/owner/QrPrint"));
const OwnerReservations = lazy(() => import("./pages/owner/Reservations"));
const OwnerWelcomeDisplay = lazy(() => import("./pages/owner/WelcomeDisplay"));
const OwnerPhotoVault = lazy(() => import("./pages/owner/PhotoVault"));
const OwnerTables = lazy(() => import("./pages/owner/Tables"));
const OwnerMenus = lazy(() => import("./pages/owner/Menus"));
const OwnerOrders = lazy(() => import("./pages/owner/Orders"));
const OwnerStaff = lazy(() => import("./pages/owner/Staff"));
const OwnerHelp = lazy(() => import("./pages/owner/Help"));

const StaffStoreSearch = lazy(() => import("./pages/staff/StoreSearch"));
const StaffPending = lazy(() => import("./pages/staff/Pending"));
const StaffDashboard = lazy(() => import("./pages/staff/Dashboard"));

const PaymentResult = lazy(() => import("./pages/PaymentResult"));

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
  const lang = useLanguage();
  if (currentUser?.role === "owner") return <Navigate to="/biz/owner" replace />;
  if (currentUser?.role === "staff") return <Navigate to="/biz/staff" replace />;

  return (
    <div
      className="min-h-screen bg-[var(--color-navy-900)] text-white flex items-center justify-center px-6 py-8 relative overflow-hidden"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* 배경 장식 — 데스크탑에서 카드 한 장이 외롭게 떠 있는 느낌 제거 */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[var(--color-mint-700)]/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--color-navy-700)]/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm lg:max-w-4xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
        {/* 좌측: 브랜드·메시지 (데스크탑 전용 확장) */}
        <div>
          <div className="flex items-center gap-3 mb-7">
            <span className="w-11 h-11 lg:w-14 lg:h-14 rounded-xl bg-white text-[var(--color-navy-900)] text-xl lg:text-2xl font-extrabold flex items-center justify-center">
              결
            </span>
            <div>
              <p className="text-[11px] font-bold opacity-60 uppercase tracking-widest">{t("bizEntry.brand", lang)}</p>
              <p className="text-[18px] lg:text-[22px] font-extrabold tracking-tight">{t("bizEntry.consoleTitle", lang)}</p>
            </div>
          </div>
          <h1 className="hidden lg:block text-[40px] xl:text-[48px] font-extrabold tracking-tight leading-[1.1] mb-5">
            {t("bizEntry.heroLine1", lang)}
            <br />
            <span className="text-[var(--color-mint-400)]">{t("bizEntry.heroLine2", lang)}</span>
          </h1>
          <p className="text-[13.5px] lg:text-[15px] opacity-70 font-medium leading-relaxed mb-7 lg:mb-0">
            {t("bizEntry.subtitle", lang)} <Link to="/" className="underline font-bold">{t("bizEntry.homeLink", lang)}</Link>{t("bizEntry.subtitleSuffix", lang)}
          </p>
        </div>

        {/* 우측: 로그인 진입 카드들 */}
        <div className="space-y-3">
          <Link
            to="/biz/owner/login"
            className="block rounded-2xl bg-white text-[var(--color-navy-900)] p-5 lg:p-6 font-extrabold text-[16px] lg:text-[18px] tracking-tight hover:-translate-y-0.5 transition-transform shadow-[var(--shadow-navy)]"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-500)] mb-1">{t("bizEntry.ownerSection", lang)}</div>
            {t("bizEntry.ownerCta", lang)}
          </Link>
          <Link
            to="/biz/staff/login"
            className="block rounded-2xl bg-white/10 border border-white/15 text-white p-5 lg:p-6 font-extrabold text-[16px] lg:text-[18px] tracking-tight hover:bg-white/15 transition-colors"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{t("bizEntry.staffSection", lang)}</div>
            {t("bizEntry.staffCta", lang)}
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

  // 푸시 포그라운드 리스너 — 앱이 열려있을 때 도착하는 알림을 toast 로
  useEffect(() => {
    import("./lib/pushNotifications").then((m) => m.listenForeground()).catch(() => {});
  }, []);

  if (!isReady) return <PageLoader />;

  return (
    <BrowserRouter>
      <BizNoIndex />
      <ToastHost />
      <GlobalOrderNotifier />
      <InstallPrompt />
      <PhoneVerifyGate />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/master" element={<Master />} />
          <Route path="/scan" element={<CustomerScanner />} />
          <Route path="/pay/success" element={<PaymentResult mode="success" />} />
          <Route path="/pay/fail" element={<PaymentResult mode="fail" />} />

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
            path="/biz/owner/marketing"
            element={
              <PrivateRoute role="owner">
                <OwnerMarketing />
              </PrivateRoute>
            }
          />
          <Route
            path="/biz/owner/inventory"
            element={
              <PrivateRoute role="owner">
                <OwnerInventory />
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
            path="/biz/owner/settlement"
            element={
              <PrivateRoute role="owner">
                <OwnerSettlement />
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
          {/* 도움말 — 사장님 + 직원 모두 접근 가능 (출근 안 해도 OK) */}
          <Route
            path="/biz/owner/help"
            element={
              <PrivateRoute role={["owner", "staff"]}>
                <OwnerHelp />
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
          {/* 듀얼 모니터/큰 화면 송출 — 손님이 보는 화면 */}
          <Route
            path="/biz/owner/welcome-display"
            element={
              <PrivateRoute role={["owner", "staff"]}>
                <OwnerWelcomeDisplay />
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
