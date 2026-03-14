import React, { useState } from 'react';
import { useStore, getCustomerTier, getEffectiveTier, getTierColor } from '../../store';
import { Users, LayoutGrid, ScanLine, Search, Send, X, MessageSquare, Ticket, History, Loader2, CheckSquare, Square } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OwnerCustomers() {
  const { users, visits, issueCoupon, recordCommunication, communications, currentUser, tierOverrides, setCustomerTier } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<string | null>(null);
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

  const filteredCustomers = customers.filter(c => 
    c.name.includes(searchTerm) || c.phone.includes(searchTerm)
  );

  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    
    const targets = isMultiSelectMode ? selectedCustomers : (selectedCustomer ? [selectedCustomer] : []);
    if (targets.length > 0 && content) {
      setIsSending(true);
      try {
        for (const targetId of targets) {
          if (sendType === 'coupon') {
            await issueCoupon(targetId, currentUser.id, '사장님 특별 서비스', content);
            await recordCommunication(targetId, currentUser.id, 'coupon', content);
          } else {
            // Simulate sending SMS
            await recordCommunication(targetId, currentUser.id, 'message', content);
          }
        }
        
        import('../../store').then(({ showToast }) => {
          if (sendType === 'message') {
            showToast(`[문자 발송 시뮬레이션]\n${targets.length}명에게 전송 완료\n내용: ${content}`, 'info');
          } else {
            showToast(`${targets.length}명에게 쿠폰 발급 완료`, 'success');
          }
        });

        setSelectedCustomer(null);
        setSelectedCustomers([]);
        setIsMultiSelectMode(false);
        setContent('');
        setSelectedPredefinedCoupon('');
      } catch (err) {
        console.error(err);
        import('../../store').then(({ showToast }) => showToast('발송 중 오류가 발생했습니다.', 'error'));
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

  return (
    <div className="min-h-full bg-transparent pb-20">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 border-b border-[#E7E0D7]">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tight">고객 관리</h1>
          <button
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setSelectedCustomers([]);
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              isMultiSelectMode ? 'bg-[#D84315] text-white' : 'bg-[#EFEBE9] text-[#5D4037] hover:bg-[#E7E0D7]'
            }`}
          >
            {isMultiSelectMode ? '취소' : '일괄 전송'}
          </button>
        </div>
        
        <div className="mt-6 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#A1887F] w-5 h-5" />
          <input 
            type="text" 
            placeholder="이름 또는 전화번호 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/80 text-[#2D1B15] placeholder-[#A1887F] rounded-2xl py-3 pl-12 pr-4 border border-[#E7E0D7] focus:border-[#4E342E] focus:ring-0 transition-colors shadow-sm"
          />
        </div>

        {isMultiSelectMode && (
          <div className="mt-4 flex justify-between items-center bg-white/80 p-3 rounded-xl border border-[#E7E0D7]">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center text-[#5D4037] font-bold text-sm"
            >
              {selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0 ? (
                <CheckSquare className="w-5 h-5 mr-2 text-[#D84315]" />
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
              className="px-4 py-2 bg-[#D84315] text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors flex items-center"
            >
              <Send className="w-4 h-4 mr-1.5" />
              선택 전송
            </button>
          </div>
        )}
      </div>

      {/* Customer List */}
      <div className="p-4 space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-[#795548]">
            검색 결과가 없습니다.
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const stats = getCustomerStats(customer.id);
            const isSelected = selectedCustomers.includes(customer.id);
            return (
              <div 
                key={customer.id} 
                className={`bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-sm border flex justify-between items-center transition-colors ${
                  isMultiSelectMode && isSelected ? 'border-[#D84315] bg-[#FFF3E0]/30' : 'border-[#E7E0D7]'
                }`}
                onClick={() => isMultiSelectMode && toggleCustomerSelection(customer.id)}
              >
                <div className="flex items-center flex-1">
                  {isMultiSelectMode && (
                    <div className="mr-4">
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-[#D84315]" />
                      ) : (
                        <Square className="w-6 h-6 text-[#A1887F]" />
                      )}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center mb-1">
                      <h3 className="font-bold text-[#2D1B15] text-lg mr-2">{customer.name}</h3>
                      <select
                        value={stats.isManualTier ? stats.tier : 'auto'}
                        onChange={(e) => setCustomerTier(customer.id, currentUser.id, e.target.value)}
                        className={`px-2 py-0.5 rounded-md text-xs font-bold border appearance-none cursor-pointer pr-5 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#D84315] ${getTierColor(stats.tier)}`}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
                        title="고객 등급 변경"
                      >
                        <option value="auto">자동 ({stats.autoTier})</option>
                        <option value="VIP">VIP</option>
                        <option value="다이아">다이아</option>
                        <option value="골드">골드</option>
                        <option value="실버">실버</option>
                        <option value="브론즈">브론즈</option>
                        <option value="일반">일반</option>
                      </select>
                    </div>
                    <p className="text-[#795548] text-sm mb-2">{customer.phone}</p>
                    <div className="flex flex-col space-y-1 text-xs text-[#A1887F]">
                      <div className="flex space-x-3">
                        <span>최근 30일: <strong className="text-[#5D4037]">{stats.recentVisits}회</strong></span>
                        <span>마지막 방문: <strong className="text-[#5D4037]">{stats.daysSinceLastVisit !== null ? `${stats.daysSinceLastVisit}일 전` : '없음'}</strong></span>
                      </div>
                      <div>
                        <span>월 평균 방문: <strong className="text-[#5D4037]">{stats.frequencyPerMonth}회</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {!isMultiSelectMode && (
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setHistoryCustomer(customer.id); }}
                      className="p-3 bg-transparent text-[#5D4037] rounded-xl hover:bg-[#EFEBE9] transition-colors"
                      title="기록 확인"
                    >
                      <History className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer.id); }}
                      className="p-3 bg-transparent text-[#5D4037] rounded-xl hover:bg-[#FFF3E0]/50 hover:text-[#D84315] transition-colors"
                      title="메시지/쿠폰 전송"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-[#E7E0D7] flex justify-around p-4 pb-safe z-40">
        <Link to="/owner" className="flex flex-col items-center text-[#A1887F] hover:text-[#2D1B15] transition-colors">
          <LayoutGrid className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">테이블</span>
        </Link>
        <Link to="/owner/customers" className="flex flex-col items-center text-[#2D1B15]">
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">고객관리</span>
        </Link>
        <Link to="/owner/scanner" className="flex flex-col items-center text-[#A1887F] hover:text-[#2D1B15] transition-colors">
          <ScanLine className="w-6 h-6 mb-1" />
          <span className="text-xs font-bold">스캐너</span>
        </Link>
      </div>

      {/* Send Modal */}
      {selectedCustomer && (isMultiSelectMode || activeCustomer) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white/90 backdrop-blur-sm w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-12 sm:pb-6 relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <button 
              onClick={() => {
                if (!isMultiSelectMode) setSelectedCustomer(null);
                else setSelectedCustomer(null); // Just close modal, keep selection
                setSelectedPredefinedCoupon('');
                setContent('');
              }}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-[#EFEBE9]"
            >
              <X className="w-5 h-5 text-[#5D4037]" />
            </button>

            <h2 className="text-xl font-black text-[#2D1B15] mb-2">
              {isMultiSelectMode ? `${selectedCustomers.length}명에게 일괄 전송` : `${activeCustomer?.name}님에게 보내기`}
            </h2>
            
            <div className="flex border-b border-[#E7E0D7] mb-6 mt-4">
              <button 
                className={`flex-1 py-3 font-bold text-sm transition-colors flex items-center justify-center ${sendType === 'coupon' ? 'text-[#D84315] border-b-2 border-[#D84315]' : 'text-[#A1887F] hover:text-[#5D4037]'}`}
                onClick={() => setSendType('coupon')}
              >
                <Ticket className="w-4 h-4 mr-2" />
                서비스 쿠폰
              </button>
              <button 
                className={`flex-1 py-3 font-bold text-sm transition-colors flex items-center justify-center ${sendType === 'message' ? 'text-[#D84315] border-b-2 border-[#D84315]' : 'text-[#A1887F] hover:text-[#5D4037]'}`}
                onClick={() => setSendType('message')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                문자 메시지
              </button>
            </div>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#4E342E] mb-2">
                  {sendType === 'coupon' ? '서비스 내용' : '메시지 내용'}
                </label>
                {sendType === 'coupon' ? (
                  <div className="space-y-3">
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
                      className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#D84315] focus:ring-0 transition-colors bg-white text-[#2D1B15]"
                      required
                    >
                      <option value="" disabled>서비스 선택</option>
                      {predefinedCoupons.map(coupon => (
                        <option key={coupon.id} value={coupon.id}>{coupon.title}</option>
                      ))}
                    </select>
                    
                    {selectedPredefinedCoupon === 'custom' && (
                      <input 
                        type="text" 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="예: 계란찜 1개 서비스"
                        className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#D84315] focus:ring-0 transition-colors"
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
                    className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#D84315] focus:ring-0 transition-colors resize-none"
                    required
                  />
                )}
              </div>

              <button 
                type="submit"
                disabled={isSending}
                className="w-full bg-[#D84315] hover:bg-[#BF360C] disabled:bg-[#D84315]/70 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white/90 backdrop-blur-sm w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-12 sm:pb-6 relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <button 
              onClick={() => setHistoryCustomer(null)}
              className="absolute top-4 right-4 p-2 bg-transparent rounded-full hover:bg-[#EFEBE9]"
            >
              <X className="w-5 h-5 text-[#5D4037]" />
            </button>

            <h2 className="text-xl font-black text-[#2D1B15] mb-6 flex items-center">
              <History className="w-6 h-6 mr-2 text-[#795548]" />
              {activeHistoryCustomer.name}님 전송 기록
            </h2>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {customerHistory.length === 0 ? (
                <div className="text-center py-8 text-[#795548]">
                  전송된 기록이 없습니다.
                </div>
              ) : (
                customerHistory.map(comm => (
                  <div key={comm.id} className="bg-[#F5F2EB]/50 p-4 rounded-2xl border border-[#E7E0D7]">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold flex items-center ${comm.type === 'coupon' ? 'bg-[#FFF3E0] text-[#D84315]' : 'bg-blue-100 text-blue-800'}`}>
                        {comm.type === 'coupon' ? <Ticket className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                        {comm.type === 'coupon' ? '서비스 쿠폰' : '문자 메시지'}
                      </span>
                      <span className="text-xs text-[#A1887F]">
                        {new Date(comm.date).toLocaleDateString('ko-KR')} {new Date(comm.date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#4E342E] text-sm font-medium">{comm.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
