import React, { useState } from 'react';
import { useStore, getTierCustomName } from '../../store';
import { 
  ArrowLeft, Save, Sparkles, Gift, Trash2, Plus, 
  Loader2, ShieldCheck, Heart, Star, Award, 
  ChevronRight, LayoutGrid, Users, BarChart3, LogOut,
  Store as StoreIcon, Edit2, Settings
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function BrandSettings() {
  const { currentUser, updateBrandSettings } = useStore();
  const navigate = useNavigate();
  
  const [tierNames, setTierNames] = useState<Record<string, string>>(currentUser?.tierNames || {
    'VIP': '장인',
    '다이아': '다이아',
    '골드': '골드',
    '실버': '실버',
    '브론즈': '브론즈'
  });

  const [tierRewards, setTierRewards] = useState<Record<string, string>>(currentUser?.tierRewards || {
    'VIP': '모든 메뉴 20% 할인 + 특별 서비스',
    '다이아': '메인 메뉴 10% 할인',
    '골드': '사이드 메뉴 서비스',
    '실버': '음료 서비스',
    '브론즈': '기본 서비스'
  });

  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) return null;

  const handleLogout = () => {
    navigate('/');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBrandSettings(currentUser.id, { tierNames, tierRewards });
      import('../../store').then(({ showToast }) => showToast('공방 설정이 성공적으로 저장되었습니다.', 'success')).catch(console.error);
      navigate('/owner');
    } catch (error) {
      console.error(error);
      import('../../store').then(({ showToast }) => showToast('설정 저장 중 오류가 발생했습니다.', 'error')).catch(console.error);
    } finally {
      setIsSaving(false);
    }
  };

  const tiers = ['VIP', '다이아', '골드', '실버', '브론즈'];

  const getTierIcon = (tier: string) => {
    switch(tier) {
      case 'VIP': return <Award className="w-6 h-6" />;
      case '다이아': return <Star className="w-6 h-6" />;
      case '골드': return <ShieldCheck className="w-6 h-6" />;
      default: return <Heart className="w-6 h-6" />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface hanji-texture relative">
      <div className="lattice-overlay absolute inset-0 pointer-events-none opacity-5"></div>
      
      {/* Sidebar - Consistent with Owner Suite */}
      <aside className="h-screen w-20 md:w-64 border-r border-primary/5 bg-primary shadow-2xl flex flex-col py-8 z-50 transition-all duration-500">
        <div className="px-6 md:px-8 mb-12">
          <h1 className="text-surface-bright font-serif italic text-2xl md:text-3xl tracking-tighter hidden md:block">결 (Gyeol)</h1>
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3 md:hidden mx-auto">
             <span className="text-white font-serif italic text-xl">결</span>
          </div>
          <div className="mt-8 hidden md:flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center border border-white/10 rotate-3">
              <StoreIcon className="text-white w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 공방'}</p>
              <p className="font-black uppercase tracking-widest text-[9px] text-white/40">장인 관리자</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <Link 
            to="/owner"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">매장 전도</span>
          </Link>
          
          <Link 
            to="/owner/customers"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">단골 장부</span>
          </Link>
          
          <Link 
            to="/owner/statistics"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 text-white/60 hover:text-white hover:bg-white/5"
          >
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">분석 및 통계</span>
          </Link>

          <Link 
            to="/owner/brand-settings"
            className="w-full flex items-center space-x-4 px-6 md:px-8 py-3.5 transition-all duration-300 bg-primary-container text-white border-l-4 border-white"
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-black uppercase tracking-widest text-[10px] hidden md:block">브랜드 설정 (Heritage)</span>
          </Link>
        </nav>
        
        <div className="px-4 md:px-8 mt-auto pt-8 space-y-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center space-x-4 px-2 md:px-0 py-3.5 text-white/40 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-bold">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:block">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-bright/50 backdrop-blur-sm">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-6 md:px-10 py-5 border-b border-primary/5">
          <div className="flex items-center space-x-4 md:space-x-12">
            <div className="font-serif text-xl md:text-2xl font-black text-primary tracking-tighter italic">고유 브랜드 설정 (Heritage)</div>
            <div className="h-6 w-px bg-primary/10 hidden md:block"></div>
            <div className="hidden lg:flex items-center space-x-4">
               <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">브랜드 헤리티지 관리</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
               onClick={handleSave}
               disabled={isSaving}
               className="flex items-center space-x-3 px-8 py-3 bg-burgundy text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-burgundy/90 disabled:opacity-30 shadow-2xl shadow-burgundy/20 hover:scale-105 active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
              <span>설정 저장 히스토리</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-6 md:p-10">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
               <h2 className="text-4xl font-serif font-black text-primary tracking-tight italic">단골의 위계 (Citizens)</h2>
               <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2">당신의 공방을 아껴주시는 시민들의 등급과 혜택을 정의합니다.</p>
            </div>
          </div>

          <div className="max-w-5xl space-y-12 pb-32">
            {/* Intro Alert */}
            <div className="bg-primary p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group border border-primary/10 transition-all hover:border-primary/30">
               <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
               <div className="flex items-start space-x-8 relative z-10">
                  <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center border border-white/20 rotate-12 group-hover:rotate-0 transition-transform duration-700 shadow-2xl">
                     <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div className="max-w-2xl">
                     <h3 className="text-3xl font-serif font-black text-white tracking-tight mb-4 italic text-glow">맞춤형 단골 관리 시스템</h3>
                     <p className="text-white/70 text-sm leading-relaxed font-serif italic serif">
                        공방만의 특별한 등급 이름을 짓고, 그에 걸맞은 혜택을 설정해보세요. 
                        변경 사항은 시민들의 개인 장부(앱)와 관리자용 실시간 전도에 즉시 반영되어
                        더욱 깊은 유대감을 형성할 수 있도록 돕습니다.
                     </p>
                  </div>
               </div>
            </div>

            {/* Tier Configuration Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {tiers.map((tierKey, index) => (
                <div 
                  key={tierKey} 
                  className="bg-white rounded-[4rem] p-12 shadow-sm border border-primary/5 group hover:border-primary/20 hover:shadow-2xl transition-all duration-700 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                     {getTierIcon(tierKey)}
                  </div>
                  
                  <div className="flex items-center space-x-6 mb-12">
                    <div className="w-16 h-16 rounded-3xl bg-primary/5 flex items-center justify-center text-primary font-serif font-black text-2xl border-2 border-primary/5 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                      {tiers.length - index}
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em] mb-1">표준 위계 분류</h4>
                       <p className="text-2xl font-serif font-black text-primary italic">{tierKey}</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div className="space-y-4">
                      <label className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] flex items-center space-x-2 ml-1">
                        <Edit2 className="w-3 h-3" />
                        <span>맞춤형 등급명 (Lineage)</span>
                      </label>
                      <input
                        type="text"
                        value={tierNames[tierKey] || ''}
                        onChange={(e) => setTierNames({ ...tierNames, [tierKey]: e.target.value })}
                        placeholder={`예: 명장, 숙련공 (레벨 ${tiers.length - index})`}
                        className="w-full px-8 py-5 bg-primary/[0.02] border border-primary/5 rounded-[2rem] text-primary font-black uppercase tracking-widest text-[10px] focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner focus:bg-white"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] flex items-center space-x-2 ml-1">
                        <Gift className="w-3 h-3" strokeWidth={3} />
                        <span>위계에 따른 혜택 (Sacred Reward)</span>
                      </label>
                      <input
                        type="text"
                        value={tierRewards[tierKey] || ''}
                        onChange={(e) => setTierRewards({ ...tierRewards, [tierKey]: e.target.value })}
                        placeholder="예: 웰컴 티 제공, 수제 반찬 10% 증정..."
                        className="w-full px-8 py-5 bg-primary/[0.02] border border-primary/5 rounded-[2rem] text-primary font-serif italic text-xs focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all shadow-inner focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
