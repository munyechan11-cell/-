import React, { useState, useEffect } from 'react';
import { X, Clock, Users, AlertTriangle, FileText } from 'lucide-react';
import { useStore } from '../store';
import type { User, Visit } from '../store';

interface MemoModalProps {
  customer: User;
  onClose: () => void;
}

const ALLERGY_OPTIONS = ['없음', '우유', '대두', '밀', '게', '새우', '땅콩', '계란', '복숭아', '토마토'];

export default function MemoModal({ customer, onClose }: MemoModalProps) {
  const { visits, updateUserMemo, currentUser } = useStore();
  const [specialNote, setSpecialNote] = useState(customer.memo || '');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) return null;

  const customerVisits: Visit[] = visits.filter(
    (v) => v.customerId === customer.id && v.storeId === currentUser.id
  );

  // 단골 여부: 최근 30일 내 방문일 2회 이상
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentVisits = customerVisits.filter((v) => new Date(v.date) >= thirtyDaysAgo);
  const uniqueRecentDays = new Set(recentVisits.map((v) => new Date(v.date).toDateString())).size;
  const isRegular = uniqueRecentDays >= 2;

  // 가장 많이 방문한 시간대 계산
  const hourCounts: Record<number, number> = {};
  customerVisits.forEach((v) => {
    const hour = new Date(v.date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const topHour =
    Object.keys(hourCounts).length > 0
      ? parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
      : null;

  // 가장 많이 방문한 인원 (tableNumber를 인원 근사값으로 사용 불가 → 방문 횟수로 대체)
  const totalVisitCount = customerVisits.length;

  // 알레르기 파싱 (메모에서)
  useEffect(() => {
    const memoText = customer.memo || '';
    const allergyMatch = memoText.match(/\[알레르기:([^\]]+)\]/);
    if (allergyMatch) {
      setSelectedAllergies(allergyMatch[1].split(',').map((s) => s.trim()).filter(Boolean));
    }
    const noteMatch = memoText.replace(/\[알레르기:[^\]]+\]/, '').trim();
    setSpecialNote(noteMatch);
  }, [customer.memo]);

  const toggleAllergy = (item: string) => {
    if (item === '없음') {
      setSelectedAllergies(['없음']);
      return;
    }
    setSelectedAllergies((prev) => {
      const without없음 = prev.filter((a) => a !== '없음');
      return without없음.includes(item)
        ? without없음.filter((a) => a !== item)
        : [...without없음, item];
    });
  };

  const handleSave = () => {
    setIsSaving(true);
    const allergyPart =
      selectedAllergies.length > 0 ? `[알레르기:${selectedAllergies.join(',')}]` : '';
    const fullMemo = [allergyPart, specialNote].filter(Boolean).join(' ').trim();
    updateUserMemo(customer.id, currentUser.id, fullMemo);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-10 sm:pb-6 relative shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        {/* 헤더: 이름 + 신규/단골 태그 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
            {customer.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isRegular
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}
              >
                {isRegular ? '단골' : '신규'}
              </span>
            </div>
            <p className="text-sm text-slate-500">{customer.phone}</p>
          </div>
        </div>

        {/* 날짜/시간대 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-slate-700">방문 시간대</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm text-slate-600">
            {customerVisits.length === 0 ? (
              <span className="text-slate-400">방문 기록 없음</span>
            ) : (
              <span>총 <strong className="text-slate-900">{totalVisitCount}회</strong> 방문</span>
            )}
          </div>
          {isRegular && topHour !== null && (
            <p className="text-xs text-indigo-600 mt-1.5 font-medium">
              💡 가장 많이 방문하신 시간대는 <strong>{topHour}시</strong>입니다.
            </p>
          )}
        </div>

        {/* 인원 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-slate-700">방문 횟수</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm text-slate-600">
            최근 30일 <strong className="text-slate-900">{uniqueRecentDays}회</strong> 방문
          </div>
          {isRegular && (
            <p className="text-xs text-indigo-600 mt-1.5 font-medium">
              💡 최근 30일 기준 <strong>{uniqueRecentDays}회</strong> 방문하셨습니다.
            </p>
          )}
        </div>

        {/* 알레르기 필터 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-bold text-slate-700">알레르기 필터</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ALLERGY_OPTIONS.map((item) => (
              <button
                key={item}
                onClick={() => toggleAllergy(item)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  selectedAllergies.includes(item)
                    ? 'bg-rose-500 text-white border-rose-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {isRegular && selectedAllergies.length > 0 && !selectedAllergies.includes('없음') && (
            <p className="text-xs text-rose-500 mt-1.5 font-medium">
              ⚠️ <strong>{selectedAllergies.join(', ')}</strong> 알레르기가 있으십니다.
            </p>
          )}
        </div>

        {/* 특이사항 기록 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-700">특이사항 기록</span>
          </div>
          <textarea
            value={specialNote}
            onChange={(e) => setSpecialNote(e.target.value)}
            placeholder="최대 50자까지 기록해 주세요."
            maxLength={50}
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all resize-none"
          />
          <p className="text-xs text-slate-400 text-right mt-1">{specialNote.length}/50</p>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-xl transition-colors shadow-sm"
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
}
