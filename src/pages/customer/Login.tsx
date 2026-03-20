import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { UserCircle, ArrowLeft, Loader2, Phone } from 'lucide-react';
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

  const handlePhoneSubmit = (e: React.FormEvent) => {
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
          const loggedInUser = login(cleanPhone, existingUser.name, 'customer', undefined, storeId, pendingOAuthUser?.uid);
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
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
            const loggedInUser = login(cleanPhone, existingUser.name, 'customer', undefined, storeId, pendingOAuthUser.uid);
            if (tableNumber) {
              recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
            }
            sessionStorage.removeItem('customerLogin_phone');
            setPendingOAuthUser(null);
            navigate(`/customer/store/${storeId}`);
          } else {
            setError('이미 가입된 전화번호입니다. 로그인을 진행해주세요.');
            setIsLogin(true);
          }
        } else {
          const loggedInUser = login(cleanPhone, name, 'customer', undefined, storeId, pendingOAuthUser?.uid, isPohangResident, gender);
          issueCoupon(loggedInUser.id, storeId, '첫 회원가입 축하', '첫 회원가입 축하쿠폰 (3000원 상당)');
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
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
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    if (isLogin) {
      const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid || u.socialIds?.includes(user.uid)) && u.role === 'customer' && u.storeId === storeId);
      if (existingUser) {
        // Login
        const loggedInUser = login(existingUser.phone, existingUser.name, 'customer', undefined, storeId, user.uid);
        if (tableNumber) {
          recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
        }
        sessionStorage.removeItem('customerLogin_phone');
        navigate(`/customer/store/${storeId}`);
      } else {
        setError(`가입되지 않은 ${providerName} 계정입니다. 정보를 입력하고 회원가입을 완료해주세요.`);
        setPendingOAuthUser({ uid: user.uid, provider: providerName, displayName: user.displayName || null });
        if (user.displayName && !name) setName(user.displayName);
        setIsLogin(false);
        setIsLoading(false);
      }
    } else {
      // Signup
      if (cleanPhone.length < 10) {
        setError(`전화번호를 올바르게 입력한 후 ${providerName} 회원가입을 진행해주세요.`);
        setIsLoading(false);
        return;
      }
      if (!name || isPohangResident === null || gender === null) {
        setError(`모든 정보를 입력한 후 ${providerName} 회원가입을 진행해주세요.`);
        setIsLoading(false);
        return;
      }
      
      const existingOAuthUser = users.find(u => (u.googleId === user.uid || u.id === user.uid || u.socialIds?.includes(user.uid)) && u.role === 'customer' && u.storeId === storeId);
      if (existingOAuthUser) {
        setError(`이미 가입된 ${providerName} 계정입니다. 로그인을 진행해주세요.`);
        setIsLogin(true);
        setIsLoading(false);
      } else {
        const existingPhoneUser = users.find(u => u.phone === cleanPhone && u.role === 'customer' && u.storeId === storeId);
        if (existingPhoneUser) {
          const loggedInUser = login(cleanPhone, existingPhoneUser.name, 'customer', undefined, storeId, user.uid);
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          sessionStorage.removeItem('customerLogin_phone');
          navigate(`/customer/store/${storeId}`);
        } else {
          const loggedInUser = login(cleanPhone, name || user.displayName || '고객님', 'customer', undefined, storeId, user.uid, isPohangResident, gender);
          issueCoupon(loggedInUser.id, storeId, '첫 회원가입 축하', '첫 회원가입 축하쿠폰 (3000원 상당)');
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          sessionStorage.removeItem('customerLogin_phone');
          navigate(`/customer/store/${storeId}`);
        }
      }
    }
  };

  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const allowedOrigins = [window.location.origin, 'http://localhost:3000', 'http://localhost:5173'];
      if (!allowedOrigins.includes(event.origin) && !event.origin.endsWith('.run.app') && !event.origin.endsWith('.onrender.com')) {
        return;
      }
      
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        if (popupTimerRef.current) {
          clearInterval(popupTimerRef.current);
          popupTimerRef.current = null;
        }
        try {
          setIsLoading(true);
          const result = await signInWithCustomToken(auth, event.data.token);
          const providerName = event.data.provider === 'kakao' ? '카카오' : '네이버';
          await processOAuthUser(result.user, providerName);
        } catch (err: any) {
          console.error(err);
          setError(`로그인 처리 중 오류가 발생했습니다: ${err.message}`);
          setIsLoading(false);
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        if (popupTimerRef.current) {
          clearInterval(popupTimerRef.current);
          popupTimerRef.current = null;
        }
        setError(`소셜 로그인 실패: ${event.data.error}`);
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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

    if (!isLogin) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        setError(`전화번호를 올바르게 입력한 후 ${provider === 'kakao' ? '카카오' : '네이버'} 회원가입을 진행해주세요.`);
        return;
      }
      if (!name || isPohangResident === null || gender === null) {
        setError(`모든 정보를 입력한 후 ${provider === 'kakao' ? '카카오' : '네이버'} 회원가입을 진행해주세요.`);
        return;
      }
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

    if (!isLogin) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        setError('전화번호를 올바르게 입력한 후 구글 회원가입을 진행해주세요.');
        return;
      }
      if (!name || isPohangResident === null || gender === null) {
        setError('모든 정보를 입력한 후 구글 회원가입을 진행해주세요.');
        return;
      }
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      
      if (isLogin) {
        const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid || u.socialIds?.includes(user.uid)) && u.role === 'customer' && u.storeId === storeId);
        if (existingUser) {
          // Login
          const loggedInUser = login(existingUser.phone, existingUser.name, 'customer', undefined, storeId, user.uid);
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          sessionStorage.removeItem('customerLogin_phone');
          navigate(`/customer/store/${storeId}`);
        } else {
          setError('가입되지 않은 구글 계정입니다. 정보를 입력하고 회원가입을 완료해주세요.');
          setPendingOAuthUser({ uid: user.uid, provider: 'Google', displayName: user.displayName || null });
          if (user.displayName && !name) setName(user.displayName);
          setIsLogin(false);
          setIsLoading(false);
        }
      } else {
        // Signup
        if (cleanPhone.length < 10) {
          setError('전화번호를 올바르게 입력한 후 구글 회원가입을 진행해주세요.');
          setIsLoading(false);
          return;
        }
        if (!name || isPohangResident === null || gender === null) {
          setError('모든 정보를 입력한 후 구글 회원가입을 진행해주세요.');
          setIsLoading(false);
          return;
        }
        
        const existingOAuthUser = users.find(u => (u.googleId === user.uid || u.id === user.uid || u.socialIds?.includes(user.uid)) && u.role === 'customer' && u.storeId === storeId);
        if (existingOAuthUser) {
          setError('이미 가입된 구글 계정입니다. 로그인을 진행해주세요.');
          setIsLogin(true);
          setIsLoading(false);
        } else {
          const existingPhoneUser = users.find(u => u.phone === cleanPhone && u.role === 'customer' && u.storeId === storeId);
          if (existingPhoneUser) {
            const loggedInUser = login(cleanPhone, existingPhoneUser.name, 'customer', undefined, storeId, user.uid);
            if (tableNumber) {
              recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
            }
            sessionStorage.removeItem('customerLogin_phone');
            navigate(`/customer/store/${storeId}`);
          } else {
            const loggedInUser = login(cleanPhone, name || user.displayName || '고객님', 'customer', undefined, storeId, user.uid, isPohangResident, gender);
            issueCoupon(loggedInUser.id, storeId, '첫 회원가입 축하', '첫 회원가입 축하쿠폰 (3000원 상당)');
            if (tableNumber) {
              recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
            }
            sessionStorage.removeItem('customerLogin_phone');
            navigate(`/customer/store/${storeId}`);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError('구글 로그인이 취소되었습니다.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('팝업이 차단되었습니다. 브라우저 설정에서 팝업 차단을 해제해주세요. (또는 새 탭에서 열어주세요)');
      } else {
        setError(`구글 로그인 중 오류가 발생했습니다: ${err.message}`);
      }
      setIsLoading(false);
    }
  };

  if (!storeId) {
    return (
      <div className="min-h-full bg-transparent flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_4px_20px_rgba(78,52,46,0.08)] border border-[#E7E0D7] overflow-hidden p-8 text-center relative">
          <Link 
            to="/" 
            className="absolute top-4 left-4 p-2 bg-transparent hover:bg-[#EFEBE9] rounded-full text-[#5D4037] transition-colors z-10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="w-20 h-20 rounded-full bg-[#FFF3E0] flex items-center justify-center mx-auto mb-4 mt-4 shadow-sm border border-[#FFE0B2]">
            <UserCircle className="w-10 h-10 text-[#D84315]" />
          </div>
          <h2 className="text-2xl font-black mb-4 tracking-tight text-[#2D1B15]">가게 QR 스캔 필요</h2>
          <p className="text-[#795548] mb-8 font-medium">로그인하려면 먼저 매장 테이블의 QR 코드를 스캔해주세요.</p>
          <div className="space-y-3">
            <Link to="/scan" className="w-full block bg-[#D84315] hover:bg-[#BF360C] text-white px-6 py-4 rounded-xl font-bold transition-colors">앱에서 QR 스캔하기</Link>
            <Link to="/" className="w-full block bg-[#EFEBE9] hover:bg-[#E7E0D7] text-[#4E342E] px-6 py-4 rounded-xl font-bold transition-colors">홈으로 돌아가기</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_4px_20px_rgba(78,52,46,0.08)] border border-[#E7E0D7] overflow-hidden relative">
        <Link 
          to="/" 
          className="absolute top-4 left-4 p-2 bg-transparent hover:bg-[#FFF3E0] rounded-full text-[#D84315] transition-colors z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        
        <div className="bg-transparent p-8 pt-12 text-center">
          <div className="w-20 h-20 rounded-full bg-[#FFF3E0] flex items-center justify-center mx-auto mb-4 shadow-sm border border-[#FFE0B2]">
            <UserCircle className="w-10 h-10 text-[#D84315]" />
          </div>
          <h1 className="text-3xl font-black text-[#2D1B15] tracking-tight">
            {pendingOAuthUser ? `${pendingOAuthUser.provider} 회원가입` : (isLogin ? '고객 로그인' : '고객 회원가입')}
          </h1>
          <p className="text-[#795548] mt-2 font-medium">{store?.restaurantName || '단골 고객 서비스'}</p>
        </div>
        
        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold text-center">
              {error}
            </div>
          )}

          <div className="flex rounded-xl bg-[#EFEBE9] p-1">
            <button
              onClick={() => { setIsLogin(true); setError(''); setPendingOAuthUser(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${
                isLogin ? 'bg-white text-[#D84315] shadow-sm' : 'text-[#795548] hover:text-[#4E342E]'
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${
                !isLogin ? 'bg-white text-[#D84315] shadow-sm' : 'text-[#795548] hover:text-[#4E342E]'
              }`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-bold text-[#5D4037] mb-2">이름 (닉네임)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full px-4 py-4 bg-white border border-[#E7E0D7] rounded-xl text-[#4E342E] placeholder-[#A1887F] focus:ring-2 focus:ring-[#D84315] focus:border-transparent transition-all font-medium text-lg"
                    placeholder="홍길동"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-[#5D4037] mb-2">포항 거주 여부</label>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-center p-4 border border-[#E7E0D7] rounded-xl cursor-pointer hover:bg-[#FFF3E0] transition-colors">
                      <input
                        type="radio"
                        name="pohang"
                        checked={isPohangResident === true}
                        onChange={() => setIsPohangResident(true)}
                        className="w-4 h-4 text-[#D84315] border-gray-300 focus:ring-[#D84315]"
                      />
                      <span className="ml-2 text-[#4E342E] font-bold">포항 거주</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center p-4 border border-[#E7E0D7] rounded-xl cursor-pointer hover:bg-[#FFF3E0] transition-colors">
                      <input
                        type="radio"
                        name="pohang"
                        checked={isPohangResident === false}
                        onChange={() => setIsPohangResident(false)}
                        className="w-4 h-4 text-[#D84315] border-gray-300 focus:ring-[#D84315]"
                      />
                      <span className="ml-2 text-[#4E342E] font-bold">타지역 거주</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#5D4037] mb-2">성별</label>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-center p-4 border border-[#E7E0D7] rounded-xl cursor-pointer hover:bg-[#FFF3E0] transition-colors">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === 'male'}
                        onChange={() => setGender('male')}
                        className="w-4 h-4 text-[#D84315] border-gray-300 focus:ring-[#D84315]"
                      />
                      <span className="ml-2 text-[#4E342E] font-bold">남성</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center p-4 border border-[#E7E0D7] rounded-xl cursor-pointer hover:bg-[#FFF3E0] transition-colors">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === 'female'}
                        onChange={() => setGender('female')}
                        className="w-4 h-4 text-[#D84315] border-gray-300 focus:ring-[#D84315]"
                      />
                      <span className="ml-2 text-[#4E342E] font-bold">여성</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-[#5D4037] mb-2">휴대전화 번호</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-[#A1887F]" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  className="block w-full pl-11 pr-4 py-4 bg-white border border-[#E7E0D7] rounded-xl text-[#4E342E] placeholder-[#A1887F] focus:ring-2 focus:ring-[#D84315] focus:border-transparent transition-all font-medium text-lg"
                  placeholder="010-0000-0000"
                  maxLength={13}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading || phone.replace(/[^0-9]/g, '').length < 10 || (!isLogin && (!name || isPohangResident === null || gender === null))}
              className="w-full bg-[#D84315] hover:bg-[#BF360C] disabled:bg-[#FFCCBC] text-white font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center shadow-sm"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? '전화번호로 시작하기' : (pendingOAuthUser ? `${pendingOAuthUser.provider} 계정으로 가입 완료` : '회원가입 완료'))}
            </button>
          </form>

          {!pendingOAuthUser && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E7E0D7]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-[#A1887F] font-medium">또는</span>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-gray-50 border border-[#E7E0D7] disabled:bg-gray-100 text-[#4E342E] font-bold py-3.5 rounded-xl transition-colors text-lg flex items-center justify-center shadow-sm"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Google로 시작하기
                    </>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => handleOAuthLogin('kakao')}
                  disabled={isLoading}
                  className="w-full bg-[#FEE500] hover:bg-[#E5CE00] disabled:bg-[#FEE500]/50 text-[#000000] font-bold py-3.5 rounded-xl transition-colors text-lg flex items-center justify-center shadow-sm"
                >
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3c-5.523 0-10 3.538-10 7.9 0 2.834 1.88 5.32 4.686 6.722-.296 1.092-1.076 3.978-1.096 4.056-.026.104.032.208.13.236.076.022.158.006.216-.042 0 0 3.43-2.316 4.88-3.32.386.054.786.082 1.184.082 5.523 0 10-3.538 10-7.9C22 6.538 17.523 3 12 3z"/>
                  </svg>
                  카카오로 시작하기
                </button>

                <button 
                  type="button"
                  onClick={() => handleOAuthLogin('naver')}
                  disabled={isLoading}
                  className="w-full bg-[#03C75A] hover:bg-[#02B350] disabled:bg-[#03C75A]/50 text-white font-bold py-3.5 rounded-xl transition-colors text-lg flex items-center justify-center shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/>
                  </svg>
                  네이버로 시작하기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
