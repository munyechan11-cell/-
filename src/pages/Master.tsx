import React, { useState } from 'react';
import { useStore, getEffectiveTier, getTierColor } from '../store';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store, Users, Ticket, Calendar, Lock, KeyRound, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export default function Master() {
  const { users, visits, coupons, tierOverrides, masterPassword, setMasterPassword, deleteUser } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'owners' | 'customers'>('owners');
  const [deletingUser, setDeletingUser] = useState<{ id: string; role: 'owner' | 'customer'; name: string } | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === masterPassword) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 3) {
      setError('새 비밀번호는 3자리 이상이어야 합니다.');
      return;
    }
    setMasterPassword(newPassword);
    setIsChangingPassword(false);
    setNewPassword('');
    setError('');
    import('../store').then(({ showToast }) => showToast('비밀번호가 성공적으로 변경되었습니다.', 'success')).catch(console.error);
  };

  const handleDeleteUser = (userId: string, role: 'owner' | 'customer', name: string) => {
    setDeletingUser({ id: userId, role, name });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden p-8 text-center relative">
          <Link 
            to="/" 
            className="absolute top-4 left-4 p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors z-10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4 mt-4">
            <Lock className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2 tracking-tight text-slate-900">마스터 인증</h2>
          <p className="text-slate-500 mb-8 text-sm">관리자 페이지에 접근하려면<br/>비밀번호를 입력해주세요.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-center text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm font-medium bg-red-50 py-2 rounded-xl border border-red-100">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-sm shadow-indigo-200"
            >
              인증하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  const owners = users.filter(u => u.role === 'owner');

  const getOwnerStats = (ownerId: string) => {
    const ownerVisits = visits.filter(v => v.storeId === ownerId);
    const ownerCoupons = coupons.filter(c => c.storeId === ownerId);
    const usedCoupons = ownerCoupons.filter(c => c.status === 'used');
    
    // Unique customers
    const uniqueCustomers = new Set(ownerVisits.map(v => v.customerId)).size;

    return {
      totalVisits: ownerVisits.length,
      totalCoupons: ownerCoupons.length,
      usedCoupons: usedCoupons.length,
      uniqueCustomers
    };
  };

  return (
    <div className="min-h-full bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white text-slate-900 p-6 pt-8 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center">
          <Link to="/" className="p-2 bg-white rounded-full hover:bg-slate-50 shadow-sm border border-slate-200 transition-colors mr-4">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">마스터 관리자</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">등록된 전체 사장님 현황</p>
          </div>
        </div>
        <button 
          onClick={() => setIsChangingPassword(!isChangingPassword)}
          className="p-2 bg-white rounded-full hover:bg-slate-50 shadow-sm border border-slate-200 transition-colors"
          title="비밀번호 변경"
        >
          <KeyRound className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      <div className="p-6">
        {isChangingPassword && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-indigo-200 mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center">
              <KeyRound className="w-5 h-5 mr-2 text-indigo-600" />
              비밀번호 변경
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
              {error && (
                <p className="text-red-600 text-sm font-medium">{error}</p>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setError('');
                    setNewPassword('');
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
                >
                  변경하기
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center text-slate-500 mb-2">
              <Store className="w-5 h-5 mr-2 text-indigo-600" />
              <span className="font-semibold text-sm">총 가맹점</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{owners.length}<span className="text-lg font-medium text-slate-500 ml-1">곳</span></p>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center text-slate-500 mb-2">
              <Users className="w-5 h-5 mr-2 text-indigo-600" />
              <span className="font-semibold text-sm">총 손님</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{users.filter(u => u.role === 'customer').length}<span className="text-lg font-medium text-slate-500 ml-1">명</span></p>
          </div>
        </div>

        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('owners')}
            className={`flex-1 py-3 rounded-2xl font-semibold transition-colors ${activeTab === 'owners' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200'}`}
          >
            가맹점 관리
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 py-3 rounded-2xl font-semibold transition-colors ${activeTab === 'customers' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200'}`}
          >
            전체 손님 관리
          </button>
        </div>

        {activeTab === 'owners' ? (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-4">가맹점 목록</h2>
            
            {owners.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
                <p className="text-slate-500">아직 등록된 사장님이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {owners.map(owner => {
                  const stats = getOwnerStats(owner.id);
                  const isExpanded = expandedOwner === owner.id;
                  const ownerCustomers = users.filter(u => u.role === 'customer' && u.storeId === owner.id);

                  return (
                    <div key={owner.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{owner.restaurantName || '이름 없는 가게'}</h3>
                          <p className="text-slate-500 text-sm mt-1">{owner.name} 사장님 • {owner.phone}</p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
                            ID: {owner.id}
                          </span>
                          <button 
                            onClick={() => handleDeleteUser(owner.id, 'owner', owner.name)}
                            className="text-red-500 hover:text-red-700 p-1 transition-colors"
                            title="사장님 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                          <Users className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                          <p className="text-xs text-slate-500 mb-1">등록 고객</p>
                          <p className="font-bold text-slate-900">{stats.uniqueCustomers}명</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                          <Calendar className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                          <p className="text-xs text-slate-500 mb-1">누적 방문</p>
                          <p className="font-bold text-slate-900">{stats.totalVisits}회</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-100">
                          <Ticket className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                          <p className="text-xs text-slate-500 mb-1">쿠폰 사용</p>
                          <p className="font-bold text-slate-900">{stats.usedCoupons}/{stats.totalCoupons}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setExpandedOwner(isExpanded ? null : owner.id)}
                        className="w-full py-2.5 flex items-center justify-center text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 rounded-xl hover:bg-slate-100"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-4 h-4 mr-1" /> 고객 목록 닫기</>
                        ) : (
                          <><ChevronDown className="w-4 h-4 mr-1" /> 고객 목록 보기</>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                          {ownerCustomers.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-2">등록된 고객이 없습니다.</p>
                          ) : (
                            ownerCustomers.map(customer => (
                              <div key={customer.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{customer.name}</p>
                                  <p className="text-xs text-slate-500">{customer.phone}</p>
                                </div>
                                <button 
                                  onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)}
                                  className="text-red-400 hover:text-red-600 p-2 transition-colors"
                                  title="고객 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-4">전체 손님 목록</h2>
            {users.filter(u => u.role === 'customer').length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100">
                <p className="text-slate-500">아직 등록된 손님이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.filter(u => u.role === 'customer').map(customer => {
                  const store = owners.find(o => o.id === customer.storeId);
                  const customerVisits = visits.filter(v => v.customerId === customer.id);
                  const customerCoupons = coupons.filter(c => c.customerId === customer.id);
                  const availableCoupons = customerCoupons.filter(c => c.status === 'available');
                  
                  // Calculate tier based on recent visits (last 30 days)
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  const recentVisits = customerVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
                  const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;
                  
                  const override = tierOverrides?.find(t => t.customerId === customer.id && t.storeId === customer.storeId);
                  const currentTier = getEffectiveTier(uniqueVisitDays, override?.tier);
                  
                  let tierBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (currentTier === 'VIP') tierBadgeClass = 'bg-purple-100 text-purple-700 border-purple-200';
                  else if (currentTier === '다이아') tierBadgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
                  else if (currentTier === '골드') tierBadgeClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                  else if (currentTier === '실버') tierBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  else if (currentTier === '브론즈') tierBadgeClass = 'bg-orange-100 text-orange-700 border-orange-200';

                  return (
                    <div key={customer.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-900">{customer.name}</h3>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${tierBadgeClass}`}>
                            {currentTier}
                          </span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {store ? store.restaurantName : '가게 미지정'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">{customer.phone}</p>
                        <div className="flex gap-3 mt-2 text-xs font-medium text-slate-500">
                          <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> 총 방문 {customerVisits.length}회</span>
                          <span className="flex items-center"><Ticket className="w-3 h-3 mr-1" /> 보유 쿠폰 {availableCoupons.length}장</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">ID: {customer.id}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)}
                        className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors ml-4"
                        title="손님 삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">사용자 삭제</h3>
            <p className="text-slate-500 mb-6 text-sm">
              <strong className="text-red-600">{deletingUser.name}</strong> {deletingUser.role === 'owner' ? '사장님' : '고객님'}을(를) 정말 삭제하시겠습니까?<br/>
              관련된 모든 데이터가 삭제됩니다.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  deleteUser(deletingUser.id, deletingUser.role);
                  import('../store').then(({ showToast }) => showToast('삭제되었습니다.', 'info')).catch(console.error);
                  setDeletingUser(null);
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors shadow-sm"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
