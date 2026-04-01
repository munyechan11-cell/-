import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { 
  Users, ChevronRight, Loader2, Sparkles, 
  MapPin, Heart, Star, Award, 
  Zap, Store, Smartphone, User, Phone, CheckCircle2
} from 'lucide-react';

const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/[^\d]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export default function CustomerLogin() {
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('storeId') || '';
  const tableNum = searchParams.get('table');
  
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isPohangResident, setIsPohangResident] = useState<boolean | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, users, stores, currentUser } = useStore();

  const currentStore = stores.find(s => s.id === storeId);

  useEffect(() => {
    if (currentUser && currentUser.role === 'customer') {
      navigate(storeId ? `/customer/store/${storeId}${tableNum ? `?table=${tableNum}` : ''}` : '/customer');
    }
  }, [currentUser, navigate, storeId, tableNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('올바른 휴대전화 번호를 입력해주세요.');
      return;
    }

    if (!isLogin && (isPohangResident === null || gender === null)) {
      setError('추가 정보를 모두 선택해 주세요.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const existingUser = users.find(u => u.phone.replace(/[^0-9]/g, '') === cleanPhone);
        if (existingUser) {
          await login(cleanPhone, existingUser.name, 'customer');
          navigate(storeId ? `/customer/store/${storeId}${tableNum ? `?table=${tableNum}` : ''}` : '/customer');
        } else {
          setError('등록되지 않은 번호입니다. 회원가입을 먼저 진행해 주세요.');
          setIsLogin(false);
        }
      } else {
        await login(cleanPhone, name, 'customer', undefined, undefined, undefined, isPohangResident || false, gender || 'male');
        navigate(storeId ? `/customer/store/${storeId}${tableNum ? `?table=${tableNum}` : ''}` : '/customer');
      }
    } catch (err: any) {
      setError(err.message || '인증 과정에서 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    setError('간편 로그인은 현재 준비 중입니다. 연락처로 로그인해 주세요.');
  };

  return (
    <div className="min-h-screen bg-[#fdfaf7] flex flex-col items-center justify-center p-6 selection:bg-primary/10">
      
      <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="text-center space-y-4">
           <div className="inline-flex w-16 h-16 rounded-3xl bg-primary text-white items-center justify-center font-serif italic text-3xl shadow-2xl rotate-3">결</div>
           <div>
              <h1 className="text-2xl font-serif font-black italic text-[#261c1a]">가동을 시작합니다</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mt-1">Gyeol Customer Access</p>
           </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-3xl border border-[#e5dcd3] space-y-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>

           {error && (
              <div className="bg-burgundy/5 text-burgundy p-4 rounded-2xl text-[10px] font-black text-center border border-burgundy/10 animate-in shake">
                {error}
              </div>
           )}

           <div className="flex bg-[#fdfaf7] p-1.5 rounded-2xl">
              <button 
                onClick={() => setIsLogin(true)} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${isLogin ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant/40 hover:text-primary'}`}
              >기존 고객</button>
              <button 
                onClick={() => setIsLogin(false)} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${!isLogin ? 'bg-primary text-white shadow-lg' : 'text-on-surface-variant/40 hover:text-primary'}`}
              >신규 고객</button>
           </div>

           <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-5 animate-in fade-in duration-500">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1 text-primary">이름</label>
                      <input 
                        className="w-full bg-[#fdfaf7] border-none rounded-2xl px-6 py-4 text-sm font-sans focus:ring-1 focus:ring-primary shadow-inner"
                        placeholder="이름을 입력해 주세요"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required={!isLogin}
                      />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1 text-primary">성별</label>
                        <div className="flex gap-2">
                           <button type="button" onClick={() => setGender('male')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${gender === 'male' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-on-surface-variant/40 border-[#e5dcd3] hover:border-primary/30'}`}>남성</button>
                           <button type="button" onClick={() => setGender('female')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${gender === 'female' ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-on-surface-variant/40 border-[#e5dcd3] hover:border-primary/30'}`}>여성</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1 text-primary">포항 거주</label>
                        <div className="flex gap-2">
                           <button type="button" onClick={() => setIsPohangResident(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${isPohangResident === true ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-on-surface-variant/40 border-[#e5dcd3] hover:border-primary/30'}`}>예</button>
                           <button type="button" onClick={() => setIsPohangResident(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-bold border transition-all ${isPohangResident === false ? 'bg-primary text-white border-primary shadow-lg' : 'bg-white text-on-surface-variant/40 border-[#e5dcd3] hover:border-primary/30'}`}>아니오</button>
                        </div>
                      </div>
                   </div>
                </div>
              )}

              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest ml-1 text-primary">휴대전화</label>
                 <input 
                    type="tel" 
                    className="w-full bg-[#fdfaf7] border-none rounded-2xl px-6 py-4 text-sm font-sans focus:ring-1 focus:ring-primary shadow-inner"
                    placeholder="010-0000-0000"
                    value={phone}
                    onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                    maxLength={13}
                 />
              </div>

              <button 
                 type="submit"
                 disabled={isLoading || phone.length < 10}
                 className="w-full py-5 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:bg-accent-burgundy active:scale-[0.98] transition-all flex items-center justify-center gap-3"
              >
                 {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? '입장하기' : '등록하고 시작')}
                 <ChevronRight className="w-4 h-4" />
              </button>
           </form>

           <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5dcd3]"></div></div>
              <div className="relative flex justify-center text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/30"><span className="bg-white px-4">간편 로그인</span></div>
           </div>

            <div className="flex flex-col gap-3">
               <button onClick={() => handleOAuthLogin('google')} className="w-full py-4 bg-[#fdfaf7] rounded-xl border border-[#e5dcd3] flex items-center justify-center gap-3 hover:bg-white transition-all group">
                 <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                 <span className="text-[10px] font-black text-[#261c1a] uppercase tracking-widest">구글 계정으로 계속하기</span>
               </button>
               <button onClick={() => handleOAuthLogin('kakao')} className="w-full py-4 bg-[#FEE500] rounded-xl flex items-center justify-center gap-3 hover:shadow-md transition-all">
                 <span className="w-5 h-5 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[10px] text-[#FEE500] font-black">K</span>
                 <span className="text-[10px] font-black text-[#3c1e1e] uppercase tracking-widest">카카오 로그인</span>
               </button>
            </div>
        </div>

        <p className="text-center text-[10px] text-on-surface-variant/30 leading-relaxed font-serif italic">
          등록 시 매장의 단골 관리 시스템에 자동 등록되며,<br/>
          최고의 서비스를 위한 사장님의 손님 명부에 기록됩니다.
        </p>
      </div>
    </div>
  );
}
