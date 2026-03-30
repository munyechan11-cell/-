import { Link } from 'react-router-dom';
import { Store, UserCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-full flex flex-col items-center px-6 bg-hanji-light dark:bg-hanji-dark">
      <div className="mt-20 sm:mt-32 mb-10 flex flex-col items-center">
        <h1 
          className="text-[100px] sm:text-[120px] font-serif font-black text-ink-light dark:text-ink-dark leading-none tracking-tighter"
        >
          결
        </h1>
        <p className="text-ink-light/60 dark:text-ink-dark/60 font-medium mt-4 tracking-tight">
          스마트한 매장 관리의 시작
        </p>
      </div>
      
      <div className="w-full max-w-md space-y-4 mt-8">
        <Link 
          to="/scan"
          className="flex items-center bg-white dark:bg-black/20 p-6 rounded-3xl border border-ink-light/10 dark:border-ink-dark/10 shadow-sm hover:shadow-md hover:border-burgundy/30 dark:hover:border-burgundy-light/30 transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-burgundy/10 dark:bg-burgundy/20 flex items-center justify-center mr-5 group-hover:scale-105 transition-transform">
            <UserCircle className="w-7 h-7 text-burgundy dark:text-burgundy-light" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark mb-1">손님 버전</h2>
            <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 font-medium">테이블 QR 스캔 및 쿠폰 확인</p>
          </div>
        </Link>

        <Link 
          to="/owner/login"
          className="flex items-center bg-white dark:bg-black/20 p-6 rounded-3xl border border-ink-light/10 dark:border-ink-dark/10 shadow-sm hover:shadow-md hover:border-espresso/30 dark:hover:border-espresso-light/30 transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-espresso/10 dark:bg-espresso/20 flex items-center justify-center mr-5 group-hover:scale-105 transition-transform">
            <Store className="w-7 h-7 text-espresso dark:text-espresso-light" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-serif font-bold text-ink-light dark:text-ink-dark mb-1">사장님 버전</h2>
            <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 font-medium">테이블 관리 및 고객 관리</p>
          </div>
        </Link>
      </div>

      <div className="mt-auto pt-8 pb-8">
        <Link to="/master" className="text-xs font-medium text-ink-light/40 dark:text-ink-dark/40 hover:text-ink-light/60 dark:hover:text-ink-dark/60 transition-colors">
          마스터 관리자
        </Link>
      </div>
    </div>
  );
}
