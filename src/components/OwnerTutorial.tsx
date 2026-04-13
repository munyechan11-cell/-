import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ChevronRight, ChevronLeft, Sparkles, 
  BarChart3, Users, Settings, Play, CheckCircle2,
  Cpu, Zap, ShieldCheck
} from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  icon: any;
  color: string;
}

const steps: TutorialStep[] = [
  {
    title: "단골 관리의 새로운 기준",
    description: "결(Gyeol) 2.0에 오신 것을 환영합니다. 사장님의 소중한 단골들을 단순한 데이터가 아닌 매장의 자산으로 키우는 여정을 시작해 보세요.",
    icon: Sparkles,
    color: "bg-primary"
  },
  {
    title: "AI 비즈니스 어시스턴트",
    description: "'매장 통계' 탭에서 AI에게 매출이나 단골 정보를 질문해 보세요. 복잡한 엑셀 데이터 대신 사장님께 꼭 필요한 인사이트를 즉시 답변해 드립니다.",
    icon: Cpu,
    color: "bg-gold"
  },
  {
    title: "모바일 주문 및 메뉴 관리",
    description: "손님들이 자리에서 직접 주문할 수 있는 디지털 메뉴판을 제공합니다. '매장 설정'에서 실시간으로 메뉴를 추가하고 가격을 조정할 수 있습니다.",
    icon: Zap,
    color: "bg-emerald-500"
  },
  {
    title: "강력한 Geofencing 보안",
    description: "매장에 실제로 방문한 손님들만 '결' 대시보드에 접근할 수 있도록 50m 위치 기반 보안 기능을 설정할 수 있습니다.",
    icon: ShieldCheck,
    color: "bg-burgundy"
  },
  {
    title: "이제 시작해 보세요!",
    description: "모든 준비가 끝났습니다. 매장의 가치를 높이는 단골 경영, '결'과 함께라면 4050 사장님들도 누구나 쉽고 완벽하게 해낼 수 있습니다.",
    icon: CheckCircle2,
    color: "bg-primary"
  }
];

interface OwnerTutorialProps {
  onClose: () => void;
}

export default function OwnerTutorial({ onClose }: OwnerTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-primary/20 backdrop-blur-3xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-[4rem] p-12 lg:p-16 shadow-3xl text-center relative overflow-hidden"
      >
        <button 
          onClick={onClose}
          className="absolute top-10 right-10 p-3 bg-primary/5 rounded-2xl text-primary/30 hover:text-primary transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center"
          >
            <div className={`w-24 h-24 ${step.color} rounded-[2.5rem] flex items-center justify-center text-white mb-10 shadow-heavy relative`}>
               <step.icon className="w-10 h-10" />
               <motion.div 
                 animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 className={`absolute inset-0 ${step.color} rounded-full blur-2xl -z-10`}
               />
            </div>

            <h2 className="text-3xl lg:text-4xl font-sans font-black text-primary mb-6 tracking-tight leading-tight">
              {step.title}
            </h2>
            
            <p className="text-base lg:text-lg font-bold text-primary/50 mb-12 leading-relaxed max-w-md">
              {step.description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-6">
           <button 
             onClick={nextStep}
             className="w-full py-7 bg-primary text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] shadow-heavy hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
           >
             {currentStep === steps.length - 1 ? "시작하기" : "다음 단계"}
             <ChevronRight className="w-5 h-5" />
           </button>
           
           <div className="flex justify-between items-center px-4">
              <button 
                onClick={prevStep}
                disabled={currentStep === 0}
                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${currentStep === 0 ? 'opacity-0' : 'text-primary/30 hover:text-primary'}`}
              >
                <ChevronLeft className="w-4 h-4" /> 이전으로
              </button>
              
              <div className="flex gap-2">
                 {steps.map((_, i) => (
                   <div 
                     key={i} 
                     className={`h-1.5 rounded-full transition-all duration-500 ${i === currentStep ? 'w-8 bg-primary' : 'w-2 bg-primary/10'}`} 
                   />
                 ))}
              </div>
              
              <div className="w-16" /> {/* Spacer */}
           </div>
        </div>
      </motion.div>
    </div>
  );
}
