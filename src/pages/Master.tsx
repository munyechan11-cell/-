import React, { useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, showToast } from '../store';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Store, Users, Ticket, Trash2, 
  ChevronRight, Search, LogOut, ShieldCheck, X,
  LayoutDashboard
} from 'lucide-react';

export default function Master() {
  const { users, visits, coupons, tables, tierOverrides, masterPassword, setMasterPassword, deleteUser } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'owners' | 'customers'>('owners');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUser, setDeletingUser] = useState<{ id: string; role: 'owner' | 'customer'; name: string } | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

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
    showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
  };

  const handleDeleteUser = (userId: string, role: 'owner' | 'customer', name: string) => {
    setDeletingUser({ id: userId, role, name });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fdfaf7] flex items-center justify-center p-6 selection:bg-primary/20">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-3xl border border-[#e5dcd3] p-12 text-center relative animate-in fade-in zoom-in-95 duration-700">
          <Link to="/" className="absolute top-8 left-8 p-3 hover:bg-surface-container rounded-full text-on-surface-variant/40"><ArrowLeft className="w-6 h-6" /></Link>
          <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center mx-auto mb-10 shadow-2xl rotate-3"><ShieldCheck className="w-12 h-12 text-white" /></div>
          <h2 className="text-3xl font-serif font-black text-primary italic mb-2">결 총괄 거버넌스</h2>
          <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-10">중앙 관리자 전용 접속</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="마스터 암호 입력"
              className="w-full bg-surface-container border-none rounded-2xl px-6 py-4 text-center text-xl font-black text-primary focus:ring-1 focus:ring-primary shadow-inner"
              autoFocus
            />
            {error && <p className="text-[10px] font-bold text-burgundy">{error}</p>}
            <button type="submit" className="w-full py-5 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:bg-accent-burgundy transition-all">접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  const owners = users.filter(u => u.role === 'owner');
  const customersList = users.filter(u => u.role === 'customer');
  const filteredOwners = owners.filter(o => (o.restaurantName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCustomersList = customersList.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone || '').includes(searchTerm));

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20">
      
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 border-r-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl tracking-tighter block">결 (Master)</Link>
          <div className="mt-8 flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20"><ShieldCheck className="text-white w-6 h-6" /></div>
             <div>
                <p className="text-[#fcfcfc] font-serif italic text-sm">총괄 시스템</p>
                <p className="text-[#fcfcfc]/50 font-sans uppercase tracking-widest text-[9px]">중앙 거버넌스</p>
             </div>
          </div>
        </div>
        <nav className="flex-1 space-y-2">
          <button onClick={() => setActiveTab('owners')} className={`w-full flex items-center gap-4 px-8 py-3.5 transition-all ${activeTab === 'owners' ? 'bg-white/10 text-white border-l-4 border-white' : 'text-[#fcfcfc]/40 hover:text-white hover:bg-white/5'}`}>
            <LayoutDashboard className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-widest">가맹점 관리</span>
          </button>
          <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-4 px-8 py-3.5 transition-all ${activeTab === 'customers' ? 'bg-white/10 text-white border-l-4 border-white' : 'text-[#fcfcfc]/40 hover:text-white hover:bg-white/5'}`}>
            <Users className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-widest">전체 손님 관리</span>
          </button>
        </nav>
        <div className="px-8 mt-auto pt-6 border-t border-white/10">
          <button onClick={() => setIsAuthenticated(false)} className="text-[#fcfcfc]/40 hover:text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><LogOut className="w-4 h-4" /> 로그아웃</button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 border-b border-outline-variant/30">
          <span className="font-serif text-2xl font-bold text-primary">중앙 거버넌스</span>
          <div className="flex items-center gap-6">
            <div className="relative w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                className="w-full bg-surface-container border-none rounded-full pl-12 pr-4 py-2 text-sm font-body"
                placeholder="가맹점/손님 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={() => setIsChangingPassword(true)} className="p-2.5 bg-surface-container rounded-full text-on-surface-variant/40 hover:text-primary transition-all"><Settings className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="p-12 space-y-12 flex-1 overflow-y-auto no-scrollbar">
           <div className="flex justify-between items-end">
              <div>
                 <h2 className="text-5xl font-serif font-black text-primary italic tracking-tight">{activeTab === 'owners' ? '가맹점 네트워크' : '전체 손님 기록'}</h2>
                 <p className="text-on-surface-variant/60 text-[11px] font-bold uppercase tracking-widest mt-2">{activeTab === 'owners' ? '모든 결 파트너 매장의 현황입니다.' : '플랫폼 전체 손님의 통합 데이터베이스입니다.'}</p>
              </div>
              <div className="flex gap-4">
                 <div className="p-8 bg-white rounded-3xl border border-outline-variant/30 text-right shadow-sm">
                    <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase mb-1">{activeTab === 'owners' ? '등록 매장' : '총 손님'}</p>
                    <p className="text-4xl font-serif font-black text-primary">{activeTab === 'owners' ? owners.length : customersList.length}</p>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-outline-variant/30 overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container/50 border-b border-outline-variant/30">
                    <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{activeTab === 'owners' ? '매장 정보' : '손님 정보'}</th>
                    <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{activeTab === 'owners' ? '사장님' : '가입 매장'}</th>
                    <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">상태</th>
                    <th className="px-10 py-6 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                   {activeTab === 'owners' ? filteredOwners.flatMap(owner => [
                     <tr 
                        key={owner.id} 
                        onClick={() => setSelectedOwnerId(selectedOwnerId === owner.id ? null : owner.id)}
                        className={`hover:bg-surface-container transition-colors group cursor-pointer ${selectedOwnerId === owner.id ? 'bg-surface-container' : ''}`}
                     >
                        <td className="px-10 py-8">
                           <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${selectedOwnerId === owner.id ? 'bg-primary text-white' : 'bg-surface-container text-primary/30 group-hover:bg-primary group-hover:text-white'}`}><Store className="w-7 h-7" /></div>
                              <div>
                                 <p className="text-xl font-serif font-black text-primary italic">{owner.restaurantName || '매장'}</p>
                                 <p className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest mt-1">ID: {owner.id}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-8 text-sm font-bold text-primary">{owner.name} 사장님</td>
                        <td className="px-10 py-8"><span className="text-[10px] font-bold uppercase text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10">운영 중</span></td>
                        <td className="px-10 py-8 text-right flex justify-end gap-2">
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(owner.id, 'owner', owner.name); }} className="p-3 bg-burgundy/5 text-burgundy rounded-xl hover:bg-burgundy hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                           <ChevronRight className={`w-5 h-5 text-on-surface-variant/20 transition-transform ${selectedOwnerId === owner.id ? 'rotate-90' : ''}`} />
                        </td>
                     </tr>,
                     selectedOwnerId === owner.id && (
                        <tr key={`${owner.id}-customers`} className="bg-surface-bright/50">
                          <td colSpan={4} className="px-10 py-12 border-b border-outline-variant/30">
                            <div className="animate-in slide-in-from-top-4 duration-500 space-y-12">
                              {/* Live Store Status Summary */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 <div className="bg-white p-6 rounded-3xl border border-primary/10 shadow-sm flex items-center justify-between">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-primary opacity-40 mb-1">현재 이용 테이블</p>
                                       <p className="text-3xl font-serif font-black text-primary italic">{tables.filter(t => t.storeId === owner.id && t.currentCustomerId).length} / {tables.filter(t => t.storeId === owner.id).length || 12}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary"><Store className="w-6 h-6" /></div>
                                 </div>
                                 <div className="bg-white p-6 rounded-3xl border border-primary/10 shadow-sm flex items-center justify-between">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 opacity-40 mb-1">총 단골 수</p>
                                       <p className="text-3xl font-serif font-black text-emerald-600 italic">{users.filter(u => u.role === 'customer' && u.storeId === owner.id).length}명</p>
                                    </div>
                                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600"><Users className="w-6 h-6" /></div>
                                 </div>
                                 <div className="bg-white p-6 rounded-3xl border border-primary/10 shadow-sm flex items-center justify-between">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-burgundy opacity-40 mb-1">미사용 쿠폰</p>
                                       <p className="text-3xl font-serif font-black text-burgundy italic">{coupons.filter(c => c.storeId === owner.id && c.status === 'available').length}개</p>
                                    </div>
                                    <div className="w-12 h-12 bg-burgundy/5 rounded-2xl flex items-center justify-center text-burgundy"><Ticket className="w-6 h-6" /></div>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                                 {/* Left: Active Sessions */}
                                 <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                       <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                                       <h4 className="font-serif font-black text-primary text-xl italic">실시간 좌석 점유 현황</h4>
                                    </div>
                                    <div className="space-y-3">
                                       {tables.filter(t => t.storeId === owner.id && t.currentCustomerId).map(table => {
                                          const customer = users.find(u => u.id === table.currentCustomerId);
                                          const startTime = table.sessionStartTime ? new Date(table.sessionStartTime) : null;
                                          const elapsed = startTime ? Math.floor((new Date().getTime() - startTime.getTime()) / 60000) : 0;
                                          return (
                                             <div key={table.number} className="bg-white p-5 rounded-2xl border border-outline-variant/30 flex items-center justify-between group hover:border-primary/30 transition-all">
                                                <div className="flex items-center gap-6">
                                                   <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-serif font-black text-lg">{table.number}</div>
                                                   <div>
                                                      <div className="flex items-center gap-2">
                                                         <p className="text-sm font-serif font-black text-primary">{customer?.name || '미표기'}</p>
                                                         <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full uppercase tracking-widest">이용 중</span>
                                                      </div>
                                                      <p className="text-[10px] font-bold text-on-surface-variant/40 mt-1">{customer?.phone}</p>
                                                   </div>
                                                </div>
                                                <div className="text-right">
                                                   <p className="text-[10px] font-black text-primary uppercase tracking-widest">이용 시간</p>
                                                   <p className="text-sm font-black text-primary">{elapsed}분 경과</p>
                                                </div>
                                             </div>
                                          );
                                       })}
                                       {tables.filter(t => t.storeId === owner.id && t.currentCustomerId).length === 0 && (
                                          <div className="py-12 border-2 border-dashed border-outline-variant/20 rounded-3xl flex flex-col items-center justify-center gap-3">
                                             <Store className="w-8 h-8 text-on-surface-variant/20" />
                                             <p className="text-xs font-serif italic text-on-surface-variant/40">현재 매장에 손님이 없습니다.</p>
                                          </div>
                                       )}
                                    </div>
                                 </div>

                                 {/* Right: Customer Directory (Recent) */}
                                 <div className="space-y-6">
                                    <h4 className="font-serif font-black text-primary/40 text-xl italic">전체 매장 단골 기록</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-4">
                                       {users.filter(u => u.role === 'customer' && u.storeId === owner.id).map(customer => (
                                          <div key={customer.id} className="bg-white p-4 rounded-2xl border border-outline-variant/20 flex items-center gap-4 hover:shadow-md transition-all group">
                                             <div className="w-10 h-10 bg-surface-container group-hover:bg-primary/5 rounded-xl flex items-center justify-center text-primary/30 group-hover:text-primary font-serif font-bold transition-all">{customer.name.charAt(0)}</div>
                                             <div>
                                                <p className="text-sm font-serif font-black text-primary">{customer.name}</p>
                                                <p className="text-[9px] font-bold text-on-surface-variant/40">{customer.phone}</p>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                   ]) : filteredCustomersList.map(customer => (
                     <tr key={customer.id} className="hover:bg-surface-container transition-colors group">
                        <td className="px-10 py-8">
                           <div className="flex items-center gap-6">
                              <div className="w-14 h-14 bg-surface-container rounded-2xl flex items-center justify-center text-primary/30"><Users className="w-7 h-7" /></div>
                              <div>
                                 <p className="text-xl font-serif font-black text-primary">{customer.name}</p>
                                 <p className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest mt-1">{customer.phone}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-8 text-sm font-bold text-primary">
                           {owners.find(o => o.id === customer.storeId)?.restaurantName || '무소속'}
                        </td>
                        <td className="px-10 py-8"><span className="text-[10px] font-bold uppercase text-primary/40 bg-surface-container px-3 py-1 rounded-full border border-outline-variant/30">활동 중</span></td>
                        <td className="px-10 py-8 text-right flex justify-end gap-2">
                           <button onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)} className="p-3 bg-burgundy/5 text-burgundy rounded-xl hover:bg-burgundy hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                        </td>
                     </tr>
                   ))}
                </tbody>
              </table>
           </div>
        </div>
      </main>

      {/* Modals */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-6">
           <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-3xl border border-outline-variant/30 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-2xl font-serif font-black text-primary italic">보안 설정</h3>
                 <button onClick={() => setIsChangingPassword(false)} className="p-2 bg-surface-container rounded-full"><X className="w-5 h-5 text-on-surface-variant/40" /></button>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-6">
                 <input 
                   type="password" 
                   className="w-full bg-surface-container border-none rounded-2xl px-6 py-4 text-center font-black text-primary focus:ring-1 focus:ring-primary shadow-inner"
                   placeholder="새로운 마스터 암호"
                   value={newPassword}
                   onChange={e => setNewPassword(e.target.value)}
                 />
                 <button type="submit" className="w-full py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg">암호 변경 승인</button>
              </form>
           </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-burgundy/10 backdrop-blur-md z-[100] flex items-center justify-center p-6">
           <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-3xl border border-burgundy/30 text-center">
              <div className="w-20 h-20 bg-burgundy/5 rounded-3xl mx-auto flex items-center justify-center text-burgundy mb-8"><Trash2 className="w-10 h-10" /></div>
              <h3 className="text-2xl font-serif font-black text-primary italic mb-4">영구 제명 확인</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-10">
                 <span className="font-bold text-burgundy">[{deletingUser.name}]</span>님의 계정과 모든 데이터를 결 플랫폼에서 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-4">
                 <button onClick={() => setDeletingUser(null)} className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">취소</button>
                 <button 
                   onClick={() => {
                     deleteUser(deletingUser.id, deletingUser.role);
                     setDeletingUser(null);
                     showToast('영구 제명되었습니다.', 'info');
                   }}
                   className="flex-[2] py-4 bg-burgundy text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-burgundy/20"
                 >제명 실행</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
