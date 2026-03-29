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
  if (data.sideDishes?.length > 0) parts.push(`[반찬/소스] ${data.sideDishes.join(', ')}`);
  if (data.meats?.length > 0) parts.push(`[고기 취향] ${data.meats.join(', ')}`);
  if (data.mealsDrinks?.length > 0) parts.push(`[식사/주류] ${data.mealsDrinks.join(', ')}`);
  if (data.seatingOthers?.length > 0) parts.push(`[좌석/기타] ${data.seatingOthers.join(', ')}`);
  if (data.other) parts.push(`[직접입력] ${data.other}`);
  
  if (parts.length === 0) return memoStr; // Fallback
  return parts.join(' / ');
}

export default function MemoModal({ isOpen, onClose, initialMemo, onSave }: MemoModalProps) {
  const [data, setData] = useState<MemoData>({ sideDishes: [], meats: [], mealsDrinks: [], seatingOthers: [] });

  useEffect(() => {
    if (isOpen) {
      setData(parseMemo(initialMemo));
    }
  }, [isOpen, initialMemo]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(JSON.stringify(data));
    onClose();
  };

  const handleReset = () => {
    setData({ sideDishes: [], meats: [], mealsDrinks: [], seatingOthers: [], other: '' });
  };

  const toggleOption = (category: keyof MemoData, option: string) => {
    setData(prev => {
      const list = (prev[category] as string[]) || [];
      if (list.includes(option)) {
        return { ...prev, [category]: list.filter(item => item !== option) };
      } else {
        return { ...prev, [category]: [...list, option] };
      }
    });
  };

  const OptionButton = ({ category, option }: { category: keyof MemoData, option: string }) => {
    const isSelected = (data[category] as string[])?.includes(option);
    return (
      <button
        onClick={() => toggleOption(category, option)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          isSelected
            ? 'bg-burgundy text-hanji-light border-2 border-burgundy shadow-md' 
            : 'bg-hanji-light text-ink-light border border-ink-light/20 hover:bg-ink-light/5 dark:bg-hanji-dark dark:text-ink-dark dark:border-ink-dark/20 dark:hover:bg-ink-dark/10'
        }`}
      >
        {option}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-hanji-light dark:bg-hanji-dark rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-ink-light/10 dark:border-ink-dark/10">
        <div className="p-6 border-b border-ink-light/10 dark:border-ink-dark/10 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-serif font-bold text-ink-light dark:text-ink-dark">고객 맞춤 메모</h2>
          <button onClick={onClose} className="p-2 hover:bg-ink-light/5 dark:hover:bg-ink-dark/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-ink-light/60 dark:text-ink-dark/60" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8 no-scrollbar">
          {/* 반찬/소스 */}
          <div>
            <h3 className="text-base font-serif font-bold text-ink-light dark:text-ink-dark mb-3 flex items-center">
              <Utensils className="w-5 h-5 text-olive mr-2" />
              반찬 및 소스 취향
            </h3>
            <div className="flex flex-wrap gap-2">
              {SIDE_DISH_OPTIONS.map(opt => <OptionButton key={opt} category="sideDishes" option={opt} />)}
            </div>
          </div>

          {/* 고기 취향 */}
          <div>
            <h3 className="text-base font-serif font-bold text-ink-light dark:text-ink-dark mb-3 flex items-center">
              <ChefHat className="w-5 h-5 text-burgundy mr-2" />
              고기 굽기 및 취향
            </h3>
            <div className="flex flex-wrap gap-2">
              {MEAT_OPTIONS.map(opt => <OptionButton key={opt} category="meats" option={opt} />)}
            </div>
          </div>

          {/* 식사/주류 */}
          <div>
            <h3 className="text-base font-serif font-bold text-ink-light dark:text-ink-dark mb-3 flex items-center">
              <Wine className="w-5 h-5 text-mustard mr-2" />
              식사 및 주류
            </h3>
            <div className="flex flex-wrap gap-2">
              {MEAL_DRINK_OPTIONS.map(opt => <OptionButton key={opt} category="mealsDrinks" option={opt} />)}
            </div>
          </div>

          {/* 좌석/기타 */}
          <div>
            <h3 className="text-base font-serif font-bold text-ink-light dark:text-ink-dark mb-3 flex items-center">
              <Users className="w-5 h-5 text-espresso mr-2" />
              좌석 및 기타 요청
            </h3>
            <div className="flex flex-wrap gap-2">
              {SEATING_OTHER_OPTIONS.map(opt => <OptionButton key={opt} category="seatingOthers" option={opt} />)}
            </div>
          </div>

          {/* 직접 입력 */}
          <div>
            <h3 className="text-base font-serif font-bold text-ink-light dark:text-ink-dark mb-3 flex items-center">
              <span className="w-1.5 h-4 bg-ink-light/50 dark:bg-ink-dark/50 rounded-full mr-2"></span>
              직접 입력
            </h3>
            <textarea
              value={data.other || ''}
              onChange={(e) => setData(prev => ({ ...prev, other: e.target.value }))}
              placeholder="추가로 기억해야 할 내용을 자유롭게 적어주세요."
              className="w-full p-4 bg-white/50 dark:bg-black/20 border border-ink-light/20 dark:border-ink-dark/20 rounded-2xl focus:ring-2 focus:ring-burgundy focus:border-burgundy resize-none h-32 text-sm text-ink-light dark:text-ink-dark placeholder:text-ink-light/40 dark:placeholder:text-ink-dark/40"
            />
          </div>
        </div>

        <div className="p-6 border-t border-ink-light/10 dark:border-ink-dark/10 bg-black/5 dark:bg-white/5 shrink-0 flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 bg-white dark:bg-black/40 text-ink-light dark:text-ink-dark py-4 rounded-2xl font-serif font-bold text-base hover:bg-ink-light/5 dark:hover:bg-ink-dark/20 transition-all duration-200 flex items-center justify-center border border-ink-light/20 dark:border-ink-dark/20"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            초기화
          </button>
          <button
            onClick={handleSave}
            className="flex-[2] bg-burgundy text-hanji-light py-4 rounded-2xl font-serif font-bold text-base hover:bg-burgundy/90 transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Check className="w-6 h-6 mr-2" />
            메모 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
