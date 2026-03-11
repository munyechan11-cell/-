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
  const { isReady } = useStore();

  if (!isReady) {
    return (
      <div className="min-h-screen hanji-bg flex items-center justify-center">
        <p className="text-[#795548] font-bold">서버와 연결 중...</p>
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
