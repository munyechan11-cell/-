import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore, formatPhoneNumber } from '../../store';
import { ArrowLeft, Sparkles, Loader2, Monitor, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';

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
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-primary/10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[45rem] h-[45rem] bg-gold/5 rounded-full translate-x-1/3 translate-y-1/3 blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full bg-white rounded-[2rem] sm:rounded-[3rem] shadow-premium border border-primary/5 p-8 sm:p-10 relative z-10"
      >
        <div className="flex justify-between items-center mb-10">
          <Link to="/" className="p-3 bg-surface-container rounded-xl text-primary/30 hover:text-primary transition-all active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-12 h-12 bg-gyeol-wood rounded-xl flex items-center justify-center text-white font-serif italic text-xl shadow-premium">결</div>
        </div>

        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3 opacity-30">
            <div className="w-6 h-px bg-primary" />
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">For Owner</p>
            <div className="w-6 h-px bg-primary" />
          </div>
          <h2 className="text-3xl font-serif font-black text-primary italic leading-none tracking-tight">
            {isLogin ? '사장님 로그인' : '신규 가맹 등록'}
          </h2>
          <p className="text-[10px] font-bold text-primary/40 tracking-widest mt-3 uppercase">매장 통합 거버넌스 시스템</p>
        </div>

        {/* View Mode Toggle */}
        <div className="w-full bg-surface-container p-1 rounded-2xl mb-8 flex">
          <button
            type="button"
            onClick={() => setOwnerViewMode('desktop')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${ownerViewMode === 'desktop' ? 'bg-white text-primary shadow-sm' : 'text-primary/40 hover:text-primary/70'}`}
          >
            <Monitor className="w-4 h-4" />
            <span className="text-[10px] font-black tracking-widest uppercase">데스크톱</span>
          </button>
          <button
            type="button"
            onClick={() => setOwnerViewMode('mobile')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${ownerViewMode === 'mobile' ? 'bg-white text-primary shadow-sm' : 'text-primary/40 hover:text-primary/70'}`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="text-[10px] font-black tracking-widest uppercase">모바일</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            className="input-gyeol"
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
                autoComplete="name"
                className="input-gyeol"
                placeholder="사장님의 성함"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <input
                type="text"
                className="input-gyeol"
                placeholder="매장 이름 (예: 커피 볶는 가을)"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                required
              />
            </>
          )}

          {error && <p className="text-[10px] font-black text-burgundy text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-heavy active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              : <span className="flex items-center justify-center gap-3"><Sparkles className="w-4 h-4 text-gold" />{isLogin ? '로그인' : '신규 가맹 등록'}</span>}
          </button>
        </form>

        <div className="relative py-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-primary/5" /></div>
          <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.5em] text-primary/20"><span className="bg-white px-4">or</span></div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            disabled={isLoading}
            className="w-full py-4 bg-white rounded-xl border border-primary/10 flex items-center justify-center gap-3 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin('kakao')}
            disabled={isLoading}
            className="w-full py-4 bg-[#FEE500] rounded-xl flex items-center justify-center gap-3 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="w-4 h-4 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[7px] text-[#FEE500] font-black">K</div>
            <span className="text-[10px] font-black text-[#3c1e1e] uppercase tracking-widest">Kakao</span>
          </button>
        </div>

        <div className="flex justify-center w-full pt-6">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] hover:text-gold transition-all"
          >
            {isLogin ? '신규 가맹점이신가요? 등록하기' : '기존 가맹점이신가요? 로그인'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
