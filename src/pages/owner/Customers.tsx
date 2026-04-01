import React, { useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getCustomerTier, getTierCustomName } from '../../store';
import { 
  Users, LayoutGrid, Search, Send, X, MessageSquare, Ticket, 
  History, Loader2, CheckSquare, Square, Download, ChevronDown, 
  BarChart3, LogOut, Store as StoreIcon, ShieldCheck, Heart, 
  TrendingUp, Calendar, Edit2, Filter, Trash2, Plus, ArrowUpRight,
  Clock, MapPin, Settings
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerCustomers() {
  const { users, visits, issueCoupon, recordCommunication, communications, currentUser, tierOverrides, setCustomerTier, updateUserMemo, bulkIssueCoupon, bulkRecordCommunication } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<string | null>(null);
  const [editingMemoCustomer, setEditingMemoCustomer] = useState<string | null>(null);
  const [sendType, setSendType] = useState<'coupon' | 'message'>('coupon');
  const [content, setContent] = useState('');
  const [selectedPredefinedCoupon, setSelectedPredefinedCoupon] = useState('');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const predefinedCoupons = [
    { id: 'c1', title: '계란찜 1개 서비스' },
    { id: 'c2', title: '음료수 1병 서비스' },
    { id: 'c3', title: '소주 1병 서비스' },
    { id: 'c4', title: '맥주 1병 서비스' },
    { id: 'c5', title: '된장찌개 서비스' },
    { id: 'c6', title: '볶음밥 1인분 서비스' },
    { id: 'c7', title: '고기 1인분 추가 서비스' },
    { id: 'custom', title: '직접 입력' }
  ];

  const navigate = useNavigate();

  if (!currentUser) return null;

  const handleLogout = () => {
    navigate('/');
  };

  const customers = users.filter(u => u.role === 'customer' && u.storeId === currentUser.id);

  const getCustomerStats = (customerId: string) => {
    const customerVisits = visits.filter(v => v.customerId === customerId && v.storeId === currentUser.id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentVisitsData = customerVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
    const recentVisits = new Set(recentVisitsData.map(v => new Date(v.date).toDateString())).size;
    
    const lastVisit = customerVisits.length > 0 
      ? new Date(Math.max(...customerVisits.map(v => new Date(v.date).getTime())))
      : null;
    
    const daysSinceLastVisit = lastVisit 
      ? Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 3600 * 24))
      : null;

    const firstVisit = customerVisits.length > 0 
      ? new Date(Math.min(...customerVisits.map(v => new Date(v.date).getTime())))
      : new Date();
    
    const daysSinceFirstVisit = Math.max(1, Math.floor((new Date().getTime() - firstVisit.getTime()) / (1000 * 3600 * 24)));
    const frequencyPerMonth = (customerVisits.length / daysSinceFirstVisit) * 30;

    const override = tierOverrides.find(t => t.customerId === customerId && t.storeId === currentUser.id);
    const effectiveTier = getEffectiveTier(recentVisits, override?.tier);

    return {
      totalVisits: customerVisits.length,
      recentVisits,
      tier: effectiveTier,
      isManualTier: !!override,
      autoTier: getCustomerTier(recentVisits),
      daysSinceLastVisit,
      frequencyPerMonth: frequencyPerMonth.toFixed(1)
    };
  };

  const filteredCustomers = customers.filter(c => {
    const formattedMemo = c.memo ? formatMemoDisplay(c.memo) : '';
    const matchesSearch = c.name.includes(searchTerm) || c.phone.includes(searchTerm) || (c.memo && c.memo.includes(searchTerm)) || formattedMemo.includes(searchTerm);
    if (!matchesSearch) return false;
    if (filterTier === 'all') return true;
    const stats = getCustomerStats(c.id);
    return stats.tier === filterTier;
  });

  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    const targets = isMultiSelectMode ? selectedCustomers : (selectedCustomer ? [selectedCustomer] : []);
    if (targets.length > 0 && content) {
      setIsSending(true);
      try {
        if (sendType === 'coupon') {
          bulkIssueCoupon(targets, currentUser.id, '사장님 특별 서비스', content);
          bulkRecordCommunication(targets, currentUser.id, 'coupon', content);
        } else {
          bulkRecordCommunication(targets, currentUser.id, 'message', content);
        }
        setSelectedCustomer(null);
        setSelectedCustomers([]);
        setIsMultiSelectMode(false);
        setContent('');
        setSelectedPredefinedCoupon('');
      } catch (err) {
        console.error(err);
      } finally {
        setIsSending(false);
      }
    }
  };

  const activeCustomer = customers.find(c => c.id === selectedCustomer);
  const activeHistoryCustomer = customers.find(c => c.id === historyCustomer);
  const customerHistory = communications.filter(c => c.customerId === historyCustomer && c.storeId === currentUser.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const toggleCustomerSelection = (id: string) => {
    setSelectedCustomers(prev => prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  const handleExportData = () => {
    if (!currentUser) return;
    const storeCustomers = users.filter(u => u.role === 'customer' && u.storeId === currentUser.id);
    if (storeCustomers.length === 0) return;
    const csvContent = ['\uFEFF' + '손님 명부 (결)', '이름,전화번호,성별,방문횟수', ...storeCustomers.map(c => `${c.name},${c.phone},${c.gender || '미선택'},${visits.filter(v => v.customerId === c.id && v.storeId === currentUser.id).length}`)].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `손님명부_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20">
      
      {/* Sidebar - Consistent with Dashboard */}
      <aside className="h-screen w-20 lg:w-64 fixed left-0 border-r-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl tracking-tighter block">결</Link>
          <div className="mt-8 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden hidden lg:block">
                <StoreIcon className="w-full h-full p-2 text-white/40" />
             </div>
             <div className="hidden lg:block overflow-hidden">
                <p className="text-[#fcfcfc] font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 공방'}</p>
                <p className="text-[#fcfcfc]/50 font-sans uppercase tracking-widest text-[10px]">사장님 관리 시스템</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <Link to="/owner" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">대시보드</span>
          </Link>
          <Link to="/owner/customers" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4 transition-transform ease-in-out">
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">단골 관리</span>
          </Link>
          <Link to="/owner/statistics" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">매장 통계</span>
          </Link>
          <Link to="/owner/brand-settings" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">매장 설정</span>
          </Link>
        </nav>

        <div className="px-8 mt-auto space-y-4">
          <div className="pt-6 border-t border-white/10 space-y-2">
            <button onClick={handleLogout} className="text-[#fcfcfc]/40 hover:text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden lg:block">로그아웃</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="ml-20 lg:ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 border-b border-outline-variant/30">
          <div className="flex items-center gap-12">
            <span className="font-serif text-2xl font-bold text-primary">단골 관리</span>
            <button 
              onClick={handleExportData}
              className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
            >
              <Download className="w-4 h-4" /> 명부 추출
            </button>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="relative hidden md:block w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                <input 
                  type="text" 
                  placeholder="단골 손님 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-surface-container border-none focus:ring-1 focus:ring-primary rounded-full pl-12 pr-4 py-2 text-sm font-body"
                />
             </div>
             <button
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  setSelectedCustomers([]);
                }}
                className={`px-6 py-2 rounded-full font-serif text-sm transition-all shadow-lg ${isMultiSelectMode ? 'bg-primary text-white' : 'bg-surface-container-highest text-primary'}`}
             >
               {isMultiSelectMode ? '취소' : '일괄 서비스'}
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
               <h2 className="text-4xl font-serif font-black text-primary tracking-tight italic">단골 명부</h2>
               <p className="text-on-surface-variant/60 text-[11px] font-bold uppercase tracking-widest mt-2">{currentUser.restaurantName}의 소중한 손님 기록입니다.</p>
            </div>
            
            <div className="flex bg-surface-container p-1 rounded-xl overflow-x-auto no-scrollbar">
              {['all', 'VIP', '다이아', '골드', '실버', '브론즈', '일반'].map(tier => (
                <button
                  key={tier}
                  onClick={() => setFilterTier(tier)}
                  className={`px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${filterTier === tier ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40 hover:text-primary'}`}
                >
                  {tier === 'all' ? '전체 등급' : getTierCustomName(tier, currentUser?.tierNames)}
                </button>
              ))}
            </div>
          </div>

          {isMultiSelectMode && (
             <div className="mb-8 flex justify-between items-center bg-primary/5 p-6 rounded-2xl border border-primary/20 animate-in fade-in slide-in-from-top-4">
                <button onClick={toggleSelectAll} className="flex items-center gap-3 text-primary font-bold text-xs">
                  {selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0 ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  전체 선택 ({selectedCustomers.length}명)
                </button>
                <button
                  disabled={selectedCustomers.length === 0}
                  onClick={() => setSelectedCustomer('bulk')}
                  className="px-8 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-30 shadow-lg"
                >일괄 서비스 발송</button>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredCustomers.map(customer => {
              const stats = getCustomerStats(customer.id);
              const isSelected = selectedCustomers.includes(customer.id);
              return (
                <div 
                  key={customer.id} 
                  className={`bg-white rounded-[2rem] p-8 shadow-sm border transition-all relative group ${isMultiSelectMode && isSelected ? 'border-primary ring-2 ring-primary/10' : 'border-outline-variant/30 hover:shadow-xl hover:-translate-y-1'}`}
                  onClick={() => isMultiSelectMode && toggleCustomerSelection(customer.id)}
                >
                  <div className="absolute top-6 right-6 flex gap-2">
                     <button onClick={(e) => { e.stopPropagation(); setHistoryCustomer(customer.id); }} className="p-2.5 bg-surface-container rounded-xl text-on-surface-variant hover:text-primary transition-all"><History className="w-4 h-4" /></button>
                  </div>

                  <div className="flex items-start gap-6 mb-8">
                     <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center font-serif text-2xl font-bold text-primary">{customer.name.charAt(0)}</div>
                     <div>
                        <div className="flex items-center gap-3 mb-1">
                           <h3 className="text-xl font-serif font-black text-primary">{customer.name}</h3>
                           <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${getTierColor(stats.tier)} text-white`}>
                              {getTierCustomName(stats.tier, currentUser?.tierNames)}
                           </span>
                        </div>
                        <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">{customer.phone}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-center">
                        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase mb-1">총 방문</p>
                        <p className="text-xl font-serif font-black text-primary">{stats.totalVisits}회</p>
                     </div>
                     <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/30 text-center">
                        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase mb-1">마지막 방문</p>
                        <p className="text-xl font-serif font-black text-primary">{stats.daysSinceLastVisit ?? 0}일 전</p>
                     </div>
                  </div>

                  {customer.memo && (
                    <div className="mb-8 p-4 bg-primary/5 rounded-2xl border-l-4 border-primary italic text-xs text-primary/80 line-clamp-2">
                       {formatMemoDisplay(customer.memo)}
                    </div>
                  )}

                  <div className="flex gap-2">
                     <button 
                       onClick={(e) => { e.stopPropagation(); setEditingMemoCustomer(customer.id); }}
                       className="flex-1 bg-primary text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent-burgundy transition-all shadow-md"
                     >사장님 메모</button>
                     <button 
                       onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer.id); }}
                       className="p-4 rounded-xl border border-outline-variant/50 text-primary hover:bg-surface-container transition-all"
                     ><Send className="w-5 h-5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modals */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-3xl p-10 shadow-3xl border border-outline-variant/30 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-serif text-2xl text-primary italic">서비스 전송</h2>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-surface-container rounded-full transition-all"><X className="w-6 h-6 text-on-surface-variant/40" /></button>
            </div>
            
            <form onSubmit={handleSend} className="space-y-6">
               <div className="flex bg-surface-container p-1 rounded-xl mb-6">
                  <button type="button" onClick={() => setSendType('coupon')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${sendType === 'coupon' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40'}`}>쿠폰 서비스</button>
                  <button type="button" onClick={() => setSendType('message')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${sendType === 'message' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/40'}`}>문자 발송</button>
               </div>

               {sendType === 'coupon' ? (
                 <select
                   value={selectedPredefinedCoupon}
                   onChange={e => {
                     setSelectedPredefinedCoupon(e.target.value);
                     if (e.target.value !== 'custom') {
                       const sel = predefinedCoupons.find(c => c.id === e.target.value);
                       if (sel) setContent(sel.title);
                     } else setContent('');
                   }}
                   className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-body"
                 >
                   <option value="" disabled>서비스 품목 선택</option>
                   {predefinedCoupons.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                 </select>
               ) : (
                 <textarea 
                   rows={4}
                   className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-body resize-none"
                   placeholder="발송할 내용을 입력해 주세요..."
                   value={content}
                   onChange={e => setContent(e.target.value)}
                 />
               )}
               
               <button 
                 type="submit" 
                 disabled={isSending || !content}
                 className="w-full py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs disabled:opacity-30 shadow-lg hover:bg-accent-burgundy"
               >{isSending ? '발송 중...' : '발송 확정'}</button>
            </form>
          </div>
        </div>
      )}

      {historyCustomer && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-3xl p-10 shadow-3xl border border-outline-variant/30 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-10">
              <h2 className="font-serif text-2xl text-primary italic">활동 내역</h2>
              <button onClick={() => setHistoryCustomer(null)} className="p-2 hover:bg-surface-container rounded-full transition-all"><X className="w-6 h-6 text-on-surface-variant/40" /></button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
              {customerHistory.map(comm => (
                <div key={comm.id} className="p-6 bg-surface-container rounded-2xl border border-outline-variant/10">
                  <div className="flex justify-between mb-2">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-full text-white ${comm.type === 'coupon' ? 'bg-primary' : 'bg-on-surface-variant'}`}>{comm.type === 'coupon' ? '쿠폰' : '메시지'}</span>
                    <span className="text-[9px] font-bold text-on-surface-variant/40">{new Date(comm.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-primary font-medium">{comm.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <MemoModal
        isOpen={!!editingMemoCustomer}
        onClose={() => setEditingMemoCustomer(null)}
        initialMemo={users.find(u => u.id === editingMemoCustomer)?.memo || ''}
        onSave={memo => editingMemoCustomer && updateUserMemo(editingMemoCustomer, currentUser.id, memo)}
      />
    </div>
  );
}
