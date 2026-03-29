import React, { useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getCustomerTier } from '../../store';
import { Users, LayoutGrid, Search, Send, X, MessageSquare, Ticket, History, Loader2, CheckSquare, Square, Download, ChevronDown, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';

export default function OwnerCustomers() {
  const { users, visits, issueCoupon, recordCommunication, communications, currentUser, tierOverrides, setCustomerTier, updateUserMemo, bulkIssueCoupon, bulkRecordCommunication } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
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

  if (!currentUser) return null;

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
    return c.name.includes(searchTerm) || c.phone.includes(searchTerm) || (c.memo && c.memo.includes(searchTerm)) || formattedMemo.includes(searchTerm);
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
    <div className="min-h-full bg-hanji-light dark:bg-hanji-dark pb-20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md text-ink-light dark:text-ink-dark p-6 pt-8 border-b border-ink-light/10 dark:border-ink-dark/10 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-serif font-bold tracking-tight">고객 관리</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExportData}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-black/20 text-ink-light/70 dark:text-ink-dark/70 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 border border-ink-light/10 dark:border-ink-dark/10 text-sm font-bold transition-colors flex items-center shadow-sm"
            >
              <Download className="w-4 h-4 mr-1.5" />
              자료출력
            </button>
            <button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedCustomers([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm border ${
                isMultiSelectMode 
                  ? 'bg-burgundy text-hanji-light border-burgundy' 
                  : 'bg-white dark:bg-black/20 text-ink-light/70 dark:text-ink-dark/70 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 border-ink-light/10 dark:border-ink-dark/10'
              }`}
            >
              {isMultiSelectMode ? '취소' : '일괄 전송'}
            </button>
          </div>
        </div>
        
        <div className="mt-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ink-light/40 dark:text-ink-dark/40 w-5 h-5" />
          <input 
            type="text" 
            placeholder="이름 또는 전화번호 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-black/20 text-ink-light dark:text-ink-dark placeholder-ink-light/40 dark:placeholder-ink-dark/40 rounded-2xl py-3 pl-12 pr-4 border border-ink-light/10 dark:border-ink-dark/10 focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-all shadow-sm"
          />
        </div>

        {isMultiSelectMode && (
          <div className="mt-4 flex justify-between items-center bg-burgundy/5 dark:bg-burgundy/10 p-3 rounded-xl border border-burgundy/20 animate-in fade-in slide-in-from-top-2">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center text-burgundy dark:text-burgundy-light font-bold text-sm"
            >
              {selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0 ? (
                <CheckSquare className="w-5 h-5 mr-2 text-burgundy" />
              ) : (
                <Square className="w-5 h-5 mr-2" />
              )}
              전체 선택 ({selectedCustomers.length}/{filteredCustomers.length})
            </button>
            <button
              onClick={() => {
                if (selectedCustomers.length > 0) {
                  // Open modal for bulk send
                  setSelectedCustomer('bulk'); // Use a dummy ID to open the modal
                }
              }}
              disabled={selectedCustomers.length === 0}
              className="px-4 py-2 bg-burgundy text-hanji-light rounded-lg text-sm font-bold disabled:opacity-50 transition-colors flex items-center shadow-sm"
            >
              <Send className="w-4 h-4 mr-1.5" />
              선택 전송
            </button>
          </div>
        )}
      </div>

      {/* Customer List */}
      <div className="p-4 space-y-4">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-ink-light/50 dark:text-ink-dark/50 bg-white dark:bg-hanji-dark rounded-3xl border border-ink-light/10 dark:border-ink-dark/10 shadow-sm mt-4">
            검색 결과가 없습니다.
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const stats = getCustomerStats(customer.id);
            const isSelected = selectedCustomers.includes(customer.id);
            return (
              <div 
                key={customer.id} 
                className={`bg-hanji-light dark:bg-hanji-dark rounded-[2rem] p-6 shadow-sm border transition-all relative overflow-hidden ${
                  isMultiSelectMode && isSelected ? 'border-burgundy ring-2 ring-burgundy/50' : 'border-ink-light/10 dark:border-ink-dark/10 hover:border-ink-light/20 dark:hover:border-ink-dark/20'
                }`}
                onClick={() => isMultiSelectMode && toggleCustomerSelection(customer.id)}
              >
                {/* Top Color Blocks (Decorative) */}
                <div className="flex gap-1.5 mb-6">
                  <div className="h-6 w-16 bg-burgundy rounded-md"></div>
                  <div className="h-6 w-16 bg-espresso rounded-md"></div>
                  <div className="h-6 w-16 bg-olive rounded-md"></div>
                  <div className="h-6 w-16 bg-mustard/20 rounded-md"></div>
                  <div className="h-6 w-16 bg-white/50 rounded-md"></div>
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    {/* VIP Badge & Name */}
                    <div className="flex items-center gap-3 mb-1">
                      <div className="relative group">
                        <select
                          value={stats.tier}
                          onChange={(e) => {
                            e.stopPropagation();
                            setCustomerTier(customer.id, currentUser.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="appearance-none px-3 py-1 pr-6 bg-burgundy/10 dark:bg-burgundy/20 text-burgundy dark:text-burgundy-light rounded-full text-xs font-bold border-none cursor-pointer focus:ring-2 focus:ring-burgundy/50 outline-none"
                        >
                          <option value="일반">일반</option>
                          <option value="단골">단골</option>
                          <option value="VIP">VIP</option>
                          <option value="VVIP">VVIP</option>
                        </select>
                        <ChevronDown className="w-3 h-3 text-burgundy dark:text-burgundy-light absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark text-2xl">{customer.name}</h3>
                    </div>
                    <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm font-medium mt-1">{customer.phone}</p>
                  </div>

                  {/* Multi-select Checkbox */}
                  {isMultiSelectMode && (
                    <div className="mt-2">
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-burgundy" />
                      ) : (
                        <Square className="w-6 h-6 text-ink-light/20 dark:text-ink-dark/20" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white dark:bg-black/20 rounded-2xl p-4 border border-ink-light/5 dark:border-ink-dark/5">
                    <p className="text-ink-light/50 dark:text-ink-dark/50 text-xs font-medium mb-1">최근 30일</p>
                    <p className="text-ink-light dark:text-ink-dark font-bold text-lg">{stats.recentVisits}회</p>
                  </div>
                  <div className="bg-white dark:bg-black/20 rounded-2xl p-4 border border-ink-light/5 dark:border-ink-dark/5">
                    <p className="text-ink-light/50 dark:text-ink-dark/50 text-xs font-medium mb-1">마지막 방문</p>
                    <p className="text-ink-light dark:text-ink-dark font-bold text-lg">{stats.daysSinceLastVisit !== null ? `${stats.daysSinceLastVisit}일 전` : '없음'}</p>
                  </div>
                </div>

                {/* Memo Display */}
                {customer.memo && (
                  <div className="mb-6 bg-white/50 dark:bg-black/10 p-4 rounded-2xl border border-ink-light/10 dark:border-ink-dark/10 relative group">
                    <p className="text-sm text-ink-light/80 dark:text-ink-dark/80 whitespace-pre-wrap font-medium leading-relaxed">
                      {formatMemoDisplay(customer.memo)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('메모를 삭제하시겠습니까?')) {
                          updateUserMemo(customer.id, currentUser.id, '');
                        }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-white dark:bg-black/40 rounded-full text-ink-light/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                      title="메모 삭제"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMemoCustomer(customer.id);
                    }}
                    className="w-full bg-burgundy text-hanji-light py-4 rounded-2xl font-bold text-base hover:bg-burgundy/90 transition-colors shadow-md flex items-center justify-center"
                  >
                    {customer.memo ? '메모 수정하기' : '메모 저장하기'}
                  </button>
                  
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomer(customer.id);
                      }}
                      className="text-ink-light/60 dark:text-ink-dark/60 text-sm font-medium hover:text-ink-light dark:hover:text-ink-dark transition-colors flex items-center"
                    >
                      서비스쿠폰 / 문자메세지 제공 <span className="ml-1 text-xs">↗</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/80 backdrop-blur-md border-t border-ink-light/10 dark:border-ink-dark/10 flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light dark:hover:text-ink-dark transition-colors">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-burgundy dark:text-burgundy-light">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
        <Link to="/owner/statistics" className="flex flex-col items-center text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light dark:hover:text-ink-dark transition-colors">
          <BarChart3 className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">통계</span>
        </Link>
      </div>

      {/* Send Modal */}
      {selectedCustomer && (isMultiSelectMode || activeCustomer) && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-hanji-light dark:bg-hanji-dark w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-12 sm:pb-6 relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 border border-ink-light/10 dark:border-ink-dark/10">
            <button 
              onClick={() => {
                if (!isMultiSelectMode) setSelectedCustomer(null);
                else setSelectedCustomer(null); // Just close modal, keep selection
                setSelectedPredefinedCoupon('');
                setContent('');
              }}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
            >
              <X className="w-5 h-5 text-ink-light/40 dark:text-ink-dark/40" />
            </button>

            <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark mb-2">
              {isMultiSelectMode ? `${selectedCustomers.length}명에게 일괄 전송` : `${activeCustomer?.name}님에게 보내기`}
            </h2>
            
            <div className="flex border-b border-ink-light/10 dark:border-ink-dark/10 mb-6 mt-4">
              <button 
                className={`flex-1 py-3 font-bold text-sm transition-colors flex items-center justify-center ${sendType === 'coupon' ? 'text-burgundy dark:text-burgundy-light border-b-2 border-burgundy dark:border-burgundy-light' : 'text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light/60 dark:hover:text-ink-dark/60'}`}
                onClick={() => setSendType('coupon')}
              >
                <Ticket className="w-4 h-4 mr-2" />
                서비스 쿠폰
              </button>
              <button 
                className={`flex-1 py-3 font-bold text-sm transition-colors flex items-center justify-center ${sendType === 'message' ? 'text-burgundy dark:text-burgundy-light border-b-2 border-burgundy dark:border-burgundy-light' : 'text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light/60 dark:hover:text-ink-dark/60'}`}
                onClick={() => setSendType('message')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                문자 메시지
              </button>
            </div>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-ink-light/70 dark:text-ink-dark/70 mb-2">
                  {sendType === 'coupon' ? '서비스 내용' : '메시지 내용'}
                </label>
                {sendType === 'coupon' ? (
                  <div className="space-y-3">
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
                        className="w-full px-4 py-3 rounded-xl border border-ink-light/10 dark:border-ink-dark/10 focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-colors bg-white dark:bg-black/20 text-ink-light dark:text-ink-dark appearance-none"
                        required
                      >
                        <option value="" disabled>서비스 선택</option>
                        {predefinedCoupons.map(coupon => (
                          <option key={coupon.id} value={coupon.id}>{coupon.title}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none text-ink-light/40 dark:text-ink-dark/40" />
                    </div>
                    
                    {selectedPredefinedCoupon === 'custom' && (
                      <input 
                        type="text" 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="예: 계란찜 1개 서비스"
                        className="w-full px-4 py-3 rounded-xl border border-ink-light/10 dark:border-ink-dark/10 focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-colors bg-white dark:bg-black/20 text-ink-light dark:text-ink-dark"
                        required
                      />
                    )}
                  </div>
                ) : (
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="고객님께 보낼 메시지를 입력하세요."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-ink-light/10 dark:border-ink-dark/10 focus:border-burgundy focus:ring-2 focus:ring-burgundy/20 transition-colors resize-none bg-white dark:bg-black/20 text-ink-light dark:text-ink-dark"
                    required
                  />
                )}
              </div>

              <button 
                type="submit"
                disabled={isSending}
                className="w-full bg-burgundy hover:bg-burgundy/90 disabled:bg-burgundy/50 text-hanji-light font-bold py-4 rounded-xl transition-colors flex items-center justify-center shadow-sm"
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                {isSending ? '전송 중...' : '전송하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyCustomer && activeHistoryCustomer && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-hanji-light dark:bg-hanji-dark w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-12 sm:pb-6 relative shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[80vh] flex flex-col border border-ink-light/10 dark:border-ink-dark/10">
            <button 
              onClick={() => setHistoryCustomer(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 transition-colors"
            >
              <X className="w-5 h-5 text-ink-light/40 dark:text-ink-dark/40" />
            </button>

            <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark mb-6 flex items-center">
              <History className="w-6 h-6 mr-2 text-ink-light/60 dark:text-ink-dark/60" />
              {activeHistoryCustomer.name}님 전송 기록
            </h2>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {customerHistory.length === 0 ? (
                <div className="text-center py-8 text-ink-light/60 dark:text-ink-dark/60 bg-white dark:bg-black/20 rounded-2xl border border-ink-light/10 dark:border-ink-dark/10">
                  전송된 기록이 없습니다.
                </div>
              ) : (
                customerHistory.map(comm => (
                  <div key={comm.id} className="bg-white dark:bg-black/20 p-4 rounded-2xl border border-ink-light/10 dark:border-ink-dark/10">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold flex items-center ${comm.type === 'coupon' ? 'bg-burgundy/10 text-burgundy dark:bg-burgundy-light/20 dark:text-burgundy-light' : 'bg-olive/10 text-olive dark:bg-olive/20 dark:text-olive-light'}`}>
                        {comm.type === 'coupon' ? <Ticket className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                        {comm.type === 'coupon' ? '서비스 쿠폰' : '문자 메시지'}
                      </span>
                      <span className="text-xs text-ink-light/40 dark:text-ink-dark/40">
                        {new Date(comm.date).toLocaleDateString('ko-KR')} {new Date(comm.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-ink-light/80 dark:text-ink-dark/80 text-sm font-medium">{comm.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Memo Modal */}
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
