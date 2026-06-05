import { useMemo, useState } from "react";
import { Plus, Trash2, Phone, UserPlus, User as UserIcon, Search, X, Minus, Monitor, MessageCircle, MessageSquare, Bell, ChevronLeft, ChevronRight, CalendarDays, List as ListIcon } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { formatPhoneNumber, digitsOnly } from "../../lib/ids";
import type { Reservation, ReservationStatus, User } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { useEscapeClose } from "../../lib/useEscapeClose";
import { cn } from "../../lib/cn";
import { useLanguage, t } from "../../lib/i18n";
import { sendKakaoMessage, sendPhysicalSms } from "../../lib/messaging";

const STATUS_KEYS: Record<ReservationStatus, string> = {
  confirmed: "ores.status.confirmed",
  completed: "ores.status.completed",
  cancelled: "ores.status.cancelled",
  "no-show": "ores.status.noshow",
};
const STATUS_COLORS: Record<ReservationStatus, string> = {
  confirmed: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  completed: "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]",
  cancelled: "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]",
  "no-show": "bg-[#fef2f2] text-[var(--color-danger)]",
};

interface Draft {
  id?: string;
  date: string;
  time: string;
  tableNumber: string;
  partySize: string;
  customerName: string;
  customerPhone: string;
  memo: string;
  /** 등록된 고객을 선택한 경우의 user.id (게스트면 undefined) */
  customerId?: string;
  /** 게스트 모드 — 등록 안 된 손님이면 true */
  isGuest?: boolean;
}

// 로컬 자정 기준 'YYYY-MM-DD' — KST/UTC 차이로 달력이 어긋나지 않게.
const toLocalISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = () => toLocalISO(new Date());

const newDraft = (): Draft => ({
  date: todayStr(),
  time: "19:00",
  tableNumber: "1",
  partySize: "2",
  customerName: "",
  customerPhone: "",
  memo: "",
});

export default function OwnerReservations() {
  const { effectiveStoreId, reservations, users, visits, currentUser, addReservation, updateReservation, deleteReservation } = useStore();
  const storeId = effectiveStoreId;
  const lang = useLanguage();
  const locale = lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "vi" ? "vi-VN" : "en-US";

  // 매장 이름 — 메시지 템플릿에서 사용
  const storeOwner = users.find((u) => u.id === storeId);
  const storeName = storeOwner?.restaurantName ?? currentUser?.restaurantName ?? "결";

  // 예약을 카카오톡/SMS로 보내는 핸들러.
  // 반환값: 성공 시 true. 일괄 발송에서 정확한 카운트를 위해 boolean 반환.
  // silent=true 면 토스트 출력 생략 (일괄 발송에서 마지막에 하나만 띄우기).
  const sendMessage = async (
    r: Reservation,
    via: "kakao" | "sms",
    kind: "confirm" | "reminder",
    silent = false
  ): Promise<boolean> => {
    if (!r.customerPhone) {
      if (!silent) showToast(t("resMsg.toast.noPhone", lang), "error");
      return false;
    }
    const fmtDate = new Date(r.date).toLocaleDateString(locale, {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    const titleKey = kind === "confirm" ? "resMsg.confirm.title" : "resMsg.reminder.title";
    const bodyKey = kind === "confirm" ? "resMsg.confirm.body" : "resMsg.reminder.body";
    const title = t(titleKey, lang, { store: storeName });
    const body = t(bodyKey, lang, {
      name: r.customerName,
      date: fmtDate,
      time: r.time,
      party: r.partySize,
    });

    if (via === "kakao") {
      const res = await sendKakaoMessage(body, title, storeId ?? "");
      if (res.ok) {
        if (!silent) showToast(t("resMsg.toast.kakaoOk", lang), "success");
        return true;
      }
      if (!silent) showToast(t("resMsg.toast.kakaoFail", lang, { msg: res.message ?? "" }), "error");
      return false;
    }
    // SMS — 모바일에서 sms: 딥링크, PC면 차단됨
    const res = await sendPhysicalSms(r.customerPhone, `${title}\n${body}`, "device");
    if (res.ok) {
      if (!silent) showToast(t("resMsg.toast.smsOk", lang), "success");
      return true;
    }
    if (!silent) showToast(t("resMsg.toast.smsFail", lang, { msg: res.message ?? "" }), "error");
    return false;
  };

  // 로컬 자정 기준 'YYYY-MM-DD' — toISOString() 은 UTC 라 KST 외 매장에서 어긋남.
  const localISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // 내일 예약 일괄 리마인더 — 중복 클릭 가드 포함
  const [reminderBusy, setReminderBusy] = useState(false);
  const sendTomorrowReminders = async (via: "kakao" | "sms") => {
    if (reminderBusy) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = localISO(tomorrow);
    const targets = reservations.filter(
      (r) => r.storeId === storeId && r.date === tomorrowStr && r.status === "confirmed" && r.customerPhone
    );
    if (targets.length === 0) {
      showToast(t("resMsg.toast.noTomorrow", lang), "info");
      return;
    }
    setReminderBusy(true);
    try {
      let sent = 0;
      let failed = 0;
      for (const r of targets) {
        // SMS는 sms: 딥링크라 연속 호출이 깨짐 — 카톡만 일괄 가능
        // SMS의 경우 첫 1건만 발송하고 나머지는 사장님이 수동 진행 (모바일 UX 한계)
        if (via === "sms" && sent + failed >= 1) break;
        // silent=true 로 카드별 토스트 생략, 마지막에 1개만 — 토스트 폭격 차단.
        // 실제 성공한 건만 sent 카운트 — 기존엔 실패도 sent++ 되어 사장님이
        // 잘못된 "n명 보냈어요" 토스트 보고 안 보낸 손님을 또 안 보내던 버그.
        // eslint-disable-next-line no-await-in-loop
        const ok = await sendMessage(r, via, "reminder", true);
        if (ok) sent++;
        else failed++;
      }
      if (sent > 0) {
        showToast(t("resMsg.toast.batchDone", lang, { n: sent }), "success");
      }
      if (failed > 0) {
        showToast(t("resMsg.toast.batchFailed", lang, { n: failed }), "error");
      }
    } finally {
      setReminderBusy(false);
    }
  };

  // 내일 예약 카운트
  const tomorrowReservationsCount = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = localISO(tomorrow);
    return reservations.filter(
      (r) => r.storeId === storeId && r.date === tomorrowStr && r.status === "confirmed" && r.customerPhone
    ).length;
  }, [reservations, storeId]);

  // 본 매장 단골 (visits 있는 고객) — 검색 후보 1순위
  const myCustomers = useMemo(() => {
    const visited = new Set(visits.filter((v) => v.storeId === storeId).map((v) => v.customerId));
    return users.filter(
      (u) => u.role === "customer" && u.status !== "deleted" && visited.has(u.id)
    );
  }, [users, visits, storeId]);

  // 본 매장에 예약 이력 있는 손님 (단골은 아니지만 예약은 함) — 2순위
  const reservedNames = useMemo(() => {
    const seen = new Map<string, { name: string; phone: string }>();
    reservations
      .filter((r) => r.storeId === storeId)
      .forEach((r) => {
        const key = digitsOnly(r.customerPhone) || r.customerName;
        if (!seen.has(key)) seen.set(key, { name: r.customerName, phone: r.customerPhone });
      });
    return Array.from(seen.values());
  }, [reservations, storeId]);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const [view, setView] = useState<"list" | "calendar">("list");
  // 캘린더가 보고 있는 달의 첫째 날(1일). null 이면 오늘 기준.
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // 캘린더에서 날짜 클릭 시 그 날만 보여주는 모드
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  useEscapeClose(!!draft, () => setDraft(null));

  const list = useMemo(() => {
    const all = reservations.filter((r) => r.storeId === storeId);
    // 캘린더에서 특정 날짜를 선택했으면 그 날만
    if (selectedDate) {
      return all
        .filter((r) => r.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time));
    }
    if (filter === "upcoming") {
      const today = todayStr();
      return all
        .filter((r) => r.date >= today && r.status === "confirmed")
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    }
    return all.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [reservations, storeId, filter, selectedDate]);

  // 달력 셀별 예약 묶음 — 한 번만 계산해 캘린더 렌더에 재사용
  const reservationsByDate = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.storeId !== storeId) continue;
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    }
    // 시간순 정렬
    for (const arr of map.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [reservations, storeId]);

  const grouped = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of list) (map[r.date] ??= []).push(r);
    return map;
  }, [list]);

  const save = async () => {
    if (!draft) return;
    if (!draft.customerName.trim() || !draft.customerPhone.trim()) {
      showToast(t("ores.err.required", lang), "error");
      return;
    }
    if (!storeId) {
      showToast(t("ores.err.noStore", lang), "error");
      return;
    }
    // 과거 날짜·시간 경고 (신규일 때만)
    if (!draft.id) {
      const scheduled = new Date(`${draft.date}T${draft.time || "00:00"}`);
      if (scheduled.getTime() < Date.now() - 60_000) {
        if (!confirm(t("ores.err.pastDate", lang))) return;
      }
    }
    const tableNumber = Number(draft.tableNumber) || 1;
    // 같은 매장·날짜·시간·테이블에 이미 확정 예약이 있으면 차단 (수정 중인 자신은 제외)
    const dup = reservations.find(
      (r) =>
        r.storeId === storeId &&
        r.id !== draft.id &&
        r.date === draft.date &&
        r.time === draft.time &&
        r.tableNumber === tableNumber &&
        r.status === "confirmed"
    );
    if (dup) {
      showToast(t("ores.err.duplicate", lang, { date: draft.date, time: draft.time, n: tableNumber }), "error");
      return;
    }
    const data = {
      storeId,
      date: draft.date,
      time: draft.time,
      tableNumber,
      partySize: Number(draft.partySize) || 1,
      customerName: draft.customerName.trim(),
      customerPhone: draft.customerPhone.trim(),
      memo: draft.memo || undefined,
    };
    try {
      if (draft.id) {
        await updateReservation(draft.id, data);
        showToast(t("ores.ok.updated", lang), "success");
      } else {
        await addReservation(data);
        showToast(t("ores.ok.added", lang), "success");
      }
      setDraft(null);
    } catch (e: any) {
      showToast(t("ores.err.saveFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  return (
    <OwnerShell
      title={t("ores.title", lang)}
      headerRight={
        <div className="flex items-center gap-2">
          {tomorrowReservationsCount > 0 && (
            <button
              onClick={() => sendTomorrowReminders("kakao")}
              disabled={reminderBusy}
              className="h-10 px-3.5 rounded-full bg-[#FEE500] text-[#191919] inline-flex items-center gap-1.5 text-[12.5px] font-extrabold disabled:opacity-50"
              title={t("resMsg.btn.reminderAll", lang, { n: tomorrowReservationsCount })}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">{t("resMsg.btn.reminderAll", lang, { n: tomorrowReservationsCount })}</span>
              <span className="sm:hidden tabular-nums">{tomorrowReservationsCount}</span>
            </button>
          )}
          <button
            onClick={() =>
              window.open(
                "/biz/owner/welcome-display",
                "gyeol-welcome-display",
                "popup=yes,width=1280,height=800"
              )
            }
            className="h-10 px-3.5 rounded-full bg-white border border-[var(--color-line)] text-[var(--color-navy-700)] inline-flex items-center gap-1.5 text-[13px] font-bold"
            title={t("ores.openDisplayTip", lang)}
          >
            <Monitor className="w-4 h-4" />
            {t("ores.openDisplay", lang)}
          </button>
          <button
            onClick={() => setDraft(newDraft())}
            className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)]"
          >
            <Plus className="w-4 h-4" />
            {t("ores.newBtn", lang)}
          </button>
        </div>
      }
    >
      <div className="max-w-[900px] mx-auto">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {/* List / Calendar 뷰 토글 */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-[var(--color-line)] rounded-[14px]">
            {(["list", "calendar"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedDate(null); }}
                className={`h-10 px-3.5 rounded-[10px] text-[12px] font-bold inline-flex items-center gap-1.5 ${
                  view === v ? "bg-[var(--color-navy-700)] text-white" : "text-[var(--color-ink-500)]"
                }`}
              >
                {v === "list" ? <ListIcon className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                {v === "list" ? t("ores.view.list", lang) : t("ores.view.calendar", lang)}
              </button>
            ))}
          </div>
          {/* 리스트 뷰에서만 upcoming/all 필터 노출 */}
          {view === "list" && !selectedDate && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[14px]">
              {(["upcoming", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-10 px-3.5 rounded-[10px] text-[12px] font-bold ${
                    filter === f ? "bg-white text-[var(--color-navy-800)]" : "text-[var(--color-ink-500)]"
                  }`}
                >
                  {f === "upcoming" ? t("ores.filter.upcoming", lang) : t("ores.filter.all", lang)}
                </button>
              ))}
            </div>
          )}
          {/* 선택된 날짜가 있으면 칩으로 표시 + 해제 */}
          {selectedDate && (
            <div className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)] text-[12.5px] font-bold">
              {new Date(selectedDate).toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "short" })}
              <button
                onClick={() => setSelectedDate(null)}
                className="w-5 h-5 rounded-full hover:bg-white/60 inline-flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Calendar 뷰 */}
        {view === "calendar" && (
          <MonthCalendar
            month={calMonth}
            onPrev={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNext={() => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            onToday={() => {
              const now = new Date();
              setCalMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(toLocalISO(now));
            }}
            reservationsByDate={reservationsByDate}
            onDayClick={(dateStr) => setSelectedDate(dateStr)}
            selectedDate={selectedDate}
            locale={locale}
          />
        )}

        {Object.keys(grouped).length === 0 ? (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)] mt-4">
            {t("ores.empty", lang)}
          </Card>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mt-4">
              <h3 className="text-[14px] font-bold text-[var(--color-ink-700)] px-1 mb-2">
                {new Date(date).toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "short" })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((r) => (
                  <Card key={r.id} padding="md">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[15px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                        {r.time}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[r.status]}`}>
                        {t(STATUS_KEYS[r.status], lang)}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(t("ores.deleteConfirm", lang, { name: r.customerName }))) {
                            deleteReservation(r.id);
                          }
                        }}
                        className="ml-auto w-8 h-8 rounded-full hover:bg-[var(--color-danger)]/10 inline-flex items-center justify-center text-[var(--color-danger)]"
                        aria-label={t("ores.deleteAria", lang)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--color-navy-900)]">
                      {t("ores.partyAndTable", lang, { name: r.customerName, n: r.partySize, table: r.tableNumber })}
                    </div>
                    <div className="text-[12px] text-[var(--color-ink-500)] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {r.customerPhone}
                    </div>
                    {r.memo && (
                      <p className="text-[13px] text-[var(--color-ink-600)] mt-1.5 bg-[var(--color-bg)] px-2 py-1.5 rounded break-keep">
                        {r.memo}
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5">
                      {(["confirmed", "completed", "no-show", "cancelled"] as ReservationStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateReservation(r.id, { status: s })}
                          className={`h-10 rounded-lg text-[12px] font-bold transition-colors ${
                            r.status === s
                              ? "bg-[var(--color-navy-700)] text-white"
                              : "bg-[var(--color-bg)] text-[var(--color-ink-600)] hover:bg-[var(--color-navy-50)]"
                          }`}
                        >
                          {t(STATUS_KEYS[s], lang)}
                        </button>
                      ))}
                    </div>
                    {/* 확정 상태일 때만 메시지 버튼 노출. 카톡/SMS — 확인 메시지는 클릭 시점 자동 분기:
                        오늘 이전 = 확인, 그 외(미래) = 확인. 리마인더는 일괄 버튼이 따로 있음. */}
                    {r.status === "confirmed" && r.customerPhone && (
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <button
                          onClick={() => sendMessage(r, "kakao", "confirm")}
                          className="h-9 rounded-lg bg-[#FEE500] text-[#191919] inline-flex items-center justify-center gap-1 text-[12px] font-extrabold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {t("resMsg.btn.kakao", lang)}
                        </button>
                        <button
                          onClick={() => sendMessage(r, "sms", "confirm")}
                          className="h-9 rounded-lg bg-white border border-[var(--color-line)] text-[var(--color-navy-800)] inline-flex items-center justify-center gap-1 text-[12px] font-bold hover:bg-[var(--color-navy-50)]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {t("resMsg.btn.sms", lang)}
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setDraft(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[88vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-5" />
            <h2 className="text-[18px] font-extrabold text-[var(--color-navy-900)] mb-4">
              {draft.id ? t("ores.editTitle", lang) : t("ores.newTitle", lang)}
            </h2>
            <div className="space-y-3">
              {/* 고객 선택/검색 — 등록 고객이면 자동 채움, 없으면 게스트 */}
              <CustomerPicker
                value={{
                  customerName: draft.customerName,
                  customerPhone: draft.customerPhone,
                  customerId: draft.customerId,
                  isGuest: !!draft.isGuest,
                }}
                onChange={(v) => setDraft({ ...draft, ...v })}
                customers={myCustomers}
                previousGuests={reservedNames}
              />

              {/* 전화번호 — 단골 선택 시 자동 채워짐, 게스트면 직접 입력 */}
              <Input
                label={t("ores.field.phone", lang)}
                value={draft.customerPhone}
                onChange={(e) => setDraft({ ...draft, customerPhone: formatPhoneNumber(e.target.value), customerId: undefined })}
                inputMode="numeric"
                placeholder="010-0000-0000"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input label={t("ores.field.date", lang)} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                <Input label={t("ores.field.time", lang)} type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
              </div>

              {/* 테이블 + 인원 (스테퍼 UI) */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t("ores.field.table", lang)}
                  inputMode="numeric"
                  value={draft.tableNumber}
                  onChange={(e) => setDraft({ ...draft, tableNumber: e.target.value.replace(/\D/g, "") })}
                />
                <PartyStepper
                  value={Number(draft.partySize) || 1}
                  onChange={(n) => setDraft({ ...draft, partySize: String(Math.max(1, Math.min(99, n))) })}
                />
              </div>

              <Input label={t("ores.field.memo", lang)} value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
            </div>
            <Button block className="mt-5" onClick={save}>{t("omenus.save", lang)}</Button>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}

// ============================================================
// CustomerPicker — 등록 고객 검색·선택 + 게스트 입력 폴백
// ============================================================
function CustomerPicker({
  value,
  onChange,
  customers,
  previousGuests,
}: {
  value: { customerName: string; customerPhone: string; customerId?: string; isGuest: boolean };
  onChange: (v: Partial<{ customerName: string; customerPhone: string; customerId?: string; isGuest: boolean }>) => void;
  customers: User[];
  previousGuests: { name: string; phone: string }[];
}) {
  const lang = useLanguage();
  const [query, setQuery] = useState(value.customerName);
  const [open, setOpen] = useState(false);
  // 게스트 추가 인라인 폼 — 이름·전화 한 번에 입력
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestError, setGuestError] = useState("");

  // 입력에 따라 후보 필터링 — 단골 우선, 그 다음 이전 예약 손님
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digitsOnly(query);
    const customerHits = customers
      .filter((u) => {
        if (!q) return true;
        const nm = (u.name || "").toLowerCase();
        const ph = digitsOnly(u.phone || "");
        return nm.includes(q) || (qDigits && ph.includes(qDigits));
      })
      .slice(0, 6)
      .map((u) => ({ kind: "registered" as const, id: u.id, name: u.name, phone: u.phone }));

    const guestHits = previousGuests
      .filter((g) => {
        if (!q) return false;
        const nm = (g.name || "").toLowerCase();
        const ph = digitsOnly(g.phone || "");
        // 등록 고객과 같은 이름·전화는 중복 제외
        if (customerHits.some((c) => c.name === g.name || (c.phone && digitsOnly(c.phone) === ph))) return false;
        return nm.includes(q) || (qDigits && ph.includes(qDigits));
      })
      .slice(0, 4)
      .map((g) => ({ kind: "guest-prev" as const, id: g.phone || g.name, name: g.name, phone: g.phone }));

    return [...customerHits, ...guestHits];
  }, [query, customers, previousGuests]);

  // 외부에서 value 가 변하면 query 동기화 (수정 모드)
  // ※ value.customerName 만 추적 — 너무 자주 갱신되지 않게
  // (Reservations.tsx 가 controlled component 로 잘 흐름)

  const selectCustomer = (c: { id: string; name: string; phone?: string }) => {
    onChange({
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone ? formatPhoneNumber(c.phone) : "",
      isGuest: false,
    });
    setQuery(c.name);
    setOpen(false);
  };

  const startGuestForm = () => {
    // 검색어를 이름 기본값으로 (게스트 prefix 없이)
    const prefix = t("ores.guestPrefix", lang);
    const raw = query.trim().replace(new RegExp(`^${prefix}\\s*`), "");
    setGuestName(raw);
    setGuestPhone("");
    setGuestError("");
    setGuestMode(true);
    setOpen(false);
  };

  const confirmGuest = () => {
    const name = guestName.trim();
    const phoneDigits = digitsOnly(guestPhone);
    if (!name) { setGuestError(t("ores.guestErr.name", lang)); return; }
    if (phoneDigits.length < 10) { setGuestError(t("ores.guestErr.phone", lang)); return; }
    const prefix = t("ores.guestPrefix", lang);
    onChange({
      customerId: undefined,
      customerName: name.startsWith(prefix) ? name : `${prefix} ${name}`,
      customerPhone: formatPhoneNumber(guestPhone),
      isGuest: true,
    });
    setQuery("");
    setGuestName("");
    setGuestPhone("");
    setGuestError("");
    setGuestMode(false);
  };

  const cancelGuest = () => {
    setGuestMode(false);
    setGuestName("");
    setGuestPhone("");
    setGuestError("");
  };

  const clearPick = () => {
    onChange({ customerId: undefined, customerName: "", customerPhone: "", isGuest: false });
    setQuery("");
    setOpen(true);
  };

  const isPicked = !!value.customerId || (value.isGuest && !!value.customerName);

  return (
    <div className="relative">
      <label className="block text-[12px] font-bold text-[var(--color-navy-800)] mb-1.5">{t("ores.customer", lang)}</label>

      {/* 게스트 추가 인라인 폼 — 이름·전화 동시 입력 */}
      {guestMode ? (
        <div className="rounded-[14px] border-2 border-[#f0b400] bg-[#fff8e6] p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#f0b400] text-white inline-flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <p className="text-[13px] font-extrabold text-[#b07b00] flex-1">
              {t("ores.guestPanel", lang)}
            </p>
          </div>
          <input
            type="text"
            value={guestName}
            onChange={(e) => { setGuestName(e.target.value); setGuestError(""); }}
            placeholder={t("ores.guestNamePh", lang)}
            autoFocus
            className="w-full h-11 px-3 rounded-[10px] border-[1.5px] border-[#f0b400]/40 bg-white text-[14px] font-semibold focus:border-[#f0b400] focus:outline-none"
          />
          <input
            type="tel"
            value={guestPhone}
            onChange={(e) => { setGuestPhone(formatPhoneNumber(e.target.value)); setGuestError(""); }}
            inputMode="numeric"
            placeholder={t("ores.guestPhonePh", lang)}
            className="w-full h-11 px-3 rounded-[10px] border-[1.5px] border-[#f0b400]/40 bg-white text-[14px] font-semibold tabular-nums focus:border-[#f0b400] focus:outline-none"
          />
          {guestError && (
            <p className="text-[11.5px] font-bold text-[var(--color-danger)]">{guestError}</p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={cancelGuest}
              className="h-10 rounded-[10px] bg-white border-[1.5px] border-[var(--color-line)] text-[var(--color-ink-700)] font-bold text-[13px]"
            >
              {t("ores.guestCancel", lang)}
            </button>
            <button
              type="button"
              onClick={confirmGuest}
              className="h-10 rounded-[10px] bg-[#f0b400] text-white font-extrabold text-[13px]"
            >
              {t("ores.guestConfirm", lang)}
            </button>
          </div>
        </div>
      ) : isPicked ? (
        // 선택 완료 칩
        <div
          className={cn(
            "w-full h-12 px-3 rounded-[12px] border-[1.5px] flex items-center gap-2.5",
            value.isGuest
              ? "border-[#f0b400] bg-[#fff8e6]"
              : "border-[var(--color-mint-300)] bg-[var(--color-mint-50)]"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-full inline-flex items-center justify-center font-extrabold text-[12px]",
            value.isGuest
              ? "bg-[#f0b400] text-white"
              : "bg-[var(--color-mint-500)] text-white"
          )}>
            {value.isGuest ? "G" : (value.customerName?.[0] ?? "?")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-extrabold text-[var(--color-navy-900)] truncate">
              {value.customerName}
              {value.isGuest && (
                <span className="ml-1.5 text-[10.5px] font-bold text-[#b07b00]">{t("ores.unregistered", lang)}</span>
              )}
            </p>
            {value.customerPhone && (
              <p className="text-[11.5px] text-[var(--color-ink-500)] truncate">{value.customerPhone}</p>
            )}
          </div>
          <button
            type="button"
            onClick={clearPick}
            className="w-8 h-8 rounded-full hover:bg-white/60 inline-flex items-center justify-center"
            aria-label={t("ores.clearAria", lang)}
          >
            <X className="w-4 h-4 text-[var(--color-ink-500)]" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange({ customerName: e.target.value }); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={t("ores.searchPlaceholder", lang)}
              className="w-full h-12 pl-9 pr-3 rounded-[12px] border-[1.5px] border-[var(--color-line)] text-[14px] focus:border-[var(--color-navy-700)] focus:outline-none"
            />
          </div>

          {open && (
            <div className="absolute z-10 left-0 right-0 mt-1.5 bg-white rounded-[12px] border border-[var(--color-line)] shadow-[var(--shadow-lifted)] overflow-hidden max-h-72 overflow-y-auto">
              {matches.length > 0 && (
                <div className="px-2 py-1.5 text-[10.5px] font-bold text-[var(--color-ink-500)] uppercase tracking-wider border-b border-[var(--color-line)]">
                  {t("ores.registered", lang)}
                </div>
              )}
              {matches.map((m) => (
                <button
                  key={`${m.kind}-${m.id}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}  // blur 차단
                  onClick={() => selectCustomer({ id: m.id, name: m.name, phone: m.phone })}
                  className="w-full px-3 py-2.5 hover:bg-[var(--color-navy-50)] flex items-center gap-2.5 text-left"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full inline-flex items-center justify-center font-extrabold text-[12px]",
                    m.kind === "registered"
                      ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]"
                      : "bg-[#fff8e6] text-[#b07b00]"
                  )}>
                    {m.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-[var(--color-navy-900)] truncate">
                      {m.name}
                      {m.kind === "guest-prev" && (
                        <span className="ml-1.5 text-[10.5px] font-bold text-[#b07b00]">{t("ores.previousGuest", lang)}</span>
                      )}
                    </p>
                    {m.phone && (
                      <p className="text-[11.5px] text-[var(--color-ink-500)] truncate">{m.phone}</p>
                    )}
                  </div>
                </button>
              ))}

              {/* 게스트로 추가 옵션 — 항상 노출. 클릭 시 이름·전화 동시 입력 폼으로 전환 */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startGuestForm}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left border-t border-[var(--color-line)] hover:bg-[#fff8e6]"
              >
                <div className="w-8 h-8 rounded-full bg-[#f0b400] text-white inline-flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#b07b00] truncate">
                    {t("ores.addGuest", lang)}
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-500)]">
                    {t("ores.addGuestDesc", lang)}
                  </p>
                </div>
              </button>

              {matches.length === 0 && query.trim() && (
                <div className="px-3 py-2.5 text-[12px] text-[var(--color-ink-500)] flex items-center gap-2 bg-[var(--color-bg)]">
                  <UserIcon className="w-3.5 h-3.5" />
                  {t("ores.noMatch", lang)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// MonthCalendar — 월간 예약 캘린더
// 각 셀에 예약 개수 배지 + 가장 가까운 시간 미리보기.
// 셀 클릭 시 그 날 예약 리스트로 필터.
// ============================================================
function MonthCalendar({
  month,
  onPrev,
  onNext,
  onToday,
  reservationsByDate,
  onDayClick,
  selectedDate,
  locale,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  reservationsByDate: Map<string, Reservation[]>;
  onDayClick: (dateStr: string) => void;
  selectedDate: string | null;
  locale: string;
}) {
  const lang = useLanguage();
  const year = month.getFullYear();
  const m = month.getMonth();
  // 그 달의 1일 요일(0=일) — 한국 달력 관습 따라 일요일 시작
  const firstDay = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const todayStrLocal = toLocalISO(new Date());

  // 셀(42칸 = 6주) 생성
  const cells: Array<{ dateStr: string; day: number; inMonth: boolean }> = [];
  // 앞쪽 빈칸 — 전달 마지막 며칠
  const prevMonthLastDay = new Date(year, m, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const d = new Date(year, m - 1, day);
    cells.push({ dateStr: toLocalISO(d), day, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, m, d);
    cells.push({ dateStr: toLocalISO(dt), day: d, inMonth: true });
  }
  // 뒤쪽 빈칸 — 다음달 시작
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const d = new Date(year, m + 1, nextDay);
    cells.push({ dateStr: toLocalISO(d), day: nextDay, inMonth: false });
    nextDay++;
    if (cells.length >= 42) break;
  }

  // 요일 헤더 — locale 기반
  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, 7); // 일요일
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  return (
    <div className="mt-4 bg-white rounded-[16px] border border-[var(--color-line)] overflow-hidden">
      {/* 헤더: 월 표시 + 이전/다음/오늘 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-line)]">
        <h3 className="text-[16px] font-extrabold text-[var(--color-navy-900)]">
          {month.toLocaleDateString(locale, { year: "numeric", month: "long" })}
        </h3>
        <div className="ml-auto inline-flex items-center gap-1">
          <button
            onClick={onPrev}
            aria-label={t("ores.cal.prev", lang)}
            className="w-9 h-9 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4 text-[var(--color-navy-800)]" />
          </button>
          <button
            onClick={onToday}
            className="h-9 px-3 rounded-full bg-[var(--color-bg)] text-[var(--color-navy-800)] text-[12px] font-bold hover:bg-[var(--color-navy-50)]"
          >
            {t("ores.cal.today", lang)}
          </button>
          <button
            onClick={onNext}
            aria-label={t("ores.cal.next", lang)}
            className="w-9 h-9 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4 text-[var(--color-navy-800)]" />
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        {weekdayLabels.map((w, i) => (
          <div
            key={i}
            className={cn(
              "py-1.5 text-center text-[11px] font-bold uppercase tracking-wider",
              i === 0 ? "text-[var(--color-danger)]" : i === 6 ? "text-[var(--color-navy-600)]" : "text-[var(--color-ink-500)]"
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 셀 그리드 */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const items = reservationsByDate.get(c.dateStr) ?? [];
          const confirmed = items.filter((r) => r.status === "confirmed");
          const isToday = c.dateStr === todayStrLocal;
          const isSelected = selectedDate === c.dateStr;
          const dayOfWeek = i % 7;
          return (
            <button
              key={`${c.dateStr}-${i}`}
              onClick={() => onDayClick(c.dateStr)}
              className={cn(
                "min-h-[84px] border-t border-l border-[var(--color-line-soft)] p-1.5 text-left transition-colors",
                !c.inMonth && "bg-[var(--color-bg)]/40 opacity-50",
                isSelected && "bg-[var(--color-mint-50)] ring-2 ring-[var(--color-mint-500)] ring-inset",
                !isSelected && c.inMonth && "hover:bg-[var(--color-navy-50)]",
                i % 7 === 0 && "border-l-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[12px] font-bold tabular-nums",
                    isToday
                      ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-navy-700)] text-white"
                      : dayOfWeek === 0
                      ? "text-[var(--color-danger)]"
                      : dayOfWeek === 6
                      ? "text-[var(--color-navy-700)]"
                      : "text-[var(--color-ink-700)]"
                  )}
                >
                  {c.day}
                </span>
                {confirmed.length > 0 && (
                  <span className="text-[10px] font-extrabold bg-[var(--color-mint-100)] text-[var(--color-mint-700)] px-1.5 rounded-full tabular-nums">
                    {confirmed.length}
                  </span>
                )}
              </div>
              {/* 시간 미리보기 — 최대 2건 */}
              {confirmed.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="mt-1 text-[10px] font-bold text-[var(--color-navy-800)] truncate"
                >
                  <span className="tabular-nums">{r.time}</span>{" "}
                  <span className="text-[var(--color-ink-600)] font-semibold">{r.customerName.slice(0, 4)}</span>
                </div>
              ))}
              {confirmed.length > 2 && (
                <div className="mt-0.5 text-[10px] font-bold text-[var(--color-ink-500)]">
                  {t("ores.cal.moreN", lang, { n: confirmed.length - 2 })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PartyStepper — 인원수 + / − 스테퍼 (큰 가시성)
// ============================================================
function PartyStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const lang = useLanguage();
  return (
    <div>
      <label className="block text-[12px] font-bold text-[var(--color-navy-800)] mb-1.5">{t("ores.field.party", lang)}</label>
      <div className="h-12 rounded-[12px] border-[1.5px] border-[var(--color-line)] flex items-center overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= 1}
          className="w-12 h-full inline-flex items-center justify-center text-[var(--color-navy-700)] hover:bg-[var(--color-navy-50)] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t("ores.partyDec", lang)}
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center font-extrabold text-[17px] text-[var(--color-navy-900)] tabular-nums">
          {t("ores.partyN", lang, { n: value })}
        </div>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= 99}
          className="w-12 h-full inline-flex items-center justify-center text-[var(--color-navy-700)] hover:bg-[var(--color-navy-50)] disabled:opacity-40"
          aria-label={t("ores.partyInc", lang)}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
