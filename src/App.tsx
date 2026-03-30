import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { CheckCircle2, AlertCircle, Info, Loader2, WifiOff } from 'lucide-react';
import DarkModeToggle from './components/DarkModeToggle';

// Lazy load pages for better performance
const CustomerLogin = lazy(() => import('./pages/customer/Login'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const CustomerScanner = lazy(() => import('./pages/customer/Scanner'));
const TableEntry = lazy(() => import('./pages/customer/TableEntry'));
const OwnerLogin = lazy(() => import('./pages/owner/Login'));
const OwnerDashboard = lazy(() => import('./pages/owner/Dashboard'));
const OwnerCustomers = lazy(() => import('./pages/owner/Customers'));
const OwnerStatistics = lazy(() => import('./pages/owner/Statistics'));
const Home = lazy(() => import('./pages/Home'));
const Master = lazy(() => import('./pages/Master'));

function Toast() {
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info', id: number } | null>(null);

  useEffect(() => {
    const handleToast = (e: CustomEvent) => {
      setToast({ ...e.detail, id: Date.now() });
    };
    window.addEventListener('show-toast', handleToast as EventListener);
    return () => window.removeEventListener('show-toast', handleToast as EventListener);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const bgs = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg border ${bgs[toast.type]}`}>
        {icons[toast.type]}
        <span className="font-bold text-sm">{toast.message}</span>
      </div>
    </div>
  );
}

function PrivateRoute({ children, role }: { children: React.ReactNode, role: 'customer' | 'owner' }) {
  const { currentUser, users, logout } = useStore();
  const location = useLocation();
  
  const userExists = currentUser && users.some(u => u.id === currentUser.id);

  React.useEffect(() => {
    if (currentUser && !userExists) {
      logout();
    }
  }, [currentUser, userExists, logout]);

  if (!currentUser || currentUser.role !== role || !userExists) {
    let loginPath = `/${role}/login`;
    if (role === 'customer' && location.pathname.includes('/customer/store/')) {
      const match = location.pathname.match(/\/customer\/store\/([^/]+)/);
      if (match && match[1]) {
        loginPath = `/customer/store/${match[1]}/login`;
      }
    }
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 text-center">
      <Loader2 className="w-8 h-8 text-burgundy dark:text-burgundy-light animate-spin mb-4" />
      <p className="text-ink-light/60 dark:text-ink-dark/60 font-medium text-sm">페이지를 불러오는 중...</p>
    </div>
  );
}

export default function App() {
  const { isReady, firebaseStatus, firebaseError } = useStore();
  const [showSlowHint, setShowSlowHint] = useState(false);
  const [forceOffline, setForceOffline] = useState(false);

  useEffect(() => {
    if (!isReady) {
      const timer = setTimeout(() => setShowSlowHint(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-hanji-light dark:bg-hanji-dark flex flex-col items-center justify-center p-4 text-center">
        <p className="text-ink-light/80 dark:text-ink-dark/80 font-bold text-xl mb-4 font-serif">서버와 연결 중...</p>
        <div className="w-8 h-8 border-4 border-burgundy/20 dark:border-burgundy-light/20 border-t-burgundy dark:border-t-burgundy-light rounded-full animate-spin"></div>
        {showSlowHint && (
          <p className="mt-6 text-ink-light/50 dark:text-ink-dark/50 text-sm font-medium animate-in fade-in">
            조금 오래 걸리고 있어요...🔄🔄🔄
            <br />
            <span className="text-xs mt-1 block">인터넷 상태를 확인하거나 잠시 후 다시 시도해주세요.</span>
          </p>
        )}
      </div>
    );
  }

  if ((firebaseStatus === 'error' || firebaseStatus === 'offline') && !forceOffline) {
    return (
      <div className="min-h-screen bg-hanji-light dark:bg-hanji-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-black/20 p-8 rounded-3xl shadow-sm max-w-md w-full border border-red-100 dark:border-red-900/30">
          <h2 className="text-2xl font-serif font-bold text-red-600 dark:text-red-400 mb-4">서버 연결 실패</h2>
          <p className="text-ink-light/80 dark:text-ink-dark/80 font-medium mb-4">
            현재 오프라인 모드(기기 내부 저장소)로 작동하려고 합니다.<br/>
            온라인 연동이 되지 않는 상태입니다.
          </p>
          
          <button 
            onClick={() => setForceOffline(true)}
            className="w-full py-3 mb-6 bg-burgundy text-white rounded-xl font-bold hover:bg-burgundy/90 transition-colors"
          >
            오프라인 모드로 계속하기
          </button>

          {firebaseError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-300 p-3 rounded-xl text-sm mb-6 text-left break-all font-mono">
              <strong>에러 메시지:</strong><br/>
              {firebaseError}
            </div>
          )}

          <div className="bg-ink-light/5 dark:bg-ink-dark/5 border border-ink-light/10 dark:border-ink-dark/10 text-ink-light/80 dark:text-ink-dark/80 p-3 rounded-xl text-xs mb-6 text-left break-all font-mono">
            <strong className="text-ink-light dark:text-ink-dark">🔍 현재 앱에 주입된 설정값 확인:</strong><br/>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>Project ID: <span className="font-bold text-blue-600 dark:text-blue-400">{import.meta.env.VITE_FIREBASE_PROJECT_ID || '없음'}</span></li>
              <li>Database ID: <span className="font-bold text-blue-600 dark:text-blue-400">{import.meta.env.VITE_FIREBASE_DATABASE_ID || '없음 (default)'}</span></li>
              <li>API Key: <span className="font-bold text-blue-600 dark:text-blue-400">{import.meta.env.VITE_FIREBASE_API_KEY ? '설정됨(정상)' : '없음'}</span></li>
            </ul>
            <p className="mt-2 text-red-600 dark:text-red-400 font-bold">
              ※ 만약 위 Database ID가 'geoyl'이 아니라 '없음'으로 뜬다면, Vercel 재배포가 아직 안 된 것이거나 핸드폰에 옛날 화면이 저장(캐시)되어 있는 것입니다!
            </p>
          </div>

          <div className="text-left bg-red-50 dark:bg-red-900/20 p-4 rounded-xl text-sm text-red-800 dark:text-red-300 mb-6">
            <p className="font-bold mb-2">원인 확인 체크리스트:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Vercel 환경변수 이름에 오타가 없는지 확인 (예: <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">VITE_FIREBASE_API_KEY</code>)</li>
              <li>Vercel 환경변수 값에 따옴표(" ")가 들어가지 않았는지 확인</li>
              <li>Vercel에서 환경변수 입력 후 <b>반드시 Redeploy(재배포)</b>를 했는지 확인</li>
              <li>Firebase Firestore Database를 생성했는지 확인</li>
              <li>Firebase 규칙(Rules)을 <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">allow read, write: if true;</code> 로 변경하고 <b>게시(Publish)</b> 했는지 확인</li>
            </ol>
          </div>
          <p className="text-xs text-ink-light/50 dark:text-ink-dark/50">
            (이 화면이 뜬다는 것은 Vercel에 입력한 파이어베이스 정보가 틀렸거나, 파이어베이스 데이터베이스 접근이 거부되었다는 뜻입니다.)
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen modern-bg flex justify-center items-center md:p-6 lg:p-8">
        <DarkModeToggle />
        <Toast />
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl min-h-screen md:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-4rem)] overflow-hidden relative flex flex-col bg-white dark:bg-hanji-dark shadow-2xl md:rounded-[2.5rem] border-0 md:border border-slate-200 dark:border-ink-dark/10">
          <div className="flex-1 overflow-y-auto no-scrollbar w-full h-full relative pt-safe pb-safe">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/master" element={<Master />} />
                
                {/* Customer Routes */}
                <Route path="/scan" element={<CustomerScanner />} />
                <Route path="/customer/login" element={<CustomerLogin />} />
                <Route path="/customer/store/:storeId/login" element={<CustomerLogin />} />
                <Route path="/customer/store/:storeId/table/:tableNumber" element={<TableEntry />} />
                <Route path="/customer" element={
                  <PrivateRoute role="customer">
                    <CustomerDashboard />
                  </PrivateRoute>
                } />
                <Route path="/customer/store/:storeId" element={
                  <PrivateRoute role="customer">
                    <CustomerDashboard />
                  </PrivateRoute>
                } />

                {/* Owner Routes */}
                <Route path="/owner/login" element={<OwnerLogin />} />
                <Route path="/owner" element={
                  <PrivateRoute role="owner">
                    <OwnerDashboard />
                  </PrivateRoute>
                } />
                <Route path="/owner/customers" element={
                  <PrivateRoute role="owner">
                    <OwnerCustomers />
                  </PrivateRoute>
                } />
                <Route path="/owner/statistics" element={
                  <PrivateRoute role="owner">
                    <OwnerStatistics />
                  </PrivateRoute>
                } />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>
    </Router>
  );
}
