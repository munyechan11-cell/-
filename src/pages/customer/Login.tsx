import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useStore, formatPhoneNumber } from '../../store';
import { QrCode, ArrowLeft, Heart, Sparkles, UserCircle, Phone, Loader2 } from 'lucide-react';

export default function CustomerLogin() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isPohangResident, setIsPohangResident] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  const { login, users, currentUser, recordVisit } = useStore();
  const currentStore = users.find(u => u.id === storeId && u.role === 'owner');

  useEffect(() => {
    if (currentUser && currentUser.role === 'customer') {
      navigate(`/customer/store/${storeId}`);
    }
  }, [currentUser, storeId, navigate]);

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
      const user = await login('', '', 'customer', undefined, storeId, provider);
      if (tableNumber && storeId) {
        await recordVisit(user.id, parseInt(tableNumber), storeId);
      }
      navigate(`/customer/store/${storeId}`);
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (!isLogin) {
         if (!name) throw new Error('성함을 입력해주세요.');
         if (!gender) throw new Error('성별을 선택해주세요.');
      }
      // For existing customers (isLogin=true), only phone is required
      const user = await login(phone, isLogin ? '' : name, 'customer', undefined, storeId, undefined, isPohangResident, gender || undefined);
      if (tableNumber && storeId) {
        await recordVisit(user.id, parseInt(tableNumber), storeId);
      }
      navigate(`/customer/store/${storeId}`);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full -ml-48 -mt-48 blur-3xl opacity-30"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full -mr-48 -mb-48 blur-3xl opacity-20"></div>

        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-3xl border border-outline-variant/30 p-10 text-center relative z-10 animate-in fade-in zoom-in-95 duration-700">
            <Link to="/" className="absolute top-8 left-8 p-3 hover:bg-surface-container rounded-full text-on-surface-variant/40"><ArrowLeft className="w-6 h-6" /></Link>
            <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner"><QrCode className="w-10 h-10 text-primary" strokeWidth={1.5} /></div>
            
            <div className="mb-10">
               <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] mb-2 font-sans">{currentStore?.restaurantName || '매장'} 방문 기록</p>
               <h2 className="text-3xl font-serif font-black text-primary italic leading-tight tracking-tighter">단골 장부 등록</h2>
            </div>
            
            <div className="space-y-8">
                {/* Direct Login Form (Prioritized) */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3">
                       <input
                         type="tel"
                         className="w-full h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary shadow-inner"
                         placeholder="전화번호 (010-xxxx-xxxx)"
                         value={phone}
                         onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                         maxLength={13}
                         required
                       />
                       
                       {!isLogin && (
                          <div className="space-y-4 animate-in slide-in-from-top-2">
                             <input
                               type="text"
                               className="w-full h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary shadow-inner"
                               placeholder="성함 입력"
                               value={name}
                               onChange={e => setName(e.target.value)}
                               required
                             />
                             <div className="flex gap-2">
                                <button type="button" onClick={() => setGender('male')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-xs transition-all ${gender === 'male' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/30'}`}>남성</button>
                                <button type="button" onClick={() => setGender('female')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-xs transition-all ${gender === 'female' ? 'bg-primary text-white border-primary' : 'bg-white text-on-surface-variant border-outline-variant/30'}`}>여성</button>
                             </div>
                             <label className="flex items-center gap-3 px-4 py-3 bg-surface-container rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors">
                                <input type="checkbox" checked={isPohangResident} onChange={e => setIsPohangResident(e.target.checked)} className="w-5 h-5 rounded-lg border-primary/20 text-primary focus:ring-primary" />
                                <span className="text-[11px] font-bold text-primary/60">포항 거주자이신가요?</span>
                             </label>
                          </div>
                       )}
                    </div>
                    
                    {error && <p className="text-[10px] font-bold text-burgundy animate-pulse">{error}</p>}

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full py-5 bg-[#261c1a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isLoading ? '인증 중...' : (isLogin ? '전화번호로 로그인' : '단골 장부 등록')}
                    </button>
                </form>

                <div className="relative py-2">
                   <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/10"></div></div>
                   <div className="relative flex justify-center text-[7px] font-bold uppercase tracking-widest text-on-surface-variant/20"><span className="bg-white px-4">또는 소셜 계정으로 시작</span></div>
                </div>

                {/* Social Login (Moved Down) */}
                <div className="flex flex-col gap-3">
                   <button 
                    onClick={() => handleOAuthLogin('google')} 
                    className="w-full py-4 bg-white rounded-2xl border border-outline-variant/30 flex items-center justify-center gap-4 hover:shadow-lg transition-all active:scale-[0.98]"
                   >
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      <span className="text-[10px] font-black text-[#261c1a] uppercase tracking-widest">Google 로그인</span>
                   </button>
                   <button 
                    onClick={() => handleOAuthLogin('kakao')} 
                    className="w-full py-4 bg-[#FEE500] rounded-2xl flex items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98]"
                   >
                      <div className="w-5 h-5 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[8px] text-[#FEE500] font-black">K</div>
                      <span className="text-[10px] font-black text-[#3c1e1e] uppercase tracking-widest">Kakao 로그인</span>
                   </button>
                </div>

                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest hover:text-primary transition-colors"
                >
                  {isLogin ? '본 매장에 처음 방문하셨나요? 등록하기' : '이미 단골이신가요? 전화번호로 로그인'}
                </button>
            </div>
        </div>
    </div>
  );
}
