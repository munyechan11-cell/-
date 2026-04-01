import { Link } from 'react-router-dom';
import { 
  Store, UserCircle, ShieldCheck, Heart, 
  MapPin, Clock, ArrowRight, Sparkles,
  Award, Star, LayoutGrid, Zap, QrCode
} from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center bg-surface-bright font-sans text-on-surface relative min-h-screen overflow-hidden px-6 pt-20 pb-32">
      {/* Decorative Brand Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full -ml-48 -mt-48 blur-3xl opacity-30"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full -mr-64 -mb-64 blur-3xl opacity-20"></div>

      {/* Hero Section */}
      <div className="text-center relative z-10 mb-16 animate-in fade-in slide-in-from-top-12 duration-1000 ease-out">
        <div className="inline-block relative mb-8">
           <h1 className="text-[120px] sm:text-[140px] font-serif font-black text-primary leading-none tracking-tighter italic select-none relative drop-shadow-sm">
             결
           </h1>
        </div>
        <div className="space-y-4 max-w-sm mx-auto">
          <p className="text-[11px] font-black text-primary/50 uppercase tracking-[0.4em] leading-relaxed">
            통합 매장 관리 및 단골 관리 시스템
          </p>
          <div className="h-px w-20 bg-primary/20 mx-auto"></div>
          <p className="text-base font-serif italic text-primary/80 leading-relaxed px-4">
            사장님의 정성과 손님의 발걸음을 잇는 공간
          </p>
        </div>
      </div>
      
      {/* Action Portal */}
      <div className="w-full max-w-xl space-y-6 mt-12 relative z-10">
        <Link 
          to="/scan"
          className="group relative block p-8 rounded-[2.5rem] bg-white border border-outline-variant/30 shadow-sm hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity">
             <QrCode className="w-32 h-32 text-primary" strokeWidth={1} />
          </div>
          
          <div className="flex items-center space-x-8">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 transition-transform duration-500">
               <UserCircle className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-serif font-black text-primary italic tracking-tight">손님 입장</h2>
                <div className="h-4 w-px bg-primary/20"></div>
                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">방문 및 혜택 확인</span>
              </div>
              <p className="text-sm text-primary/60 font-sans leading-relaxed max-w-[280px]">
                매장의 QR 코드를 스캔하여 단골 장부에 등록하고 특별한 혜택을 받으세요.
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full border border-primary/10 group-hover:bg-primary group-hover:text-white transition-all">
               <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        <Link 
          to="/owner/login"
          className="group relative block p-8 rounded-[2.5rem] bg-sidebar-bg border border-white/5 shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 overflow-hidden"
        >
          <div className="absolute bottom-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.15] transition-opacity translate-y-4">
             <Store className="w-32 h-32 text-white" strokeWidth={1} />
          </div>

          <div className="flex items-center space-x-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg transition-transform duration-500">
               <Store className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-serif font-black text-white italic tracking-tight">사장님 관리</h2>
                <div className="h-4 w-px bg-white/20"></div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">매장 거버넌스</span>
              </div>
              <p className="text-sm text-white/60 font-sans leading-relaxed max-w-[280px]">
                테이블 배치 관리 및 실시간 손님 통찰 데이터를 확인하여 운영 효율을 높이세요.
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full border border-white/10 group-hover:bg-white group-hover:text-sidebar-bg transition-all">
               <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>
      </div>

      {/* Footer / Master Admin */}
      <div className="mt-auto pt-24 pb-8 relative z-10 flex flex-col items-center">
        <Link 
          to="/master" 
          className="group flex items-center space-x-3 text-[11px] font-black text-primary/40 hover:text-primary transition-all uppercase tracking-[0.4em]"
        >
          <ShieldCheck className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
          <span>중앙 통합 관리자</span>
        </Link>
        <div className="mt-8 flex items-center space-x-6 opacity-10">
           <div className="h-1 w-1 rounded-full bg-primary/50"></div>
           <div className="h-1 w-1 rounded-full bg-primary/50"></div>
           <div className="h-1 w-1 rounded-full bg-primary/50"></div>
        </div>
      </div>
    </div>
  );
}
