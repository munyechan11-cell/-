import { useMemo, useState } from "react";
import { Plus, Trash2, ScanLine, Copy } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { useLanguage, t, fmtKRW, type Lang } from "../../lib/i18n";
import { useModalChrome } from "../../lib/useModalChrome";
import { resizeImage } from "./PhotoVault";
import { api } from "../../lib/api";
import { showToast } from "../../lib/toast";
import type { ExpenseCategory } from "../../lib/types";

// 인건비(labor)는 근태×시급으로 자동 집계되므로 수동 입력 카테고리에서 제외 → 이중 차감 방지
const CATEGORIES: ExpenseCategory[] = ["rent", "material", "utility", "marketing", "other"];

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Period = "today" | "week" | "month";

export default function Settlement() {
  const { orders, menus, ingredients, expenses, shifts, users, currentUser, addExpense, deleteExpense } = useStore();
  const lang = useLanguage();
  const [period, setPeriod] = useState<Period>("month");
  const [adding, setAdding] = useState(false);

  const storeId = currentUser?.id ?? "";
  const todayStr = localDateStr(new Date());
  const weekStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localDateStr(d);
  }, []);

  // 기간 판정 — 모두 로컬 자정 기준 YYYY-MM-DD 비교
  const inRange = (dateStr: string) => {
    if (period === "today") return dateStr === todayStr;
    if (period === "month") return dateStr.slice(0, 7) === todayStr.slice(0, 7);
    return dateStr >= weekStartStr && dateStr <= todayStr;
  };

  // 직전 동기간(어제 / 직전 7일 / 전월) — 매출 증감률 비교용
  const yesterdayStr = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d); }, []);
  const prevWeekStartStr = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 13); return localDateStr(d); }, []);
  const prevWeekEndStr = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return localDateStr(d); }, []);
  const prevMonthStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-11
    return `${m === 0 ? y - 1 : y}-${String(m === 0 ? 12 : m).padStart(2, "0")}`;
  }, []);
  const prevInRange = (dateStr: string) => {
    if (period === "today") return dateStr === yesterdayStr;
    if (period === "month") return dateStr.slice(0, 7) === prevMonthStr;
    return dateStr >= prevWeekStartStr && dateStr <= prevWeekEndStr;
  };

  const ingMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const menuMap = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  // 매출(결제완료 주문 합) + 원가(레시피×재료단가) 동시 집계
  const { revenue, cardRevenue, cashRevenue, cost } = useMemo(() => {
    let rev = 0;
    let card = 0;
    let cash = 0;
    let cst = 0;
    for (const o of orders) {
      if (o.storeId !== storeId || o.paymentStatus !== "paid") continue;
      if (!inRange(localDateStr(new Date(o.createdAt)))) continue;
      rev += o.totalAmount;
      if (o.paymentMethod === "card") card += o.totalAmount;
      else cash += o.totalAmount; // 미설정(과거 데이터)·현금 → 현금으로 집계
      for (const item of o.items) {
        const menu = menuMap.get(item.menuId);
        for (const r of menu?.recipe ?? []) {
          const ing = ingMap.get(r.ingredientId);
          if (ing) cst += ing.unitCost * r.quantity * item.quantity;
        }
      }
    }
    return { revenue: rev, cardRevenue: card, cashRevenue: cash, cost: cst };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, storeId, period, menuMap, ingMap, todayStr]);

  // 직전 동기간 매출 → 증감률(%)
  const prevRevenue = useMemo(() => {
    let sum = 0;
    for (const o of orders) {
      if (o.storeId !== storeId || o.paymentStatus !== "paid") continue;
      if (!prevInRange(localDateStr(new Date(o.createdAt)))) continue;
      sum += o.totalAmount;
    }
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, storeId, period, yesterdayStr, prevMonthStr, prevWeekStartStr, prevWeekEndStr]);
  const changeRate = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;

  const periodExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.storeId === storeId && inRange(e.date))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, storeId, period, todayStr]
  );
  const expenseTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  // 인건비 — 기간 내 완료된 근무(shift) × 직원 시급 자동 집계
  const labor = useMemo(() => {
    let sum = 0;
    for (const sh of shifts) {
      if (sh.storeId !== storeId || !sh.clockOutAt) continue;
      const inDate = new Date(sh.clockInAt);
      if (!inRange(localDateStr(inDate))) continue;
      const dur = new Date(sh.clockOutAt).getTime() - inDate.getTime();
      const wage = userById.get(sh.staffId)?.hourlyWage ?? 0;
      sum += (Math.max(0, dur) / 3600000) * wage;
    }
    return Math.round(sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, storeId, period, userById, todayStr]);

  const netProfit = revenue - cost - expenseTotal - labor;

  return (
    <OwnerShell
      title={t("settle.title", lang)}
      headerRight={
        <Button size="sm" onClick={() => setAdding(true)} leftIcon={<Plus className="w-4 h-4" />}>
          <span className="hidden sm:inline">{t("settle.addExpense", lang)}</span>
        </Button>
      }
    >
      <div className="max-w-[900px] mx-auto">
        {/* 기간 탭 */}
        <div className="inline-flex gap-1 p-1 bg-white border border-[var(--color-line)] rounded-[14px] mb-4">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`h-9 px-4 rounded-[10px] text-[13px] font-bold transition-colors ${
                period === p
                  ? "bg-[var(--color-navy-700)] text-white"
                  : "text-[var(--color-ink-500)] hover:text-[var(--color-navy-700)]"
              }`}
            >
              {t(`settle.period.${p}`, lang)}
            </button>
          ))}
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <SummaryCard label={t("settle.revenue", lang)} value={revenue} cls="text-[var(--color-navy-900)]" delta={changeRate} />
          <SummaryCard label={t("settle.cost", lang)} value={cost} cls="text-[#d98a00]" />
          <SummaryCard label={t("settle.expense", lang)} value={expenseTotal} cls="text-[var(--color-danger)]" />
          <SummaryCard
            label={t("settle.netProfit", lang)}
            value={netProfit}
            cls={netProfit >= 0 ? "text-[var(--color-mint-700)]" : "text-[var(--color-danger)]"}
            highlight
          />
        </div>
        <p className="text-[12px] text-[var(--color-ink-600)] mb-1 px-1 font-semibold tabular-nums">
          {t("settle.cardCash", lang, { card: fmtKRW(cardRevenue), cash: fmtKRW(cashRevenue) })}
          {labor > 0 && (
            <span className="ml-2 text-[var(--color-ink-500)]">· {t("settle.labor", lang, { amount: fmtKRW(labor) })}</span>
          )}
        </p>
        <p className="text-[12px] text-[var(--color-ink-500)] mb-5 px-1">
          {t("settle.formula", lang)}
        </p>

        {/* 비용 내역 */}
        <Card padding="md">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-2">
            {t("settle.expenseList", lang)}
          </p>
          {periodExpenses.length === 0 ? (
            <p className="text-center text-[13px] text-[var(--color-ink-500)] py-6">{t("settle.empty", lang)}</p>
          ) : (
            <div className="divide-y divide-[var(--color-line-soft)]">
              {periodExpenses.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center gap-3">
                  <span className="text-[11.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-navy-50)] text-[var(--color-navy-700)] shrink-0">
                    {t(`settle.cat.${e.category}`, lang)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {e.memo && <p className="text-[13px] text-[var(--color-navy-900)] truncate">{e.memo}</p>}
                    <p className="text-[11.5px] text-[var(--color-ink-500)] tabular-nums">{e.date}</p>
                  </div>
                  <span className="text-[14px] font-bold tabular-nums text-[var(--color-navy-900)] shrink-0">
                    {fmtKRW(e.amount)}
                  </span>
                  <button
                    onClick={() => {
                      addExpense(storeId, { category: e.category, amount: e.amount, date: todayStr, memo: e.memo });
                      showToast(t("settle.copied", lang), "success");
                    }}
                    className="w-8 h-8 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center text-[var(--color-ink-500)] shrink-0"
                    aria-label={t("settle.copyAria", lang)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t("settle.deleteConfirm", lang))) deleteExpense(e.id);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-[var(--color-danger)]/10 inline-flex items-center justify-center text-[var(--color-danger)] shrink-0"
                    aria-label={t("settle.deleteAria", lang)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {adding && (
        <ExpenseModal
          storeId={storeId}
          todayStr={todayStr}
          lang={lang}
          onClose={() => setAdding(false)}
          onAdd={addExpense}
        />
      )}
    </OwnerShell>
  );
}

function SummaryCard({
  label,
  value,
  cls,
  highlight,
  delta,
}: {
  label: string;
  value: number;
  cls: string;
  highlight?: boolean;
  delta?: number | null;
}) {
  return (
    <Card padding="md" className={highlight ? "ring-[1.5px] ring-[var(--color-navy-700)]" : ""}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-1">{label}</p>
      <p className={`text-[17px] lg:text-[19px] font-extrabold tabular-nums ${cls}`}>{fmtKRW(value)}</p>
      {delta != null && (
        <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${delta >= 0 ? "text-[var(--color-mint-700)]" : "text-[var(--color-danger)]"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
        </p>
      )}
    </Card>
  );
}

function ExpenseModal({
  storeId,
  todayStr,
  lang,
  onClose,
  onAdd,
}: {
  storeId: string;
  todayStr: string;
  lang: Lang;
  onClose: () => void;
  onAdd: (
    storeId: string,
    data: { category: ExpenseCategory; amount: number; date: string; memo?: string }
  ) => Promise<void>;
}) {
  useModalChrome(true, onClose);
  const [category, setCategory] = useState<ExpenseCategory>("material");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  // 영수증 사진 → AI 추출 → 폼 자동 채움. 사장님은 확인 후 저장만 (진입장벽↓).
  const onReceipt = async (file: File) => {
    if (scanning) return;
    setScanning(true);
    try {
      const dataUrl = await resizeImage(file, 1600); // 영수증 글자 인식 위해 약간 크게
      const res = await fetch(api("/api/ai/receipt"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const r = await res.json();
      if (r.category && (CATEGORIES as string[]).includes(r.category)) setCategory(r.category);
      if (r.amount && Number(r.amount) > 0) setAmount(String(Math.round(Number(r.amount))));
      if (typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
      const note = [r.vendor, r.memo].filter(Boolean).join(" · ");
      if (note) setMemo(note);
      showToast(t("settle.receipt.done", lang), "success");
    } catch {
      showToast(t("settle.receipt.fail", lang), "error");
    } finally {
      setScanning(false);
    }
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !date || busy) return;
    setBusy(true);
    try {
      await onAdd(storeId, { category, amount: amt, date, memo: memo.trim() || undefined });
      onClose();
    } catch {
      setBusy(false);
    }
  };

  const fieldCls =
    "w-full h-11 px-3 rounded-[12px] border border-[var(--color-line)] text-[14px] font-medium bg-white";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] sm:my-4 max-h-[92vh] overflow-y-auto p-5 pb-[max(env(safe-area-inset-bottom),20px)] animate-[gyeol-slide-up_.2s_ease-out]"
      >
        <h2 className="text-[18px] font-extrabold text-[var(--color-navy-900)] mb-3">
          {t("settle.addExpense", lang)}
        </h2>
        {/* 영수증 촬영 → AI 자동 채움 */}
        <label className="mb-4 flex items-center justify-center gap-2 h-12 rounded-[14px] border-[1.5px] border-dashed border-[var(--color-navy-300)] bg-[var(--color-navy-50)] text-[13.5px] font-bold text-[var(--color-navy-700)] cursor-pointer active:scale-[0.99] transition-transform">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={scanning}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onReceipt(f);
              e.currentTarget.value = "";
            }}
          />
          <ScanLine className="w-4 h-4" />
          {scanning ? t("settle.receipt.scanning", lang) : t("settle.receipt.scan", lang)}
        </label>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">
              {t("settle.categoryLabel", lang)}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`h-10 rounded-[10px] text-[12.5px] font-bold transition-colors ${
                    category === c
                      ? "bg-[var(--color-navy-700)] text-white"
                      : "bg-[var(--color-bg)] text-[var(--color-ink-600)] hover:bg-[var(--color-navy-50)]"
                  }`}
                >
                  {t(`settle.cat.${c}`, lang)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">
              {t("settle.amount", lang)}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${fieldCls} tabular-nums`}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">
              {t("settle.date", lang)}
            </label>
            <input
              type="date"
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className={`${fieldCls} tabular-nums`}
            />
          </div>
          <div>
            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">
              {t("settle.memo", lang)}
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={60}
              className={fieldCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>
            {t("settle.cancel", lang)}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!amount || Number(amount) <= 0}>
            {t("settle.save", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}
