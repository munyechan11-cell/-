import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { 
  UserCircle, ArrowLeft, Loader2, Phone, 
  Sparkles, ShieldCheck, Heart, Star, Award,
  ChevronRight, LayoutGrid, Zap, Store as StoreIcon
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithCustomToken } from 'firebase/auth';

export const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/[^\d]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export default function CustomerLogin() {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

  const [phone, setPhone] = useState(() => sessionStorage.getItem('customerLogin_phone') || '');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [isPohangResident, setIsPohangResident] = useState<boolean | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [pendingOAuthUser, setPendingOAuthUser] = useState<{ uid: string, provider: string, displayName: string | null } | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, users, currentUser, recordVisit, issueCoupon } = useStore();
  const processedRef = useRef(false);

  const store = storeId ? users.find(u => u.id === storeId && u.role === 'owner') : null;

  useEffect(() => {
    if (processedRef.current) return;

    const userExists = currentUser && users.some(u => u.id === currentUser.id);

    if (currentUser?.role === 'customer' && userExists) {
      if (storeId && currentUser.storeId === storeId) {
        processedRef.current = true;
        if (tableNumber) {
          recordVisit(currentUser.id, parseInt(tableNumber), storeId);
        }
        navigate(`/customer/store/${storeId}`);
      } else if (!storeId) {
        processedRef.current = true;
        navigate('/customer');
      }
    }
  }, [currentUser, users, navigate, storeId, tableNumber, recordVisit]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 휴대전화 번호를 입력해주세요.');
      return;
    }

    if (!storeId) {
      setError('가게 QR 코드를 먼저 스캔해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const existingUser = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === 'customer' && u.storeId === storeId);
      
      if (isLogin) {
        if (existingUser) {
          const loggedInUser = await login(cleanPhone, existingUser.name, 'customer', undefined, storeId, pendingOAuthUser?.uid);
          if (tableNumber) {
            await recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          sessionStorage.removeItem('customerLogin_phone');
          setPendingOAuthUser(null);
          navigate(`/customer/store/${storeId}`);
        } else {
          setError('가입되지 않은 번호입니다. 회원가입을 진행해주세요.');
          setIsLogin(false);
        }
      } else {
        if (!name || isPohangResident === null || gender === null) {
          setError('모든 정보를 입력해주세요.');
          setIsLoading(false);
          return;
        }
        if (existingUser) {
          if (pendingOAuthUser) {
            const loggedInUser = await login(cleanPhone, existingUser.name, 'customer', undefined, storeId, pendingOAuthUser.uid);
            if (tableNumber) {
              await recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
            }
            sessionStorage.removeItem('customerLogin_phone');
            setPendingOAuthUser(null);
            navigate(`/customer/store/${storeId}`);
          } else {
            setError('이미 가입된 전화번호입니다. 로그인을 진행해주세요.');
            setIsLogin(true);
          }
        } else {
          const loggedInUser = await login(cleanPhone, name, 'customer', undefined, storeId, pendingOAuthUser?.uid, isPohangResident, gender);
          await issueCoupon(loggedInUser.id, storeId, '첫 회원가입 축하', '첫 회원가입 축하쿠폰 (3000원 상당)');
          if (tableNumber) {
            await recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          sessionStorage.removeItem('customerLogin_phone');
          setPendingOAuthUser(null);
          navigate(`/customer/store/${storeId}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const processOAuthUser = async (user: any, providerName: string) => {
    const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid || u.socialIds?.includes(user.uid)) && u.role === 'customer' && u.storeId === storeId);
    
    if (existingUser) {
      const loggedInUser = await login(existingUser.phone, existingUser.name, 'customer', undefined, storeId, user.uid);
      if (tableNumber) {
        await recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
      }
      sessionStorage.removeItem('customerLogin_phone');
      navigate(`/customer/store/${storeId}`);
    } else {
      setError(`가입되지 않은 ${providerName} 계정입니다. 추가 정보를 입력하고 회원가입을 완료해주세요.`);
      setIsLogin(false); 
      setPendingOAuthUser({ uid: user.uid, provider: providerName, displayName: user.displayName || null });
      if (user.displayName && !name) setName(user.displayName);
      setIsLogin(false);
      setIsLoading(false);
    }
  };

  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const processToken = async (token: string, provider: string) => {
      if (popupTimerRef.current) {
        clearInterval(popupTimerRef.current);
        popupTimerRef.current = null;
      }
      try {
        setIsLoading(true);
        const result = await signInWithCustomToken(auth, token);
        const providerName = provider === 'kakao' ? '카카오' : '네이버';
        await processOAuthUser(result.user, providerName);
      } catch (err: any) {
        console.error(err);
        setError(`로그인 처리 중 오류가 발생했습니다: ${err.message}`);
        setIsLoading(false);
      }
    };

    const handleMessage = async (event: MessageEvent) => {
      const allowedOrigins = [window.location.origin, 'http://localhost:3000', 'http://localhost:5173'];
      if (!allowedOrigins.includes(event.origin) && !event.origin.endsWith('.run.app') && !event.origin.endsWith('.onrender.com')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        await processToken(event.data.token, event.data.provider);
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        if (popupTimerRef.current) {
          clearInterval(popupTimerRef.current);
          popupTimerRef.current = null;
        }
        setError(`소셜 로그인 실패: ${event.data.error}`);
        setIsLoading(false);
      }
    };

    const handleStorage = async (event: StorageEvent) => {
      if (event.key === 'oauth_token_data' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data.type === 'OAUTH_AUTH_SUCCESS' && data.token) {
            localStorage.removeItem('oauth_token_data');
            await processToken(data.token, data.provider);
          }
        } catch (e) {
          console.error('Failed to parse oauth_token_data', e);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    
    const existingToken = localStorage.getItem('oauth_token_data');
    if (existingToken) {
      try {
        const data = JSON.parse(existingToken);
        if (data.type === 'OAUTH_AUTH_SUCCESS' && data.token && data.timestamp && Date.now() - data.timestamp < 5 * 60 * 1000) {
          localStorage.removeItem('oauth_token_data');
          processToken(data.token, data.provider);
        }
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (popupTimerRef.current) {
        clearInterval(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    };
  }, [isLogin, phone, name, isPohangResident, gender, storeId, users, tableNumber, login, recordVisit, issueCoupon, navigate]);

  const handleOAuthLogin = async (provider: 'kakao' | 'naver') => {
    if (isLoading || !auth) {
      if (!auth) setError('로그인 설정이 완료되지 않았습니다.');
      return;
    }
    
    if (!storeId) {
      setError('가게 QR 코드를 먼저 스캔해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const authWindow = window.open('', 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        setError('팝업이 차단되었습니다. 브라우저 설정에서 팝업 차단을 해제해주세요.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/auth/${provider}/url`);
      if (!response.ok) {
        authWindow.close();
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();
      
      authWindow.location.href = url;
      
      popupTimerRef.current = setInterval(() => {
        if (authWindow.closed) {
          if (popupTimerRef.current) {
            clearInterval(popupTimerRef.current);
            popupTimerRef.current = null;
          }
          setIsLoading(false);
        }
      }, 500);
    } catch (err: any) {
      console.error(err);
      setError(`${provider === 'kakao' ? '카카오' : '네이버'} 로그인 중 오류가 발생했습니다.`);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading || !auth) {
      if (!auth) setError('구글 로그인 설정이 완료되지 않았습니다.');
      return;
    }
    
    if (!storeId) {
      setError('가게 QR 코드를 먼저 스캔해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await processOAuthUser(result.user, 'Google');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError('구글 로그인이 취소되었습니다.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('팝업이 차단되었습니다. 브라우저 설정에서 팝업 차단을 해제해주세요.');
      } else {
        setError(`구글 로그인 중 오류가 발생했습니다: ${err.message}`);
      }
      setIsLoading(false);
    }
  };

  if (!storeId) {
    return (
      <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 hanji-texture relative overflow-hidden">
        <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
        <div className="max-w-md w-full bg-white rounded-[3.5rem] shadow-3xl border border-primary/10 p-12 text-center relative z-10 animate-in fade-in zoom-in duration-700">
          <Link 
            to="/" 
            className="absolute top-8 left-8 p-3 hover:bg-primary/10 rounded-2xl text-primary/30 hover:text-primary transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="w-24 h-24 rounded-[2rem] bg-burgundy/10 flex items-center justify-center mx-auto mb-10 rotate-3 animate-pulse">
            <UserCircle className="w-12 h-12 text-burgundy" strokeWidth={1} />
          </div>
          <h2 className="text-3xl font-serif font-black text-primary mb-4 tracking-tighter italic">QR 스캔 필요</h2>
          <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mb-12 leading-relaxed">
            시작하려면 테이블에 비치된 QR 코드를 먼저 스캔해 주세요.
          </p>
          <div className="space-y-4">
            <Link to="/scan" className="w-full flex items-center justify-center bg-burgundy text-white px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-burgundy/20 hover:scale-[1.02] active:scale-[0.98] transition-all">QR 코드 스캔하기</Link>
            <Link to="/" className="w-full flex items-center justify-center text-primary/30 hover:text-primary px-8 py-4 rounded-[2.5rem] font-black uppercase tracking-widest text-[9px] transition-colors">홈으로 돌아가기</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 hanji-texture relative overflow-hidden">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-10"></div>
      
      {/* Decorative Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full -ml-48 -mt-48 blur-3xl opacity-30"></div>
      
      <div className="max-w-md w-full bg-white rounded-[4rem] shadow-3xl border border-primary/10 overflow-hidden relative z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
        <Link 
          to="/" 
          className="absolute top-8 left-8 p-3 hover:bg-primary/10 rounded-2xl text-primary/30 hover:text-primary transition-all z-20"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        
        <div className="p-12 pb-8 text-center">
          <div className="inline-block relative mb-8">
             <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl"></div>
             <h1 className="text-8xl font-serif font-black text-primary leading-none tracking-tighter italic relative">결</h1>
          </div>
          <h1 className="text-2xl font-serif font-black text-primary tracking-tight mb-2 italic">
            {pendingOAuthUser ? `${pendingOAuthUser.provider} 초기화 및 연동` : (isLogin ? '시민 접속 (로그인)' : '유산 시작 (회원가입)')}
          </h1>
          <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em]">{store?.restaurantName || '매장 시스템'}</p>
        </div>
        
        <div className="px-12 pb-12 space-y-10">
          {error && (
            <div className="bg-burgundy/5 text-burgundy p-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-burgundy/10 animate-in shake duration-500">
              {error}
            </div>
          )}

          <div className="flex bg-primary/10 p-1.5 rounded-[2rem]">
            <button
              onClick={() => { setIsLogin(true); setError(''); setPendingOAuthUser(null); }}
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-3xl transition-all ${
                isLogin ? 'bg-primary text-white shadow-xl' : 'text-primary/40 hover:text-primary'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-3xl transition-all ${
                !isLogin ? 'bg-primary text-white shadow-xl' : 'text-primary/40 hover:text-primary'
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handlePhoneSubmit} className="space-y-8">
            {!isLogin && (
              <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] ml-1">성함 (본명)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-8 py-5 bg-primary/[0.02] border border-primary/10 rounded-[2rem] text-primary font-black uppercase tracking-widest text-[11px] focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner focus:bg-white"
                    placeholder="성함을 입력하세요"
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] ml-1">지역 거주 여부</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsPohangResident(true)}
                      className={`flex-1 py-4 border rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${isPohangResident === true ? 'bg-primary text-white shadow-xl' : 'bg-primary/[0.02] border-primary/10 text-primary/40 hover:bg-white hover:text-primary'}`}
                    >
                      포항 시민
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPohangResident(false)}
                      className={`flex-1 py-4 border rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${isPohangResident === false ? 'bg-primary text-white shadow-xl' : 'bg-primary/[0.02] border-primary/10 text-primary/40 hover:bg-white hover:text-primary'}`}
                    >
                      타지역 방문객
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] ml-1">성별</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`flex-1 py-4 border rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${gender === 'male' ? 'bg-primary text-white shadow-xl' : 'bg-primary/[0.02] border-primary/10 text-primary/40 hover:bg-white hover:text-primary'}`}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`flex-1 py-4 border rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${gender === 'female' ? 'bg-primary text-white shadow-xl' : 'bg-primary/[0.02] border-primary/10 text-primary/40 hover:bg-white hover:text-primary'}`}
                    >
                      여성
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] ml-1">연락처 (암호)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-primary/20" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  className="w-full pl-14 pr-8 py-5 bg-primary/[0.02] border border-primary/10 rounded-[2rem] text-primary font-black uppercase tracking-widest text-[11px] focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner focus:bg-white"
                  placeholder="010-0000-0000"
                  maxLength={13}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading || phone.replace(/[^0-9]/g, '').length < 10 || (!isLogin && (!name || isPohangResident === null || gender === null))}
              className="w-full bg-burgundy hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 text-white font-black py-6 rounded-[2.5rem] transition-all shadow-2xl shadow-burgundy/20 flex items-center justify-center space-x-3 text-[10px] uppercase tracking-widest mt-4"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? '입장하기' : '등록하기')}
            </button>
          </form>

          {!pendingOAuthUser && (
            <div className="space-y-10">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-primary/10"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-black text-primary/30 uppercase tracking-[0.5em]">
                  <span className="px-6 bg-white">또는 다음으로 접속</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-white border border-primary/10 hover:border-primary/20 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-primary/60 flex items-center justify-center space-x-4 transition-all"
                >
                   <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                   </svg>
                   <span>구글 로그인</span>
                </button>

                <div className="grid grid-cols-2 gap-4">
                   <button 
                    onClick={() => handleOAuthLogin('kakao')}
                    className="bg-[#FEE500] hover:scale-[1.02] py-5 rounded-[2rem] flex items-center justify-center space-x-3 transition-all grayscale-[0.2] hover:grayscale-0"
                   >
                     <div className="w-5 h-5 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-[10px] text-[#FEE500] font-black">K</span>
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-widest text-black">Kakao</span>
                   </button>
                   <button 
                    onClick={() => handleOAuthLogin('naver')}
                    className="bg-[#03C75A] hover:scale-[1.02] py-5 rounded-[2rem] flex items-center justify-center space-x-3 transition-all grayscale-[0.2] hover:grayscale-0"
                   >
                      <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center">
                        <span className="text-[10px] text-[#03C75A] font-black">N</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">Naver</span>
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
