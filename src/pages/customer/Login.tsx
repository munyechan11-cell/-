import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useStore, formatPhoneNumber } from '../../store';
import { QrCode, ArrowLeft, Heart, Sparkles, UserCircle, Phone, Loader2, Calendar, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CustomerLogin() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isPohangResident, setIsPohangResident] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthYear, setBirthYear] = useState('');
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

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setIsLoading(true);
    try {
      const user = await login('', '', 'customer', undefined, storeId, provider);
      if (tableNumber && storeId) {
        await recordVisit(user.id, parseInt(tableNumber), storeId);
      }
      navigate(`/customer/store/${storeId}`);
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
      if (!isLogin) {
         if (!name) throw new Error('성함을 입력해주세요.');
         if (!gender) throw new Error('성별을 선택해주세요.');
      }
      // For existing customers (isLogin=true), only phone is required
      const user = await login(phone, isLogin ? '' : name, 'customer', undefined, storeId, undefined, isPohangResident, gender || undefined, birthYear ? parseInt(birthYear) : undefined);
      if (tableNumber && storeId) {
        await recordVisit(user.id, parseInt(tableNumber), storeId);
      }
      navigate(`/customer/store/${storeId}`);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bright flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-primary/10">
        {/* Boutique Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
           <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-[120px]"></div>
           <div className="absolute bottom-0 right-0 w-[45rem] h-[45rem] bg-gold/5 rounded-full translate-x-1/3 translate-y-1/3 blur-[150px]"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full bg-white rounded-[4rem] shadow-premium border border-primary/5 p-12 text-center relative z-10"
        >
            <div className="flex justify-between items-center mb-12">
               <Link to="/" className="p-4 bg-surface-container rounded-2xl text-primary/30 hover:text-primary transition-all active:scale-95">
                  <ArrowLeft className="w-6 h-6 " />
               </Link>
               <div className="w-14 h-14 bg-gyeol-wood rounded-2xl flex items-center justify-center text-white font-serif italic text-2xl shadow-premium">결</div>
            </div>
            
            <div className="mb-14 text-center">
               <div className="flex items-center justify-center gap-3 mb-4 opacity-30">
                  <div className="w-8 h-px bg-primary"></div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] font-sans">
                     {currentStore?.restaurantName || 'Gyeol'} Invitation
                  </p>
                  <div className="w-8 h-px bg-primary"></div>
               </div>
               <h2 className="text-4xl font-serif font-black text-primary italic leading-none tracking-tight">
                  {isLogin ? '단골 로그인' : '장부 등록하기'}
               </h2>
               <p className="mt-4 text-xs font-medium text-primary/40 leading-relaxed">
                  {isLogin 
                    ? '반가운 발걸음, 다시 뵙게 되어 영광입니다.' 
                    : '오늘의 인연이 특별한 단골의 혜택으로 이어집니다.'}
               </p>
            </div>
            
            <div className="space-y-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                       <div className="relative group">
                          <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/20 group-focus-within:text-gold transition-colors" />
                          <input
                            type="tel"
                            className="w-full h-16 bg-surface-container border-none rounded-[2rem] pl-14 pr-6 font-bold text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-gold/20 shadow-inner transition-all text-lg"
                            placeholder="010-0000-0000"
                            value={phone}
                            onChange={e => setPhone(formatPhoneNumber(e.target.value))}
                            maxLength={13}
                            required
                          />
                       </div>
                       
                       {!isLogin && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-6 overflow-hidden"
                          >
                             {/* 필수 회원정보 */}
                             <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-3">
                                   <div className="px-3 py-1 bg-primary text-white text-[8px] font-black rounded-lg uppercase tracking-widest">필수 회원정보</div>
                                </div>
                                <div className="relative group">
                                   <UserCircle className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/20 group-focus-within:text-gold transition-colors" />
                                   <input
                                     type="text"
                                     className="w-full h-16 bg-surface-container border-none rounded-[2rem] pl-14 pr-6 font-bold text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-gold/20 shadow-inner transition-all text-lg"
                                     placeholder="이름 (성함 또는 닉네임)"
                                     value={name}
                                     onChange={e => setName(e.target.value)}
                                     required
                                   />
                                </div>
                                <p className="text-[9px] text-primary/20 font-bold pl-6">※ 연락처는 위에서 입력하셨습니다</p>
                             </div>

                             {/* 선택 회원정보 */}
                             <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                   <div className="px-3 py-1 bg-gold/20 text-gold text-[8px] font-black rounded-lg uppercase tracking-widest">선택 회원정보</div>
                                </div>
                                
                                <div className="flex gap-3">
                                   {(['male', 'female'] as const).map(g => (
                                      <button 
                                        key={g}
                                        type="button" 
                                        onClick={() => setGender(g)} 
                                        className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border ${gender === g ? 'bg-primary text-white border-primary shadow-xl' : 'bg-white text-primary/30 border-primary/5 hover:border-primary/20'}`}
                                      >
                                         {g === 'male' ? '남성' : '여성'}
                                      </button>
                                   ))}
                                </div>

                                <div className="relative group">
                                   <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/20 group-focus-within:text-gold transition-colors" />
                                   <input
                                     type="number"
                                     className="w-full h-16 bg-surface-container border-none rounded-[2rem] pl-14 pr-6 font-bold text-primary placeholder:text-primary/20 focus:ring-2 focus:ring-gold/20 shadow-inner transition-all text-lg"
                                     placeholder="출생년도 (예: 1995)"
                                     value={birthYear}
                                     onChange={e => setBirthYear(e.target.value)}
                                     min={1920}
                                     max={new Date().getFullYear()}
                                   />
                                </div>

                                <label className="flex items-center gap-4 px-6 py-5 bg-surface-container rounded-[2rem] cursor-pointer hover:bg-gold/5 transition-colors border border-transparent hover:border-gold/10">
                                   <input 
                                     type="checkbox" 
                                     checked={isPohangResident} 
                                     onChange={e => setIsPohangResident(e.target.checked)} 
                                     className="w-5 h-5 rounded-lg border-primary/10 text-gold focus:ring-gold bg-white" 
                                   />
                                   <span className="text-[11px] font-black text-primary/50 uppercase tracking-widest">포항 지역 주민 인증</span>
                                </label>
                             </div>
                          </motion.div>
                       )}
                    </div>
                    
                    {error && <p className="text-[10px] font-black text-burgundy uppercase tracking-widest animate-pulse">{error}</p>}

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full py-7 bg-primary text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[11px] shadow-heavy active:scale-[0.98] transition-all disabled:opacity-50 relative overflow-hidden"
                    >
                      {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      ) : (
                        <div className="flex items-center justify-center gap-4">
                           <Sparkles className="w-4 h-4 text-gold" />
                           {isLogin ? '로그인' : '장부 등록'}
                        </div>
                      )}
                    </button>
                </form>

                <div className="relative py-4">
                   <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-primary/5"></div></div>
                   <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.6em] text-primary/10">
                      <span className="bg-white px-6 italic">Secure Social Link</span>
                   </div>
                </div>

                <div className="flex flex-col gap-3">
                   <button 
                     onClick={() => handleOAuthLogin('google')} 
                     type="button"
                     className="w-full py-4 bg-white rounded-2xl border border-outline-variant/30 flex items-center justify-center gap-4 hover:shadow-lg transition-all group active:scale-[0.98]"
                   >
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      <span className="text-[10px] font-black text-[#261c1a] uppercase tracking-widest">Google로 시작하기</span>
                   </button>
                   <button 
                     onClick={() => handleOAuthLogin('kakao')} 
                     type="button"
                     className="w-full py-4 bg-[#FEE500] rounded-2xl flex items-center justify-center gap-3 hover:shadow-lg transition-all active:scale-[0.98]"
                   >
                      <div className="w-5 h-5 bg-[#3c1e1e] rounded-full flex items-center justify-center text-[8px] text-[#FEE500] font-black">K</div>
                      <span className="text-[10px] font-black text-[#3c1e1e] uppercase tracking-widest">Kakao로 시작하기</span>
                   </button>
                </div>

                <div className="flex justify-center w-full pb-4">
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    type="button"
                    className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] hover:text-gold transition-all"
                  >
                    {isLogin ? '처음 방문하셨나요? 장부 등록하기' : '이미 단골이신가요? 로그인'}
                  </button>
                </div>
            </div>
        </motion.div>
    </div>
  );
}
