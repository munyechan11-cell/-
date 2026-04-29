import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useStore, formatPhoneNumber } from '../../store';
import { ArrowLeft, Sparkles, UserCircle, Phone, Loader2, Calendar, Users, ShieldCheck, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대', '60대 이상'] as const;

export default function CustomerLogin() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState(1); // 1: 기본정보, 2: 추가정보, 3: 동의

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [isPohangResident, setIsPohangResident] = useState(false);

  // Privacy consents
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeService, setAgreeService] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, users, currentUser, recordVisit } = useStore();
  const currentStore = users.find(u => u.id === storeId && u.role === 'owner');

  useEffect(() => {
    if (currentUser && currentUser.role === 'customer') {
      navigate(`/customer/store/${storeId}`);
    }
  }, [currentUser, storeId, navigate]);

  // Auto-calculate age group from birth year
  useEffect(() => {
    if (birthYear && birthYear.length === 4) {
      const age = new Date().getFullYear() - parseInt(birthYear);
      if (age < 20) setAgeGroup('10대');
      else if (age < 30) setAgeGroup('20대');
      else if (age < 40) setAgeGroup('30대');
      else if (age < 50) setAgeGroup('40대');
      else if (age < 60) setAgeGroup('50대');
      else setAgeGroup('60대 이상');
    }
  }, [birthYear]);

  const handleAgreeAll = (checked: boolean) => {
    setAgreeAll(checked);
    setAgreePrivacy(checked);
    setAgreeService(checked);
    setAgreeMarketing(checked);
  };

  useEffect(() => {
    setAgreeAll(agreePrivacy && agreeService && agreeMarketing);
  }, [agreePrivacy, agreeService, agreeMarketing]);

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
      const user = await login('', '', 'customer', undefined, storeId, provider);
      if (tableNumber && storeId) await recordVisit(user.id, parseInt(tableNumber), storeId);
      navigate(`/customer/store/${storeId}`);
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep1 = () => {
    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) { setError('올바른 전화번호를 입력해주세요.'); return false; }
    if (!name.trim()) { setError('이름을 입력해주세요.'); return false; }
    setError(''); return true;
  };

  const validateStep2 = () => {
    if (!gender) { setError('성별을 선택해주세요.'); return false; }
    if (!birthYear || birthYear.length !== 4) { setError('출생 연도 4자리를 입력해주세요.'); return false; }
    if (!birthMonth || !birthDay) { setError('생일(월/일)을 입력해주세요.'); return false; }
    if (!ageGroup) { setError('연령대를 선택해주세요.'); return false; }
    setError(''); return true;
  };

  const handleSubmit = async () => {
    if (!agreePrivacy || !agreeService) { setError('필수 동의 항목에 체크해주세요.'); return; }
    setIsLoading(true); setError('');
    const birthday = `${birthMonth.padStart(2,'0')}-${birthDay.padStart(2,'0')}`;
    try {
      const user = await login(phone, name, 'customer', undefined, storeId, undefined, isPohangResident, gender || undefined, parseInt(birthYear), birthday, ageGroup, new Date().toISOString());
      if (tableNumber && storeId) await recordVisit(user.id, parseInt(tableNumber), storeId);
      navigate(`/customer/store/${storeId}`);
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError('');
    try {
      const user = await login(phone, '', 'customer', undefined, storeId);
      if (tableNumber && storeId) await recordVisit(user.id, parseInt(tableNumber), storeId);
      navigate(`/customer/store/${storeId}`);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full h-14 bg-surface-container border-none rounded-2xl pl-14 pr-6 font-bold text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-gold/20 shadow-inner transition-all text-base";
  const iconClass = "absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/20 group-focus-within:text-gold transition-colors";

  // ─── REGISTER MODE ───
  const renderRegisterForm = () => (
    <AnimatePresence mode="wait">
      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

        {/* Step Indicator */}
        <div className="flex items-center gap-2 justify-center mb-8">
          {[1,2,3].map(s => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${step >= s ? 'bg-primary text-white shadow-lg' : 'bg-primary/5 text-primary/30'}`}>{s}</div>
              {s < 3 && <div className={`w-8 h-0.5 rounded-full transition-all ${step > s ? 'bg-primary' : 'bg-primary/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <h3 className="text-lg font-black text-primary text-center">기본 정보 입력</h3>
            <p className="text-[10px] text-primary/40 text-center font-bold uppercase tracking-widest">필수 수집 항목</p>
            <div className="relative group">
              <Phone className={iconClass} />
              <input type="tel" className={inputClass} placeholder="전화번호 (카카오계정)" value={phone} onChange={e => setPhone(formatPhoneNumber(e.target.value))} maxLength={13} required />
            </div>
            <div className="relative group">
              <UserCircle className={iconClass} />
              <input type="text" className={inputClass} placeholder="이름 (실명)" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            {error && <p className="text-[10px] font-black text-burgundy text-center">{error}</p>}
            <button type="button" onClick={() => validateStep1() && setStep(2)} className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 shadow-heavy active:scale-95 transition-all">
              다음 단계 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h3 className="text-lg font-black text-primary text-center">추가 정보 입력</h3>
            <p className="text-[10px] text-primary/40 text-center font-bold uppercase tracking-widest">필수 수집 항목</p>

            {/* Gender */}
            <div>
              <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2 block pl-1">성별 *</label>
              <div className="flex gap-3">
                {(['male','female'] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)} className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border ${gender === g ? 'bg-primary text-white border-primary shadow-xl' : 'bg-white text-primary/30 border-primary/10 hover:border-primary/30'}`}>
                    {g === 'male' ? '남성' : '여성'}
                  </button>
                ))}
              </div>
            </div>

            {/* Birth Year */}
            <div>
              <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2 block pl-1">출생 연도 *</label>
              <div className="relative group">
                <Calendar className={iconClass} />
                <input type="number" className={inputClass} placeholder="예: 1995" value={birthYear} onChange={e => setBirthYear(e.target.value.slice(0,4))} min={1920} max={new Date().getFullYear()} />
              </div>
            </div>

            {/* Birthday (Month/Day) */}
            <div>
              <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2 block pl-1">생일 (월 / 일) *</label>
              <div className="flex gap-3">
                <input type="number" className="flex-1 h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-gold/20 shadow-inner text-base text-center" placeholder="월" value={birthMonth} onChange={e => setBirthMonth(e.target.value.slice(0,2))} min={1} max={12} />
                <input type="number" className="flex-1 h-14 bg-surface-container border-none rounded-2xl px-6 font-bold text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-gold/20 shadow-inner text-base text-center" placeholder="일" value={birthDay} onChange={e => setBirthDay(e.target.value.slice(0,2))} min={1} max={31} />
              </div>
            </div>

            {/* Age Group */}
            <div>
              <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2 block pl-1">연령대 *</label>
              <div className="grid grid-cols-3 gap-2">
                {AGE_GROUPS.map(ag => (
                  <button key={ag} type="button" onClick={() => setAgeGroup(ag)} className={`py-3 rounded-xl text-[11px] font-black transition-all border ${ageGroup === ag ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-primary/30 border-primary/10 hover:border-primary/20'}`}>
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[10px] font-black text-burgundy text-center">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setError(''); setStep(1); }} className="flex-1 py-5 bg-primary/5 text-primary rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">이전</button>
              <button type="button" onClick={() => validateStep2() && setStep(3)} className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-heavy active:scale-95 transition-all">
                다음 단계 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-black text-primary text-center">개인정보 수집 · 이용 동의</h3>
            <p className="text-[10px] text-primary/40 text-center font-bold uppercase tracking-widest">아래 내용을 확인하고 동의해 주세요</p>

            {/* Collected items summary */}
            <div className="bg-surface-container rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">수집 항목</p>
              <div className="grid grid-cols-3 gap-2">
                {['이름','성별','연령대','생일','출생연도','전화번호'].map(item => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-gold" />
                    <span className="text-[11px] font-bold text-primary/60">{item}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-primary/5 pt-3 space-y-1">
                <p className="text-[10px] font-bold text-primary/40"><span className="font-black text-primary/60">수집 목적:</span> 단골 등급 관리, 맞춤 혜택 제공, 서비스 이용</p>
                <p className="text-[10px] font-bold text-primary/40"><span className="font-black text-primary/60">보유 기간:</span> 회원 탈퇴 시 또는 수집 목적 달성 시 즉시 파기</p>
              </div>
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-4 bg-primary rounded-2xl cursor-pointer">
                <input type="checkbox" checked={agreeAll} onChange={e => handleAgreeAll(e.target.checked)} className="w-5 h-5 rounded-md border-white/30 text-gold focus:ring-gold bg-white/10" />
                <span className="text-[12px] font-black text-white tracking-wide">전체 동의하기</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-white border border-primary/10 rounded-2xl cursor-pointer hover:bg-surface-container transition-colors">
                <input type="checkbox" checked={agreePrivacy} onChange={e => setAgreePrivacy(e.target.checked)} className="w-5 h-5 rounded-md border-primary/20 text-primary focus:ring-primary" />
                <span className="text-[11px] font-bold text-primary/70">[필수] 개인정보 수집 · 이용 동의</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-white border border-primary/10 rounded-2xl cursor-pointer hover:bg-surface-container transition-colors">
                <input type="checkbox" checked={agreeService} onChange={e => setAgreeService(e.target.checked)} className="w-5 h-5 rounded-md border-primary/20 text-primary focus:ring-primary" />
                <span className="text-[11px] font-bold text-primary/70">[필수] 서비스 이용약관 동의</span>
              </label>
              <label className="flex items-center gap-3 p-4 bg-white border border-primary/10 rounded-2xl cursor-pointer hover:bg-surface-container transition-colors">
                <input type="checkbox" checked={agreeMarketing} onChange={e => setAgreeMarketing(e.target.checked)} className="w-5 h-5 rounded-md border-primary/20 text-primary focus:ring-primary" />
                <span className="text-[11px] font-bold text-primary/70">[선택] 마케팅 정보 수신 동의</span>
              </label>
            </div>

            {error && <p className="text-[10px] font-black text-burgundy text-center">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setError(''); setStep(2); }} className="flex-1 py-5 bg-primary/5 text-primary rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">이전</button>
              <button type="button" onClick={handleSubmit} disabled={isLoading} className="flex-[2] py-5 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-heavy active:scale-95 transition-all disabled:opacity-50">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> 가입 완료</>}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-primary/10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[45rem] h-[45rem] bg-gold/5 rounded-full translate-x-1/3 translate-y-1/3 blur-[150px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="max-w-md w-full bg-white rounded-[3rem] shadow-premium border border-primary/5 p-10 relative z-10">
        <div className="flex justify-between items-center mb-10">
          <Link to="/" className="p-3 bg-surface-container rounded-xl text-primary/30 hover:text-primary transition-all active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-12 h-12 bg-gyeol-wood rounded-xl flex items-center justify-center text-white font-serif italic text-xl shadow-premium">결</div>
        </div>

        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3 opacity-30">
            <div className="w-6 h-px bg-primary" />
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">{currentStore?.restaurantName || 'Gyeol'}</p>
            <div className="w-6 h-px bg-primary" />
          </div>
          <h2 className="text-3xl font-serif font-black text-primary italic leading-none tracking-tight">
            {mode === 'login' ? '단골 로그인' : '회원가입'}
          </h2>
        </div>

        {mode === 'login' ? (
          <div className="space-y-8">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="relative group">
                <Phone className={iconClass} />
                <input type="tel" className={inputClass} placeholder="전화번호" value={phone} onChange={e => setPhone(formatPhoneNumber(e.target.value))} maxLength={13} required />
              </div>
              {error && <p className="text-[10px] font-black text-burgundy text-center">{error}</p>}
              <button type="submit" disabled={isLoading} className="w-full py-6 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] shadow-heavy active:scale-[0.98] transition-all disabled:opacity-50">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="flex items-center justify-center gap-3"><Sparkles className="w-4 h-4 text-gold" /> 로그인</span>}
              </button>
            </form>

            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-primary/5" /></div>
              <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.5em] text-primary/10"><span className="bg-white px-4">or</span></div>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => handleOAuthLogin('google')} type="button" className="w-full py-4 bg-white rounded-xl border border-primary/10 flex items-center justify-center gap-3 hover:shadow-md transition-all active:scale-[0.98]">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Google</span>
              </button>
              <button onClick={() => handleOAuthLogin('kakao')} type="button" className="w-full py-4 bg-[#FEE500] rounded-xl flex items-center justify-center gap-3 hover:shadow-md transition-all active:scale-[0.98]">
                <div className="w-4 h-4 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[7px] text-[#FEE500] font-black">K</div>
                <span className="text-[10px] font-black text-[#3c1e1e] uppercase tracking-widest">Kakao</span>
              </button>
            </div>
          </div>
        ) : (
          renderRegisterForm()
        )}

        <div className="flex justify-center w-full pt-6">
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setStep(1); setError(''); }} type="button" className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] hover:text-gold transition-all">
            {mode === 'login' ? '처음 방문하셨나요? 회원가입' : '이미 단골이신가요? 로그인'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
