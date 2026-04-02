import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { CheckCircle2, AlertCircle, Info, Loader2, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CustomerLogin = lazy(() => import('./pages/customer/Login'));
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const CustomerScanner = lazy(() => import('./pages/customer/Scanner'));
const TableEntry = lazy(() => import('./pages/customer/TableEntry'));
const OwnerLogin = lazy(() => import('./pages/owner/Login'));
const OwnerDashboard = lazy(() => import('./pages/owner/Dashboard'));
const OwnerCustomers = lazy(() => import('./pages/owner/Customers'));
const OwnerStatistics = lazy(() => import('./pages/owner/Statistics'));
const BrandSettings = lazy(() => import('./pages/owner/BrandSettings'));
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
    success: <CheckCircle2 className="w-5 h-5 text-primary" />,
    error: <AlertCircle className="w-5 h-5 text-burgundy" />,
    info: <Info className="w-5 h-5 text-primary" />
  };

  const bgs = {
    success: 'bg-primary/5 border-primary/10 text-primary',
    error: 'bg-burgundy/5 border-burgundy/10 text-burgundy',
    info: 'bg-primary/5 border-primary/10 text-primary'
  };

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={`flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl border backdrop-blur-md ${bgs[toast.type]}`}>
        {icons[toast.type]}
        <span className="font-bold text-xs uppercase tracking-tight">{toast.message}</span>
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
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-8 text-center text-primary selection:bg-primary/10">
      <div className="relative mb-8">
         <div className="w-16 h-16 rounded-[2rem] border-4 border-primary/5 border-t-primary animate-spin"></div>
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[10px] font-serif italic font-bold">결</div>
         </div>
      </div>
      <p className="text-primary/40 font-bold text-[10px] uppercase tracking-[0.3em]">매장 시스템 연결 중...</p>
    </div>
  );
}

function NavigationRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes key={location.pathname} location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/master" element={<Master />} />
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

        <Route path="/owner/login" element={<OwnerLogin />} />
        <Route path="/owner" element={
          <PrivateRoute role="owner">
            <OwnerDashboard />
          </PrivateRoute>
        } />
        <Route path="/owner/brand-settings" element={
          <PrivateRoute role="owner">
            <BrandSettings />
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
    </AnimatePresence>
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
    return <PageLoader />;
  }

  if ((firebaseStatus === 'error' || firebaseStatus === 'offline') && !forceOffline) {
    return (
      <div className="min-h-screen bg-[#fdfaf7] flex flex-col items-center justify-center p-6 text-center selection:bg-primary/10">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-3xl max-w-md w-full border border-[#e5dcd3] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
          
          <div className="w-20 h-20 bg-burgundy/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <WifiOff className="w-10 h-10 text-burgundy" />
          </div>
          
          <h2 className="text-3xl font-serif font-black text-primary mb-4 italic tracking-tighter">연결이 원활하지 않습니다</h2>
          <p className="text-on-surface-variant/60 font-medium mb-12 text-sm leading-relaxed">
            실시간 데이터를 불러올 수 없습니다. <br/>
            네트워크 연결을 확인하거나 다시 시도해 보세요.
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-5 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              새로고침하여 다시 시도
            </button>
            <button 
              onClick={() => setForceOffline(true)}
              className="w-full py-4 text-on-surface-variant/40 hover:text-primary rounded-2xl font-bold uppercase tracking-widest text-[9px] transition-all"
            >
              오프라인 모드로 계속하기
            </button>
          </div>

          {firebaseError && (
            <details className="mt-12 text-left opacity-30">
              <summary className="text-[9px] font-bold text-primary uppercase tracking-widest cursor-pointer list-none text-center hover:opacity-100 transition-opacity">
                Error Details
              </summary>
              <div className="mt-4 p-4 bg-primary/5 rounded-xl text-[9px] font-mono break-all border border-primary/5">
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
      <div className="min-h-screen bg-surface-bright selection:bg-primary/20">
        <Toast />
        <div className="w-full min-h-screen relative">
          <Suspense fallback={<PageLoader />}>
            <NavigationRoutes />
          </Suspense>
        </div>
      </div>
    </Router>
  );
}
