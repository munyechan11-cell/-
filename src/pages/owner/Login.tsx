import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Store, ArrowLeft } from 'lucide-react';

export default function OwnerLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, users, currentUser } = useStore();

  useEffect(() => {
    if (currentUser?.role === 'owner') {
      navigate('/owner');
    }
  }, [currentUser, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
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
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#E7E0D7] focus:border-[#4E342E] focus:ring-0 transition-colors"
              required
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
                />
              </div>
            </>
          )}

          <button 
            type="submit"
            className="w-full bg-[#4E342E] hover:bg-[#3E2723] text-white font-bold py-4 rounded-xl transition-colors text-lg"
          >
            {isLogin ? '로그인' : '회원가입 및 시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
