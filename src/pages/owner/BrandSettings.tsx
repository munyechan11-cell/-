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
    'VIP': '사장님 특별 손님',
    '다이아': '최고 단골',
    '골드': '골드 회원',
    '실버': '실버 회원',
    '브론즈': '일반 단골'
  });

  const [tierRewards, setTierRewards] = useState<Record<string, string>>(currentUser?.tierRewards || {
    'VIP': '전 메뉴 10% 상시 할인 + 사장님 특별 모듬 서비스',
    '다이아': '메인 메뉴 5,000원 할인 + 음료 서비스',
    '골드': '사이드 메뉴 1종 무료 (식사 시)',
    '실버': '음료 1캔 무료 제공',
    '브론즈': '재방문 시 스탬프 추가 적립'
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
      navigate('/owner');
    } catch (error) {
      console.error(error);
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
    <div className="flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20">
      
      {/* Sidebar - Consistent */}
      <aside className="h-screen w-20 lg:w-64 fixed left-0 border-r-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
        <div className="px-8 mb-12">
          <Link to="/" className="text-[#fcfcfc] font-serif italic text-2xl tracking-tighter block">결</Link>
          <div className="mt-8 hidden lg:flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 overflow-hidden">
                <StoreIcon className="w-full h-full p-2 text-white/40" />
             </div>
             <div>
                <p className="text-[#fcfcfc] font-serif italic text-sm truncate">{currentUser.restaurantName || '나의 매장'}</p>
                <p className="text-[#fcfcfc]/50 font-sans uppercase tracking-widest text-[10px]">사장님 관리 시스템</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <Link to="/owner" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <LayoutGrid className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">대시보드</span>
          </Link>
          <Link to="/owner/customers" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <Users className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">단골 관리</span>
          </Link>
          <Link to="/owner/statistics" className="text-[#fcfcfc]/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all duration-300">
            <BarChart3 className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">매장 통계</span>
          </Link>
          <Link to="/owner/brand-settings" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4 transition-transform ease-in-out">
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="font-sans uppercase tracking-widest text-xs hidden lg:block">매장 설정</span>
          </Link>
        </nav>

        <div className="px-8 mt-auto pt-6 border-t border-white/10">
          <button onClick={handleLogout} className="text-[#fcfcfc]/40 hover:text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
            <LogOut className="w-4 h-4" /> <span className="hidden lg:block">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="ml-20 lg:ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-8 py-4 border-b border-outline-variant/30">
          <span className="font-serif text-2xl font-bold text-primary">매장 브랜딩 설정</span>
          <button
             onClick={handleSave}
             disabled={isSaving}
             className="px-8 py-2 bg-primary text-white rounded-full font-serif text-sm hover:bg-accent-burgundy transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            설정 저장하기
          </button>
        </header>

        <div className="p-8 space-y-12 flex-1 overflow-y-auto no-scrollbar">
           <div className="max-w-4xl space-y-12">
              <section>
                 <h2 className="text-3xl font-serif font-black text-primary italic mb-2">단골 등급 체계</h2>
                 <p className="text-on-surface-variant/60 text-sm mb-10">손님들의 등급별 명칭과 혜택을 사장님만의 스타일로 정의해 보세요.</p>
                 
                 <div className="space-y-6">
                    {tiers.map((tier) => (
                      <div key={tier} className="bg-white p-8 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col md:flex-row gap-8 items-start md:items-center group">
                        <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                           {getTierIcon(tier)}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">맞춤 등급명</label>
                              <input 
                                className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-body focus:ring-1 focus:ring-primary"
                                value={tierNames[tier]}
                                onChange={e => setTierNames({...tierNames, [tier]: e.target.value})}
                                placeholder={`${tier} 등급의 이름...`}
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">등급별 혜택</label>
                              <input 
                                className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-sm font-body focus:ring-1 focus:ring-primary"
                                value={tierRewards[tier]}
                                onChange={e => setTierRewards({...tierRewards, [tier]: e.target.value})}
                                placeholder="예: 웰컴 드링크 제공..."
                              />
                           </div>
                        </div>
                      </div>
                    ))}
                 </div>
              </section>

              <section className="bg-primary p-10 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden group">
                 <div className="relative z-10 space-y-4">
                    <h3 className="text-2xl font-serif font-black italic">브랜딩 팁</h3>
                    <p className="text-sm opacity-80 leading-relaxed max-w-xl">
                      단골 손님들에게 사장님만의 친근하거나 품격 있는 명칭을 불러드리면 재방문율을 높이는 데 큰 도움이 됩니다. 설정을 저장하면 손님의 모바일 화면에도 즉시 반영됩니다.
                    </p>
                 </div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-1000"></div>
              </section>
           </div>
        </div>
      </main>
    </div>
  );
}
