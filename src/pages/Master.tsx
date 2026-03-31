import React, { useState, useMemo } from 'react';
import { useStore, getEffectiveTier, getTierColor } from '../store';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store, Users, Ticket, Calendar, Lock, KeyRound, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';

export default function Master() {
  const { users, visits, coupons, tierOverrides, masterPassword, setMasterPassword, deleteUser } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'owners' | 'customers'>('owners');
  const [searchTerm, setSearchTerm] = useState('');
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
      <div className="flex-1 bg-hanji-light dark:bg-hanji-dark flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-black/20 rounded-3xl shadow-sm border border-ink-light/10 dark:border-ink-dark/10 overflow-hidden p-8 text-center relative">
          <Link 
            to="/" 
            className="absolute top-4 left-4 p-2 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 rounded-full text-ink-light/60 dark:text-ink-dark/60 transition-colors z-10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="w-20 h-20 rounded-full bg-burgundy/10 dark:bg-burgundy/20 flex items-center justify-center mx-auto mb-4 mt-4">
            <Lock className="w-10 h-10 text-burgundy dark:text-burgundy-light" />
          </div>
          <h2 className="text-2xl font-serif font-bold mb-2 tracking-tight text-ink-light dark:text-ink-dark">마스터 인증</h2>
          <p className="text-ink-light/60 dark:text-ink-dark/60 mb-8 text-sm font-medium">관리자 페이지에 접근하려면<br/>비밀번호를 입력해주세요.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 rounded-xl px-5 py-4 text-center text-lg font-bold text-ink-light dark:text-ink-dark placeholder-ink-light/30 dark:placeholder-ink-dark/30 focus:outline-none focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-all"
              />
            </div>

            {error && (
              <p className="text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 py-2 rounded-xl border border-red-100 dark:border-red-900/30">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-burgundy hover:bg-burgundy/90 text-hanji-light font-bold py-4 rounded-xl transition-colors text-lg shadow-sm"
            >
              인증하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  const owners = useMemo(() => users.filter(u => u.role === 'owner'), [users]);
  const customersList = useMemo(() => users.filter(u => u.role === 'customer'), [users]);

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

  const filteredOwners = owners.filter(o => 
    (o.restaurantName || '').includes(searchTerm) || 
    (o.name || '').includes(searchTerm) || 
    (o.phone || '').includes(searchTerm) ||
    o.id.includes(searchTerm)
  );

  const filteredCustomersList = customersList.filter(c => 
    (c.name || '').includes(searchTerm) || 
    (c.phone || '').includes(searchTerm) ||
    c.id.includes(searchTerm)
  );

  return (
    <div className="flex-1 bg-hanji-light dark:bg-hanji-dark pb-20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md text-ink-light dark:text-ink-dark p-6 pt-8 border-b border-ink-light/10 dark:border-ink-dark/10 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center">
          <Link to="/" className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors mr-4">
            <ArrowLeft className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold tracking-tight">마스터 관리자</h1>
            <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm mt-1 font-medium">등록된 전체 사장님 현황</p>
          </div>
        </div>
        <button 
          onClick={() => setIsChangingPassword(!isChangingPassword)}
          className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors"
          title="비밀번호 변경"
        >
          <KeyRound className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
        </button>
      </div>

      <div className="p-6">
        {isChangingPassword && (
          <div className="bg-white dark:bg-black/20 rounded-3xl p-5 shadow-sm border border-burgundy/20 dark:border-burgundy-light/20 mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark mb-4 flex items-center">
              <KeyRound className="w-5 h-5 mr-2 text-burgundy dark:text-burgundy-light" />
              비밀번호 변경
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="w-full bg-white dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 rounded-xl px-4 py-3 text-ink-light dark:text-ink-dark placeholder:text-ink-light/30 dark:placeholder:text-ink-dark/30 focus:outline-none focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-all"
              />
              {error && (
                <p className="text-red-600 dark:text-red-400 text-sm font-bold">{error}</p>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setError('');
                    setNewPassword('');
                  }}
                  className="flex-1 bg-ink-light/5 dark:bg-ink-dark/10 hover:bg-ink-light/10 dark:hover:bg-ink-dark/20 text-ink-light/80 dark:text-ink-dark/80 font-bold py-3 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-burgundy hover:bg-burgundy/90 text-hanji-light font-bold py-3 rounded-xl transition-colors shadow-sm"
                >
                  변경하기
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-black/20 rounded-3xl p-5 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
            <div className="flex items-center text-ink-light/60 dark:text-ink-dark/60 mb-2">
              <Store className="w-5 h-5 mr-2 text-burgundy dark:text-burgundy-light" />
              <span className="font-bold text-sm">총 가맹점</span>
            </div>
            <p className="text-3xl font-bold text-ink-light dark:text-ink-dark">{owners.length}<span className="text-lg font-medium text-ink-light/50 dark:text-ink-dark/50 ml-1">곳</span></p>
          </div>
          <div className="bg-white dark:bg-black/20 rounded-3xl p-5 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
            <div className="flex items-center text-ink-light/60 dark:text-ink-dark/60 mb-2">
              <Users className="w-5 h-5 mr-2 text-burgundy dark:text-burgundy-light" />
              <span className="font-bold text-sm">총 손님</span>
            </div>
            <p className="text-3xl font-bold text-ink-light dark:text-ink-dark">{customersList.length}<span className="text-lg font-medium text-ink-light/50 dark:text-ink-dark/50 ml-1">명</span></p>
          </div>
        </div>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => { setActiveTab('owners'); setSearchTerm(''); }}
            className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'owners' ? 'bg-ink-light dark:bg-ink-dark text-hanji-light dark:text-hanji-dark shadow-sm' : 'bg-white dark:bg-black/20 text-ink-light/60 dark:text-ink-dark/60 hover:text-ink-light/80 dark:hover:text-ink-dark/80 border border-ink-light/10 dark:border-ink-dark/10'}`}
          >
            가맹점 관리
          </button>
          <button
            onClick={() => { setActiveTab('customers'); setSearchTerm(''); }}
            className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'customers' ? 'bg-ink-light dark:bg-ink-dark text-hanji-light dark:text-hanji-dark shadow-sm' : 'bg-white dark:bg-black/20 text-ink-light/60 dark:text-ink-dark/60 hover:text-ink-light/80 dark:hover:text-ink-dark/80 border border-ink-light/10 dark:border-ink-dark/10'}`}
          >
            전체 손님 관리
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ink-light/40 dark:text-ink-dark/40 w-5 h-5" />
          <input 
            type="text" 
            placeholder={activeTab === 'owners' ? "가맹점명, 사장님 이름, 연락처 검색" : "손님 이름, 연락처 검색"}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-black/20 text-ink-light dark:text-ink-dark placeholder-ink-light/40 dark:placeholder-ink-dark/40 rounded-2xl py-3 pl-12 pr-4 border border-ink-light/10 dark:border-ink-dark/10 focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-all shadow-sm"
          />
        </div>

        {activeTab === 'owners' ? (
          <>
            <h2 className="text-lg font-serif font-bold text-ink-light dark:text-ink-dark mb-4">가맹점 목록</h2>
            
            {filteredOwners.length === 0 ? (
              <div className="bg-white dark:bg-black/20 rounded-3xl p-8 text-center shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
                <p className="text-ink-light/60 dark:text-ink-dark/60 font-medium">검색 결과나 등록된 사장님이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOwners.map(owner => {
                  const stats = getOwnerStats(owner.id);
                  const isExpanded = expandedOwner === owner.id;
                  const ownerCustomers = users.filter(u => u.role === 'customer' && u.storeId === owner.id);

                  return (
                    <div key={owner.id} className="bg-white dark:bg-black/20 rounded-3xl p-5 shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
                      <div className="flex justify-between items-start mb-4 border-b border-ink-light/10 dark:border-ink-dark/10 pb-4">
                        <div>
                          <h3 className="text-xl font-bold text-ink-light dark:text-ink-dark">{owner.restaurantName || '이름 없는 가게'}</h3>
                          <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm mt-1 font-medium">{owner.name} 사장님 • {owner.phone}</p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className="bg-ink-light/5 dark:bg-ink-dark/10 text-ink-light/70 dark:text-ink-dark/70 text-xs font-bold px-3 py-1 rounded-full">
                            ID: {owner.id}
                          </span>
                          <button 
                            onClick={() => handleDeleteUser(owner.id, 'owner', owner.name)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 transition-colors"
                            title="사장님 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-ink-light/5 dark:bg-ink-dark/10 rounded-2xl p-3 text-center border border-ink-light/5 dark:border-ink-dark/5">
                          <Users className="w-4 h-4 mx-auto mb-1 text-ink-light/40 dark:text-ink-dark/40" />
                          <p className="text-xs text-ink-light/60 dark:text-ink-dark/60 mb-1 font-medium">등록 고객</p>
                          <p className="font-bold text-ink-light dark:text-ink-dark">{stats.uniqueCustomers}명</p>
                        </div>
                        <div className="bg-ink-light/5 dark:bg-ink-dark/10 rounded-2xl p-3 text-center border border-ink-light/5 dark:border-ink-dark/5">
                          <Calendar className="w-4 h-4 mx-auto mb-1 text-ink-light/40 dark:text-ink-dark/40" />
                          <p className="text-xs text-ink-light/60 dark:text-ink-dark/60 mb-1 font-medium">누적 방문</p>
                          <p className="font-bold text-ink-light dark:text-ink-dark">{stats.totalVisits}회</p>
                        </div>
                        <div className="bg-ink-light/5 dark:bg-ink-dark/10 rounded-2xl p-3 text-center border border-ink-light/5 dark:border-ink-dark/5">
                          <Ticket className="w-4 h-4 mx-auto mb-1 text-ink-light/40 dark:text-ink-dark/40" />
                          <p className="text-xs text-ink-light/60 dark:text-ink-dark/60 mb-1 font-medium">쿠폰 사용</p>
                          <p className="font-bold text-ink-light dark:text-ink-dark">{stats.usedCoupons}/{stats.totalCoupons}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setExpandedOwner(isExpanded ? null : owner.id)}
                        className="w-full py-2.5 flex items-center justify-center text-sm font-bold text-ink-light/70 dark:text-ink-dark/70 hover:text-ink-light dark:hover:text-ink-dark transition-colors bg-ink-light/5 dark:bg-ink-dark/10 rounded-xl hover:bg-ink-light/10 dark:hover:bg-ink-dark/20"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-4 h-4 mr-1" /> 고객 목록 닫기</>
                        ) : (
                          <><ChevronDown className="w-4 h-4 mr-1" /> 고객 목록 보기</>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-2 border-t border-ink-light/10 dark:border-ink-dark/10 pt-4">
                          {ownerCustomers.length === 0 ? (
                            <p className="text-center text-sm text-ink-light/40 dark:text-ink-dark/40 py-2 font-medium">등록된 고객이 없습니다.</p>
                          ) : (
                            ownerCustomers.map(customer => (
                              <div key={customer.id} className="flex justify-between items-center bg-white dark:bg-black/20 p-3 rounded-xl border border-ink-light/10 dark:border-ink-dark/10 shadow-sm">
                                <div>
                                  <p className="font-bold text-ink-light dark:text-ink-dark text-sm">{customer.name}</p>
                                  <p className="text-xs text-ink-light/60 dark:text-ink-dark/60 font-medium">{customer.phone}</p>
                                </div>
                                <button 
                                  onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)}
                                  className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 p-2 transition-colors"
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
            <h2 className="text-lg font-serif font-bold text-ink-light dark:text-ink-dark mb-4">전체 손님 목록</h2>
            {filteredCustomersList.length === 0 ? (
              <div className="bg-white dark:bg-black/20 rounded-3xl p-8 text-center shadow-sm border border-ink-light/10 dark:border-ink-dark/10">
                <p className="text-ink-light/60 dark:text-ink-dark/60 font-medium">검색 결과나 등록된 손님이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomersList.map(customer => {
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
                  
                  let tierBadgeClass = 'bg-ink-light/5 dark:bg-ink-dark/10 text-ink-light/70 dark:text-ink-dark/70 border-ink-light/10 dark:border-ink-dark/10';
                  if (currentTier === 'VIP') tierBadgeClass = 'bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-burgundy-light border-burgundy/20 dark:border-burgundy-light/20';
                  else if (currentTier === '다이아') tierBadgeClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50';
                  else if (currentTier === '골드') tierBadgeClass = 'bg-mustard/10 dark:bg-mustard/20 text-mustard-dark dark:text-mustard border-mustard/20 dark:border-mustard/30';
                  else if (currentTier === '실버') tierBadgeClass = 'bg-ink-light/5 dark:bg-ink-dark/10 text-ink-light/70 dark:text-ink-dark/70 border-ink-light/10 dark:border-ink-dark/10';
                  else if (currentTier === '브론즈') tierBadgeClass = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50';

                  return (
                    <div key={customer.id} className="bg-white dark:bg-black/20 rounded-2xl p-4 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-ink-light dark:text-ink-dark">{customer.name}</h3>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${tierBadgeClass}`}>
                            {currentTier}
                          </span>
                          <span className="text-xs font-bold text-burgundy dark:text-burgundy-light bg-burgundy/5 dark:bg-burgundy/10 px-2 py-0.5 rounded-md border border-burgundy/10 dark:border-burgundy/20">
                            {store ? store.restaurantName : '가게 미지정'}
                          </span>
                        </div>
                        <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 font-medium">{customer.phone}</p>
                        <div className="flex gap-3 mt-2 text-xs font-bold text-ink-light/50 dark:text-ink-dark/50">
                          <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> 총 방문 {customerVisits.length}회</span>
                          <span className="flex items-center"><Ticket className="w-3 h-3 mr-1" /> 보유 쿠폰 {availableCoupons.length}장</span>
                        </div>
                        <p className="text-xs text-ink-light/40 dark:text-ink-dark/40 mt-1 font-medium">ID: {customer.id}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)}
                        className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors ml-4"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-ink-dark rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl border border-ink-light/10 dark:border-ink-dark/10">
            <h3 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark mb-2">사용자 삭제</h3>
            <p className="text-ink-light/60 dark:text-ink-dark/60 mb-6 text-sm font-medium">
              <strong className="text-red-600 dark:text-red-400">{deletingUser.name}</strong> {deletingUser.role === 'owner' ? '사장님' : '고객님'}을(를) 정말 삭제하시겠습니까?<br/>
              관련된 모든 데이터가 삭제됩니다.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-3 bg-ink-light/5 dark:bg-ink-dark/10 text-ink-light/70 dark:text-ink-dark/70 rounded-xl font-bold hover:bg-ink-light/10 dark:hover:bg-ink-dark/20 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  deleteUser(deletingUser.id, deletingUser.role);
                  import('../store').then(({ showToast }) => showToast('삭제되었습니다.', 'info')).catch(console.error);
                  setDeletingUser(null);
                }}
                className="flex-1 py-3 bg-red-500 dark:bg-red-600 text-white rounded-xl font-bold hover:bg-red-600 dark:hover:bg-red-700 transition-colors shadow-sm"
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
