import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { UserCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from 'firebase/auth';

export default function CustomerLogin() {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

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

  useEffect(() => {
    const handleRedirectResult = async () => {
      if (!auth || !storeId) return;
      try {
        setIsLoading(true);
        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'customer' && u.storeId === storeId);
          
          if (existingUser) {
            const loggedInUser = login('', existingUser.name, 'customer', undefined, storeId, user.uid);
            if (tableNumber) {
              recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
            }
            navigate(`/customer/store/${storeId}`);
          } else {
            const loggedInUser = login('', user.displayName || '고객님', 'customer', undefined, storeId, user.uid);
            if (tableNumber) {
              recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
            }
            navigate(`/customer/store/${storeId}`);
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
  }, [auth, storeId, users, login, tableNumber, navigate, recordVisit]);

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
      // Detect mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        await signInWithRedirect(auth, provider);
        return; // Execution stops here as the page redirects
      } else {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const existingUser = users.find(u => (u.googleId === user.uid || u.id === user.uid) && u.role === 'customer' && u.storeId === storeId);
        
        if (existingUser) {
          // Login
          const loggedInUser = login('', existingUser.name, 'customer', undefined, storeId, user.uid);
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          navigate(`/customer/store/${storeId}`);
        } else {
          // Signup
          const loggedInUser = login('', user.displayName || '고객님', 'customer', undefined, storeId, user.uid);
          if (tableNumber) {
            recordVisit(loggedInUser.id, parseInt(tableNumber), storeId);
          }
          navigate(`/customer/store/${storeId}`);
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
        
        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold text-center">
              {error}
            </div>
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
                Google로 시작하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
