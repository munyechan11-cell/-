import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { 
  Store, ArrowLeft, Loader2, Sparkles, 
  ShieldCheck, Heart, Star, Award, 
  ChevronRight, LayoutGrid, Zap, 
  Store as StoreIcon, ShieldAlert,
  Phone, User
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithCustomToken } from 'firebase/auth';

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
  const [isPohangResident, setIsPohangResident] = useState<boolean | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [pendingOAuthUser, setPendingOAuthUser] = useState<{ uid: string, provider: string, displayName: string | null } | null>(null);
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
        const existingOwner = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === 'owner');
        if (existingOwner) {
          await login(cleanPhone, existingOwner.name, 'owner', existingOwner.restaurantName, undefined, pendingOAuthUser?.uid);
          sessionStorage.clear();
          navigate('/owner');
        } else {
          setError('등록되지 않은 사장님 정보입니다. 회원가입을 진행해 주세요.');
          setIsLogin(false);
        }
      } else {
        if (cleanPhone && name && restaurantName) {
           const existingOwner = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone && u.role === 'owner');
           if (existingOwner) {
              setError('이미 등록된 번호입니다. 로그인을 진행해 주세요.');
              setIsLogin(true);
           } else {
              await login(cleanPhone, name, 'owner', restaurantName, undefined, pendingOAuthUser?.uid, isPohangResident || false, gender || 'male');
              sessionStorage.clear();
              navigate('/owner');
           }
        }
      }
    } catch (err) {
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'kakao' | 'naver' | 'google') => {
    setError('간편 로그인은 현재 준비 중입니다. 연락처로 로그인해 주세요.');
  };

  return (
    <div className="min-h-screen bg-[#fdfaf7] flex flex-col items-center justify-center p-6 selection:bg-primary/10">
      
      <div className="w-full max-w-md space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Logo Section */}
        <div className="text-center space-y-4">
           <div className="inline-flex w-20 h-20 rounded-[2rem] bg-primary text-white items-center justify-center font-serif italic text-4xl shadow-2xl rotate-3">결</div>
           <h1 className="text-3xl font-serif font-black italic text-[#261c1a]">사장님 관리 센터</h1>
           <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">Gyeol Owner Administration</p>
        </div>

        {/* Auth Box */}
        <div className="bg-white p-10 rounded-[3rem] shadow-3xl border border-[#e5dcd3] space-y-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>

           {error && <div className="bg-burgundy/5 text-burgundy p-4 rounded-xl text-xs font-bold text-center border border-burgundy/10 animate-in shake">{error}</div>}

           <div className="flex bg-[#fdfaf7] p-1.5 rounded-2xl">
              <button 
                onClick={() => setIsLogin(true)} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${isLogin ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant/40 hover:text-primary'}`}
              >로그인</button>
              <button 
                onClick={() => setIsLogin(false)} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${!isLogin ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant/40 hover:text-primary'}`}
              >신규 등록</button>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="space-y-6 animate-in fade-in duration-500">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1">매장 이름</label>
                      <input 
                        className="w-full bg-[#fdfaf7] border-none rounded-2xl px-6 py-4 text-sm font-sans focus:ring-1 focus:ring-primary shadow-inner"
                        placeholder="매장 명칭을 입력하세요"
                        value={restaurantName}
                        onChange={e => setRestaurantName(e.target.value)}
                        required={!isLogin}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1">사장님 성함</label>
                      <input 
                        className="w-full bg-[#fdfaf7] border-none rounded-2xl px-6 py-4 text-sm font-sans focus:ring-1 focus:ring-primary shadow-inner"
                        placeholder="실명을 입력하세요"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required={!isLogin}
                      />
                   </div>
                </div>
              )}

              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1">연락처</label>
                 <div className="relative">
                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/20" />
                    <input 
                      type="tel" 
                      className="w-full bg-[#fdfaf7] border-none rounded-2xl pl-14 pr-6 py-4 text-sm font-sans focus:ring-1 focus:ring-primary shadow-inner"
                      placeholder="010-0000-0000"
                      value={phone}
                      onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                      maxLength={13}
                      required
                    />
                 </div>
              </div>

              <button 
                 type="submit"
                 disabled={isLoading || phone.length < 10}
                 className="w-full py-5 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:bg-accent-burgundy active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
              >
                 {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? '로그인하기' : '매장 등록하기')}
                 <ChevronRight className="w-4 h-4" />
              </button>
           </form>

           <div className="pt-4 space-y-6">
              <div className="relative">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5dcd3]"></div></div>
                 <div className="relative flex justify-center text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/30"><span className="bg-white px-4">간편 인증</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => handleOAuthLogin('kakao')} className="py-4 bg-[#FEE500] rounded-xl flex items-center justify-center gap-2 hover:shadow-md transition-all">
                    <span className="text-[9px] font-black text-[#3c1e1e] uppercase tracking-widest">Kakao</span>
                 </button>
                 <button onClick={() => handleOAuthLogin('naver')} className="py-4 bg-[#03C75A] rounded-xl flex items-center justify-center gap-2 hover:shadow-md transition-all">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Naver</span>
                 </button>
              </div>
           </div>
        </div>

        <Link to="/" className="flex items-center justify-center gap-2 text-[10px] font-bold text-on-surface-variant/40 hover:text-primary transition-all">
           <ArrowLeft className="w-4 h-4" /> 메인으로 돌아가기
        </Link>

        <footer className="pt-8 text-center opacity-20">
           <p className="text-[8px] font-black uppercase tracking-[0.5em]">Gyeol Enterprise Security</p>
        </footer>
      </div>
    </div>
  );
}
