import React, { useState } from 'react';
import { useStore, getTierCustomName, showToast } from '../../store';
import { 
  ArrowLeft, Save, Sparkles, Gift, Trash2, Plus, 
  Loader2, ShieldCheck, Heart, Star, Award, 
  ChevronRight, LayoutGrid, Users, BarChart3, LogOut,
  Store as StoreIcon, Edit2, Settings, MapPin, ShieldAlert, Utensils
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function BrandSettings() {
  const { currentUser, updateBrandSettings, ownerViewMode, updateStoreLocation } = useStore();
  const navigate = useNavigate();
  
  const [tierNames, setTierNames] = useState<Record<string, string>>(currentUser?.tierNames || {
    'VIP': '사장님 특별 손님',
    '다이아': '최고 단골',
    '골드': '골드 회원',
    '실버': '실버 회원',
    '브론즈': '일반 단골'
  });

  const { menus, addMenuItem, deleteMenuItem, updateMenuItem, isProcessing } = useStore();
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('식사');
  const [newMenuDesc, setNewMenuDesc] = useState('');
  const [newMenuPosCode, setNewMenuPosCode] = useState('');
  const [newMenuImageUrl, setNewMenuImageUrl] = useState('');

  const [tierRewards, setTierRewards] = useState<Record<string, string>>(currentUser?.tierRewards || {
    'VIP': '전 메뉴 10% 상시 할인 + 사장님 특별 모듬 서비스',
    '다이아': '메인 메뉴 5,000원 할인 + 음료 서비스',
    '골드': '사이드 메뉴 1종 무료 (식사 시)',
    '실버': '음료 1캔 무료 제공',
    '브론즈': '재방문 시 스탬프 추가 적립'
  });

  const [crmCustomInsights, setCrmCustomInsights] = useState<Record<string, string>>(currentUser?.storeConfig?.crmCustomInsights || {
    'vip': '',
    'new': '',
    'slipping': '',
    'whale': '',
    'cold': ''
  });
  const [locationAccessOnly, setLocationAccessOnly] = useState(currentUser?.storeConfig?.locationAccessOnly || false);
  const [allowedRadius, setAllowedRadius] = useState(currentUser?.storeConfig?.allowedRadius || 50);
  const [foodtechStoreCode, setFoodtechStoreCode] = useState(currentUser?.foodtechStoreCode || '');
  const [tossClientKey, setTossClientKey] = useState(currentUser?.storeConfig?.pointRate !== undefined ? '' : ''); // Placeholder for Toss Key (can use pointRate field or add to config)
  const [isLocating, setIsLocating] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) return null;

  const handleLogout = () => {
    navigate('/');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBrandSettings(currentUser.id, { 
        tierNames, 
        tierRewards,
        foodtechStoreCode,
        storeConfig: {
          ...currentUser.storeConfig,
          crmCustomInsights,
          locationAccessOnly,
          allowedRadius
        } as any
      });
      showToast('브랜드 및 보안 설정이 저장되었습니다.', 'success');
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
    <div className={`flex h-screen overflow-hidden bg-surface-bright font-sans text-on-surface selection:bg-primary/20 ${ownerViewMode === 'mobile' ? 'flex-col' : ''}`}>
      
      {/* Sidebar - Consistent */}
      {ownerViewMode === 'desktop' && (
        <aside className="h-screen w-20 lg:w-64 fixed left-0 bg-sidebar-bg shadow-2xl flex flex-col py-8 z-50">
          <div className="px-8 mb-12">
            <Link to="/" className="text-[#fcfcfc] font-sans font-black text-2xl">결</Link>
            <div className="mt-8 hidden lg:block">
              <p className="text-[#fcfcfc] font-sans font-bold text-sm">{currentUser.restaurantName}</p>
              <p className="text-[#fcfcfc]/50 uppercase tracking-widest text-[10px]">브랜드 아이덴티티 관리</p>
            </div>
          </div>
          <nav className="flex-1 space-y-2">
            <Link to="/owner" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
              <LayoutGrid className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">대시보드</span>
            </Link>
            <Link to="/owner/customers" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
              <Users className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">단골 관리</span>
            </Link>
            <Link to="/owner/statistics" className="text-white/60 hover:text-white px-8 py-3 flex items-center gap-4 hover:bg-white/5 transition-all">
              <BarChart3 className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">매장 통계</span>
            </Link>
            <Link to="/owner/brand-settings" className="bg-white/10 text-white rounded-l-full ml-4 pl-4 py-3 flex items-center gap-4 transition-all">
              <Settings className="w-5 h-5 flex-shrink-0" /><span className="text-xs hidden lg:block">매장 설정</span>
            </Link>
          </nav>
          <button onClick={handleLogout} className="px-8 mt-auto text-white/40 hover:text-white text-[10px] flex items-center gap-2 uppercase tracking-widest">
            <LogOut className="w-4 h-4" /> <span className="hidden lg:block">시스템 로그아웃</span>
          </button>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {ownerViewMode === 'mobile' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-sidebar-bg/95 backdrop-blur-xl border-t border-white/5 z-[100] px-6 py-4 flex justify-between items-center safe-area-bottom">
           {[
             { to: '/owner', icon: LayoutGrid, label: '홈' },
             { to: '/owner/customers', icon: Users, label: '단골' },
             { to: '/owner/statistics', icon: BarChart3, label: '통계' },
             { to: '/owner/brand-settings', icon: Settings, label: '설정', active: true }
           ].map((item, idx) => (
             <Link 
               key={idx}
               to={item.to} 
               className={`flex flex-col items-center gap-1.5 transition-all ${item.active ? 'text-gold' : 'text-white/40'}`}
             >
               <item.icon className="w-5 h-5" />
               <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
             </Link>
           ))}
        </nav>
      )}

      {/* Main Workspace */}
      <main className={`${ownerViewMode === 'desktop' ? 'ml-20 lg:ml-64' : 'flex-1 pb-24'} flex-1 h-screen flex flex-col overflow-hidden`}>
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center w-full px-6 lg:px-8 py-4 border-b border-outline-variant/30">
          <span className="font-sans text-xl lg:text-2xl font-black text-primary tracking-tight">매장 브랜딩 설정</span>
          <button
             onClick={handleSave}
             disabled={isSaving}
             className="px-6 lg:px-8 py-2 bg-primary text-white rounded-full font-sans font-black text-xs lg:text-sm hover:bg-accent-burgundy transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {ownerViewMode === 'mobile' ? '저장' : '설정 저장하기'}
          </button>
        </header>

        <div className="p-8 space-y-12 flex-1 overflow-y-auto no-scrollbar bg-gyeol-pattern">
           <div className="max-w-4xl space-y-12">
              <section className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-primary/5 shadow-premium">
                 <h2 className="text-3xl font-sans font-black text-primary mb-2 tracking-tight">단골 등급 리네이밍</h2>
                 <p className="text-primary/40 text-sm mb-10 font-bold uppercase tracking-widest">손님들의 등급별 명칭과 혜택을 매장 컨셉에 맞춰 정의해 보세요.</p>
                 
                 <div className="space-y-6">
                    {tiers.map((tier) => (
                      <div key={tier} className="bg-white p-8 rounded-3xl border border-primary/5 shadow-sm flex flex-col md:flex-row gap-8 items-start md:items-center group hover:border-primary transition-all">
                        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                           {getTierIcon(tier)}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">맞춤 등급명</label>
                              <input 
                                className="w-full bg-primary/5 border-none rounded-xl px-4 py-3 text-sm font-black focus:ring-1 focus:ring-primary"
                                value={tierNames[tier]}
                                onChange={e => setTierNames({...tierNames, [tier]: e.target.value})}
                                placeholder={`${tier} 등급의 이름...`}
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">등급별 공식 혜택</label>
                              <input 
                                className="w-full bg-primary/5 border-none rounded-xl px-4 py-3 text-sm font-black focus:ring-1 focus:ring-primary"
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

              <section className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-primary/5 shadow-premium">
                  <div className="flex items-center gap-4 mb-2">
                     <h2 className="text-3xl font-sans font-black text-primary tracking-tight">매장 보안 및 위치 설정 (Geofencing)</h2>
                     <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-black rounded-lg">SECURITY</div>
                  </div>
                  <p className="text-primary/40 text-sm mb-10 font-bold uppercase tracking-widest">실제 매장 방문객만 접속할 수 있도록 GPS 기반의 접속 제한을 설정하세요.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="bg-surface-bright p-8 rounded-3xl border border-primary/5 space-y-6">
                        <div className="flex justify-between items-center">
                           <div>
                              <h4 className="text-sm font-black text-primary uppercase">위치 기반 접속 제한</h4>
                              <p className="text-[10px] text-primary/40 font-bold mt-1">매장 50m 근처에서만 대시보드 접근 가능</p>
                           </div>
                           <button 
                             onClick={() => setLocationAccessOnly(!locationAccessOnly)}
                             className={`w-14 h-8 rounded-full transition-all relative ${locationAccessOnly ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-primary/10'}`}
                           >
                              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${locationAccessOnly ? 'left-7' : 'left-1'}`}></div>
                           </button>
                        </div>
                        
                        <div className="pt-4 border-t border-primary/5 space-y-4">
                           <div className="flex justify-between items-end">
                              <label className="text-[10px] font-black text-primary/30 uppercase tracking-widest">접속 허용 반경</label>
                              <span className="text-sm font-black text-primary">{allowedRadius}m</span>
                           </div>
                           <input 
                             type="range" 
                             min="50" 
                             max="1000" 
                             step="50"
                             className="w-full h-1.5 bg-primary/10 rounded-lg appearance-none cursor-pointer accent-primary"
                             value={allowedRadius}
                             onChange={e => setAllowedRadius(parseInt(e.target.value))}
                           />
                           <p className="text-[9px] text-primary/30 font-medium">※ 도심 오차를 고려해 최소 50m ~ 최대 1km 설정이 가능합니다.</p>
                        </div>
                     </div>

                     <div className="bg-surface-bright p-8 rounded-3xl border border-primary/5 flex flex-col justify-between gap-6">
                        <div className="flex items-start gap-4">
                           <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary shrink-0 transition-transform">
                              <MapPin className="w-6 h-6" />
                           </div>
                           <div>
                              <h4 className="text-sm font-black text-primary uppercase">매장 좌표 등록</h4>
                              <p className="text-[10px] text-primary/40 font-bold mt-1 tracking-tight">
                                {currentUser.lat && currentUser.lng 
                                  ? `현재 등록됨: ${currentUser.lat.toFixed(4)}, ${currentUser.lng.toFixed(4)}` 
                                  : '등록된 위치가 없습니다. 사장님 폰으로 매장에서 등록해 주세요.'}
                              </p>
                           </div>
                        </div>
                        
                        <button 
                          onClick={async () => {
                            if (!navigator.geolocation) {
                              showToast('위치 정보를 사용할 수 없는 브라우저입니다.', 'error');
                              return;
                            }
                            setIsLocating(true);
                            navigator.geolocation.getCurrentPosition(
                              async (pos) => {
                                await updateStoreLocation(currentUser.id, pos.coords.latitude, pos.coords.longitude);
                                showToast('매장 좌표가 현재 위치로 성공적으로 업데이트되었습니다.', 'success');
                                setIsLocating(false);
                              },
                              (err) => {
                                showToast('위치 권한을 허용해 주세요.', 'error');
                                setIsLocating(false);
                              }
                            );
                          }}
                          disabled={isLocating}
                          className="w-full py-4 bg-white border border-primary/10 rounded-2xl text-[11px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all shadow-sm flex items-center justify-center gap-3"
                        >
                           {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                           현재 브라우저 위치를 매장 위치로 강제 등록
                        </button>
                     </div>
                  </div>
               </section>

               <section className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-primary/5 shadow-premium">
                  <div className="flex items-center gap-4 mb-2">
                     <h2 className="text-3xl font-sans font-black text-primary tracking-tight">온라인 결제 설정 (Payment)</h2>
                     <div className="px-3 py-1 bg-primary/5 text-primary text-[9px] font-black rounded-lg">FINTECH</div>
                  </div>
                  <p className="text-primary/40 text-sm mb-10 font-bold uppercase tracking-widest">토스, 카카오페이, 네이버페이를 한 번에 연동하세요. (토스페이먼츠 위젯 지원)</p>
                  
                  <div className="bg-surface-bright p-8 rounded-3xl border border-primary/5 space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">토스페이먼츠 클라이언트 키 (Client Key)</label>
                        <input 
                           className="w-full bg-white border border-primary/10 rounded-xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                           value={tossClientKey}
                           onChange={e => setTossClientKey(e.target.value)}
                           placeholder="test_ck_XXXXXXXXXXXX"
                        />
                        <p className="text-[9px] text-primary/30 font-medium">※ 토스 개발자 센터에서 발급받은 '클라이언트 키'를 입력해 주세요.</p>
                     </div>
                  </div>
               </section>

               <section className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-primary/5 shadow-premium">
                  <div className="flex items-center gap-4 mb-2">
                     <h2 className="text-3xl font-sans font-black text-primary tracking-tight">주문 중계 및 연동 (POS Relay)</h2>
                     <div className="px-3 py-1 bg-burgundy/10 text-burgundy text-[9px] font-black rounded-lg">POS SYNC</div>
                  </div>
                  <p className="text-primary/40 text-sm mb-10 font-bold uppercase tracking-widest">OKPOS 등 실제 매장 포스기와의 실시간 주문 연동 설정을 관리합니다.</p>
                  
                  <div className="bg-surface-bright p-8 rounded-3xl border border-primary/5 space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em]">푸드테크(M-Kitchen) 매장코드</label>
                        <input 
                           className="w-full bg-white border border-primary/10 rounded-xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                           value={foodtechStoreCode}
                           onChange={e => setFoodtechStoreCode(e.target.value)}
                           placeholder="FT_XXXXXX_XXXX"
                        />
                        <p className="text-[9px] text-primary/30 font-medium">※ 푸드테크에서 발급받은 정식 코드를 입력하면 POS 연동 주문이 활성화됩니다.</p>
                     </div>
                  </div>
               </section>

              <section className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-primary/5 shadow-premium">
                 <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-3xl font-sans font-black text-primary tracking-tight">디지털 메뉴판 관리</h2>
                    <div className="px-3 py-1 bg-primary/5 text-primary text-[9px] font-black rounded-lg">COMMERCE</div>
                 </div>
                 <p className="text-primary/40 text-sm mb-10 font-bold uppercase tracking-widest">손님들이 자리에서 직접 주문할 메뉴들을 등록하세요.</p>
                 
                 <div className="bg-primary/5 p-8 rounded-[2.5rem] mb-10 space-y-6 border border-primary/10">
                    <h4 className="text-xs font-black text-primary uppercase tracking-widest">새 메뉴 등록</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <input 
                         className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                         placeholder="메뉴 이름 (예: 김치찌개)"
                         value={newMenuName}
                         onChange={e => setNewMenuName(e.target.value)}
                       />
                       <input 
                         type="number"
                         className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                         placeholder="가격 (숫자만 입력)"
                         value={newMenuPrice}
                         onChange={e => setNewMenuPrice(e.target.value)}
                       />
                       <select 
                         className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm appearance-none"
                         value={newMenuCategory}
                         onChange={e => setNewMenuCategory(e.target.value)}
                       >
                          <option value="식사">식사류</option>
                          <option value="음료">음료/주류</option>
                          <option value="사이드">사이드</option>
                          <option value="세트">세트메뉴</option>
                       </select>
                       <input 
                         className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                         placeholder="간단 설명"
                         value={newMenuDesc}
                         onChange={e => setNewMenuDesc(e.target.value)}
                       />
                        <input 
                          className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                          placeholder="POS 메뉴코드 (예: 01)"
                          value={newMenuPosCode}
                          onChange={e => setNewMenuPosCode(e.target.value)}
                        />
                        <input 
                          className="w-full bg-white rounded-2xl px-6 py-4 text-sm font-black focus:ring-1 focus:ring-primary shadow-sm"
                          placeholder="이미지 URL (Unsplash 등)"
                          value={newMenuImageUrl}
                          onChange={e => setNewMenuImageUrl(e.target.value)}
                        />
                     </div>
                     {newMenuImageUrl && (
                       <div className="mt-4 w-32 h-32 rounded-2xl overflow-hidden border border-primary/10 shadow-inner">
                         <img src={newMenuImageUrl} alt="Preview" className="w-full h-full object-cover" />
                       </div>
                     )}
                    <button 
                      onClick={async () => {
                         if (!newMenuName || !newMenuPrice) return;
                          await addMenuItem({
                             name: newMenuName,
                             price: parseInt(newMenuPrice),
                             category: newMenuCategory,
                             description: newMenuDesc,
                             posProductCode: newMenuPosCode,
                             imageUrl: newMenuImageUrl,
                             storeId: currentUser.id
                          });
                          setNewMenuName('');
                          setNewMenuPrice('');
                          setNewMenuDesc('');
                          setNewMenuPosCode('');
                          setNewMenuImageUrl('');
                      }}
                      disabled={isProcessing}
                      className="w-full bg-primary text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.01] transition-all"
                    >
                       <Plus className="w-4 h-4" /> 메뉴 추가하기
                    </button>
                 </div>

                 <div className="space-y-4">
                    {menus.filter(m => m.storeId === currentUser.id).map(m => (
                       <div key={m.id} className="flex items-center justify-between p-6 bg-white rounded-3xl border border-primary/5 hover:border-primary/20 transition-all group">
                          <div className="flex gap-6 items-center">
                             <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary/20 overflow-hidden">
                                {m.imageUrl ? (
                                   <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                   <Utensils className="w-8 h-8" />
                                )}
                             </div>
                             <div>
                                <div className="flex items-center gap-3">
                                   <p className="text-lg font-black text-primary">{m.name}</p>
                                   <span className="text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded font-black uppercase">{m.category}</span>
                                   {m.posProductCode && (
                                      <span className="text-[8px] px-2 py-0.5 bg-primary/5 text-primary/40 rounded font-bold uppercase">POS: {m.posProductCode}</span>
                                   )}
                                </div>
                                <p className="text-sm font-serif font-black italic text-primary/40">₩{m.price.toLocaleString()}</p>
                             </div>
                          </div>
                          <button 
                            onClick={() => deleteMenuItem(m.id)}
                            className="p-4 rounded-xl text-primary/20 hover:text-burgundy hover:bg-burgundy/5 transition-all opacity-0 group-hover:opacity-100"
                          >
                             <Trash2 className="w-5 h-5" />
                          </button>
                       </div>
                    ))}
                 </div>
              </section>

              <section className="bg-white/80 backdrop-blur-md p-10 rounded-[3rem] border border-primary/5 shadow-premium">
                 <div className="flex items-center gap-4 mb-2">
                    <h2 className="text-3xl font-sans font-black text-primary tracking-tight">CRM 마케팅 인사이트 설정</h2>
                    <div className="px-3 py-1 bg-gold/10 text-gold text-[9px] font-black rounded-lg">PREMIUM</div>
                 </div>
                 <p className="text-primary/40 text-sm mb-10 font-bold uppercase tracking-widest">각 고객 세그먼트별로 표시될 마케팅 제안 문구를 자유롭게 수정하세요.</p>
                 
                 <div className="grid grid-cols-1 gap-6">
                    {[
                      { id: 'vip', label: 'VIP 레전드', default: '우리 매장의 기둥입니다. 신메뉴 테스트나 특별 행사에 우선 초대하세요.' },
                      { id: 'new', label: '유망 신규', default: '방금 데뷔한 신규 고객입니다. 웰컴 푸드나 무료 음료 쿠폰으로 첫 인상을 굳히세요.' },
                      { id: 'slipping', label: '이탈 위험', default: '지난 한 달간 방문이 없습니다. 안부 인사와 함께 재방문 쿠폰을 보내보세요.' },
                      { id: 'whale', label: '잠재 큰손', default: '객단가가 높은 우량 고객입니다. VIP 등급 수동 지정을 검토해 보세요.' },
                      { id: 'cold', label: '장기 휴면', default: '관심이 필요한 휴면 고객입니다. 다시 방문할 수 있는 강력한 혜택을 제안해 보세요.' }
                    ].map((item) => (
                      <div key={item.id} className="bg-white p-8 rounded-3xl border border-primary/5 shadow-sm group hover:border-gold transition-all">
                         <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-black text-primary tracking-tight">{item.label}</label>
                            <span className="text-[9px] font-black text-primary/20 uppercase tracking-widest">SEGMENT MESSAGE</span>
                         </div>
                         <textarea 
                           className="w-full bg-primary/5 border-none rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-gold min-h-[100px] resize-none"
                           value={crmCustomInsights[item.id] || ''}
                           onChange={e => setCrmCustomInsights({...crmCustomInsights, [item.id]: e.target.value})}
                           placeholder={`기본 메시지: ${item.default}`}
                         />
                      </div>
                    ))}
                 </div>
              </section>

              <section className="bg-primary p-12 rounded-[3.5rem] shadow-3xl text-white relative overflow-hidden group">
                 <div className="relative z-10 space-y-4">
                    <h3 className="text-2xl font-sans font-black tracking-tight">사장님을 위한 브랜딩 팁</h3>
                    <p className="text-sm opacity-80 leading-relaxed max-w-xl border-l-2 border-white/20 pl-6">
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
