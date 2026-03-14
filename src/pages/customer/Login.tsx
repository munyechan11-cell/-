import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { UserCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

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

  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, users, currentUser, recordVisit } = useStore();
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

  const handleGoogleLogin = async () => {
    if (isLoading || !auth) return;
    
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
      if (!name) {
        setError('성함을 입력한 후 구글 회원가입을 진행해주세요.');
        return;
      }
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (isLogin) {
        const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'customer' && u.storeId === storeId);
        if (existingUser) {
          const loggedInUser = login('', existingUser.name, 'customer', undefined, storeId, user.uid);
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          navigate(`/customer/store/${storeId}`);
        } else {
          const userInOtherStore = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'customer');
          if (userInOtherStore) {
            setError('해당 구글 계정은 다른 매장에 등록되어 있습니다. 이 매장에는 처음 방문이시라면 회원가입을 진행해주세요.');
          } else {
            setError('가입되지 않은 구글 계정입니다. 처음 방문이시라면 회원가입을 진행해주세요.');
          }
        }
      } else {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        
        const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'customer' && u.storeId === storeId);
        if (existingUser) {
          setError('이미 이 매장에 가입된 구글 계정입니다. 로그인을 진행해주세요.');
          setIsLogin(true);
          setIsLoading(false);
          return;
        }
        
        const existingPhone = users.find(u => u.phone === cleanPhone && u.role === 'customer' && u.storeId === storeId);
        if (existingPhone && existingPhone.googleId && existingPhone.googleId !== user.uid) {
          setError('이미 다른 구글 계정과 연동된 전화번호입니다.');
          setIsLoading(false);
          return;
        }
        
        const loggedInUser = login(cleanPhone, name, 'customer', undefined, storeId, user.uid);
        if (tableNumber) {
          recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
        }
        navigate(`/customer/store/${storeId}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(`구글 로그인 중 오류가 발생했습니다: ${err.message}`);
    } finally {
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
          <h1 className="text-3xl font-black text-[#2D1B15] tracking-tight">고객 로그인</h1>
          <p className="text-[#795548] mt-2 font-medium">{store?.restaurantName || '단골 고객 서비스'}</p>
        </div>
        
        <div className="flex border-b border-[#E7E0D7]">
          <button 
            className={`flex-1 py-4 font-bold text-sm transition-colors ${isLogin ? 'text-[#D84315] border-b-2 border-[#D84315]' : 'text-[#A1887F] hover:text-[#5D4037]'}`}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            로그인
          </button>
          <button 
            className={`flex-1 py-4 font-bold text-sm transition-colors ${!isLogin ? 'text-[#D84315] border-b-2 border-[#D84315]' : 'text-[#A1887F] hover:text-[#5D4037]'}`}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            회원가입
          </button>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold text-center">
              {error}
            </div>
          )}
          
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-bold text-[#4E342E] mb-2">전화번호</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#D84315] focus:ring-0 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#4E342E] mb-2">성함</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#D84315] focus:ring-0 transition-colors"
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 border border-[#E7E0D7] disabled:bg-gray-100 text-[#4E342E] font-bold py-4 rounded-xl transition-colors text-lg flex items-center justify-center shadow-sm"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google로 {isLogin ? '로그인' : '회원가입 및 시작하기'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
