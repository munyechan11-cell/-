import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Clock } from "lucide-react";
import { useStore } from "../../store/store";
import { useLanguage, t, getLocale } from "../../lib/i18n";
import type { OrderStatus } from "../../lib/types";
import { cookStartLabel, cookingNowLabel } from "../../lib/cookingLabels";

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ACTIVE: OrderStatus[] = ["pending", "accepted", "cooking"];

/**
 * 주방 디스플레이(KDS) — 주방 모니터/태블릿용 풀스크린.
 * 오늘 미완료 주문을 시간순 카드로 표시, 터치로 조리시작→완료 전환.
 * served/cancelled 는 화면에서 사라짐. 30초마다 경과시간 갱신.
 */
export default function KitchenDisplay() {
  const { orders, updateOrderStatus, currentUser, users } = useStore();
  const lang = useLanguage();
  const nav = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const storeId =
    currentUser?.role === "staff" ? currentUser.employerStoreId ?? "" : currentUser?.id ?? "";
  // 8-9: 업종별 조리 라벨 — 매장 owner 의 storeConfig.industry 기준
  const industry =
    (currentUser?.role === "owner" ? currentUser.storeConfig?.industry : undefined) ??
    users.find((u) => u.id === storeId && u.role === "owner")?.storeConfig?.industry;
  const today = localDateStr(new Date());

  const active = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.storeId === storeId &&
            ACTIVE.includes(o.status) &&
            localDateStr(new Date(o.createdAt)) === today
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders, storeId, today]
  );

  const clock = new Date(now).toLocaleTimeString(getLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[var(--color-navy-900)] text-white flex flex-col">
      {/* 상단 바 */}
      <header className="flex items-center gap-3 px-5 h-[60px] border-b border-white/10 shrink-0">
        <h1 className="text-[18px] font-extrabold tracking-tight">{t("kds.title", lang)}</h1>
        <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-white/10">
          {t("kds.waiting", lang, { n: active.length })}
        </span>
        <span className="ml-auto text-[18px] font-bold tabular-nums">{clock}</span>
        <button
          onClick={() => nav("/biz/owner/orders")}
          className="w-10 h-10 rounded-full hover:bg-white/10 inline-flex items-center justify-center"
          aria-label={t("kds.close", lang)}
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* 카드 그리드 */}
      {active.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/50 text-[16px] font-semibold">
          {t("kds.empty", lang)}
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4 content-start">
          {active.map((o) => {
            const mins = Math.max(0, Math.floor((now - new Date(o.createdAt).getTime()) / 60_000));
            const tone =
              mins >= 10
                ? "border-[var(--color-danger)]"
                : mins >= 5
                ? "border-[#f0b400]"
                : "border-[var(--color-mint-500)]";
            const cooking = o.status === "cooking";
            return (
              <div
                key={o.id}
                className={`bg-white text-[var(--color-navy-900)] rounded-2xl p-4 border-l-[5px] ${tone} flex flex-col`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[24px] font-extrabold leading-none">
                    {t("kds.table", lang, { n: o.tableNumber })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[14px] font-extrabold tabular-nums ${
                      mins >= 10 ? "text-[var(--color-danger)]" : "text-[var(--color-ink-600)]"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {t("kds.min", lang, { n: mins })}
                  </span>
                </div>
                {cooking && (
                  <span className="self-start mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#fff4d6] text-[#9a7700]">
                    {cookingNowLabel(industry, lang)}
                  </span>
                )}
                <ul className="text-[16px] my-3 space-y-1 flex-1">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 break-keep">
                        <span className="font-semibold">{it.name}</span>
                        {it.selectedOptions?.length ? (
                          <span className="block text-[13px] font-medium text-[var(--color-ink-500)]">
                            {it.selectedOptions.map((o) => o.optionName).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-extrabold tabular-nums shrink-0">×{it.quantity}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => updateOrderStatus(o.id, cooking ? "served" : "cooking")}
                  className={`w-full h-12 rounded-xl text-[15px] font-extrabold text-white transition-colors ${
                    cooking
                      ? "bg-[var(--color-mint-600)] hover:bg-[var(--color-mint-700)]"
                      : "bg-[var(--color-navy-700)] hover:bg-[var(--color-navy-800)]"
                  }`}
                >
                  {cooking ? t("kds.done", lang) : cookStartLabel(industry, lang)}
                </button>
              </div>
            );
          })}
        </main>
      )}
    </div>
  );
}
