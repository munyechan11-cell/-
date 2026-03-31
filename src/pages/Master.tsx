import React, { useState, useMemo } from 'react';
import { useStore, getEffectiveTier, getTierColor, showToast } from '../store';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Store, Users, Ticket, Calendar, Lock, KeyRound, Trash2, 
  ChevronRight, Search, Bell, Settings, HelpCircle, LogOut, CheckCircle2,
  LayoutDashboard, CreditCard, History, ShieldCheck, X
} from 'lucide-react';

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
    showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
  };

  const handleDeleteUser = (userId: string, role: 'owner' | 'customer', name: string) => {
    setDeletingUser({ id: userId, role, name });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface-bright flex items-center justify-center p-4 hanji-texture relative overflow-hidden font-sans">
        <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
        <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-primary/10 overflow-hidden p-10 text-center relative z-10 transition-all duration-700 animate-in fade-in zoom-in-95">
          <Link 
            to="/" 
            className="absolute top-6 left-6 p-2 hover:bg-primary/5 rounded-full text-primary/40 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-24 h-24 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6 rotate-3 transform-gpu transition-transform hover:rotate-0 border-2 border-primary/5">
            <ShieldCheck className="w-12 h-12 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-serif font-black mb-2 tracking-tighter text-primary italic">결 총괄 관리자</h2>
          <p className="text-primary/40 mb-10 text-[11px] font-black uppercase tracking-widest leading-relaxed">Palace Governance Oversight</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/20 group-focus-within:text-primary transition-colors">
                <KeyRound className="w-5 h-5" />
              </span>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full bg-primary/5 border border-primary/5 rounded-2xl pl-12 pr-5 py-4 text-center text-xl font-black text-primary placeholder-primary/20 focus:outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-burgundy text-[10px] font-black bg-burgundy/5 py-3 rounded-xl border border-burgundy/10 flex items-center justify-center animate-shake">
                <X className="w-3 h-3 mr-1" /> {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-container text-white font-black py-4 rounded-2xl transition-all text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95"
            >
              대시보드 입장 (Enter)
            </button>
          </form>
          
          <div className="mt-8 pt-8 border-t border-primary/5">
            <p className="text-[10px] font-black text-primary/20 uppercase tracking-[0.3em]">Refining heritage through digital precision</p>
          </div>
        </div>
      </div>
    );
  }

  const owners = useMemo(() => users.filter(u => u.role === 'owner'), [users]);
  const customersList = useMemo(() => users.filter(u => u.role === 'customer'), [users]);

  const getOwnerStats = (ownerId: string) => {
    const ownerVisits = visits.filter(v => v.storeId === ownerId);
    const ownerCoupons = coupons.filter(c => c.storeId === ownerId);
    return {
      totalVisits: ownerVisits.length,
      totalCoupons: ownerCoupons.length,
      uniqueCustomers: new Set(ownerVisits.map(v => v.customerId)).size,
      revenue: ownerVisits.length * 15000 // Mock revenue logic
    };
  };

  const filteredOwners = owners.filter(o => 
    (o.restaurantName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.phone || '').includes(searchTerm)
  );

  const filteredCustomersList = customersList.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone || '').includes(searchTerm)
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface hanji-texture relative">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
      
      {/* SideNavBar */}
      <aside className="h-screen w-64 border-r border-primary/5 bg-primary shadow-2xl flex flex-col py-8 z-50 transition-all duration-500">
        <div className="px-8 mb-12">
          <h1 className="text-surface-bright font-serif italic text-3xl tracking-tighter">결 (Gyeol)</h1>
          <div className="mt-8 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3">
              <ShieldCheck className="text-white w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-white font-serif italic text-sm">총괄 관리자</p>
              <p className="font-black uppercase tracking-widest text-[9px] text-white/40">Palace Oversight</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setActiveTab('owners')}
            className={`w-full flex items-center space-x-4 px-8 py-3.5 transition-all duration-300 group ${activeTab === 'owners' ? 'bg-primary-container text-white border-l-4 border-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-black uppercase tracking-widest text-[10px]">가맹점 거버넌스</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('customers')}
            className={`w-full flex items-center space-x-4 px-8 py-3.5 transition-all duration-300 group ${activeTab === 'customers' ? 'bg-primary-container text-white border-l-4 border-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-black uppercase tracking-widest text-[10px]">시민명부 관리</span>
          </button>
          
          <button className="w-full flex items-center space-x-4 px-8 py-3.5 text-white/40 cursor-not-allowed">
            <History className="w-5 h-5" />
            <span className="font-black uppercase tracking-widest text-[10px]">전통 기록소</span>
          </button>
        </nav>
        
        <div className="px-8 mt-auto pt-8 space-y-4 border-t border-white/5">
          <button className="w-full py-3.5 bg-surface-bright text-primary rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg hover:scale-102 transition-all">
            시스템 초기화
          </button>
          <div className="flex flex-col space-y-3">
            <button className="flex items-center space-x-4 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-bold">
              <HelpCircle className="w-4 h-4" />
              <span>기술 지원</span>
            </button>
            <button onClick={() => setIsAuthenticated(false)} className="flex items-center space-x-4 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-bold">
              <LogOut className="w-4 h-4" />
              <span>관리자 종료</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden overflow-y-auto bg-surface-bright/50 backdrop-blur-sm no-scrollbar">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-10 py-5 border-b border-primary/5">
          <div className="flex items-center space-x-12">
            <div className="font-serif text-2xl font-black text-primary tracking-tighter italic">결 메인 거버넌스</div>
            <nav className="hidden md:flex space-x-8">
              <a href="#" className="font-serif text-sm tracking-widest text-primary border-b-2 border-primary pb-1">CENTRAL</a>
              <a href="#" className="font-serif text-sm tracking-widest text-primary/40 hover:text-primary transition-colors">INSIGHTS</a>
            </nav>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-primary/20 group-focus-within:text-primary transition-colors">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="가맹점 또는 손님 검색..." 
                className="bg-primary/5 border-none rounded-2xl pl-10 pr-5 py-2.5 text-[10px] focus:ring-4 focus:ring-primary/5 w-64 transition-all font-black uppercase tracking-widest placeholder:text-primary/20"
              />
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-primary/40 hover:text-primary transition-colors relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-burgundy rounded-full border border-white"></span>
              </button>
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="text-primary/40 hover:text-primary transition-colors"
                title="보안 설정"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-primary/10"></div>
              <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-[10px] font-black font-sans ring-2 ring-primary/5 shadow-lg">M</div>
            </div>
          </div>
        </header>

        <div className="p-12 max-w-7xl w-full mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
          {/* Hero Section */}
          <section className="flex justify-between items-end">
            <div className="max-w-2xl space-y-4">
              <span className="font-black uppercase tracking-[0.4em] text-[10px] text-primary/40 block">Empire Management</span>
              <h2 className="font-serif text-6xl text-primary font-black leading-none tracking-tighter italic">
                {activeTab === 'owners' ? '가맹점 통제전도' : '전체 시민명부'}
              </h2>
              <p className="text-primary/60 text-lg leading-relaxed font-serif italic serif max-w-xl">
                {activeTab === 'owners' 
                  ? "가맹점 네트워크의 모든 정보를 한눈에 관리합니다. 각 공방의 운영 현황과 가치를 극대화하는 정밀한 거버넌스를 시작하세요." 
                  : "결의 모든 이용자 기록입니다. 개개인의 소중한 방문 데이터와 혜택 정보를 투명하게 확인하고 관리할 수 있습니다."}
              </p>
            </div>
            <div className="flex space-x-4">
              <div className="p-8 bg-white rounded-[2.5rem] shadow-sm border border-primary/5 text-right space-y-1 min-w-[180px] hover:shadow-xl transition-all">
                <p className="font-black uppercase tracking-widest text-[9px] text-primary/30">활성 시민 수</p>
                <p className="font-serif text-4xl text-primary font-black">
                  {activeTab === 'owners' ? owners.length : customersList.length}
                </p>
              </div>
              <div className="p-8 bg-white rounded-[2.5rem] shadow-sm border border-primary/5 text-right space-y-1 min-w-[180px] hover:shadow-xl transition-all">
                <p className="font-black uppercase tracking-widest text-[9px] text-primary/30">총 유동 자산</p>
                <p className="font-serif text-4xl text-primary font-black italic">₩3.2B</p>
              </div>
            </div>
          </section>

          {/* Filters & Navigation */}
          <section className="flex flex-wrap items-center gap-4 bg-primary/10 p-4 rounded-3xl border border-primary/5">
            <div className="flex items-center space-x-3 px-5 py-2.5 bg-white rounded-2xl border border-primary/5 shadow-sm">
              <span className="font-black text-[9px] text-primary/40 uppercase tracking-widest">거버넌스 지수</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Normal</span>
            </div>
            <div className="flex items-center space-x-3 px-5 py-2.5 bg-white rounded-2xl border border-primary/5 shadow-sm">
              <span className="font-black text-[9px] text-primary/40 uppercase tracking-widest">데이터 정밀도</span>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">High Fidelity</span>
            </div>
            
            <div className="ml-auto flex items-center space-x-2">
              <button className="p-2.5 text-primary/40 hover:text-primary transition-colors bg-white rounded-xl shadow-sm border border-primary/5">
                <History className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Data Table Area */}
          <div className="bg-white rounded-[3rem] shadow-xl shadow-primary/5 overflow-hidden border border-primary/5">
            {activeTab === 'owners' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary/5">
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40">장인(가맹점) 정보</th>
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40">관리자(사장님)</th>
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40">운영 상태</th>
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40 text-right">성과 지표</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filteredOwners.map((owner) => {
                    const stats = getOwnerStats(owner.id);
                    return (
                      <tr key={owner.id} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="px-10 py-8">
                          <div className="flex items-center space-x-6">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-primary/5 flex-shrink-0 flex items-center justify-center text-primary/20 group-hover:bg-primary group-hover:text-white transition-all duration-500 border border-primary/5">
                              <Store className="w-7 h-7" strokeWidth={1} />
                            </div>
                            <div>
                              <p className="font-serif text-xl text-primary font-black tracking-tight italic">{owner.restaurantName || '이름 없는 공방'}</p>
                              <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mt-1">ID: {owner.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-sm">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                            <span className="font-black text-primary text-[11px] uppercase tracking-widest">{owner.name} 장인</span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-emerald-100">Operational</span>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <p className="font-serif text-xl text-primary font-black tracking-tight">₩{(stats.revenue/10000).toFixed(1)}M</p>
                          <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1 italic">Upward Flow</p>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleDeleteUser(owner.id, 'owner', owner.name)}
                              className="p-2.5 text-burgundy hover:text-white hover:bg-burgundy rounded-xl transition-all border border-burgundy/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-primary/5">
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40">시민 기록 (Citizen)</th>
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40">상태</th>
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40">소속 공방</th>
                    <th className="px-10 py-6 font-black uppercase tracking-[0.2em] text-[10px] text-primary/40 text-right">참여도</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filteredCustomersList.map((customer) => {
                    const store = owners.find(o => o.id === customer.storeId);
                    const customerVisits = visits.filter(v => v.customerId === customer.id);
                    return (
                      <tr key={customer.id} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="px-10 py-8">
                          <div className="flex items-center space-x-6">
                            <div className="w-14 h-14 rounded-3xl overflow-hidden bg-primary/5 flex-shrink-0 flex items-center justify-center text-primary/20 group-hover:bg-primary group-hover:text-white transition-all duration-500 border border-primary/5">
                              <Users className="w-7 h-7" strokeWidth={1} />
                            </div>
                            <div>
                              <p className="font-serif text-xl text-primary font-black tracking-tight">{customer.name}</p>
                              <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mt-1">{customer.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <span className="px-4 py-1.5 bg-primary/5 text-primary/60 text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/10">Active</span>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center space-x-3">
                             <div className="w-6 h-6 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/5">
                                <Store className="w-3 h-3 text-primary/40" />
                             </div>
                             <span className="text-[11px] font-black text-primary uppercase tracking-widest">{store?.restaurantName || '방랑 시민'}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <p className="font-serif text-xl text-primary font-black tracking-tight">{customerVisits.length}회 방문</p>
                          <p className="text-[9px] text-primary/30 font-black uppercase tracking-widest mt-1">Loyalty Tier</p>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleDeleteUser(customer.id, 'customer', customer.name)}
                              className="p-2.5 text-burgundy hover:text-white hover:bg-burgundy rounded-xl transition-all border border-burgundy/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            
            <div className="px-10 py-8 bg-primary/5 flex items-center justify-between border-t border-primary/5">
              <p className="text-[9px] text-primary/30 font-black uppercase tracking-[0.3em] font-sans">Verification Check: Passed</p>
              <div className="flex space-x-2">
                <button className="w-10 h-10 flex items-center justify-center rounded-xl border border-primary/10 text-primary/20 hover:bg-white hover:text-primary transition-all">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white text-[10px] font-black ring-4 ring-primary/10 transition-all">1</button>
                <button className="w-10 h-10 flex items-center justify-center rounded-xl border border-primary/10 text-primary/20 hover:bg-white hover:text-primary transition-all">
                   <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <footer className="pt-20 pb-10 text-center flex flex-col items-center space-y-4 opacity-30">
             <div className="w-12 h-px bg-primary"></div>
             <p className="font-serif italic text-sm text-primary italic">Refining heritage through digital precision.</p>
          </footer>
        </div>
      </main>

      {/* Security Settings Modal */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-3xl border border-primary/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-serif font-black text-primary tracking-tighter italic">관리자 보안 설정</h3>
                <button 
                  onClick={() => { setIsChangingPassword(false); setNewPassword(''); setError(''); }}
                  className="p-3 hover:bg-primary/5 rounded-2xl text-primary/20 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] ml-1">새로운 마스터 키 (New Password)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="최소 3자리 이상 입력"
                    className="w-full bg-primary/5 border border-primary/5 rounded-2xl px-6 py-4 text-primary font-black placeholder:text-primary/10 focus:outline-none focus:bg-white focus:border-primary/20 transition-all text-center text-lg"
                  />
                </div>
                
                {error && (
                   <p className="text-burgundy text-[10px] font-black bg-burgundy/5 py-2 rounded-lg text-center border border-burgundy/10">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-primary text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-[11px]"
                >
                  변경 승인 (Authorize)
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Protocol Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-burgundy/20 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-3xl border border-burgundy/10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-burgundy/5 rounded-full -mr-12 -mt-12"></div>
            <div className="w-20 h-20 bg-burgundy/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-burgundy/5">
              <Trash2 className="w-10 h-10 text-burgundy" strokeWidth={1} />
            </div>
            <h3 className="text-2xl font-serif font-black text-primary tracking-tighter mb-2 italic">영구 제명 고지</h3>
            <p className="text-primary/60 text-[11px] leading-relaxed mb-10 font-bold uppercase tracking-wide">
               <span className="text-burgundy font-black">{deletingUser.name}</span> 사장님을 시스템에서 영구히 제명하시겠습니까? 관련한 모든 방문 기록과 데이터가 완전히 소멸됩니다.
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-4 bg-primary/5 text-primary/40 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary/10 transition-colors"
              >
                취소 (Retreat)
              </button>
              <button
                onClick={() => {
                  deleteUser(deletingUser.id, deletingUser.role);
                  showToast('데이터가 영구히 소멸되었습니다.', 'info');
                  setDeletingUser(null);
                }}
                className="flex-1 py-4 bg-burgundy text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-burgundy/20 active:scale-95 transition-all"
              >
                제명 실행 (Execute)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
