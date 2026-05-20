import React, { useState, useMemo } from 'react';
import { useStore, formatPhoneNumber, showToast } from '../../store';
import {
  LayoutGrid, Users, BarChart3, Settings, Calendar as CalendarIcon,
  Plus, Edit2, Trash2, X, Save, Loader2, Phone, Clock,
  UserCheck, Camera, LogOut, Utensils, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

type Reservation = any;

const STATUS_LABEL: Record<string, string> = {
  confirmed: '예약 확정',
  completed: '방문 완료',
  cancelled: '취소됨',
  'no-show': '노쇼'
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  completed: 'bg-blue-100 text-blue-800 border-blue-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
  'no-show': 'bg-amber-100 text-amber-800 border-amber-300'
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateKR = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 (${days[date.getDay()]})`;
};

export default function OwnerReservations() {
  const {
    currentUser,
    reservations = [],
    tables = [],
    addReservation,
    updateReservation,
    deleteReservation,
    ownerViewMode
  } = useStore();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [filterDate, setFilterDate] = useState<string>(todayISO());
  const [filterMode, setFilterMode] = useState<'day' | 'all'>('day');
  const [isSaving, setIsSaving] = useState(false);

  const myStoreTables = useMemo(
    () => (tables || []).filter((t: any) => t.storeId === currentUser?.id && t.type !== 'corridor' && t.type !== 'door' && t.type !== 'pos'),
    [tables, currentUser]
  );

  const myReservations = useMemo(() => {
    if (!currentUser) return [];
    return (reservations || [])
      .filter((r: Reservation) => r.storeId === currentUser.id)
      .filter((r: Reservation) => filterMode === 'all' ? true : r.date === filterDate)
      .sort((a: Reservation, b: Reservation) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a.time < b.time ? -1 : 1;
      });
  }, [reservations, currentUser, filterDate, filterMode]);

  const todayStats = useMemo(() => {
    if (!currentUser) return { total: 0, partySum: 0 };
    const today = (reservations || []).filter(
      (r: Reservation) => r.storeId === currentUser.id && r.date === todayISO() && r.status === 'confirmed'
    );
    return {
      total: today.length,
      partySum: today.reduce((s: number, r: Reservation) => s + (r.partySize || 0), 0)
    };
  }, [reservations, currentUser]);

  const groupedByDate = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of myReservations) {
      (map[r.date] = map[r.date] || []).push(r);
    }
    return map;
  }, [myReservations]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (r: Reservation) => {
    setEditing(r);
    setShowForm(true);
  };

  const handleDelete = async (r: Reservation) => {
    if (!confirm(`${r.customerName}님 ${formatDateKR(r.date)} ${r.time} 예약을 삭제할까요?`)) return;
    try {
      await deleteReservation(r.id);
    } catch (e) {
      showToast('삭제 실패', 'error');
    }
  };

  const handleStatusChange = async (r: Reservation, status: string) => {
    try {
      await updateReservation(r.id, { status });
    } catch (e) {
      showToast('상태 변경 실패', 'error');
    }
  };

  if (!currentUser) return null;

  return (
    <div className={`flex h-screen overflow-hidden bg-stone-50 font-sans text-stone-900 ${ownerViewMode === 'mobile' ? 'flex-col' : ''}`}>

      {ownerViewMode === 'desktop' && (
        <aside className="h-screen w-24 lg:w-72 fixed left-0 bg-stone-900 shadow-2xl flex flex-col py-8 z-50">
          <div className="px-8 mb-10">
            <Link to="/" className="text-white font-sans font-black text-3xl">결</Link>
            <div className="mt-6 hidden lg:block">
              <p className="text-white font-sans font-black text-lg leading-tight">{currentUser.restaurantName}</p>
              <p className="text-stone-400 text-sm font-bold mt-1">예약 관리</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {[
              { to: '/owner', icon: LayoutGrid, label: '대시보드' },
              { to: '/owner/reservations', icon: CalendarIcon, label: '예약 관리', active: true },
              { to: '/owner/customers', icon: Users, label: '단골 관리' },
              { to: '/owner/photos', icon: Camera, label: '사진 보관' },
              { to: '/owner/statistics', icon: BarChart3, label: '매출 통계' },
              { to: '/owner/brand-settings', icon: Settings, label: '매장 설정' }
            ].map((item, idx) => (
              <Link
                key={idx}
                to={item.to}
                className={`flex items-center gap-4 px-8 py-4 transition-all ${item.active ? 'bg-white text-stone-900 mx-3 rounded-2xl shadow-lg' : 'text-stone-300 hover:bg-white/10 hover:text-white'}`}
              >
                <item.icon className="w-6 h-6 flex-shrink-0" />
                <span className="text-base font-black hidden lg:block">{item.label}</span>
              </Link>
            ))}
          </nav>
          <button onClick={() => navigate('/')} className="px-8 mt-auto text-stone-400 hover:text-white text-base font-bold flex items-center gap-3 py-3">
            <LogOut className="w-5 h-5" /> <span className="hidden lg:block">로그아웃</span>
          </button>
        </aside>
      )}

      {ownerViewMode === 'mobile' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t-2 border-stone-800 z-[100] px-2 py-2 flex justify-between items-center safe-area-bottom">
          {[
            { to: '/owner', icon: LayoutGrid, label: '홈' },
            { to: '/owner/reservations', icon: CalendarIcon, label: '예약', active: true },
            { to: '/owner/customers', icon: Users, label: '단골' },
            { to: '/owner/brand-settings', icon: Utensils, label: '메뉴' },
            { to: '/owner/photos', icon: Camera, label: '사진' }
          ].map((item, idx) => (
            <Link
              key={idx}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all min-w-[60px] ${item.active ? 'bg-white text-stone-900' : 'text-stone-400'}`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs font-black">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      <main className={`${ownerViewMode === 'desktop' ? 'ml-24 lg:ml-72' : 'flex-1 pb-24'} flex-1 h-screen flex flex-col overflow-hidden`}>
        {/* 큰 헤더 */}
        <header className="bg-white border-b-2 border-stone-200 px-5 lg:px-10 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] flex justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-4xl font-black text-stone-900">예약 관리</h1>
            <p className="text-base lg:text-lg font-bold text-stone-600 mt-1">
              오늘 예약 <span className="text-emerald-700">{todayStats.total}건</span>
              <span className="text-stone-400 mx-2">·</span>
              총 <span className="text-emerald-700">{todayStats.partySum}명</span>
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-5 lg:px-7 py-4 bg-emerald-600 text-white rounded-2xl font-black text-base lg:text-lg hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="w-5 h-5 lg:w-6 lg:h-6" />
            <span>예약 추가</span>
          </button>
        </header>

        <div className="p-5 lg:p-10 flex-1 overflow-y-auto space-y-6">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* 큰 필터 */}
            <section className="bg-white p-5 rounded-3xl border-2 border-stone-200 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl">
                  <button
                    onClick={() => setFilterMode('day')}
                    className={`px-5 py-3 rounded-xl text-base font-black transition-all ${filterMode === 'day' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-500'}`}
                  >
                    날짜별
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-5 py-3 rounded-xl text-base font-black transition-all ${filterMode === 'all' ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-500'}`}
                  >
                    전체
                  </button>
                </div>

                {filterMode === 'day' && (
                  <>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="bg-stone-100 border-2 border-stone-200 rounded-2xl px-5 py-3 text-lg font-bold text-stone-900 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => setFilterDate(todayISO())}
                      className="px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-base font-black hover:bg-emerald-100"
                    >
                      오늘
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* 리스트 */}
            {myReservations.length === 0 ? (
              <div className="bg-white p-12 lg:p-16 rounded-3xl border-2 border-dashed border-stone-300 text-center">
                <CalendarIcon className="w-16 h-16 text-stone-300 mx-auto mb-5" />
                <p className="text-2xl font-black text-stone-700 mb-2">예약이 없습니다</p>
                <p className="text-base font-bold text-stone-500">우측 상단 [예약 추가] 버튼으로 등록해 주세요</p>
              </div>
            ) : (
              Object.keys(groupedByDate).sort().map((date) => (
                <section key={date} className="space-y-3">
                  <div className="flex items-baseline gap-3 px-1">
                    <h3 className="text-xl lg:text-2xl font-black text-stone-900">{formatDateKR(date)}</h3>
                    <span className="text-base font-bold text-stone-500">
                      {groupedByDate[date].length}건
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupedByDate[date].map((r: Reservation) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white p-5 lg:p-6 rounded-3xl border-2 border-stone-200 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-3">
                              <div className="flex items-center gap-2 text-stone-900">
                                <Clock className="w-6 h-6 text-emerald-600" />
                                <span className="text-3xl font-black tracking-tight">{r.time}</span>
                              </div>
                              <span className={`text-sm font-black px-3 py-1.5 rounded-full border-2 ${STATUS_COLOR[r.status] || ''}`}>
                                {STATUS_LABEL[r.status] || r.status}
                              </span>
                            </div>
                            <div className="space-y-2 text-lg">
                              <p>
                                <span className="font-black text-stone-900 text-xl">{r.customerName}</span>
                                <span className="text-stone-500 mx-2">·</span>
                                <span className="font-bold text-stone-700"><UserCheck className="w-5 h-5 inline -mt-1 mr-1" />{r.partySize}명</span>
                              </p>
                              <p className="text-base font-bold text-stone-700">
                                <LayoutGrid className="w-4 h-4 inline -mt-1 mr-1.5 text-stone-400" />
                                {r.tableNumber}번 테이블
                                {r.customerPhone && (
                                  <>
                                    <span className="text-stone-400 mx-2">·</span>
                                    <Phone className="w-4 h-4 inline -mt-1 mr-1.5 text-stone-400" />
                                    <a href={`tel:${r.customerPhone}`} className="text-emerald-700 underline">{r.customerPhone}</a>
                                  </>
                                )}
                              </p>
                            </div>
                            {r.memo && (
                              <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                                <p className="text-base font-bold text-amber-900 leading-relaxed">📌 {r.memo}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                            {r.status === 'confirmed' && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(r, 'completed')}
                                  className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-base font-black hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                  <CheckCircle2 className="w-5 h-5" /> 완료
                                </button>
                                <button
                                  onClick={() => handleStatusChange(r, 'no-show')}
                                  className="px-4 py-3 bg-amber-500 text-white rounded-2xl text-base font-black hover:bg-amber-600 transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                  <AlertCircle className="w-5 h-5" /> 노쇼
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openEdit(r)}
                              className="p-3.5 bg-stone-100 text-stone-700 rounded-2xl hover:bg-stone-200 transition-all"
                              title="수정"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r)}
                              className="p-3.5 bg-red-50 text-red-700 rounded-2xl hover:bg-red-100 transition-all"
                              title="삭제"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showForm && (
          <ReservationFormModal
            initial={editing}
            tables={myStoreTables}
            isSaving={isSaving}
            onClose={() => { setShowForm(false); setEditing(null); }}
            onSubmit={async (data) => {
              const conflict = (reservations || []).find((r: Reservation) => {
                if (r.storeId !== currentUser.id) return false;
                if (r.status !== 'confirmed') return false;
                if (editing && r.id === editing.id) return false;
                if (r.date !== data.date) return false;
                if (r.tableNumber !== data.tableNumber) return false;
                const toMin = (t: string) => {
                  const [h, m] = t.split(':').map(Number);
                  return h * 60 + m;
                };
                return Math.abs(toMin(r.time) - toMin(data.time)) < 90;
              });
              if (conflict) {
                showToast(`${data.tableNumber}번 테이블 ${conflict.time}에 ${conflict.customerName}님 예약이 이미 있습니다.`, 'error');
                return;
              }
              setIsSaving(true);
              try {
                if (editing) await updateReservation(editing.id, data);
                else await addReservation({ ...data, storeId: currentUser.id });
                setShowForm(false);
                setEditing(null);
              } finally {
                setIsSaving(false);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReservationFormModal({
  initial, tables, isSaving, onClose, onSubmit
}: {
  initial: Reservation | null;
  tables: any[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [date, setDate] = useState<string>(initial?.date || todayISO());
  const [time, setTime] = useState<string>(initial?.time || '18:00');
  const [tableNumber, setTableNumber] = useState<number>(initial?.tableNumber || tables[0]?.number || 1);
  const [partySize, setPartySize] = useState<number>(initial?.partySize || 2);
  const [customerName, setCustomerName] = useState(initial?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone || '');
  const [memo, setMemo] = useState(initial?.memo || '');
  const [status, setStatus] = useState<string>(initial?.status || 'confirmed');

  const submit = () => {
    if (!customerName.trim()) { showToast('손님 성함을 입력해 주세요.', 'error'); return; }
    if (partySize < 1) { showToast('인원수는 1명 이상이어야 합니다.', 'error'); return; }
    onSubmit({
      date, time, tableNumber: Number(tableNumber), partySize: Number(partySize),
      customerName: customerName.trim(), customerPhone: customerPhone.trim(),
      memo: memo.trim(), status
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-stone-900/60 flex items-end lg:items-center justify-center p-0 lg:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-3xl lg:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="px-6 pt-6 pb-5 flex justify-between items-center border-b-2 border-stone-100">
          <h3 className="text-2xl font-black text-stone-900">{initial ? '예약 수정' : '예약 추가'}</h3>
          <button onClick={onClose} className="p-3 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <BigField label="날짜">
              <input
                type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
              />
            </BigField>
            <BigField label="시간">
              <input
                type="time" value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
              />
            </BigField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <BigField label="테이블">
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(Number(e.target.value))}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
              >
                {tables.length === 0 && <option value={1}>1번</option>}
                {tables.map((t: any) => (
                  <option key={t.number} value={t.number}>
                    {t.number}번 ({t.seats || 4}석{t.isRoom ? ' · 룸' : ''})
                  </option>
                ))}
              </select>
            </BigField>
            <BigField label="인원수">
              <input
                type="number" min={1} max={50} value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
              />
            </BigField>
          </div>

          <BigField label="손님 성함">
            <input
              type="text" value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="홍길동"
              className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
            />
          </BigField>

          <BigField label="연락처">
            <input
              type="tel" value={customerPhone}
              onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-1234-5678"
              className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
            />
          </BigField>

          <BigField label="메모 (선택)">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="알러지, 기념일, 특별 요청 등"
              rows={2}
              className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-base font-bold focus:outline-none focus:border-emerald-500 resize-none"
            />
          </BigField>

          {initial && (
            <BigField label="상태">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="confirmed">예약 확정</option>
                <option value="completed">방문 완료</option>
                <option value="no-show">노쇼</option>
                <option value="cancelled">취소됨</option>
              </select>
            </BigField>
          )}
        </div>

        <div className="px-6 py-5 border-t-2 border-stone-100 flex gap-3 bg-stone-50">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border-2 border-stone-300 text-stone-700 rounded-2xl font-black text-lg hover:bg-stone-100"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={isSaving}
            className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {initial ? '수정 저장' : '예약 등록'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-base font-black text-stone-700 mb-2">{label}</span>
      {children}
    </label>
  );
}
