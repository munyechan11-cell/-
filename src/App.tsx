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
      const timer = setTimeout(() => setShowSlowHint(true), 10000);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-hanji-light dark:bg-hanji-dark flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 rounded-full bg-burgundy/5 dark:bg-burgundy/10 flex items-center justify-center mb-8 relative">
          <div className="absolute inset-0 rounded-full border-2 border-burgundy/10 border-t-burgundy animate-spin"></div>
          <Loader2 className="w-8 h-8 text-burgundy dark:text-burgundy-light animate-pulse" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark mb-2 tracking-tight">연결 중입니다</h2>
        <p className="text-ink-light/50 dark:text-ink-dark/50 text-sm font-medium">안정적인 서비스를 위해 서버와 동기화하고 있습니다.</p>
        
        {showSlowHint && (
          <div className="mt-12 p-6 bg-white/50 dark:bg-black/20 rounded-[2rem] border border-ink-light/5 dark:border-ink-dark/5 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm leading-relaxed">
              연결이 평소보다 늦어지고 있습니다.<br/> 
              인터넷 상태를 확인하거나 잠시 후 다시 시도해 주세요.
            </p>
            <button 
              onClick={() => setForceOffline(true)}
              className="mt-6 text-burgundy dark:text-burgundy-light text-xs font-bold underline underline-offset-4 hover:text-burgundy/70 transition-colors"
            >
              오프라인 모드로 계속하기
            </button>
          </div>
        )}
      </div>
    );
  }

  if ((firebaseStatus === 'error' || firebaseStatus === 'offline') && !forceOffline) {
    return (
      <div className="min-h-screen bg-hanji-light dark:bg-hanji-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-black/20 p-10 rounded-[3rem] shadow-sm max-w-md w-full border border-ink-light/5 dark:border-ink-dark/5">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark mb-4 tracking-tight">연결이 원활하지 않습니다</h2>
          <p className="text-ink-light/60 dark:text-ink-dark/60 font-medium mb-8 text-sm leading-relaxed">
            실시간 데이터를 불러올 수 없습니다. <br/>
            네트워크 연결을 확인하거나 아래 복구 옵션을 시도해 보세요.
          </p>
          
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-burgundy text-white rounded-2xl font-bold hover:bg-burgundy/90 transition-all shadow-md active:scale-[0.98]"
            >
              새로고침하여 다시 시도
            </button>
            
            <button 
              onClick={() => {
                // Manually trigger fallback to default database
                window.dispatchEvent(new CustomEvent('force-firebase-fallback'));
              }}
              className="w-full py-4 bg-ink-light/5 dark:bg-ink-dark/5 text-ink-light dark:text-ink-dark rounded-2xl font-bold hover:bg-ink-light/10 transition-colors border border-ink-light/10"
            >
              기본 데이터베이스로 접속 시도
            </button>

            <button 
              onClick={() => setForceOffline(true)}
              className="w-full py-4 bg-transparent text-ink-light/40 dark:text-ink-dark/40 rounded-2xl font-bold hover:text-ink-light/60 transition-colors text-xs"
            >
              오프라인 모드로 계속하기
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-ink-light/5 dark:border-ink-dark/5">
            <p className="text-[10px] text-ink-light/30 dark:text-ink-dark/30 mb-2">접속 시도 중인 데이터베이스 정보</p>
            <div className="px-3 py-2 bg-ink-light/5 dark:bg-ink-dark/5 rounded-xl inline-block">
              <code className="text-[10px] text-ink-light/50 dark:text-ink-dark/50 font-mono">
                {import.meta.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-c3b0...'}
              </code>
            </div>
          </div>

          {firebaseError && (
            <details className="mt-4 text-left group">
              <summary className="text-[9px] text-ink-light/20 dark:text-ink-dark/20 cursor-pointer hover:text-ink-light/40 transition-colors list-none text-center">
                기술적 에러 정보
              </summary>
              <div className="mt-2 p-4 bg-ink-light/5 dark:bg-ink-dark/5 rounded-2xl text-[9px] text-ink-light/40 dark:text-ink-dark/40 font-mono break-all border border-ink-light/5 dark:border-ink-dark/5">
                {firebaseError}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen modern-bg flex justify-center items-center md:p-6 lg:p-8">
        <DarkModeToggle />
        <Toast />
        <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl min-h-screen md:min-h-[calc(100vh - 3rem)] lg:min-h-[calc(100vh - 4rem)] overflow-hidden relative flex flex-col bg-white dark:bg-hanji-dark shadow-2xl md:rounded-[2.5rem] border-0 md:border border-slate-200 dark:border-ink-dark/10">
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
