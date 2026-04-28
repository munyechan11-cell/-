import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore, formatPhoneNumber } from '../../store';
import { Store, ArrowLeft, ShieldCheck, Heart, Sparkles, Loader2, Monitor, Smartphone } from 'lucide-react';

export default function OwnerLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login, currentUser, ownerViewMode, setOwnerViewMode } = useStore();

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
      // Pass the current state values to the login function for social registration
      await login(phone, name, 'owner', !isLogin ? restaurantName : undefined, undefined, provider);
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
    <div className="min-h-screen bg-surface-bright bg-gyeol-pattern flex flex-col items-center justify-center p-6 selection:bg-primary/20 relative overflow-hidden">
      
      <div className="w-full max-w-sm flex flex-col items-center text-center relative z-10 animate-in fade-in zoom-in-95 duration-700 mt-[-5vh]">
        <Link to="/" className="absolute -top-4 -left-2 p-3 hover:bg-white/50 rounded-full text-primary/40 transition-colors"><ArrowLeft className="w-6 h-6" /></Link>
        
        <div className="w-20 h-20 rounded-[1.5rem] bg-primary flex items-center justify-center mx-auto mb-8 shadow-xl">
           <Store className="w-10 h-10 text-white" />
        </div>
        
        <div className="mb-10">
           <h2 className="text-[2.5rem] font-serif font-black text-primary mb-3 tracking-tight">결 사장님용</h2>
           <p className="text-[11px] font-medium text-primary/60 tracking-widest font-sans">매장 통합 거버넌스 시스템</p>
        </div>

        <div className="w-full bg-white/80 backdrop-blur-md p-1 rounded-[1.5rem] mb-10 flex border border-primary/5 shadow-sm">
           <button 
             onClick={() => setOwnerViewMode('desktop')}
             className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all ${ownerViewMode === 'desktop' ? 'bg-white text-primary shadow-md' : 'text-primary/40 hover:text-primary/80'}`}
           >
              <Monitor className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-widest">데스크톱</span>
           </button>
           <button 
             onClick={() => setOwnerViewMode('mobile')}
             className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all ${ownerViewMode === 'mobile' ? 'bg-white text-primary shadow-md' : 'text-primary/40 hover:text-primary/80'}`}
           >
              <Smartphone className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-widest">모바일</span>
           </button>
        </div>

        <div className="w-full space-y-8">
           <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                 <input
                   type="tel"
                   className="w-full h-[3.5rem] bg-white border border-primary/10 rounded-[1.5rem] px-6 font-bold text-primary placeholder:text-primary/30 focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
                   placeholder="전화번호 (010-xxxx-xxxx)"
                   value={phone}
                   onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                   maxLength={13}
                   required
                 />
                 {!isLogin && (
                    <>
                       <input
                         type="text"
                         className="w-full h-[3.5rem] bg-white border border-primary/10 rounded-[1.5rem] px-6 font-bold text-primary placeholder:text-primary/30 focus:ring-2 focus:ring-primary/20 shadow-sm transition-all animate-in slide-in-from-top-2"
                         placeholder="사장님의 성함 입력"
                         value={name}
                         onChange={e => setName(e.target.value)}
                         required
                       />
                       <input
                         type="text"
                         className="w-full h-[3.5rem] bg-white border border-primary/10 rounded-[1.5rem] px-6 font-bold text-primary placeholder:text-primary/30 focus:ring-2 focus:ring-primary/20 shadow-sm transition-all animate-in slide-in-from-top-4"
                         placeholder="매장 이름 (예: 커피 볶는 가을)"
                         value={restaurantName}
                         onChange={e => setRestaurantName(e.target.value)}
                         required
                       />
                    </>
                 )}
              </div>

              {error && <p className="text-[10px] font-bold text-primary/80 animate-pulse">{error}</p>}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-[3.5rem] bg-primary text-white rounded-[1.5rem] font-bold text-[13px] tracking-wide shadow-xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? '인증 중...' : (isLogin ? '전화번호로 로그인' : '신규 가맹 등록')}
              </button>
           </form>

           <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => handleOAuthLogin('google')} 
                className="flex-1 h-[3.5rem] bg-white rounded-[1.5rem] border border-primary/10 flex items-center justify-center gap-2 hover:shadow-md transition-all active:scale-[0.98]"
              >
                 <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                 <span className="text-[11px] font-bold text-[#3c4043] tracking-wide">GOOGLE로 접속</span>
              </button>
              <button 
                onClick={() => handleOAuthLogin('kakao')} 
                className="flex-1 h-[3.5rem] bg-[#FEE500] rounded-[1.5rem] flex items-center justify-center gap-2 hover:shadow-md transition-all active:scale-[0.98]"
              >
                 <div className="w-4 h-4 bg-[#000000] rounded-full flex items-center justify-center text-[8px] text-[#FEE500] font-black">K</div>
                 <span className="text-[11px] font-bold text-[#000000] tracking-wide">KAKAO로 시작하기</span>
              </button>
           </div>

           <button 
             onClick={() => setIsLogin(!isLogin)}
             className="text-[11px] font-bold text-primary/40 underline underline-offset-4 hover:text-primary transition-colors pt-4"
           >
             {isLogin ? '신규 가맹점으로 등록하시겠습니까?' : '기존 가맹점 사장님이신가요?'}
           </button>
        </div>
      </div>
    </div>
  );
}
