import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../store/store";
import type { Reservation } from "../../lib/types";
import { useLanguage, t, type Lang, getLocale } from "../../lib/i18n";
import { localTodayStr } from "../../lib/date";

// 듀얼 모니터/큰 화면 송출용 — 별도 창(window.open)으로 열어 손님이 보는 화면.
// 오늘의 확정 예약을 큰 글씨로 보여주고, 가장 임박한 예약을 hero로 강조한다.

const todayStr = () => localTodayStr();

function fmtTimeLeft(target: Date, now: number, lang: Lang): string {
  const diff = target.getTime() - now;
  if (diff <= 0) return t("owd.now", lang);
  const min = Math.floor(diff / 60000);
  if (min < 60) return t("owd.minLater", lang, { n: min });
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? t("owd.hourMinLater", lang, { h, m }) : t("owd.hourLater", lang, { h });
}

export default function WelcomeDisplay() {
  const { effectiveStoreId, reservations, users, currentUser } = useStore();
  const storeId = effectiveStoreId;
  const lang = useLanguage();
  const locale = getLocale(lang);

  const owner = useMemo(
    () => users.find((u) => u.id === storeId && u.role === "owner"),
    [users, storeId]
  );
  const storeName = owner?.restaurantName ?? t("owd.welcome.fallback", lang);

  // 시계 — 1초마다 갱신
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 오늘의 확정 예약 — 시간순
  const todayReservations = useMemo(() => {
    const today = todayStr();
    return reservations
      .filter((r) => r.storeId === storeId && r.date === today && r.status === "confirmed")
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, storeId]);

  // 가장 임박한 예약 (지나간 것 중 30분 이내 + 앞으로 올 것)
  const hero: Reservation | null = useMemo(() => {
    if (todayReservations.length === 0) return null;
    const nowDate = new Date(now);
    const cutoff = nowDate.getTime() - 30 * 60_000;
    const upcoming = todayReservations.find((r) => {
      const t = new Date(`${r.date}T${r.time}`).getTime();
      return t >= cutoff;
    });
    return upcoming ?? todayReservations[todayReservations.length - 1];
  }, [todayReservations, now]);

  const rest = useMemo(
    () => todayReservations.filter((r) => r.id !== hero?.id),
    [todayReservations, hero]
  );

  // 큰 화면 — 다크 톤 + 큰 타이포
  return (
    <div className="min-h-screen bg-[var(--color-navy-900)] text-white px-10 py-10 flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[14px] uppercase tracking-[0.3em] opacity-50 font-bold">
            Welcome
          </p>
          <h1 className="text-[44px] font-extrabold tracking-tight leading-tight mt-1">
            {storeName}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[14px] opacity-50 font-bold">
            {new Date(now).toLocaleDateString(locale, {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
          <p className="text-[56px] font-extrabold tabular-nums tracking-tight leading-none mt-1">
            {new Date(now).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </p>
        </div>
      </header>

      {!storeId || !currentUser ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[22px] opacity-60 text-center">
            {t("owd.noStore", lang)}
            <br />
            {t("owd.noStoreDesc", lang)}
          </p>
        </div>
      ) : todayReservations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[28px] font-bold opacity-60 mb-3">
              {t("owd.noToday", lang)}
            </p>
            <p className="text-[18px] opacity-40">
              {t("owd.autoUpdate", lang)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-rows-[auto_1fr] gap-8 min-h-0">
          {/* Hero — 가장 임박한 예약 */}
          {hero && (
            <section className="bg-white text-[var(--color-navy-900)] rounded-[32px] px-12 py-10 shadow-2xl">
              <div className="flex items-baseline gap-4 mb-4">
                <span className="text-[16px] font-extrabold uppercase tracking-[0.25em] text-[var(--color-mint-700)]">
                  {t("owd.hero.label", lang)}
                </span>
                <span className="text-[15px] font-bold text-[var(--color-ink-500)]">
                  {fmtTimeLeft(new Date(`${hero.date}T${hero.time}`), now, lang)}
                </span>
              </div>
              <div className="flex items-end justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[88px] leading-[0.95] font-extrabold tracking-tight break-keep">
                    {hero.customerName} {t("owd.hero.guestSuffix", lang) && <span className="text-[44px] font-bold text-[var(--color-ink-500)]">{t("owd.hero.guestSuffix", lang)}</span>}
                  </p>
                  <p className="text-[26px] font-bold text-[var(--color-ink-600)] mt-3">
                    {t("owd.hero.guide", lang, { n: hero.tableNumber })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[96px] leading-none font-extrabold tabular-nums tracking-tight">
                    {hero.time}
                  </p>
                  <p className="text-[24px] font-bold text-[var(--color-ink-500)] mt-2">
                    {t("owd.hero.partyTable", lang, { n: hero.partySize, table: hero.tableNumber })}
                  </p>
                </div>
              </div>
              {hero.memo && (
                <p className="text-[18px] font-semibold text-[var(--color-ink-600)] mt-6 bg-[var(--color-navy-50)] px-5 py-3 rounded-2xl break-keep">
                  {hero.memo}
                </p>
              )}
            </section>
          )}

          {/* 나머지 오늘 예약 — 간략 리스트 */}
          {rest.length > 0 && (
            <section className="min-h-0">
              <p className="text-[15px] font-bold uppercase tracking-[0.25em] opacity-50 mb-4">
                {t("owd.today.title", lang, { n: todayReservations.length })}
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                {rest.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white/10 rounded-2xl px-6 py-5 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[34px] font-extrabold tabular-nums">{r.time}</span>
                      <span className="text-[14px] font-bold opacity-60">
                        {t("owd.rest.tableLine", lang, { n: r.tableNumber })}
                      </span>
                    </div>
                    <p className="text-[22px] font-bold truncate">{r.customerName}</p>
                    <p className="text-[14px] opacity-60 font-semibold">{t("owd.rest.partyLine", lang, { n: r.partySize })}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <footer className="mt-6 pt-4 border-t border-white/10 text-center text-[12px] opacity-40 font-bold uppercase tracking-[0.3em]">
        Gyeol · Welcome Display
      </footer>
    </div>
  );
}
