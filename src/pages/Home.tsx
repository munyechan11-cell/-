import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, UserCircle, ShieldCheck, ArrowRight, 
  Sparkles, Star, QrCode, Heart, Zap
} from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';

export default function Home() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  useEffect(() => {
    document.title = "결 (Gyeol) - 단골과 사장님이 만나는 정성의 숨결";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "가장 편리하고 품격 있는 단골 매니지먼트 플랫폼 '결'. 매장의 진심과 손님의 발걸음이 만나는 가장 아름다운 결을 경험하세요.");
    }
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring" as const, 
        damping: 25, 
        stiffness: 120 
      }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-gyeol-pattern flex flex-col items-center selection:bg-primary/20 relative overflow-x-hidden"
    >
      {/* Dynamic Background Grain Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              opacity: 0 
            }}
            animate={{ 
              y: [null, "-20%", "120%"],
              opacity: [0, 0.2, 0]
            }}
            transition={{ 
              duration: 15 + Math.random() * 10, 
              repeat: Infinity, 
              ease: "linear",
              delay: i * 2 
            }}
            style={{ y: i % 2 === 0 ? y1 : y2 }}
            className="absolute w-24 h-24 bg-primary/5 rounded-full blur-3xl"
          />
        ))}
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 text-center z-10 w-full max-w-4xl">
        <motion.div variants={itemVariants} className="inline-block mb-6">
           <span className="px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-black text-primary uppercase tracking-[0.3em]">
             실시간 매장 및 단골 관리 플랫폼
           </span>
        </motion.div>
        
        <motion.div variants={itemVariants} className="relative mb-12">
           <h1 className="text-[140px] sm:text-[180px] font-sans font-black text-primary leading-none tracking-tighter select-none relative drop-shadow-2xl">
             결
           </h1>
        </motion.div>

        <motion.p variants={itemVariants} className="text-lg sm:text-xl text-primary/70 font-sans font-bold max-w-2xl mx-auto mb-12 leading-relaxed">
          "사장님의 정성과 손님의 발걸음이 만나는 가장 아름다운 결"
        </motion.p>
      </section>

      {/* Action Portal */}
      <section className="w-full max-w-5xl px-6 grid grid-cols-1 md:grid-cols-2 gap-8 z-10 mb-32">
        <motion.div variants={itemVariants}>
          <Link 
            to="/scan"
            className="group relative block h-full p-10 rounded-[3rem] glass-effect hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:rotate-12">
               <QrCode className="w-48 h-48 text-primary" strokeWidth={0.5} />
            </div>
            
            <div className="relative z-20">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 mb-8 group-hover:rotate-6 transition-transform">
                 <UserCircle className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <h2 className="text-3xl font-sans font-black text-primary tracking-tight">손님 입장</h2>
                  <Sparkles className="w-5 h-5 text-gold animate-pulse" />
                </div>
                <p className="text-base text-primary/60 font-sans leading-relaxed max-w-xs">
                  매장의 QR 코드를 스캔하여 단골 장부에 등록하고 당신만을 위한 특별한 혜택을 경험하세요.
                </p>
                <div className="pt-4 flex items-center text-[10px] font-black text-primary uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform">
                  <span>지금 입장하기</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Link 
            to="/owner/login"
            className="group relative block h-full p-10 rounded-[3rem] bg-sidebar-bg border border-white/5 shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 overflow-hidden"
          >
            <div className="absolute bottom-0 right-0 p-10 opacity-[0.05] group-hover:opacity-[0.12] transition-all duration-700 group-hover:-translate-y-4">
               <Store className="w-48 h-48 text-white" strokeWidth={0.5} />
            </div>

            <div className="relative z-20">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-lg mb-8 group-hover:-rotate-6 transition-transform">
                 <Store className="w-7 h-7 text-white" strokeWidth={1.5} />
              </div>
              <div className="space-y-4 text-white">
                <div className="flex items-center space-x-3">
                  <h2 className="text-3xl font-sans font-black tracking-tight">사장님 관리</h2>
                  <Zap className="w-5 h-5 text-gold" />
                </div>
                <p className="text-base text-white/60 font-sans leading-relaxed max-w-xs">
                  실시간 데이터와 직관적인 통찰로 매장의 품격을 높이세요. 매장 운영의 효율과 단골을 동시에 관리할 수 있습니다.
                </p>
                <div className="pt-4 flex items-center text-[10px] font-black text-white uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform">
                  <span>포탈 접속하기</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </section>

      {/* Brand Values */}
      <section className="w-full max-w-6xl px-6 py-20 border-t border-primary/5 bg-white/30 backdrop-blur-sm">
        <motion.div variants={itemVariants} className="text-center mb-16">
          <h3 className="text-[11px] font-black text-primary/40 uppercase tracking-[0.5em] mb-4">핵심 가치</h3>
          <h2 className="text-4xl font-sans font-black text-primary">결의 세 가지 약속</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {[
            { icon: <Shield className="w-8 h-8" />, title: "신뢰", desc: "검증된 데이터를 통해 손님과 매장 사이의 깊은 신뢰 관계를 형성합니다." },
            { icon: <Heart className="w-8 h-8" />, title: "진심", desc: "단순한 거래를 넘어, 매장마다 담긴 고유한 정성과 철학을 온전히 전달합니다." },
            { icon: <Star className="w-8 h-8" />, title: "품질", desc: "정교한 매니지먼트 시스템으로 매장 운영의 품질을 한 단계 더 끌어올립니다." }
          ].map((val, idx) => (
            <motion.div 
              key={idx}
              variants={itemVariants}
              whileHover={{ y: -10 }}
              className="flex flex-col items-center text-center p-8 rounded-3xl hover:bg-white transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary mb-6">
                {val.icon}
              </div>
              <h4 className="text-xl font-sans font-black text-primary mb-3">{val.title}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">{val.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer / Master Admin */}
      <footer className="w-full mt-auto pt-32 pb-12 flex flex-col items-center z-10">
        <motion.div variants={itemVariants}>
          <Link 
            to="/master" 
            className="group flex items-center space-x-3 text-[10px] font-black text-primary/30 hover:text-primary transition-all uppercase tracking-[0.4em]"
          >
            <ShieldCheck className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" strokeWidth={3} />
            <span>시스템 관리자</span>
          </Link>
        </motion.div>
        
        <motion.div variants={itemVariants} className="mt-12 flex items-center space-x-8 text-[10px] font-bold text-primary/20 uppercase tracking-widest">
           <span>이용약관</span>
           <div className="w-1 h-1 rounded-full bg-primary/20"></div>
           <span>개인정보처리방침</span>
           <div className="w-1 h-1 rounded-full bg-primary/20"></div>
           <span>문의하기</span>
        </motion.div>
        
        <motion.p variants={itemVariants} className="mt-8 text-[9px] font-medium text-primary/10 uppercase tracking-[0.5em]">
          © 2026 결 페이퍼. All Rights Reserved.
        </motion.p>
      </footer>
    </motion.div>
  );
}
