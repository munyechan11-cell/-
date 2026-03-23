import { Link } from 'react-router-dom';
import { Store, UserCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-full flex flex-col items-center px-6 bg-white">
      <div className="mt-20 sm:mt-32 mb-10 flex flex-col items-center">
        <h1 
          className="text-[100px] sm:text-[120px] font-black text-slate-900 leading-none tracking-tighter"
        >
          결
        </h1>
        <p className="text-slate-500 font-medium mt-4 tracking-tight">
          스마트한 매장 관리의 시작
        </p>
      </div>
      
      <div className="w-full max-w-md space-y-4 mt-8">
        <Link 
          to="/scan"
          className="flex items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mr-5 group-hover:scale-105 transition-transform">
            <UserCircle className="w-7 h-7 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 mb-1">손님 버전</h2>
            <p className="text-sm text-slate-500 font-medium">테이블 QR 스캔 및 쿠폰 확인</p>
          </div>
        </Link>

        <Link 
          to="/owner/login"
          className="flex items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mr-5 group-hover:scale-105 transition-transform">
            <Store className="w-7 h-7 text-rose-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 mb-1">사장님 버전</h2>
            <p className="text-sm text-slate-500 font-medium">테이블 관리 및 고객 관리</p>
          </div>
        </Link>
      </div>

      <div className="mt-auto pt-8 pb-8">
        <Link to="/master" className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
          마스터 관리자
        </Link>
      </div>
    </div>
  );
}
