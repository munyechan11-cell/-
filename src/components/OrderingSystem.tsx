import { useState, useMemo, useEffect } from 'react';
import { useStore, MenuItem, StoreOrder } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Plus, Minus, X, ChevronRight, 
  Utensils, Coffee, Beer, Pizza, Info, Clock, 
  Sparkles, CheckCircle2, CreditCard, Banknote, AlertCircle
} from 'lucide-react';

interface OrderingSystemProps {
  storeId: string;
  tableNumber: number;
}

export default function OrderingSystem({ storeId, tableNumber }: OrderingSystemProps) {
  const { menus, placeOrder, currentUser, users } = useStore();
  const owner = useMemo(() => users.find(u => u.id === storeId), [users, storeId]);
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderAmount, setLastOrderAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'prepay' | 'postpay'>('postpay');

  // Filter menus for the current store (only available ones)
  const storeMenus = useMemo(() => menus.filter(m => m.storeId === storeId && m.isAvailable !== false), [menus, storeId]);
  
  const categories = useMemo(() => {
    const cats = ['전체', ...new Set(storeMenus.map(m => m.category))];
    return cats;
  }, [storeMenus]);

  const filteredMenus = useMemo(() => {
    if (activeCategory === '전체') return storeMenus;
    return storeMenus.filter(m => m.category === activeCategory);
  }, [storeMenus, activeCategory]);

  // Check if store has payment configured
  const hasPaymentConfig = useMemo(() => !!owner?.storeConfig?.tossClientKey, [owner]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      if (existing) {
        return prev.map(p => p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(p => p.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.item.id === itemId) {
        const newQty = Math.max(1, p.quantity + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const totalAmount = cart.reduce((sum, p) => sum + (p.item.price * p.quantity), 0);
  const totalQuantity = cart.reduce((sum, p) => sum + p.quantity, 0);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || !currentUser) return;
    
    // Toss Payments 선결제 모드
    if (paymentMode === 'prepay' && hasPaymentConfig) {
      const clientKey = owner?.storeConfig?.tossClientKey;
      if (clientKey && (window as any).PaymentWidget) {
        try {
          const paymentWidget = (window as any).PaymentWidget(clientKey, currentUser.id);
          
          await paymentWidget.renderPaymentMethods('#payment-method', { value: totalAmount });
          await paymentWidget.renderAgreement('#agreement');

          // Show payment UI
          const paymentMethodEl = document.getElementById('payment-method');
          const agreementEl = document.getElementById('agreement');
          if (paymentMethodEl) paymentMethodEl.classList.remove('hidden');
          if (agreementEl) agreementEl.classList.remove('hidden');

          await paymentWidget.requestPayment({
            orderId: generateId(),
            orderName: cart.length === 1 ? cart[0].item.name : `${cart[0].item.name} 외 ${cart.length - 1}건`,
            customerName: currentUser.name,
            successUrl: `${window.location.origin}/customer/payment/success?storeId=${storeId}&table=${tableNumber}&cart=${encodeURIComponent(JSON.stringify(cart))}`,
            failUrl: `${window.location.origin}/customer/payment/fail`,
          });
          return;
        } catch (err) {
          console.error('Payment Error:', err);
          // Fall through to postpay
        }
      }
    }

    // 후불 모드 또는 결제 미설정 시
    setIsOrdering(true);
    try {
      await placeOrder({
        storeId,
        tableNumber,
        customerId: currentUser.id,
        items: cart.map(p => ({
          menuId: p.item.id,
          name: p.item.name,
          quantity: p.quantity,
          price: p.item.price
        })),
        totalAmount
      });
      setLastOrderAmount(totalAmount);
      setCart([]);
      setIsCartOpen(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gyeol-pattern/20">
      {/* Order Success Overlay */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-32 h-32 bg-white/10 rounded-[4rem] flex items-center justify-center mb-10"
            >
              <CheckCircle2 className="w-16 h-16 text-gold" />
            </motion.div>
            <h2 className="text-4xl font-serif font-black italic mb-4">주문 완료!</h2>
            <p className="text-sm opacity-60 font-bold uppercase tracking-widest">{tableNumber}번 테이블 | 사장님께 주문이 전달되었습니다</p>
            <p className="text-3xl font-serif font-black italic mt-8 text-gold">₩{lastOrderAmount.toLocaleString()}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-6 py-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-8 py-3 rounded-2xl whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all ${
              activeCategory === cat 
                ? 'bg-primary text-white shadow-premium scale-105' 
                : 'bg-white text-primary/40 hover:text-primary border border-primary/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="grid grid-cols-1 gap-6">
          {filteredMenus.map(item => (
            <motion.div 
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2.5rem] p-6 shadow-premium border border-primary/5 flex gap-6 items-center group active:scale-95 transition-all"
            >
              <div className="w-28 h-28 rounded-3xl overflow-hidden bg-primary/5 flex-shrink-0 shadow-inner">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary/20">
                    <Utensils className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                   <h4 className="text-xl font-black text-primary tracking-tight">{item.name}</h4>
                   <span className="text-xs font-black text-gold uppercase tracking-widest">{item.category}</span>
                </div>
                <p className="text-sm font-medium text-primary/40 line-clamp-2 leading-relaxed">{item.description || '이 메뉴에 대한 설명이 준비 중입니다.'}</p>
                <div className="flex justify-between items-center pt-2">
                   <p className="text-2xl font-serif font-black italic text-primary">₩{item.price.toLocaleString()}</p>
                   <button 
                     onClick={() => addToCart(item)}
                     className="bg-primary text-white p-4 rounded-2xl shadow-heavy hover:scale-105 transition-all active:scale-90"
                   >
                     <Plus className="w-6 h-6" />
                   </button>
                </div>
              </div>
            </motion.div>
          ))}
          
          {filteredMenus.length === 0 && (
             <div className="text-center py-20 space-y-4">
                <Utensils className="w-16 h-16 text-primary/10 mx-auto" />
                <p className="text-lg font-bold text-primary/20">등록된 메뉴가 없습니다.</p>
                <p className="text-sm text-primary/10">사장님이 메뉴를 등록하면 여기에 표시됩니다.</p>
             </div>
          )}
        </div>
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && !isCartOpen && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-10 left-6 right-6 z-50"
        >
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-primary text-white py-8 rounded-[3rem] shadow-heavy flex items-center justify-between px-10 border-t border-white/10 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gold/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
            <div className="relative z-10 flex items-center gap-6">
               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
               </div>
               <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">장바구니</p>
                  <p className="text-2xl font-serif font-black italic">{totalQuantity}개 항목</p>
               </div>
            </div>
            <p className="relative z-10 text-2xl font-serif font-black italic">₩{totalAmount.toLocaleString()}</p>
          </button>
        </motion.div>
      )}

      {/* Cart Sidebar/Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-primary/40 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col rounded-l-[4rem]"
            >
              <div className="p-10 flex justify-between items-center border-b border-primary/5">
                 <div className="space-y-1">
                    <h3 className="text-3xl font-serif font-black text-primary italic">나의 장바구니</h3>
                    <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">{tableNumber}번 테이블 주문서</p>
                 </div>
                 <button 
                   onClick={() => setIsCartOpen(false)}
                   className="p-4 bg-primary/5 rounded-2xl text-primary hover:bg-primary hover:text-white transition-all"
                 >
                   <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
                 {cart.map(p => (
                   <div key={p.item.id} className="flex gap-6 items-center group">
                      <div className="w-20 h-20 bg-primary/5 rounded-2xl flex items-center justify-center text-primary/20 overflow-hidden">
                        {p.item.imageUrl ? <img src={p.item.imageUrl} className="w-full h-full object-cover" /> : <Pizza />}
                      </div>
                      <div className="flex-1 space-y-1">
                         <h5 className="text-lg font-black text-primary tracking-tight">{p.item.name}</h5>
                         <p className="text-sm font-bold text-gold italic">₩{(p.item.price * p.quantity).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-primary/5 rounded-2xl p-2 px-3">
                         <button onClick={() => updateQuantity(p.item.id, -1)} className="p-1.5 text-primary hover:bg-white rounded-lg transition-all"><Minus className="w-4 h-4" /></button>
                         <span className="text-lg font-black font-serif text-primary w-6 text-center">{p.quantity}</span>
                         <button onClick={() => updateQuantity(p.item.id, 1)} className="p-1.5 text-primary hover:bg-white rounded-lg transition-all"><Plus className="w-4 h-4" /></button>
                      </div>
                      <button onClick={() => removeFromCart(p.item.id)} className="text-primary/20 hover:text-burgundy transition-all"><X className="w-5 h-5" /></button>
                   </div>
                 ))}
              </div>

              <div className="p-10 bg-primary rounded-tl-[4rem] space-y-8">
                 {/* Payment Mode Selector */}
                 {hasPaymentConfig && (
                   <div className="flex gap-3">
                     <button 
                       onClick={() => setPaymentMode('postpay')}
                       className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                         paymentMode === 'postpay' ? 'bg-white text-primary' : 'bg-white/10 text-white/50'
                       }`}
                     >
                       <Banknote className="w-4 h-4" /> 후불 결제
                     </button>
                     <button 
                       onClick={() => setPaymentMode('prepay')}
                       className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                         paymentMode === 'prepay' ? 'bg-gold text-primary' : 'bg-white/10 text-white/50'
                       }`}
                     >
                       <CreditCard className="w-4 h-4" /> 선결제
                     </button>
                   </div>
                 )}

                 <div className="flex justify-between items-center text-white">
                    <span className="text-sm font-bold uppercase tracking-widest opacity-40">총 합계액</span>
                    <span className="text-4xl font-serif font-black italic">₩{totalAmount.toLocaleString()}</span>
                 </div>

                 {/* Payment Widget Anchors */}
                 <div id="payment-method" className="bg-white rounded-2xl overflow-hidden mb-4 hidden"></div>
                 <div id="agreement" className="bg-white rounded-2xl overflow-hidden mb-4 hidden"></div>

                 <button 
                   onClick={handlePlaceOrder}
                   disabled={isOrdering || cart.length === 0}
                   className="w-full bg-gold text-primary text-xl font-black py-8 rounded-[2.5rem] shadow-heavy flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                 >
                   {isOrdering ? (
                     <Sparkles className="w-6 h-6 animate-spin" />
                   ) : (
                     <>
                        {paymentMode === 'prepay' && hasPaymentConfig ? (
                          <><CreditCard className="w-6 h-6" /> 결제하기</>
                        ) : (
                          <><CheckCircle2 className="w-6 h-6" /> 주문하기 (후불)</>
                        )}
                     </>
                   )}
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
