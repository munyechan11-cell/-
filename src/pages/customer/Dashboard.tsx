import { useEffect, useState } from 'react';
import { useStore, getEffectiveTier, getTierColor, getNextTierVisits, getTierCustomName } from '../../store';
import { 
  LogOut, Ticket, Award, Calendar, X, ArrowLeft, 
  LogOut as LeaveIcon, MessageSquare, Bell, Edit3, 
  Send, Loader2, Star, ShieldCheck, Heart, 
  TrendingUp, Clock, MapPin, Search, Filter,
  ChevronRight, Activity, Zap, Store as StoreIcon,
  ArrowUpRight
} from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import MemoModal, { formatMemoDisplay } from '../../components/MemoModal';

export default function CustomerDashboard() {
  const { currentUser, visits, coupons, users, tables, logout, leaveTable, communications, tierOverrides, requestCouponUse, cancelCouponRequest, updateUserMemo, recordCommunication } = useStore();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null);
  const [cancelingCoupon, setCancelingCoupon] = useState<string | null>(null);
  const [editingMemo, setEditingMemo] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (currentUser && storeId && currentUser.storeId !== storeId) {
      logout();
      navigate(`/customer/store/${storeId}/login`);
    }
  }, [currentUser, storeId, logout, navigate]);

  if (!currentUser || currentUser.storeId !== storeId) return null;

  const owner = users.find(u => u.id === storeId && u.role === 'owner');
  if (!owner) {
    return (
      <div className="min-h-screen bg-surface-bright flex items-center justify-center p-6 hanji-texture relative overflow-hidden">
        <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
        <div className="max-w-md w-full bg-white rounded-[3.5rem] shadow-3xl border border-primary/5 p-12 text-center relative z-10">
          <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Registry Not Found</p>
          <Link to="/scan" className="text-burgundy font-black uppercase tracking-widest text-[10px] hover:underline underline-offset-8">Return to Cipher Scanner</Link>
        </div>
      </div>
    );
  }

  const restaurantName = owner.restaurantName || '단골 매장';

  const myVisits = visits.filter(v => v.customerId === currentUser.id && v.storeId === storeId);
  const myCoupons = coupons.filter(c => c.customerId === currentUser.id && c.storeId === storeId && (c.status === 'available' || c.status === 'pending'));
  const myCommunications = communications.filter(c => c.customerId === currentUser.id && c.storeId === storeId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const currentTable = tables.find(t => t.currentCustomerId === currentUser.id && t.storeId === storeId);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentVisits = myVisits.filter(v => new Date(v.date) >= thirtyDaysAgo);
  const uniqueVisitDays = new Set(recentVisits.map(v => new Date(v.date).toDateString())).size;
  const recentVisitsCount = uniqueVisitDays;
  
  const override = tierOverrides.find(t => t.customerId === currentUser.id && t.storeId === storeId);
  const currentTier = getEffectiveTier(recentVisitsCount, override?.tier);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLeaveStore = () => {
    if (currentTable && storeId) {
      leaveTable(currentTable.number, storeId);
      navigate('/scan');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await recordCommunication(currentUser.id, storeId!, 'message', messageContent.trim(), 'customer');
      setMessageContent('');
      setSendingMessage(false);
      import('../../store').then(({ showToast }) => showToast('Cypher transmitted to the Atelier owner.', 'success')).catch(console.error);
    } catch (err) {
      console.error(err);
      import('../../store').then(({ showToast }) => showToast('Transmission failed.', 'error')).catch(console.error);
    } finally {
      setIsSending(false);
    }
  };

  const activeCoupon = myCoupons.find(c => c.id === selectedCoupon);
  const activeCancelingCoupon = myCoupons.find(c => c.id === cancelingCoupon);

  return (
    <div className="min-h-screen bg-surface-bright pb-32 max-w-lg mx-auto hanji-texture relative overflow-hidden">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
      
      {/* Header Profile Section */}
      <div className="bg-white/80 backdrop-blur-xl p-8 pt-12 border-b border-primary/5 sticky top-0 z-40 animate-in slide-in-from-top-12 duration-700">
        <div className="flex justify-between items-center mb-10 relative">
          <Link to="/scan" className="p-3 hover:bg-primary/5 rounded-2xl text-primary/30 hover:text-primary transition-all">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="text-center">
             <h1 className="text-8xl font-serif font-black text-primary leading-none tracking-tighter italic select-none">결</h1>
             <p className="text-[8px] font-black text-primary/30 uppercase tracking-[0.4em] mt-2 italic">{restaurantName}</p>
          </div>
          <button onClick={handleLogout} className="p-3 hover:bg-primary/5 rounded-2xl text-primary/30 hover:text-primary transition-all">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
             <div className="absolute -inset-2 bg-primary/5 rounded-full blur-xl animate-pulse"></div>
             <div className="w-24 h-24 rounded-[2.5rem] bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3 transition-transform duration-700 hover:rotate-0">
                <span className="text-3xl font-serif font-black text-white italic">{currentUser.name.charAt(0)}</span>
             </div>
             <button 
                onClick={() => setSendingMessage(true)}
                className="absolute -bottom-2 -right-2 p-3 bg-burgundy text-white rounded-2xl shadow-xl shadow-burgundy/20 hover:scale-110 active:scale-95 transition-all border-4 border-white"
              >
                <Send className="w-4 h-4" />
              </button>
          </div>
          
          <div className="text-center w-full">
            <h2 className="text-3xl font-serif font-black text-primary italic tracking-tight">{currentUser.name}</h2>
            <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em] mt-1">Honored Citizen</p>
            
            <div className="mt-8 bg-surface-bright rounded-[2.5rem] p-6 border border-primary/5 relative group overflow-hidden">
               <div className="absolute -inset-0 bg-primary/[0.01] opacity-0 group-hover:opacity-100 transition-opacity"></div>
               <div className="flex items-center justify-between relative z-10">
                  <div className="flex-1 text-left px-2">
                    <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest mb-1">Heritage Memo</p>
                    <p className="text-xs text-primary/70 font-serif italic serif leading-relaxed italic">
                      {currentUser.memo ? formatMemoDisplay(currentUser.memo) : "Awaiting your first inscription..."}
                    </p>
                  </div>
                  <button 
                    onClick={() => setEditingMemo(true)}
                    className="p-3 bg-white border border-primary/5 text-primary/30 hover:text-primary rounded-xl hover:shadow-md transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
               </div>
            </div>

            {currentTable && (
              <div className="flex items-center justify-center space-x-3 mt-8">
                <span className="text-[9px] font-black text-burgundy bg-burgundy/5 px-6 py-2 rounded-full border border-burgundy/10 uppercase tracking-widest">
                  Assigned Table {currentTable.number}
                </span>
                <button 
                  onClick={handleLeaveStore}
                  className="p-2.5 text-primary/30 hover:text-burgundy transition-colors"
                >
                  <LeaveIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-12">
          <div className="text-center p-4 bg-primary/[0.02] rounded-3xl border border-primary/5 group hover:bg-primary/[0.04] transition-all">
            <p className="text-2xl font-serif font-black text-primary group-hover:scale-110 transition-transform">{recentVisitsCount}</p>
            <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest mt-1">Visits</p>
          </div>
          <div className="text-center p-4 bg-primary/[0.02] rounded-3xl border border-primary/5 group hover:bg-primary/[0.04] transition-all">
            <p className="text-2xl font-serif font-black text-primary group-hover:scale-110 transition-transform">{myCoupons.length}</p>
            <p className="text-[8px] font-black text-primary/20 uppercase tracking-widest mt-1">Ciphers</p>
          </div>
          <div className="text-center p-4 bg-burgundy/[0.02] rounded-3xl border border-burgundy/5 group hover:bg-burgundy/[0.04] transition-all">
            <p className="text-2xl font-serif font-black text-burgundy group-hover:scale-110 transition-transform truncate px-1">
              {getTierCustomName(currentTier, owner?.tierNames)}
            </p>
            <p className="text-[8px] font-black text-burgundy/20 uppercase tracking-widest mt-1">Tier</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 space-y-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
        
        {/* Lineage Progression */}
        <div className="bg-white rounded-[3rem] p-10 shadow-sm border border-primary/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
             <Activity className="w-32 h-32 text-primary" strokeWidth={1} />
          </div>
          
          <div className="flex justify-between items-center mb-8 relative z-10">
            <div>
               <h3 className="text-xl font-serif font-black text-primary tracking-tight italic flex items-center">
                 <span className="w-2 h-2 bg-burgundy rounded-full mr-3 animate-pulse"></span>
                 Ascension
               </h3>
               <p className="text-[8px] font-black text-primary/30 uppercase tracking-[0.2em] mt-1">Lineage Progression</p>
            </div>
            <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-lg ${getTierColor(currentTier)}`}>
              {getTierCustomName(currentTier, owner?.tierNames)}
            </span>
          </div>
          
          <div className="relative z-10">
            {override ? (
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/5 text-center">
                 <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest leading-relaxed">
                   Grandmaster's Decree<br/><span className="text-primary/20 italic font-serif serif">Universal Tier Manifested</span>
                 </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">30-Day Devotion</p>
                  <p className="text-2xl font-serif font-black text-primary">{recentVisitsCount} <span className="text-[10px] font-medium text-primary/20 uppercase">Units</span></p>
                </div>
                <div className="w-full bg-primary/5 rounded-full h-4 overflow-hidden p-1 border border-primary/5 shadow-inner relative">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-1000 ease-out shadow-lg shadow-primary/20 relative" 
                    style={{ 
                      width: recentVisitsCount >= 12
                        ? '100%'
                        : `${Math.min(((recentVisitsCount % (recentVisitsCount + getNextTierVisits(recentVisitsCount))) / (recentVisitsCount + getNextTierVisits(recentVisitsCount))) * 100, 100)}%`
                    }}
                  >
                     <div className="absolute inset-0 lattice-overlay opacity-10"></div>
                  </div>
                </div>
                <p className="text-[9px] font-black text-primary/30 uppercase tracking-widest text-right italic font-serif serif">
                  {recentVisitsCount >= 12 
                    ? '🏆 Zenith of Lineage Attained'
                    : `Next Ascension in ${getNextTierVisits(recentVisitsCount)} Devotions`
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ciphers (Coupons) */}
        <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
             <h3 className="text-xl font-serif font-black text-primary tracking-tight italic">Heritage Ciphers</h3>
             <Ticket className="w-5 h-5 text-burgundy opacity-20" />
          </div>
          
          {myCoupons.length === 0 ? (
            <div className="bg-white rounded-[3rem] p-12 text-center shadow-sm border border-primary/5 group hover:border-primary/10 transition-all">
              <div className="w-16 h-16 bg-primary/[0.02] rounded-full flex items-center justify-center mx-auto mb-6 opacity-20 group-hover:scale-110 transition-transform">
                <Ticket className="w-8 h-8 text-primary" strokeWidth={1} />
              </div>
              <p className="text-[9px] font-black text-primary/20 uppercase tracking-[0.3em] leading-relaxed">No Ciphers in Archive</p>
              <p className="text-xs text-primary/40 font-serif italic serif mt-4 px-8">Deepen your devotion at the atelier to unlock heritage rewards.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myCoupons.map((coupon, index) => (
                <button
                  key={coupon.id}
                  onClick={() => {
                    if (coupon.status === 'available') setSelectedCoupon(coupon.id);
                    else if (coupon.status === 'pending') setCancelingCoupon(coupon.id);
                  }}
                  className={`w-full group relative bg-white rounded-[2.5rem] p-8 shadow-sm border transition-all duration-500 overflow-hidden text-left ${coupon.status === 'pending' ? 'bg-burgundy/5 border-burgundy/10' : 'border-primary/5 hover:border-primary/20 hover:shadow-2xl'}`}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                     <Award className="w-24 h-24 text-primary" />
                  </div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-4 pr-12">
                      <span className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm ${coupon.status === 'pending' ? 'bg-white text-burgundy' : 'bg-primary text-white'}`}>
                        {coupon.status === 'pending' ? 'PENDING APPROVAL' : 'LEGACY CIPHER'}
                      </span>
                      <h4 className="text-xl font-serif font-black text-primary tracking-tight italic group-hover:translate-x-1 transition-transform">{coupon.description}</h4>
                    </div>
                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${coupon.status === 'pending' ? 'bg-burgundy/10 text-burgundy' : 'bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white'}`}>
                       {coupon.status === 'pending' ? <X className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Communication Ledger */}
        {myCommunications.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
             <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-serif font-black text-primary tracking-tight italic">Governance Archive</h3>
                <MessageSquare className="w-5 h-5 text-primary opacity-20" />
             </div>
             <div className="space-y-4">
                {myCommunications.slice(0, 3).map((comm, index) => (
                  <div key={comm.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-primary/5 group hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${comm.type === 'coupon' ? 'bg-burgundy/10 text-burgundy' : 'bg-primary/10 text-primary'}`}>
                        {comm.type === 'coupon' ? 'CIPHER' : 'DECREE'}
                      </span>
                      <span className="text-[8px] font-black text-primary/20 uppercase tracking-widest">
                        {new Date(comm.date).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-xs font-serif italic text-primary/70 serif leading-relaxed italic">{comm.content}</p>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Ciphers Modal */}
      {selectedCoupon && activeCoupon && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl flex items-center justify-center p-8 z-50 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3.5rem] p-12 max-w-sm w-full text-center relative shadow-3xl border border-primary/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            
            <button 
              onClick={() => setSelectedCoupon(null)}
              className="absolute top-8 right-8 p-3 hover:bg-primary/5 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6 text-primary/30" />
            </button>
            
            <div className="w-20 h-20 bg-burgundy rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-burgundy/20 rotate-6 transition-transform hover:rotate-0">
              <Ticket className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-3xl font-serif font-black text-primary mb-2 italic tracking-tighter">Honorable Intent</h3>
            <p className="text-primary/40 text-[9px] font-black uppercase tracking-[0.3em] mb-12">Universal Reward Activation</p>
            
            <div className="bg-surface-bright p-8 rounded-[2rem] border border-primary/5 mb-12">
               <p className="text-xl font-serif font-black text-burgundy italic mb-2 tracking-tight">"{activeCoupon.description}"</p>
               <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest leading-relaxed">
                 By activating this cipher, the Master of the Atelier will be notified of your request.
               </p>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedCoupon(null)}
                className="flex-1 py-4 text-[9px] font-black uppercase tracking-widest text-primary/30 hover:text-primary transition-colors"
              >
                Abort
              </button>
              <button
                onClick={() => {
                  if (currentTable) {
                    requestCouponUse(activeCoupon.id, currentTable.number);
                    setSelectedCoupon(null);
                  } else {
                    setSelectedCoupon(null);
                    import('../../store').then(({ showToast }) => showToast('Protocol requires table assignment.', 'error')).catch(console.error);
                  }
                }}
                className="flex-[2] py-5 bg-burgundy text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-burgundy/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
              >
                Declare Use
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abort Ritual Modal */}
      {cancelingCoupon && activeCancelingCoupon && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl flex items-center justify-center p-8 z-50 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3.5rem] p-12 max-w-sm w-full text-center relative shadow-3xl border border-primary/10 overflow-hidden">
            <button 
              onClick={() => setCancelingCoupon(null)}
              className="absolute top-8 right-8 p-3 hover:bg-primary/5 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6 text-primary/30" />
            </button>
            
            <h3 className="text-3xl font-serif font-black text-primary mb-2 italic tracking-tighter">Retract Cypher</h3>
            <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mb-12 italic">Pending Protocol Cancellation</p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setCancelingCoupon(null)}
                className="flex-1 py-4 text-[9px] font-black uppercase tracking-widest text-primary/30 hover:text-primary transition-colors"
              >
                Preserve
              </button>
              <button
                onClick={() => {
                  cancelCouponRequest(cancelingCoupon);
                  setCancelingCoupon(null);
                }}
                className="flex-[2] py-5 bg-burgundy text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-burgundy/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
              >
                Abort Ritual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decree Transmission Modal */}
      {sendingMessage && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-xl flex items-end sm:items-center justify-center z-[100] p-0 sm:p-8 animate-in fade-in duration-500">
          <div className="bg-white w-full sm:max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-10 pb-12 sm:pb-10 relative shadow-3xl border border-primary/10 overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
             
             <button 
              onClick={() => {
                setSendingMessage(false);
                setMessageContent('');
              }}
              className="absolute top-8 right-8 p-3 hover:bg-primary/5 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6 text-primary/30" />
            </button>

            <h2 className="text-3xl font-serif font-black text-primary mb-2 italic tracking-tighter">Transmit decree</h2>
            <p className="text-primary/40 text-[9px] font-black uppercase tracking-[0.3em] mb-10">Direct link to the Atelier Master</p>
            
            <form onSubmit={handleSendMessage} className="space-y-8">
              <textarea 
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="ENGRAVE SCRIPT HERE..."
                rows={4}
                className="w-full bg-primary/[0.02] border border-primary/5 rounded-[2rem] p-8 text-[10px] font-black uppercase tracking-widest text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner focus:bg-white resize-none"
                required
                autoFocus
              />

              <button 
                type="submit"
                disabled={isSending || !messageContent.trim()}
                className="w-full bg-burgundy hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 text-white font-black py-6 rounded-[2rem] transition-all shadow-2xl shadow-burgundy/20 flex items-center justify-center space-x-3 text-[10px] uppercase tracking-widest"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSending ? 'Transmitting...' : 'Send Decree'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Persistence Modal */}
      <MemoModal
        isOpen={editingMemo}
        onClose={() => setEditingMemo(false)}
        initialMemo={currentUser.memo || ''}
        onSave={(memo) => {
          updateUserMemo(currentUser.id, storeId, memo);
        }}
      />
    </div>
  );
}
