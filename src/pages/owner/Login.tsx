import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Store, ArrowLeft, ShieldCheck, Heart, Sparkles } from 'lucide-react';

export default function OwnerLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login, currentUser } = useStore();

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
      await login('', '', 'owner', undefined, undefined, provider, false, undefined);
      navigate('/owner');
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
      // In Login mode, we pass empty name to the store's login function
      // In register mode, we need both phone and name
      if (!isLogin && !name) {
        throw new Error('이름을 입력해주세요.');
      }
      await login(phone, isLogin ? '' : name, 'owner', !isLogin ? restaurantName : undefined);
      navigate('/owner');
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bright flex items-center justify-center p-6 selection:bg-primary/20 relative overflow-hidden">
      {/* Decorative Circles */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full -ml-[300px] -mt-[300px] blur-3xl opacity-30"></div>
      
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-3xl border border-outline-variant/30 p-12 text-center relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <Link to="/" className="absolute top-8 left-8 p-3 hover:bg-surface-container rounded-full text-on-surface-variant/40 transition-colors"><ArrowLeft className="w-6 h-6" /></Link>
        <div className="w-24 h-24 rounded-[2rem] bg-primary flex items-center justify-center mx-auto mb-10 shadow-2xl rotate-3 scale-110"><Store className="w-12 h-12 text-white" /></div>
        
        <div className="mb-12">
           <h2 className="text-4xl font-serif font-black text-primary italic mb-2 tracking-tighter">결 사장님용</h2>
           <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em] font-sans">매장 통합 거버넌스 시스템</p>
        </div>

        <div className="space-y-10">
           {/* Direct Login Form (Prioritized) */}
           <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                 <input
                   type="tel"
                   className="w-full h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary shadow-inner"
                   placeholder="전화번호 (-) 없이 입력"
                   value={phone}
                   onChange={e => setPhone(e.target.value)}
                   required
                 />
                 {!isLogin && (
                    <>
                       <input
                         type="text"
                         className="w-full h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary shadow-inner animate-in slide-in-from-top-2"
                         placeholder="시장님의 본함 입력"
                         value={name}
                         onChange={e => setName(e.target.value)}
                         required
                       />
                       <input
                         type="text"
                         className="w-full h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-on-surface-variant/30 focus:ring-1 focus:ring-primary shadow-inner animate-in slide-in-from-top-4"
                         placeholder="매장 이름 (예: 커피 볶는 가을)"
                         value={restaurantName}
                         onChange={e => setRestaurantName(e.target.value)}
                         required
                       />
                    </>
                 )}
              </div>

              {error && <p className="text-[10px] font-bold text-burgundy animate-pulse">{error}</p>}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-5 bg-[#261c1a] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? '인증 중...' : (isLogin ? '전화번호로 로그인' : '신규 가맹 등록')}
              </button>
           </form>

           <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/10"></div></div>
              <div className="relative flex justify-center text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/20"><span className="bg-white px-4">소셜 계정으로 시작하기</span></div>
           </div>

           {/* Social Login Buttons (Moved Down) */}
           <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleOAuthLogin('google')} 
                className="w-full py-4 bg-white rounded-2xl border border-outline-variant/30 flex items-center justify-center gap-4 hover:shadow-lg transition-all group active:scale-[0.98]"
              >
                 <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                 <span className="text-[10px] font-black text-[#261c1a] uppercase tracking-widest">Google로 접속</span>
              </button>
              <button 
                onClick={() => handleOAuthLogin('kakao')} 
                className="w-full py-4 bg-[#FEE500] rounded-2xl flex items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98]"
              >
                 <div className="w-5 h-5 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[8px] text-[#FEE500] font-black">K</div>
                 <span className="text-[10px] font-black text-[#3c1e1e] uppercase tracking-widest">Kakao로 시작하기</span>
              </button>
           </div>

           <button 
             onClick={() => setIsLogin(!isLogin)}
             className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest hover:text-primary transition-colors"
           >
             {isLogin ? '신규 가맹점으로 등록하시겠습니까?' : '기존 가맹점 사장님이신가요?'}
           </button>
        </div>
      </div>
    </div>
  );
}
