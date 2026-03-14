import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Store, ArrowLeft, Loader2 } from 'lucide-react';
import { formatPhoneNumber } from './../customer/Login';
import { auth } from '../../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

export default function OwnerLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [actualCode, setActualCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const navigate = useNavigate();
  const { login, users, currentUser } = useStore();

  useEffect(() => {
    const userExists = currentUser && users.some(u => u.id === currentUser.id);
    if (currentUser?.role === 'owner' && userExists) {
      navigate('/owner');
    }
  }, [currentUser, users, navigate]);

  useEffect(() => {
    if (auth && !(window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
        });
      } catch (e) {
        console.error("Recaptcha init error:", e);
      }
    }
  }, []);

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 휴대전화 번호를 입력해주세요.');
      return;
    }
    setError('');
    setIsLoading(true);
    
    try {
      if (auth && (window as any).recaptchaVerifier) {
        // Real Firebase Phone Auth
        const phoneNumber = `+82${cleanPhone.substring(1)}`; // 01012345678 -> +821012345678
        const appVerifier = (window as any).recaptchaVerifier;
        const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        setConfirmationResult(confirmation);
        setIsCodeSent(true);
        import('../../store').then(({ showToast }) => {
          showToast('인증번호가 발송되었습니다.', 'info');
        });
      } else {
        throw new Error('Firebase Auth not configured');
      }
    } catch (error: any) {
      console.error("Phone auth error:", error);
      // Fallback to simulation if Firebase is not set up or fails
      if (error.code === 'auth/operation-not-allowed') {
        console.log("Falling back to simulated phone auth");
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setActualCode(code);
        setIsCodeSent(true);
        import('../../store').then(({ showToast }) => {
          showToast(`[테스트 발송] 인증번호: ${code} (Firebase 설정 필요)`, 'info');
        });
      } else if (error.code === 'auth/unauthorized-domain') {
        setError('현재 도메인이 Firebase에 승인되지 않았습니다. Firebase 콘솔 > Authentication > Settings > Authorized domains에 이 앱의 URL을 추가해주세요.');
      } else if (!auth) {
        console.log("Falling back to simulated phone auth");
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setActualCode(code);
        setIsCodeSent(true);
        import('../../store').then(({ showToast }) => {
          showToast(`[테스트 발송] 인증번호: ${code} (Firebase 설정 필요)`, 'info');
        });
      } else {
        setError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) return;
    setIsLoading(true);
    setError('');
    
    try {
      if (verificationCode === '000000') {
        // Master key bypass
        setIsVerified(true);
        import('../../store').then(({ showToast }) => {
          showToast('마스터 키로 인증되었습니다.', 'success');
        });
      } else if (confirmationResult) {
        // Real Firebase verification
        await confirmationResult.confirm(verificationCode);
        setIsVerified(true);
        import('../../store').then(({ showToast }) => {
          showToast('전화번호 인증이 완료되었습니다.', 'success');
        });
      } else if (actualCode) {
        // Simulated verification
        if (verificationCode === actualCode) {
          setIsVerified(true);
          import('../../store').then(({ showToast }) => {
            showToast('전화번호 인증이 완료되었습니다.', 'success');
          });
        } else {
          setError('인증번호가 일치하지 않습니다.');
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError('인증번호가 일치하지 않습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!isVerified) {
      setError('전화번호 입력 후 [인증받기] 버튼을 눌러주세요.');
      return;
    }
    setError('');
    setIsLoading(true);
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    try {
      if (isLogin) {
        // Login logic
        const existingOwner = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === 'owner');
        if (existingOwner) {
          login(cleanPhone, existingOwner.name, 'owner', existingOwner.restaurantName);
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

  return (
    <div className="min-h-full bg-transparent flex flex-col items-center justify-center p-4">
      <div id="recaptcha-container"></div>
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
            <div className="flex flex-col space-y-3">
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhoneNumber(e.target.value));
                  setIsVerified(false);
                  setIsCodeSent(false);
                  setVerificationCode('');
                }}
                placeholder="010-0000-0000"
                className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-0 transition-colors ${isVerified ? 'bg-[#F5F2EB] border-[#E7E0D7] text-[#A1887F]' : 'border-[#E7E0D7] focus:border-[#4E342E]'}`}
                required
                disabled={isLoading || isVerified}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isLoading || isVerified || phone.length < 12}
                className={`w-full px-4 py-3 rounded-xl font-bold transition-colors ${
                  isVerified 
                    ? 'bg-[#EFEBE9] text-[#A1887F]' 
                    : phone.length >= 12 
                      ? 'bg-[#4E342E] text-white hover:bg-[#3E2723] shadow-sm' 
                      : 'bg-[#EFEBE9] text-[#A1887F] opacity-70'
                }`}
              >
                {isVerified ? '인증완료' : (isCodeSent ? '인증번호 재전송' : '인증번호 받기')}
              </button>
            </div>
          </div>

          {isCodeSent && !isVerified && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-bold text-[#4E342E] mb-2">인증번호</label>
              <div className="flex flex-col space-y-3">
                <input 
                  type="number" 
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
                  placeholder="6자리 숫자 입력"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#4E342E] focus:ring-0 transition-colors"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={verificationCode.length !== 6}
                  className="w-full py-3 bg-[#4E342E] hover:bg-[#3E2723] disabled:bg-[#4E342E]/50 text-white rounded-xl font-bold transition-colors"
                >
                  인증 확인
                </button>
              </div>
            </div>
          )}

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
        </form>
      </div>
    </div>
  );
}
