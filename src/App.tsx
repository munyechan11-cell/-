import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import CustomerLogin from './pages/customer/Login';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerScanner from './pages/customer/Scanner';
import TableEntry from './pages/customer/TableEntry';
import OwnerLogin from './pages/owner/Login';
import OwnerDashboard from './pages/owner/Dashboard';
import OwnerCustomers from './pages/owner/Customers';
import OwnerScanner from './pages/owner/Scanner';
import Home from './pages/Home';
import Master from './pages/Master';

function PrivateRoute({ children, role }: { children: React.ReactNode, role: 'customer' | 'owner' }) {
  const { currentUser, users, logout } = useStore();
  
  const userExists = currentUser && users.some(u => u.id === currentUser.id);

  React.useEffect(() => {
    if (currentUser && !userExists) {
      logout();
    }
  }, [currentUser, userExists, logout]);

  if (!currentUser || currentUser.role !== role || !userExists) {
    return <Navigate to={`/${role}/login`} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { isReady, firebaseStatus } = useStore();

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
              <Route path="/owner/scanner" element={
                <PrivateRoute role="owner">
                  <OwnerScanner />
                </PrivateRoute>
              } />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
