import { useMemo, useState } from "react";
import { Plus, Trash2, Phone } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { formatPhoneNumber } from "../../lib/ids";
import type { Reservation, ReservationStatus } from "../../lib/types";
import { showToast } from "../../lib/toast";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: "예약 확정",
  completed: "방문 완료",
  cancelled: "취소",
  "no-show": "노쇼",
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
}

const todayStr = () => new Date().toISOString().slice(0, 10);

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
  const { currentUser, reservations, addReservation, updateReservation, deleteReservation } = useStore();
  const storeId = currentUser?.id ?? "";
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = useMemo(() => {
    const all = reservations.filter((r) => r.storeId === storeId);
    if (filter === "upcoming") {
      const today = todayStr();
      return all
        .filter((r) => r.date >= today && r.status === "confirmed")
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    }
    return all.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [reservations, storeId, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, Reservation[]> = {};
    for (const r of list) (map[r.date] ??= []).push(r);
    return map;
  }, [list]);

  const save = async () => {
    if (!draft) return;
    if (!draft.customerName || !draft.customerPhone) {
      showToast("이름과 전화번호는 필수입니다.", "error");
      return;
    }
    const data = {
      storeId,
      date: draft.date,
      time: draft.time,
      tableNumber: Number(draft.tableNumber) || 1,
      partySize: Number(draft.partySize) || 1,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      memo: draft.memo || undefined,
    };
    if (draft.id) {
      await updateReservation(draft.id, data);
      showToast("예약을 수정했습니다.", "success");
    } else {
      await addReservation(data);
    }
    setDraft(null);
  };

  return (
    <OwnerShell
      title="예약 관리"
      headerRight={
        <button
          onClick={() => setDraft(newDraft())}
          className="h-10 px-4 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center gap-1.5 text-[13px] font-bold shadow-[var(--shadow-navy)]"
        >
          <Plus className="w-4 h-4" />
          새 예약
        </button>
      }
    >
      <div className="max-w-[900px] mx-auto">
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[14px] max-w-xs">
          {(["upcoming", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-10 rounded-[10px] text-[12px] font-bold ${
                filter === f ? "bg-white text-[var(--color-navy-800)]" : "text-[var(--color-ink-500)]"
              }`}
            >
              {f === "upcoming" ? "예정" : "전체"}
            </button>
          ))}
        </div>

        {Object.keys(grouped).length === 0 ? (
          <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)] mt-4">
            예약이 없습니다.
          </Card>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mt-4">
              <h3 className="text-[13px] font-bold text-[var(--color-ink-500)] px-1 mb-2">
                {new Date(date).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((r) => (
                  <Card key={r.id} padding="md">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[15px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                        {r.time}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      <button
                        onClick={() => deleteReservation(r.id)}
                        className="ml-auto w-8 h-8 rounded-full hover:bg-[var(--color-danger)]/10 inline-flex items-center justify-center text-[var(--color-danger)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--color-navy-900)]">
                      {r.customerName} · {r.partySize}명 · 테이블 {r.tableNumber}
                    </div>
                    <div className="text-[12px] text-[var(--color-ink-500)] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {r.customerPhone}
                    </div>
                    {r.memo && (
                      <p className="text-[12px] text-[var(--color-ink-500)] mt-1.5 bg-[var(--color-bg)] px-2 py-1 rounded">
                        {r.memo}
                      </p>
                    )}
                    <div className="flex gap-1 mt-2">
                      {(["confirmed", "completed", "no-show", "cancelled"] as ReservationStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateReservation(r.id, { status: s })}
                          className={`flex-1 h-7 rounded text-[10px] font-bold ${
                            r.status === s
                              ? "bg-[var(--color-navy-700)] text-white"
                              : "bg-[var(--color-bg)] text-[var(--color-ink-500)]"
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
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
              {draft.id ? "예약 수정" : "새 예약"}
            </h2>
            <div className="space-y-3">
              <Input label="고객명" value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} />
              <Input
                label="전화번호"
                value={draft.customerPhone}
                onChange={(e) => setDraft({ ...draft, customerPhone: formatPhoneNumber(e.target.value) })}
                inputMode="numeric"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="날짜" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                <Input label="시간" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="테이블" inputMode="numeric" value={draft.tableNumber} onChange={(e) => setDraft({ ...draft, tableNumber: e.target.value.replace(/\D/g, "") })} />
                <Input label="인원" inputMode="numeric" value={draft.partySize} onChange={(e) => setDraft({ ...draft, partySize: e.target.value.replace(/\D/g, "") })} />
              </div>
              <Input label="메모 (선택)" value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
            </div>
            <Button block className="mt-5" onClick={save}>저장</Button>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}
