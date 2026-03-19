import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import CustomerLogin from './pages/customer/Login';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerScanner from './pages/customer/Scanner';
import TableEntry from './pages/customer/TableEntry';
import OwnerLogin from './pages/owner/Login';
import OwnerDashboard from './pages/owner/Dashboard';
import OwnerCustomers from './pages/owner/Customers';
import Home from './pages/Home';
import Master from './pages/Master';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

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

export default function App() {
  const { isReady, firebaseStatus, firebaseError } = useStore();

  if (!isReady) {
    return (
      <div className="min-h-screen hanji-bg flex flex-col items-center justify-center p-4 text-center">
        <p className="text-[#795548] font-bold text-xl mb-4">서버와 연결 중...</p>
        <div className="w-8 h-8 border-4 border-[#D84315] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (firebaseStatus === 'error' || firebaseStatus === 'offline') {
    return (
      <div className="min-h-screen hanji-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full border-2 border-red-500">
          <h2 className="text-2xl font-black text-red-600 mb-4">🚨 서버 연결 실패 🚨</h2>
          <p className="text-[#795548] font-bold mb-4">
            현재 오프라인 모드(기기 내부 저장소)로 작동하려고 합니다.<br/>
            온라인 연동이 되지 않는 상태입니다.
          </p>
          
          {firebaseError && (
            <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded-xl text-sm mb-6 text-left break-all font-mono">
              <strong>에러 메시지:</strong><br/>
              {firebaseError}
            </div>
          )}

          <div className="bg-gray-100 border border-gray-300 text-gray-800 p-3 rounded-xl text-xs mb-6 text-left break-all font-mono">
            <strong className="text-gray-900">🔍 현재 앱에 주입된 설정값 확인:</strong><br/>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>Project ID: <span className="font-bold text-blue-600">{import.meta.env.VITE_FIREBASE_PROJECT_ID || '없음'}</span></li>
              <li>Database ID: <span className="font-bold text-blue-600">{import.meta.env.VITE_FIREBASE_DATABASE_ID || '없음 (default)'}</span></li>
              <li>API Key: <span className="font-bold text-blue-600">{import.meta.env.VITE_FIREBASE_API_KEY ? '설정됨(정상)' : '없음'}</span></li>
            </ul>
            <p className="mt-2 text-red-600 font-bold">
              ※ 만약 위 Database ID가 'geoyl'이 아니라 '없음'으로 뜬다면, Vercel 재배포가 아직 안 된 것이거나 핸드폰에 옛날 화면이 저장(캐시)되어 있는 것입니다!
            </p>
          </div>

          <div className="text-left bg-red-50 p-4 rounded-xl text-sm text-red-800 mb-6">
            <p className="font-bold mb-2">원인 확인 체크리스트:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Vercel 환경변수 이름에 오타가 없는지 확인 (예: <code className="bg-red-100 px-1 rounded">VITE_FIREBASE_API_KEY</code>)</li>
              <li>Vercel 환경변수 값에 따옴표(" ")가 들어가지 않았는지 확인</li>
              <li>Vercel에서 환경변수 입력 후 <b>반드시 Redeploy(재배포)</b>를 했는지 확인</li>
              <li>Firebase Firestore Database를 생성했는지 확인</li>
              <li>Firebase 규칙(Rules)을 <code className="bg-red-100 px-1 rounded">allow read, write: if true;</code> 로 변경하고 <b>게시(Publish)</b> 했는지 확인</li>
            </ol>
          </div>
          <p className="text-xs text-gray-500">
            (이 화면이 뜬다는 것은 Vercel에 입력한 파이어베이스 정보가 틀렸거나, 파이어베이스 데이터베이스 접근이 거부되었다는 뜻입니다.)
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen hanji-bg flex justify-center">
        <Toast />
        <div className="w-full max-w-md min-h-screen overflow-hidden relative flex flex-col">
          <div className="flex-1 overflow-y-auto no-scrollbar w-full h-full relative pt-safe pb-safe">
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
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
