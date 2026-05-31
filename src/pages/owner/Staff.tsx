import { useMemo, useState } from "react";
import { Check, X, UserMinus, Clock, ChevronDown, ChevronUp, UserCheck, UserPlus } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { formatPhoneNumber } from "../../lib/ids";

function fmtDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}시간 ${m}분`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function OwnerStaff() {
  const { currentUser, users, shifts, approveStaff, rejectStaff, removeStaffMembership } = useStore();
  const [openShiftsFor, setOpenShiftsFor] = useState<string | null>(null);

  const storeId = currentUser?.id ?? "";

  const myStaff = useMemo(
    () => users.filter((u) => u.role === "staff" && u.employerStoreId === storeId),
    [users, storeId]
  );
  const pending = myStaff.filter((s) => s.employerStatus === "pending");
  const approved = myStaff.filter((s) => s.employerStatus === "approved");

  const statsByStaff = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const map = new Map<string, { todayMs: number; weekMs: number; onDuty: boolean; activeSince?: string }>();
    const todayKey = new Date().toDateString();
    for (const s of shifts.filter((s) => s.storeId === storeId)) {
      const inT = new Date(s.clockInAt).getTime();
      const outT = s.clockOutAt ? new Date(s.clockOutAt).getTime() : now;
      const dur = Math.max(0, outT - inT);
      const cur = map.get(s.staffId) ?? { todayMs: 0, weekMs: 0, onDuty: false };
      if (new Date(s.clockInAt).toDateString() === todayKey) cur.todayMs += dur;
      if (inT >= weekAgo) cur.weekMs += dur;
      if (!s.clockOutAt) {
        cur.onDuty = true;
        cur.activeSince = s.clockInAt;
      }
      map.set(s.staffId, cur);
    }
    return map;
  }, [shifts, storeId]);

  return (
    <OwnerShell title="직원 관리">
      {/* 대기 요청 */}
      <section className="mb-7">
        <h2 className="headline-sub mb-3 px-1 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          승인 대기 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card padding="lg" className="text-center body-sm">
            대기 중인 가입 요청이 없습니다.
          </Card>
        ) : (
          <div className="space-y-2">
            {pending.map((s) => (
              <Card key={s.id} padding="md" className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-[var(--color-navy-900)] break-keep">
                    {s.name} {s.position && <span className="text-[var(--color-navy-700)] font-bold">· {s.position}</span>}
                  </p>
                  <p className="body-sm">{formatPhoneNumber(s.phone)}</p>
                  {s.joinRequestedAt && (
                    <p className="text-[12px] text-[var(--color-ink-600)] font-semibold mt-0.5">
                      요청 {fmtDate(s.joinRequestedAt)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" leftIcon={<Check className="w-4 h-4" />} onClick={() => approveStaff(s.id)}>
                    승인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<X className="w-4 h-4" />}
                    onClick={() => rejectStaff(s.id)}
                  >
                    거절
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 활성 직원 */}
      <section>
        <h2 className="headline-sub mb-3 px-1 flex items-center gap-2">
          <UserCheck className="w-4 h-4" />
          소속 직원 ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <Card padding="lg" className="text-center body-sm">
            아직 소속된 직원이 없습니다.
          </Card>
        ) : (
          <div className="space-y-2">
            {approved.map((s) => {
              const st = statsByStaff.get(s.id) ?? { todayMs: 0, weekMs: 0, onDuty: false };
              const open = openShiftsFor === s.id;
              const myShifts = shifts
                .filter((sh) => sh.storeId === storeId && sh.staffId === s.id)
                .sort((a, b) => b.clockInAt.localeCompare(a.clockInAt))
                .slice(0, 30);
              return (
                <Card key={s.id} padding="md">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-[var(--color-navy-900)] truncate flex items-center gap-2">
                        {s.name}
                        {st.onDuty && (
                          <span className="chip text-[11px] bg-[var(--color-mint-100)] text-[var(--color-mint-700)] px-2 py-0.5">
                            근무 중
                          </span>
                        )}
                      </p>
                      <p className="body-sm">
                        {formatPhoneNumber(s.phone)}
                        {s.position ? ` · ${s.position}` : ""}
                      </p>
                      <p className="text-[12px] text-[var(--color-ink-600)] font-semibold mt-1 flex items-center gap-3 flex-wrap">
                        <span><Clock className="inline w-3 h-3 mr-1" />오늘 {fmtDuration(st.todayMs)}</span>
                        <span>주간 {fmtDuration(st.weekMs)}</span>
                        {st.activeSince && (
                          <span>출근 {new Date(st.activeSince).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        rightIcon={open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        onClick={() => setOpenShiftsFor(open ? null : s.id)}
                      >
                        근무기록
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<UserMinus className="w-4 h-4" />}
                        onClick={() => {
                          if (confirm(`${s.name}님을 매장에서 해제할까요?`)) removeStaffMembership(s.id);
                        }}
                      >
                        해제
                      </Button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-line-soft)] space-y-1">
                      {myShifts.length === 0 ? (
                        <p className="body-sm text-center text-[var(--color-ink-500)] py-2">
                          기록이 없습니다.
                        </p>
                      ) : (
                        myShifts.map((sh) => {
                          const inT = new Date(sh.clockInAt).getTime();
                          const outT = sh.clockOutAt ? new Date(sh.clockOutAt).getTime() : Date.now();
                          return (
                            <div
                              key={sh.id}
                              className="flex items-center justify-between text-[12px] text-[var(--color-ink-700)] font-semibold py-1"
                            >
                              <span>{fmtDate(sh.clockInAt)} → {sh.clockOutAt ? fmtDate(sh.clockOutAt) : "근무 중"}</span>
                              <span className="tabular-nums text-[var(--color-navy-700)]">
                                {fmtDuration(outT - inT)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </OwnerShell>
  );
}
