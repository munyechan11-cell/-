import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { useStore } from "../../store/store";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";
import { localTodayStr } from "../../lib/date";
import { useModalChrome } from "../../lib/useModalChrome";

/**
 * 재고 "간편 입력" 모드 (체크리스트 #3) — 가장 낮은 진입장벽.
 * 레시피·단가 없이: 매출(주문 자동) + 원재료 구매(사장 입력) → 원가율 자동 계산.
 * 원재료 구매는 expenses(category="material") 로 저장 → 매출장부와도 자연히 연결.
 */
export function SimpleInventory({ storeId, modeTabs }: { storeId: string; modeTabs: React.ReactNode }) {
  const { orders, expenses, addExpense } = useStore();
  const lang = useLanguage();
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const today = localTodayStr();
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);

  // 모달 공통 UX — ESC 닫기 + body 스크롤 잠금
  useModalChrome(adding, () => setAdding(false));

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (period === "week" ? 7 : 30));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [period]);

  const revenue = useMemo(
    () =>
      orders
        .filter((o) => o.storeId === storeId && o.status !== "cancelled" && new Date(o.createdAt).getTime() >= cutoff)
        .reduce((s, o) => s + o.totalAmount, 0),
    [orders, storeId, cutoff]
  );

  const materialExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.storeId === storeId && e.category === "material" && new Date(e.date).getTime() >= cutoff)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, storeId, cutoff]
  );
  const materialCost = materialExpenses.reduce((s, e) => s + e.amount, 0);
  const costRate = revenue > 0 ? Math.round((materialCost / revenue) * 100) : 0;

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !date || busy) return;
    setBusy(true);
    try {
      await addExpense(storeId, { category: "material", amount: amt, date, memo: memo.trim() || undefined });
      setAmount("");
      setMemo("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full h-11 px-3 rounded-xl border border-[var(--color-line)] text-[14px] font-medium bg-white";

  return (
    <OwnerShell title={t("inv.title", lang)}>
      <div className="max-w-[760px] mx-auto pb-12">
        {modeTabs}
        <p className="text-[13px] text-[var(--color-ink-600)] mb-4 leading-relaxed">{t("inv.simple.hint", lang)}</p>

        {/* 기간 토글 */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[12px] max-w-[240px] mb-4">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`h-9 rounded-[9px] text-[12.5px] font-bold transition-colors ${period === p ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]" : "text-[var(--color-ink-500)]"}`}
            >
              {t(`inv.simple.${p}`, lang)}
            </button>
          ))}
        </div>

        {/* 매출 / 원재료비 / 원가율 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl bg-white border border-[var(--color-line)] p-4 text-center">
            <p className="text-[11.5px] text-[var(--color-ink-500)]">{t("inv.simple.revenue", lang)}</p>
            <p className="text-[15px] lg:text-[17px] font-extrabold tabular-nums mt-1 text-[var(--color-navy-900)]">{fmtKRW(revenue, lang)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-[var(--color-line)] p-4 text-center">
            <p className="text-[11.5px] text-[var(--color-ink-500)]">{t("inv.simple.materialCost", lang)}</p>
            <p className="text-[15px] lg:text-[17px] font-extrabold tabular-nums mt-1 text-[var(--color-navy-900)]">{fmtKRW(materialCost, lang)}</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-navy-700)] text-white p-4 text-center">
            <p className="text-[11.5px] text-white/70">{t("inv.simple.costRate", lang)}</p>
            <p className={`text-[20px] font-extrabold tabular-nums mt-1 ${costRate >= 40 ? "text-[#ffb4b4]" : "text-[#7be8c4]"}`}>{costRate}%</p>
          </div>
        </div>

        <button onClick={() => setAdding(true)} className="w-full h-12 rounded-xl bg-[var(--color-navy-700)] text-white font-bold inline-flex items-center justify-center gap-2 shadow-[var(--shadow-navy)] mb-5">
          <Plus className="w-4 h-4" />
          {t("inv.simple.addPurchase", lang)}
        </button>

        {/* 최근 구매 */}
        <p className="text-[12px] font-bold text-[var(--color-ink-500)] mb-2">{t("inv.simple.recentPurchases", lang)}</p>
        {materialExpenses.length === 0 ? (
          <p className="text-[13px] text-[var(--color-ink-500)] text-center py-8">{t("inv.simple.noPurchases", lang)}</p>
        ) : (
          <div className="space-y-1.5">
            {materialExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-[var(--color-line)] text-[13px]">
                <span className="text-[var(--color-ink-600)] tabular-nums">
                  {e.date}
                  {e.memo ? ` · ${e.memo}` : ""}
                </span>
                <span className="font-bold tabular-nums text-[var(--color-navy-900)]">{fmtKRW(e.amount, lang)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 구매 추가 모달 */}
      {adding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setAdding(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("inv.simple.addPurchase", lang)}
            className="w-full max-w-[400px] bg-white rounded-t-[24px] sm:rounded-2xl p-5 pb-[max(env(safe-area-inset-bottom),20px)] max-h-[88vh] overflow-y-auto"
          >
            <h2 className="text-[17px] font-extrabold text-[var(--color-navy-900)] mb-4">{t("inv.simple.addPurchase", lang)}</h2>
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("inv.simple.amount", lang)}</label>
            <input type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={`${field} tabular-nums mb-3`} autoFocus />
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("inv.simple.date", lang)}</label>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={`${field} tabular-nums mb-3`} />
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("inv.simple.memo", lang)}</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("inv.simple.memoPh", lang)} className={`${field} mb-4`} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAdding(false)} className="h-11 rounded-xl bg-[var(--color-bg)] font-bold text-[var(--color-ink-700)]">{t("inv.simple.cancel", lang)}</button>
              <button onClick={submit} disabled={busy || !amount} className="h-11 rounded-xl bg-[var(--color-navy-700)] text-white font-bold disabled:opacity-50">{t("inv.simple.save", lang)}</button>
            </div>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}
