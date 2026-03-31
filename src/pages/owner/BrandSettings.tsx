import React, { useState } from 'react';
import { useStore, getTierCustomName } from '../../store';
import { ArrowLeft, Save, Sparkles, Gift, Trash2, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function BrandSettings() {
  const { currentUser, updateBrandSettings } = useStore();
  const navigate = useNavigate();
  
  const [tierNames, setTierNames] = useState<Record<string, string>>(currentUser?.tierNames || {
    'VIP': '티어 5',
    '다이아': '티어 4',
    '골드': '티어 3',
    '실버': '티어 2',
    '브론즈': '티어 1'
  });

  const [tierRewards, setTierRewards] = useState<Record<string, string>>(currentUser?.tierRewards || {
    'VIP': '사이드 하나 + 음료수',
    '다이아': '사이드 하나',
    '골드': '작은 사이드 하나',
    '실버': '음료수 2개',
    '브론즈': '음료수 하나'
  });

  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBrandSettings(currentUser.id, { tierNames, tierRewards });
      import('../../store').then(({ showToast }) => showToast('브랜드 설정이 저장되었습니다.', 'success')).catch(console.error);
      navigate('/owner');
    } catch (error) {
      console.error(error);
      import('../../store').then(({ showToast }) => showToast('저장 중 오류가 발생했습니다.', 'error')).catch(console.error);
    } finally {
      setIsSaving(false);
    }
  };

  const tiers = ['VIP', '다이아', '골드', '실버', '브론즈'];

  return (
    <div className="min-h-full bg-hanji-light dark:bg-hanji-dark pb-20">
      {/* Header */}
      <div className="bg-white/80 dark:bg-black/20 backdrop-blur-md text-ink-light dark:text-ink-dark p-6 pt-8 flex items-center border-b border-ink-light/10 dark:border-ink-dark/10 sticky top-0 z-20">
        <Link to="/owner" className="p-2 bg-white dark:bg-black/20 rounded-full hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 transition-colors mr-4">
          <ArrowLeft className="w-5 h-5 text-ink-light/70 dark:text-ink-dark/70" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">브랜드 설정</h1>
          <p className="text-ink-light/60 dark:text-ink-dark/60 text-sm mt-1 font-medium">매장만의 특별한 등급 체계</p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Intro */}
        <div className="bg-gradient-to-br from-burgundy/5 to-burgundy/10 dark:from-burgundy/10 dark:to-burgundy/20 p-6 rounded-[2.5rem] border border-burgundy/10 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-burgundy dark:text-burgundy-light" />
            <h2 className="text-lg font-serif font-bold text-ink-light dark:text-ink-dark">단골 등급 커스터마이징</h2>
          </div>
          <p className="text-ink-light/70 dark:text-ink-dark/70 text-sm leading-relaxed font-medium">
            매장의 분위기에 맞춰 등급 명칭을 자유롭게 정해보세요.<br/>
            수정된 명칭은 고객님의 대시보드와 쿠폰에 즉시 반영됩니다.
          </p>
        </div>

        {/* Tier List */}
        <div className="space-y-4">
          {tiers.map((tierKey, index) => (
            <div key={tierKey} className="bg-white dark:bg-black/20 rounded-[2.5rem] p-6 shadow-sm border border-ink-light/10 dark:border-ink-dark/10 group hover:border-burgundy/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-burgundy/10 dark:bg-burgundy/20 flex items-center justify-center text-burgundy dark:text-burgundy-light font-bold text-sm">
                  {tiers.length - index}
                </div>
                <h3 className="font-serif font-bold text-ink-light dark:text-ink-dark">기본 등급: {tierKey}</h3>
              </div>

              <div className="grid gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-ink-light/40 dark:text-ink-dark/40 uppercase tracking-wider ml-1">변경할 명칭</label>
                  <input
                    type="text"
                    value={tierNames[tierKey] || ''}
                    onChange={(e) => setTierNames({ ...tierNames, [tierKey]: e.target.value })}
                    placeholder={`예: 단골마스터, 레벨 ${tiers.length - index}`}
                    className="w-full px-5 py-4 bg-hanji-light/30 dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 rounded-2xl text-ink-light dark:text-ink-dark font-bold focus:ring-2 focus:ring-burgundy/20 transition-all placeholder:text-ink-light/20"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 ml-1">
                    <Gift className="w-4 h-4 text-burgundy/60 dark:text-burgundy-light/60" />
                    <label className="text-xs font-bold text-ink-light/40 dark:text-ink-dark/40 uppercase tracking-wider">달성 시 혜택 문구</label>
                  </div>
                  <input
                    type="text"
                    value={tierRewards[tierKey] || ''}
                    onChange={(e) => setTierRewards({ ...tierRewards, [tierKey]: e.target.value })}
                    placeholder="예: 전 메뉴 10% 할인, 무료 음료 서비스"
                    className="w-full px-5 py-4 bg-hanji-light/30 dark:bg-black/20 border border-ink-light/10 dark:border-ink-dark/10 rounded-2xl text-ink-light dark:text-ink-dark font-medium text-sm focus:ring-2 focus:ring-burgundy/20 transition-all placeholder:text-ink-light/20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-burgundy hover:bg-burgundy/90 text-hanji-light font-bold py-5 rounded-[2.5rem] transition-all shadow-xl shadow-burgundy/20 flex items-center justify-center gap-3 sticky bottom-8 z-30 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          <span className="text-lg">설정 저장하기</span>
        </button>
      </div>
    </div>
  );
}
