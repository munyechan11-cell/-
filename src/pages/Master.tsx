import React, { useState } from 'react';
import { useStore } from '../store';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store, Users, Ticket, Calendar, Lock, KeyRound, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export default function Master() {
  const { users, visits, coupons, masterPassword, setMasterPassword, deleteUser } = useStore();
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
    import('../store').then(({ showToast }) => showToast('비밀번호가 성공적으로 변경되었습니다.', 'success'));
  };

  const handleDeleteUser = (userId: string, role: 'owner' | 'customer', name: string) => {
    setDeletingUser({ id: userId, role, name });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-transparent flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_4px_20px_rgba(78,52,46,0.08)] border border-[#E7E0D7] overflow-hidden p-8 text-center relative">
          <Link 
            to="/" 
            className="absolute top-4 left-4 p-2 bg-transparent hover:bg-[#EFEBE9] rounded-full text-[#5D4037] transition-colors z-10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="w-20 h-20 rounded-full bg-[#FFF3E0] flex items-center justify-center mx-auto mb-4 mt-4 shadow-sm border border-[#FFE0B2]">
            <Lock className="w-10 h-10 text-[#D84315]" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight text-[#2D1B15]">마스터 인증</h2>
          <p className="text-[#795548] mb-8 font-medium">관리자 페이지에 접근하려면<br/>비밀번호를 입력해주세요.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full bg-[#F5F2EB] border-2 border-[#E7E0D7] rounded-2xl px-5 py-4 text-center text-lg font-bold text-[#2D1B15] placeholder:text-[#A1887F] focus:outline-none focus:border-[#D84315] focus:bg-white transition-all"
              />
            </div>

            {error && (
              <p className="text-[#D84315] text-sm font-bold bg-[#FFF3E0] py-2 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-[#D84315] hover:bg-[#BF360C] text-white font-bold py-4 rounded-2xl transition-colors text-lg shadow-sm"
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
    <div className="min-h-full bg-transparent pb-20">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 border-b border-[#E7E0D7] flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors mr-4">
            <ArrowLeft className="w-5 h-5 text-[#D84315]" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">마스터 관리자</h1>
            <p className="text-[#795548] text-sm mt-1 font-medium">등록된 전체 사장님 현황</p>
          </div>
        </div>
        <button 
          onClick={() => setIsChangingPassword(!isChangingPassword)}
          className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors"
          title="비밀번호 변경"
        >
          <KeyRound className="w-5 h-5 text-[#4E342E]" />
        </button>
      </div>

      <div className="p-6">
        {isChangingPassword && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#D84315] mb-8 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-[#2D1B15] mb-4 flex items-center">
              <KeyRound className="w-5 h-5 mr-2 text-[#D84315]" />
              비밀번호 변경
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="w-full bg-[#F5F2EB] border-2 border-[#E7E0D7] rounded-xl px-4 py-3 text-[#2D1B15] placeholder:text-[#A1887F] focus:outline-none focus:border-[#D84315] focus:bg-white transition-all"
              />
              {error && (
                <p className="text-[#D84315] text-sm font-bold">{error}</p>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setError('');
                    setNewPassword('');
                  }}
                  className="flex-1 bg-[#EFEBE9] hover:bg-stone-300 text-[#2D1B15] font-bold py-3 rounded-xl transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#D84315] hover:bg-[#BF360C] text-white font-bold py-3 rounded-xl transition-colors"
                >
                  변경하기
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#E7E0D7]">
            <div className="flex items-center text-[#795548] mb-2">
              <Store className="w-5 h-5 mr-2 text-[#D84315]" />
              <span className="font-bold">총 가맹점</span>
            </div>
            <p className="text-3xl font-black text-[#2D1B15]">{owners.length}<span className="text-lg font-medium text-[#795548] ml-1">곳</span></p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#E7E0D7]">
            <div className="flex items-center text-[#795548] mb-2">
              <Users className="w-5 h-5 mr-2 text-[#D84315]" />
              <span className="font-bold">총 손님</span>
            </div>
            <p className="text-3xl font-black text-[#2D1B15]">{users.filter(u => u.role === 'customer').length}<span className="text-lg font-medium text-[#795548] ml-1">명</span></p>
          </div>
        </div>

        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('owners')}
            className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'owners' ? 'bg-[#2D1B15] text-white' : 'bg-white/80 text-[#795548] border border-[#E7E0D7]'}`}
          >
            가맹점 관리
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 py-3 rounded-2xl font-bold transition-colors ${activeTab === 'customers' ? 'bg-[#2D1B15] text-white' : 'bg-white/80 text-[#795548] border border-[#E7E0D7]'}`}
          >
            전체 손님 관리
          </button>
        </div>

        {activeTab === 'owners' ? (
          <>
            <h2 className="text-lg font-bold text-[#2D1B15] mb-4">가맹점 목록</h2>
            
            {owners.length === 0 ? (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 text-center shadow-sm border border-[#E7E0D7]">
                <p className="text-[#795548]">아직 등록된 사장님이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {owners.map(owner => {
                  const stats = getOwnerStats(owner.id);
                  const isExpanded = expandedOwner === owner.id;
                  const ownerCustomers = users.filter(u => u.role === 'customer' && u.storeId === owner.id);

                  return (
                    <div key={owner.id} className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#E7E0D7]">
                      <div className="flex justify-between items-start mb-4 border-b border-[#E7E0D7]/50 pb-4">
                        <div>
                          <h3 className="text-xl font-bold text-[#2D1B15]">{owner.restaurantName || '이름 없는 가게'}</h3>
                          <p className="text-[#795548] text-sm mt-1">{owner.name} 사장님 • {owner.phone}</p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className="bg-[#FFF3E0] text-[#D84315] text-xs font-bold px-3 py-1 rounded-full">
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
                        <div className="bg-[#F5F2EB]/50 rounded-2xl p-3 text-center">
                          <Users className="w-4 h-4 mx-auto mb-1 text-[#795548]" />
                          <p className="text-xs text-[#795548] mb-1">등록 고객</p>
                          <p className="font-bold text-[#2D1B15]">{stats.uniqueCustomers}명</p>
                        </div>
                        <div className="bg-[#F5F2EB]/50 rounded-2xl p-3 text-center">
                          <Calendar className="w-4 h-4 mx-auto mb-1 text-[#795548]" />
                          <p className="text-xs text-[#795548] mb-1">누적 방문</p>
                          <p className="font-bold text-[#2D1B15]">{stats.totalVisits}회</p>
                        </div>
                        <div className="bg-[#F5F2EB]/50 rounded-2xl p-3 text-center">
                          <Ticket className="w-4 h-4 mx-auto mb-1 text-[#795548]" />
                          <p className="text-xs text-[#795548] mb-1">쿠폰 사용</p>
                          <p className="font-bold text-[#2D1B15]">{stats.usedCoupons}/{stats.totalCoupons}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => setExpandedOwner(isExpanded ? null : owner.id)}
                        className="w-full py-2 flex items-center justify-center text-sm font-bold text-[#795548] hover:text-[#4E342E] transition-colors bg-[#F5F2EB]/50 rounded-xl"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-4 h-4 mr-1" /> 고객 목록 닫기</>
                        ) : (
                          <><ChevronDown className="w-4 h-4 mr-1" /> 고객 목록 보기</>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-2 border-t border-[#E7E0D7]/50 pt-4">
                          {ownerCustomers.length === 0 ? (
                            <p className="text-center text-sm text-[#A1887F] py-2">등록된 고객이 없습니다.</p>
                          ) : (
                            ownerCustomers.map(customer => (
                              <div key={customer.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-[#E7E0D7]">
                                <div>
                                  <p className="font-bold text-[#2D1B15] text-sm">{customer.name}</p>
                                  <p className="text-xs text-[#795548]">{customer.phone}</p>
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
            <h2 className="text-lg font-bold text-[#2D1B15] mb-4">전체 손님 목록</h2>
            {users.filter(u => u.role === 'customer').length === 0 ? (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 text-center shadow-sm border border-[#E7E0D7]">
                <p className="text-[#795548]">아직 등록된 손님이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.filter(u => u.role === 'customer').map(customer => {
                  const store = owners.find(o => o.id === customer.storeId);
                  return (
                    <div key={customer.id} className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-[#E7E0D7] flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[#2D1B15]">{customer.name}</h3>
                          <span className="text-xs font-bold text-[#D84315] bg-[#FFF3E0] px-2 py-0.5 rounded-md">
                            {store ? store.restaurantName : '가게 미지정'}
                          </span>
                        </div>
                        <p className="text-sm text-[#795548]">{customer.phone}</p>
                        <p className="text-xs text-[#A1887F] mt-1">ID: {customer.id}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)}
                        className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 max-w-sm w-full text-center relative">
            <h3 className="text-xl font-bold text-[#2D1B15] mb-2">사용자 삭제</h3>
            <p className="text-[#795548] mb-6">
              <strong className="text-[#D84315]">{deletingUser.name}</strong> {deletingUser.role === 'owner' ? '사장님' : '고객님'}을(를) 정말 삭제하시겠습니까?<br/>
              관련된 모든 데이터가 삭제됩니다.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-3 bg-[#EFEBE9] text-[#5D4037] rounded-xl font-bold hover:bg-[#E7E0D7] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  deleteUser(deletingUser.id, deletingUser.role);
                  import('../store').then(({ showToast }) => showToast('삭제되었습니다.', 'info'));
                  setDeletingUser(null);
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shadow-sm"
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
