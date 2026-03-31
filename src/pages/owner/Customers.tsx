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
  
  // Multi-select state
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
    
    // Calculate days since last visit
    const lastVisit = customerVisits.length > 0 
      ? new Date(Math.max(...customerVisits.map(v => new Date(v.date).getTime())))
      : null;
    
    const daysSinceLastVisit = lastVisit 
      ? Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 3600 * 24))
      : null;

    // Calculate frequency
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
          // Simulate sending SMS
          bulkRecordCommunication(targets, currentUser.id, 'message', content);
        }
        
        import('../../store').then(({ showToast }) => {
          if (sendType === 'message') {
            showToast(`[문자 발송 시뮬레이션]\n${targets.length}명에게 전송 완료\n내용: ${content}`, 'info');
          }
        }).catch(console.error);

        setSelectedCustomer(null);
        setSelectedCustomers([]);
        setIsMultiSelectMode(false);
        setContent('');
        setSelectedPredefinedCoupon('');
      } catch (err) {
        console.error(err);
        import('../../store').then(({ showToast }) => showToast('발송 중 오류가 발생했습니다.', 'error')).catch(console.error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const activeCustomer = customers.find(c => c.id === selectedCustomer);
  const activeHistoryCustomer = customers.find(c => c.id === historyCustomer);
  const customerHistory = communications.filter(c => c.customerId === historyCustomer && c.storeId === currentUser.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const toggleCustomerSelection = (id: string) => {
    setSelectedCustomers(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
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
    const total = storeCustomers.length;
    
    if (total === 0) {
      import('../../store').then(({ showToast }) => showToast('출력할 데이터가 없습니다.', 'error')).catch(console.error);
      return;
    }

    const pohangCount = storeCustomers.filter(u => u.isPohangResident === true).length;
    const nonPohangCount = storeCustomers.filter(u => u.isPohangResident === false).length;
    const unknownPohangCount = total - pohangCount - nonPohangCount;

    const maleCount = storeCustomers.filter(u => u.gender === 'male').length;
    const femaleCount = storeCustomers.filter(u => u.gender === 'female').length;
    const unknownGenderCount = total - maleCount - femaleCount;

    const pohangRatio = ((pohangCount / total) * 100).toFixed(1);
    const maleRatio = ((maleCount / total) * 100).toFixed(1);
    const femaleRatio = ((femaleCount / total) * 100).toFixed(1);

    const csvContent = [
      '\uFEFF' + '고객 통계 리포트',
      `총 고객 수,${total}명`,
      '',
      '거주지 통계',
      `포항 거주,${pohangCount}명,${pohangRatio}%`,
      `타지역 거주,${nonPohangCount}명,${((nonPohangCount / total) * 100).toFixed(1)}%`,
      `미입력,${unknownPohangCount}명,${((unknownPohangCount / total) * 100).toFixed(1)}%`,
      '',
      '성별 통계',
      `남성,${maleCount}명,${maleRatio}%`,
      `여성,${femaleCount}명,${femaleRatio}%`,
      `미입력,${unknownGenderCount}명,${((unknownGenderCount / total) * 100).toFixed(1)}%`,
      '',
      '고객 상세 목록',
      '이름,전화번호,포항거주,성별',
      ...storeCustomers.map(c => 
        `${c.name},${c.phone},${c.isPohangResident === true ? 'O' : (c.isPohangResident === false ? 'X' : '미입력')},${c.gender === 'male' ? '남성' : (c.gender === 'female' ? '여성' : '미입력')}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `고객통계_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface hanji-texture relative">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
      
      {/* Sidebar - Consistent with Dashboard */}
      <aside className="h-screen w-20 md:w-64 border-r border-primary/5 bg-primary shadow-2xl flex flex-col py-8 z-50 transition-all duration-500">
        <div className="px-6 md:px-8 mb-12">
          <h1 className="text-surface-bright font-serif italic text-2xl md:text-3xl tracking-tighter hidden md:block">결 (Gyeol)</h1>
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3 md:hidden mx-auto">
             <span className="text-white font-serif italic text-xl">결</span>
          </div>
          <div className="mt-8 hidden md:flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3">
              <StoreIcon className="text-white w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 공방'}</p>
              <p className="font-black uppercase tracking-widest text-[9px] text-white/40">장인 관리자</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <Link 
            to="/owner"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">매장 전도</span>
          </Link>
          
          <Link 
            to="/owner/customers"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 bg-primary-container text-white border-l-4 border-white"
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">단골 장부</span>
          </Link>
          
          <Link 
            to="/owner/statistics"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">분석 및 통계</span>
          </Link>

          <Link 
            to="/owner/brand-settings"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">브랜드 설정</span>
          </Link>
        </nav>
        
        <div className="px-4 md:px-8 mt-auto pt-8 space-y-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center space-x-4 px-2 md:px-0 py-3.5 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-bold">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:block">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-bright/50 backdrop-blur-sm">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-6 md:px-10 py-5 border-b border-primary/5">
          <div className="flex items-center space-x-4 md:space-x-12">
            <div className="font-serif text-xl md:text-2xl font-black text-primary tracking-tighter italic">시민 명부 (고객 관리)</div>
            <div className="h-6 w-px bg-primary/10 hidden md:block"></div>
            <div className="hidden lg:flex items-center space-x-4">
               <button 
                onClick={handleExportData}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all border border-primary/10"
               >
                 <Download className="w-4 h-4" />
                 <span>데이터 추출</span>
               </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block w-64 lg:w-96">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
               <input 
                type="text" 
                placeholder="이름 또는 연락처로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-primary/10 border border-primary/10 rounded-2xl py-2.5 pl-12 pr-4 text-[10px] font-black tracking-widest text-primary placeholder:text-primary/20 focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
               />
            </div>
            
            <button
               onClick={() => {
                 if (customers.length === 0) return;
                 setIsMultiSelectMode(!isMultiSelectMode);
                 setSelectedCustomers([]);
               }}
               className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isMultiSelectMode ? 'bg-burgundy text-white border-burgundy shadow-xl shadow-burgundy/20' : 'bg-white text-primary/40 border-primary/10 hover:border-primary/30'}`}
            >
              <Filter className="w-4 h-4" />
              <span>{isMultiSelectMode ? '발송 취소' : '일괄 발송'}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6 md:p-10">
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
               <h2 className="text-4xl font-serif font-black text-primary tracking-tight italic">단골 장부</h2>
               <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{currentUser.restaurantName || '공방'}의 소중한 시민(고객)들을 관리합니다.</p>
            </div>
            
            <div className="flex bg-primary/10 p-1 rounded-2xl overflow-x-auto no-scrollbar">
              {['all', 'VIP', '다이아', '골드', '실버', '브론즈', '일반'].map(tier => (
                <button
                  key={tier}
                  onClick={() => {
                    setFilterTier(tier);
                    setSelectedCustomers([]);
                  }}
                  className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    filterTier === tier 
                      ? 'bg-primary text-white shadow-xl' 
                      : 'text-primary/40 hover:text-primary hover:bg-white/50'
                  }`}
                >
                  {tier === 'all' ? '전체 등급' : getTierCustomName(tier, currentUser?.tierNames)}
                </button>
              ))}
            </div>
          </div>

          {isMultiSelectMode && (
             <div className="mb-8 flex justify-between items-center bg-burgundy/5 p-6 rounded-[2rem] border border-burgundy/10 animate-in fade-in slide-in-from-top-4">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center space-x-3 text-burgundy font-black text-[10px] uppercase tracking-widest"
                >
                  {selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0 ? (
                    <CheckSquare className="w-6 h-6" />
                  ) : (
                    <Square className="w-6 h-6" />
                  )}
                  <span>전체 선택 ({selectedCustomers.length}/{filteredCustomers.length})</span>
                </button>
                <button
                  onClick={() => {
                    if (selectedCustomers.length > 0) {
                      setSelectedCustomer('bulk');
                    }
                  }}
                  disabled={selectedCustomers.length === 0}
                  className="px-8 py-3 bg-burgundy text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 shadow-xl shadow-burgundy/20 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>선택한 시민에게 발송</span>
                </button>
             </div>
          )}

          {/* Customer Registry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCustomers.length === 0 ? (
               <div className="col-span-full py-32 text-center space-y-4 opacity-20">
                  <span className="material-symbols-outlined text-8xl">person_search</span>
                  <p className="font-black uppercase tracking-[0.4em] text-xs">검색된 기록이 없습니다.</p>
               </div>
            ) : (
              filteredCustomers.map(customer => {
                const stats = getCustomerStats(customer.id);
                const isSelected = selectedCustomers.includes(customer.id);
                return (
                  <div 
                    key={customer.id} 
                    className={`bg-white rounded-[2.5rem] p-8 shadow-sm border transition-all duration-500 relative group overflow-hidden ${
                      isMultiSelectMode && isSelected ? 'border-burgundy ring-4 ring-burgundy/5' : 'border-primary/5 hover:border-primary/20 hover:shadow-xl'
                    }`}
                    onClick={() => isMultiSelectMode && toggleCustomerSelection(customer.id)}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={(e) => { e.stopPropagation(); setHistoryCustomer(customer.id); }} className="p-3 bg-primary/10 rounded-2xl hover:bg-primary text-primary/40 hover:text-white transition-all shadow-sm">
                          <History className="w-4 h-4" />
                       </button>
                    </div>

                    <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center space-x-5">
                         <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center border-2 border-primary/5">
                            <span className="text-2xl font-serif italic font-black text-primary">{customer.name.charAt(0)}</span>
                         </div>
                         <div>
                            <div className="flex items-center space-x-3 mb-1">
                               <h3 className="text-xl font-serif font-black text-primary tracking-tight">{customer.name}</h3>
                               <div className="relative">
                                  <select
                                    value={stats.isManualTier ? stats.tier : 'auto'}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setCustomerTier(customer.id, currentUser.id, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`appearance-none pl-3 pr-8 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border-none cursor-pointer focus:ring-4 focus:ring-primary/5 outline-none text-white transition-all ${getTierColor(stats.tier)}`}
                                  >
                                    <option value="auto">자동 ({getTierCustomName(stats.autoTier, currentUser?.tierNames)})</option>
                                    <option value="일반">{getTierCustomName('일반', currentUser?.tierNames)}</option>
                                    <option value="브론즈">{getTierCustomName('브론즈', currentUser?.tierNames)}</option>
                                    <option value="실버">{getTierCustomName('실버', currentUser?.tierNames)}</option>
                                    <option value="골드">{getTierCustomName('골드', currentUser?.tierNames)}</option>
                                    <option value="다이아">{getTierCustomName('다이아', currentUser?.tierNames)}</option>
                                    <option value="VIP">{getTierCustomName('VIP', currentUser?.tierNames)}</option>
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-white absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                               </div>
                            </div>
                            <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest">{customer.phone}</p>
                         </div>
                      </div>
                      
                      {isMultiSelectMode && (
                        <div className="pt-2">
                          {isSelected ? (
                            <CheckSquare className="w-7 h-7 text-burgundy animate-in zoom-in duration-300" />
                          ) : (
                            <Square className="w-7 h-7 text-primary/10" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                       <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10">
                          <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1 flex items-center"><TrendingUp className="w-3 h-3 mr-1" /> 방문 빈도</p>
                          <p className="text-lg font-black text-primary">{stats.recentVisits} <span className="text-[11px] font-medium text-primary/40 uppercase tracking-tighter">회</span></p>
                       </div>
                       <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10">
                          <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> 마지막 방문</p>
                          <p className="text-lg font-black text-primary">{stats.daysSinceLastVisit !== null ? stats.daysSinceLastVisit : '0'} <span className="text-[11px] font-medium text-primary/40 uppercase tracking-tighter">일 전</span></p>
                       </div>
                    </div>

                    {customer.memo && (
                      <div className="mb-8 p-6 bg-surface-bright rounded-3xl border border-primary/10 relative">
                         <div className="absolute transform rotate-45 top-0 right-0 -mr-1 -mt-1 w-4 h-4 bg-primary/10 rounded-full"></div>
                         <p className="text-xs text-primary/70 leading-relaxed font-serif italic serif">
                            {formatMemoDisplay(customer.memo)}
                         </p>
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                       <button 
                        onClick={(e) => { e.stopPropagation(); setEditingMemoCustomer(customer.id); }}
                        className="flex-1 bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-container transition-all shadow-xl shadow-primary/10"
                       >
                         장인의 메모
                       </button>
                       <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer.id); }}
                        className="p-3.5 bg-primary/10 text-primary border border-primary/10 rounded-2xl hover:bg-primary/20 transition-all group"
                       >
                         <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                       </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Transmit Modal (Service/Message) */}
      {selectedCustomer && (isMultiSelectMode || activeCustomer) && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-3xl border border-primary/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            
            <button 
              onClick={() => {
                setSelectedCustomer(null);
                setSelectedPredefinedCoupon('');
                setContent('');
              }}
              className="absolute top-8 right-8 p-3 hover:bg-primary/5 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6 text-primary/30" />
            </button>

            <h2 className="text-3xl font-serif font-black text-primary tracking-tighter mb-2 italic">알림 발송</h2>
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mb-10">
              {isMultiSelectMode ? `${selectedCustomers.length}명의 시민에게 발송 중` : `${activeCustomer?.name}님을 위한 개별 알림`}
            </p>
            
            <div className="flex space-x-2 bg-primary/5 p-1 rounded-2xl mb-8">
              <button 
                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${sendType === 'coupon' ? 'bg-primary text-white shadow-xl' : 'text-primary/40 hover:text-primary'}`}
                onClick={() => setSendType('coupon')}
              >
                전통 쿠폰 (서비스)
              </button>
              <button 
                className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${sendType === 'message' ? 'bg-primary text-white shadow-xl' : 'text-primary/40 hover:text-primary'}`}
                onClick={() => setSendType('message')}
              >
                문자 메시지
              </button>
            </div>

            <form onSubmit={handleSend} className="space-y-6">
              {sendType === 'coupon' ? (
                <div className="space-y-4">
                  <div className="relative">
                    <select
                      value={selectedPredefinedCoupon}
                      onChange={(e) => {
                        setSelectedPredefinedCoupon(e.target.value);
                        if (e.target.value !== 'custom') {
                          const selected = predefinedCoupons.find(c => c.id === e.target.value);
                          if (selected) setContent(selected.title);
                        } else {
                          setContent('');
                        }
                      }}
                      className="w-full bg-primary/10 border border-primary/10 rounded-2xl py-4 pl-6 pr-12 text-[10px] font-black uppercase tracking-widest text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 appearance-none"
                      required
                    >
                      <option value="" disabled>항목 선택</option>
                      {predefinedCoupons.map(coupon => (
                        <option key={coupon.id} value={coupon.id}>{coupon.title.toUpperCase()}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-primary/30" />
                  </div>
                  
                  {selectedPredefinedCoupon === 'custom' && (
                    <input 
                      type="text" 
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="직접 입력..."
                      className="w-full bg-primary/10 border border-primary/10 rounded-2xl py-4 px-6 text-[10px] font-black uppercase tracking-widest text-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
                      required
                    />
                  )}
                </div>
              ) : (
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="보낼 메시지 내용을 입력하세요..."
                  rows={4}
                  className="w-full bg-primary/10 border border-primary/10 rounded-2xl py-6 px-6 text-[10px] font-black uppercase tracking-widest text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none"
                  required
                />
              )}

              <button 
                type="submit"
                disabled={isSending}
                className="w-full bg-burgundy hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-burgundy/20 flex items-center justify-center space-x-3 text-[10px] uppercase tracking-widest"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSending ? '발송 중...' : '발송 하기'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Archive Modal */}
      {historyCustomer && activeHistoryCustomer && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-12 shadow-3xl border border-primary/10 relative overflow-hidden flex flex-col max-h-[85vh]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            
            <button 
              onClick={() => setHistoryCustomer(null)}
              className="absolute top-8 right-8 p-3 hover:bg-primary/5 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6 text-primary/30" />
            </button>

            <h2 className="text-3xl font-serif font-black text-primary tracking-tighter mb-2 italic">기록 보관소</h2>
            <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mb-10">{activeHistoryCustomer.name}님의 활동 기록</p>
            
            <div className="overflow-y-auto flex-1 pr-4 space-y-6 no-scrollbar">
              {customerHistory.length === 0 ? (
                <div className="text-center py-24 opacity-20 space-y-4">
                   <span className="material-symbols-outlined text-6xl">history_toggle_off</span>
                   <p className="font-black uppercase tracking-widest text-[10px]">기록된 활동이 없습니다.</p>
                </div>
              ) : (
                customerHistory.map(comm => (
                  <div key={comm.id} className={`p-8 rounded-[2rem] border relative overflow-hidden ${comm.senderRole === 'customer' ? 'bg-primary/5 border-primary/10' : 'bg-surface-bright border-primary/5'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex space-x-3">
                        <span className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ${comm.type === 'coupon' ? 'bg-burgundy text-white' : 'bg-primary text-white'}`}>
                          {comm.type === 'coupon' ? '쿠폰' : '메시지'}
                        </span>
                        {comm.senderRole === 'customer' && (
                          <span className="px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-sm">
                            시민의 응답
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-primary/20 uppercase tracking-widest">
                        {new Date(comm.date).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className={`text-sm font-serif italic serif leading-relaxed ${comm.senderRole === 'customer' ? 'text-primary' : 'text-primary/70'}`}>{comm.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Heritage Note Modal */}
      <MemoModal
        isOpen={!!editingMemoCustomer}
        onClose={() => setEditingMemoCustomer(null)}
        initialMemo={users.find(u => u.id === editingMemoCustomer)?.memo || ''}
        onSave={(memo) => {
          if (editingMemoCustomer) {
            updateUserMemo(editingMemoCustomer, currentUser.id, memo);
          }
        }}
      />
    </div>
  );
}
