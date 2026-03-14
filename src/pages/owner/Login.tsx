import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Store, ArrowLeft, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';

export const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/[^\d]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export default function OwnerLogin() {
  const [isLogin, setIsLogin] = useState(() => {
    const saved = sessionStorage.getItem('ownerLogin_isLogin');
    return saved !== null ? saved === 'true' : true;
  });
  const [phone, setPhone] = useState(() => sessionStorage.getItem('ownerLogin_phone') || '');
  const [name, setName] = useState(() => sessionStorage.getItem('ownerLogin_name') || '');
  const [restaurantName, setRestaurantName] = useState(() => sessionStorage.getItem('ownerLogin_restaurantName') || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, users, currentUser } = useStore();

  useEffect(() => {
    const userExists = currentUser && users.some(u => u.id === currentUser.id);
    if (currentUser?.role === 'owner' && userExists) {
      navigate('/owner');
    }
  }, [currentUser, users, navigate]);

  useEffect(() => {
    const handleRedirectResult = async () => {
      if (!auth) return;
      try {
        setIsLoading(true);
        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          
          if (isLogin) {
            const existingOwner = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'owner');
            if (existingOwner) {
              login('', existingOwner.name, 'owner', existingOwner.restaurantName, undefined, user.uid);
              sessionStorage.clear();
              navigate('/owner');
            } else {
              setError('회원가입되지 않은 구글 계정입니다. 회원가입을 먼저 진행해주세요.');
              setIsLogin(false);
            }
          } else {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const existingOwner = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'owner');
            if (existingOwner) {
              setError('이미 가입된 구글 계정입니다. 로그인을 진행해주세요.');
              setIsLogin(true);
            } else {
              const existingPhone = users.find(u => u.phone === cleanPhone && u.role === 'owner');
              if (existingPhone && existingPhone.googleId && existingPhone.googleId !== user.uid) {
                setError('이미 다른 구글 계정과 연동된 전화번호입니다.');
              } else {
                login(cleanPhone, name, 'owner', restaurantName, undefined, user.uid);
                sessionStorage.clear();
                navigate('/owner');
              }
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(`구글 로그인 중 오류가 발생했습니다: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    handleRedirectResult();
  }, [auth, users, login, navigate, isLogin, phone, name, restaurantName]);

  const saveStateToSession = () => {
    sessionStorage.setItem('ownerLogin_isLogin', String(isLogin));
    sessionStorage.setItem('ownerLogin_phone', phone);
    sessionStorage.setItem('ownerLogin_name', name);
    sessionStorage.setItem('ownerLogin_restaurantName', restaurantName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 휴대전화 번호를 입력해주세요.');
      return;
    }

    setError('');
    setIsLoading(true);
    
    try {
      if (isLogin) {
        // Login logic
        const existingOwner = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === 'owner');
        if (existingOwner) {
          login(cleanPhone, existingOwner.name, 'owner', existingOwner.restaurantName);
          sessionStorage.clear();
          navigate('/owner');
        } else {
          setError('회원가입되지 않은 정보입니다.');
        }
      } else {
        // Signup logic
        if (cleanPhone && name && restaurantName) {
          const existingOwner = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === 'owner');
          if (existingOwner) {
            setError('이미 가입된 전화번호입니다. 로그인을 진행해주세요.');
            setIsLogin(true);
          } else {
            login(cleanPhone, name, 'owner', restaurantName);
            sessionStorage.clear();
            navigate('/owner');
          }
        } else {
          setError('모든 정보를 입력해주세요.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading || !auth) {
      if (!auth) setError('구글 로그인 설정이 완료되지 않았습니다.');
      return;
    }
    
    if (!isLogin) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        setError('전화번호를 올바르게 입력한 후 구글 회원가입을 진행해주세요.');
        return;
      }
      if (!name) {
        setError('성함을 입력한 후 구글 회원가입을 진행해주세요.');
        return;
      }
      if (!restaurantName) {
        setError('가게 이름을 입력한 후 구글 회원가입을 진행해주세요.');
        return;
      }
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        saveStateToSession();
        await signInWithRedirect(auth, provider);
        return;
      } else {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        if (isLogin) {
          const existingOwner = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'owner');
          if (existingOwner) {
            login('', existingOwner.name, 'owner', existingOwner.restaurantName, undefined, user.uid);
            sessionStorage.clear();
            navigate('/owner');
          } else {
            setError('회원가입되지 않은 구글 계정입니다. 회원가입을 먼저 진행해주세요.');
            setIsLogin(false);
          }
        } else {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const existingOwner = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'owner');
          if (existingOwner) {
            setError('이미 가입된 구글 계정입니다. 로그인을 진행해주세요.');
            setIsLogin(true);
          } else {
            const existingPhone = users.find(u => u.phone === cleanPhone && u.role === 'owner');
            if (existingPhone && existingPhone.googleId && existingPhone.googleId !== user.uid) {
              setError('이미 다른 구글 계정과 연동된 전화번호입니다.');
            } else {
              login(cleanPhone, name, 'owner', restaurantName, undefined, user.uid);
              sessionStorage.clear();
              navigate('/owner');
            }
          }
        }
      }
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

  return (
    <div className="min-h-full bg-transparent flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_4px_20px_rgba(78,52,46,0.08)] border border-[#E7E0D7] overflow-hidden relative">
        <Link 
          to="/" 
          className="absolute top-4 left-4 p-2 bg-transparent hover:bg-[#EFEBE9] rounded-full text-[#4E342E] transition-colors z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        
        <div className="bg-transparent p-8 pt-12 text-center">
          <div className="w-20 h-20 rounded-full bg-[#EFEBE9] flex items-center justify-center mx-auto mb-4 shadow-sm border border-[#D7CCC8]">
            <Store className="w-10 h-10 text-[#4E342E]" />
          </div>
          <h1 className="text-3xl font-black text-[#2D1B15] tracking-tight">
            {!isLogin && restaurantName ? restaurantName : '사장님 서비스'}
          </h1>
          <p className="text-[#795548] mt-2 font-medium">단골 관리 파트너</p>
        </div>
        
        <div className="flex border-b border-[#E7E0D7]">
          <button 
            className={`flex-1 py-4 font-bold text-sm transition-colors ${isLogin ? 'text-[#2D1B15] border-b-2 border-[#4E342E]' : 'text-[#A1887F] hover:text-[#5D4037]'}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            로그인
          </button>
          <button 
            className={`flex-1 py-4 font-bold text-sm transition-colors ${!isLogin ? 'text-[#2D1B15] border-b-2 border-[#4E342E]' : 'text-[#A1887F] hover:text-[#5D4037]'}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold text-center">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-[#4E342E] mb-2">전화번호</label>
            <input 
              type="tel" 
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#4E342E] focus:ring-0 transition-colors"
              required
              disabled={isLoading}
            />
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-bold text-[#4E342E] mb-2">성함</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#4E342E] focus:ring-0 transition-colors"
                  required={!isLogin}
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#4E342E] mb-2">가게 이름</label>
                <input 
                  type="text" 
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="연심"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#4E342E] focus:ring-0 transition-colors"
                  required={!isLogin}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#4E342E] hover:bg-[#3E2723] disabled:bg-[#4E342E]/70 text-white font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? '로그인' : '회원가입 및 시작하기')}
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-[#E7E0D7]"></div>
            <span className="flex-shrink-0 mx-4 text-[#A1887F] text-sm font-medium">또는</span>
            <div className="flex-grow border-t border-[#E7E0D7]"></div>
          </div>
          
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 border border-[#E7E0D7] disabled:bg-gray-100 text-[#4E342E] font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center"
          >
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google로 {isLogin ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  );
}
