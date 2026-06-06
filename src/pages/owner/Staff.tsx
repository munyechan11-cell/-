import { useMemo, useState } from "react";
import { Check, X, UserMinus, Clock, ChevronDown, ChevronUp, UserCheck, UserPlus } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { formatPhoneNumber } from "../../lib/ids";
import { useLanguage, t, type Lang, getLocale, fmtKRW } from "../../lib/i18n";

function fmtDuration(ms: number, lang: Lang) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return t("ostaff.hourMin", lang, { h, m });
}

function fmtDate(iso: string, lang: Lang) {
  const d = new Date(iso);
  const locale = getLocale(lang);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function OwnerStaff() {
  const { currentUser, users, shifts, approveStaff, rejectStaff, removeStaffMembership, setStaffWage } = useStore();
  const lang = useLanguage();
  const locale = getLocale(lang);
  const [openShiftsFor, setOpenShiftsFor] = useState<string | null>(null);
  const [wageEdit, setWageEdit] = useState<Record<string, string>>({});

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
    const map = new Map<string, { todayMs: number; weekMs: number; monthMs: number; onDuty: boolean; activeSince?: string }>();
    const todayKey = new Date().toDateString();
    const thisMonth = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    for (const s of shifts.filter((s) => s.storeId === storeId)) {
      const inDate = new Date(s.clockInAt);
      const inT = inDate.getTime();
      const outT = s.clockOutAt ? new Date(s.clockOutAt).getTime() : now;
      const dur = Math.max(0, outT - inT);
      const cur = map.get(s.staffId) ?? { todayMs: 0, weekMs: 0, monthMs: 0, onDuty: false };
      if (inDate.toDateString() === todayKey) cur.todayMs += dur;
      if (inT >= weekAgo) cur.weekMs += dur;
      if (`${inDate.getFullYear()}-${inDate.getMonth()}` === thisMonth) cur.monthMs += dur;
      if (!s.clockOutAt) {
        cur.onDuty = true;
        cur.activeSince = s.clockInAt;
      }
      map.set(s.staffId, cur);
    }
    return map;
  }, [shifts, storeId]);

  return (
    <OwnerShell title={t("ostaff.title", lang)}>
      {/* 대기 요청 */}
      <section className="mb-7">
        <h2 className="headline-sub mb-3 px-1 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          {t("ostaff.pending.title", lang, { n: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <Card padding="lg" className="text-center body-sm">
            {t("ostaff.pending.empty", lang)}
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
                      {t("ostaff.requestedAt", lang, { when: fmtDate(s.joinRequestedAt, lang) })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" leftIcon={<Check className="w-4 h-4" />} onClick={() => approveStaff(s.id)}>
                    {t("ostaff.approve", lang)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<X className="w-4 h-4" />}
                    onClick={() => rejectStaff(s.id)}
                  >
                    {t("ostaff.reject", lang)}
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
          {t("ostaff.active.title", lang, { n: approved.length })}
        </h2>
        {approved.length === 0 ? (
          <Card padding="lg" className="text-center body-sm">
            {t("ostaff.active.empty", lang)}
          </Card>
        ) : (
          <div className="space-y-2">
            {approved.map((s) => {
              const st = statsByStaff.get(s.id) ?? { todayMs: 0, weekMs: 0, monthMs: 0, onDuty: false };
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
                            {t("ostaff.onDuty", lang)}
                          </span>
                        )}
                      </p>
                      <p className="body-sm">
                        {formatPhoneNumber(s.phone)}
                        {s.position ? ` · ${s.position}` : ""}
                      </p>
                      <p className="text-[12px] text-[var(--color-ink-600)] font-semibold mt-1 flex items-center gap-3 flex-wrap">
                        <span><Clock className="inline w-3 h-3 mr-1" />{t("ostaff.today", lang, { dur: fmtDuration(st.todayMs, lang) })}</span>
                        <span>{t("ostaff.thisWeek", lang, { dur: fmtDuration(st.weekMs, lang) })}</span>
                        {st.activeSince && (
                          <span>{t("ostaff.clockedInAt", lang, { time: new Date(st.activeSince).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })}</span>
                        )}
                      </p>
                      <div className="text-[12px] mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="text-[var(--color-ink-600)] font-semibold">
                          {t("ostaff.thisMonth", lang, { dur: fmtDuration(st.monthMs, lang) })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[var(--color-ink-500)]">{t("ostaff.wage", lang)}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={wageEdit[s.id] ?? String(s.hourlyWage ?? "")}
                            onChange={(e) => setWageEdit((w) => ({ ...w, [s.id]: e.target.value.replace(/\D/g, "") }))}
                            onBlur={(e) => {
                              const v = Number(e.target.value) || 0;
                              if (v !== (s.hourlyWage ?? 0)) setStaffWage(s.id, v);
                            }}
                            className="w-20 h-8 px-2 rounded-lg border border-[var(--color-line)] text-[12px] tabular-nums text-right"
                            placeholder="0"
                          />
                        </span>
                        <span className="font-extrabold text-[var(--color-navy-700)] tabular-nums">
                          {t("ostaff.monthPay", lang, {
                            amount: fmtKRW(Math.round((st.monthMs / 3600000) * (Number(wageEdit[s.id] ?? s.hourlyWage) || 0))),
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        rightIcon={open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        onClick={() => setOpenShiftsFor(open ? null : s.id)}
                      >
                        {t("ostaff.shifts", lang)}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<UserMinus className="w-4 h-4" />}
                        onClick={() => {
                          if (confirm(t("ostaff.removeConfirm", lang, { name: s.name }))) removeStaffMembership(s.id);
                        }}
                      >
                        {t("ostaff.remove", lang)}
                      </Button>
                    </div>
                  </div>

                  {open && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-line-soft)] space-y-1">
                      {myShifts.length === 0 ? (
                        <p className="body-sm text-center text-[var(--color-ink-500)] py-2">
                          {t("ostaff.noRecord", lang)}
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
                              <span>{fmtDate(sh.clockInAt, lang)} → {sh.clockOutAt ? fmtDate(sh.clockOutAt, lang) : t("ostaff.workingNow", lang)}</span>
                              <span className="tabular-nums text-[var(--color-navy-700)]">
                                {fmtDuration(outT - inT, lang)}
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
