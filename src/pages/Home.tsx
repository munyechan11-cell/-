import { Link } from 'react-router-dom';
import { Store, UserCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-full flex flex-col items-center px-6 bg-transparent">
      <div className="mt-20 sm:mt-32 mb-10 flex flex-col items-center">
        <h1 
          className="text-[100px] sm:text-[120px] font-black text-[#151515] leading-none"
          style={{ textShadow: '3px 4px 6px rgba(0, 0, 0, 0.15)' }}
        >
          결
        </h1>
      </div>
      
      <p className="text-lg text-[#4E342E] mb-8 tracking-tight">
        원하시는 버전을 선택해주세요.
      </p>

      <div className="w-full max-w-md space-y-4">
        <Link 
          to="/scan"
          className="flex items-center bg-white/85 p-6 rounded-[20px] border border-[#E7E0D7] shadow-[0_4px_10px_rgba(78,52,46,0.06)] hover:bg-white transition-all"
        >
          <div className="w-16 h-16 rounded-full bg-[#FFF3E0] flex items-center justify-center mr-5">
            <UserCircle className="w-8 h-8 text-[#D84315]" />
          </div>
          <div className="flex-1">
            <h2 className="text-[22px] font-bold text-[#2D1B15] mb-1.5">손님 버전</h2>
            <p className="text-sm text-[#795548]">테이블 QR 스캔 및 쿠폰 확인</p>
          </div>
        </Link>

        <Link 
          to="/owner/login"
          className="flex items-center bg-white/85 p-6 rounded-[20px] border border-[#E7E0D7] shadow-[0_4px_10px_rgba(78,52,46,0.06)] hover:bg-white transition-all"
        >
          <div className="w-16 h-16 rounded-full bg-[#EFEBE9] flex items-center justify-center mr-5">
            <Store className="w-8 h-8 text-[#4E342E]" />
          </div>
          <div className="flex-1">
            <h2 className="text-[22px] font-bold text-[#2D1B15] mb-1.5">사장님 버전</h2>
            <p className="text-sm text-[#795548]">테이블 관리 및 고객 관리</p>
          </div>
        </Link>
      </div>

      <div className="mt-auto pt-8 pb-4">
        <Link to="/master" className="text-xs text-[#A1887F] hover:text-[#795548] transition-colors">
          마스터 관리자
        </Link>
      </div>
    </div>
  );
}
