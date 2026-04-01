import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Utensils, ChefHat, Wine, Users } from 'lucide-react';

interface MemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMemo: string;
  onSave: (memo: string) => void;
}

export const SIDE_DISH_OPTIONS = [
  '밑반찬 많이', '밑반찬 적게', '쌈채소 많이', '마늘 많이', '파절이 많이', '소금장 선호', '쌈장 선호', '멜젓 선호'
];

export const MEAT_OPTIONS = [
  '바싹 익혀서', '부드럽게(덜 익혀서)', '직접 굽기 선호', '구워주는 것 선호', '불판 자주 교체'
];

export const MEAL_DRINK_OPTIONS = [
  '찌개 필수', '냉면 필수', '볶음밥 필수', '주류 많이 마심', '주류 안 마심'
];

export const SEATING_OTHER_OPTIONS = [
  '조용한 자리 선호', '창가 자리 선호', '아이 동반', '유모차 있음', '단체 모임 잦음', '앞치마 필수', '식사 속도 빠름', '식사 속도 느림'
];

export interface MemoData {
  sideDishes: string[];
  meats: string[];
  mealsDrinks: string[];
  seatingOthers: string[];
  other?: string;
}

export function parseMemo(memoStr: string): MemoData {
  const defaultData: MemoData = { sideDishes: [], meats: [], mealsDrinks: [], seatingOthers: [] };
  if (!memoStr) return defaultData;
  try {
    if (memoStr.startsWith('{') && memoStr.endsWith('}')) {
      const parsed = JSON.parse(memoStr);
      return {
        sideDishes: Array.isArray(parsed.sideDishes) ? parsed.sideDishes : [],
        meats: Array.isArray(parsed.meats) ? parsed.meats : [],
        mealsDrinks: Array.isArray(parsed.mealsDrinks) ? parsed.mealsDrinks : [],
        seatingOthers: Array.isArray(parsed.seatingOthers) ? parsed.seatingOthers : [],
        other: parsed.other
      };
    }
  } catch (e) {
    // Ignore
  }
  return { ...defaultData, other: memoStr };
}

export function formatMemoDisplay(memoStr: string): string {
  if (!memoStr) return '';
  const data = parseMemo(memoStr);
  const parts = [];
  if (data.sideDishes?.length > 0) parts.push(`[반찬] ${data.sideDishes.join(', ')}`);
  if (data.meats?.length > 0) parts.push(`[고기] ${data.meats.join(', ')}`);
  if (data.mealsDrinks?.length > 0) parts.push(`[음료] ${data.mealsDrinks.join(', ')}`);
  if (data.seatingOthers?.length > 0) parts.push(`[기타] ${data.seatingOthers.join(', ')}`);
  if (data.other) parts.push(`${data.other}`);
  return parts.length === 0 ? memoStr : parts.join(' | ');
}

export default function MemoModal({ isOpen, onClose, initialMemo, onSave }: MemoModalProps) {
  const [data, setData] = useState<MemoData>({ sideDishes: [], meats: [], mealsDrinks: [], seatingOthers: [] });

  useEffect(() => {
    if (isOpen) setData(parseMemo(initialMemo));
  }, [isOpen, initialMemo]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(JSON.stringify(data));
    onClose();
  };

  const handleReset = () => setData({ sideDishes: [], meats: [], mealsDrinks: [], seatingOthers: [], other: '' });

  const toggleOption = (category: keyof MemoData, option: string) => {
    setData(prev => {
      const list = (prev[category] as string[]) || [];
      return { ...prev, [category]: list.includes(option) ? list.filter(item => item !== option) : [...list, option] };
    });
  };

  const OptionButton = ({ category, option }: { category: keyof MemoData, option: string }) => {
    const isSelected = (data[category] as string[])?.includes(option);
    return (
      <button
        onClick={() => toggleOption(category, option)}
        className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
          isSelected ? 'bg-primary text-white shadow-md' : 'bg-[#fdfaf7] text-on-surface-variant/40 border border-[#e5dcd3] hover:border-primary/20'
        }`}
      >
        {option}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-3xl overflow-hidden flex flex-col max-h-[85vh] border border-[#e5dcd3]">
        <div className="p-8 border-b border-[#e5dcd3] flex justify-between items-center bg-[#fdfaf7]/50">
          <div>
            <h2 className="text-2xl font-serif font-black text-primary italic">단골 맞춤 메모</h2>
            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/40 mt-1">Preference Ledger</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-surface-container rounded-full text-on-surface-variant/40 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1 space-y-10 no-scrollbar">
          <section>
            <h3 className="text-xs font-bold text-primary/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Utensils className="w-4 h-4" /> 반찬 및 소스
            </h3>
            <div className="flex flex-wrap gap-2">{SIDE_DISH_OPTIONS.map(opt => <OptionButton key={opt} category="sideDishes" option={opt} />)}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-primary/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ChefHat className="w-4 h-4" /> 고기 굽기 및 취향
            </h3>
            <div className="flex flex-wrap gap-2">{MEAT_OPTIONS.map(opt => <OptionButton key={opt} category="meats" option={opt} />)}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-primary/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Wine className="w-4 h-4" /> 식사 및 주류
            </h3>
            <div className="flex flex-wrap gap-2">{MEAL_DRINK_OPTIONS.map(opt => <OptionButton key={opt} category="mealsDrinks" option={opt} />)}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-primary/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> 좌석 및 기타
            </h3>
            <div className="flex flex-wrap gap-2">{SEATING_OTHER_OPTIONS.map(opt => <OptionButton key={opt} category="seatingOthers" option={opt} />)}</div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-primary/40 uppercase tracking-widest mb-4">직접 입력</h3>
            <textarea
              value={data.other || ''}
              onChange={(e) => setData(prev => ({ ...prev, other: e.target.value }))}
              placeholder="추가로 기억해야 할 내용을 적어주세요..."
              className="w-full p-6 bg-[#fdfaf7] border-none rounded-2xl focus:ring-1 focus:ring-primary shadow-inner text-sm font-sans min-h-[120px] resize-none"
            />
          </section>
        </div>

        <div className="p-8 border-t border-[#e5dcd3] bg-[#fdfaf7]/50 flex gap-4">
          <button onClick={handleReset} className="flex-1 py-4 bg-white border border-[#e5dcd3] text-on-surface-variant/60 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-surface-container transition-all flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> 초기화
          </button>
          <button onClick={handleSave} className="flex-[2] py-4 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:bg-accent-burgundy transition-all flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> 메모 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
