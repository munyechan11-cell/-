import { useMemo, useRef, useState } from "react";
import { Camera, Sparkles, Loader2, Plus } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { useStore } from "../../store/store";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";
import { localTodayStr } from "../../lib/date";
import { api } from "../../lib/api";
import { resizeImage } from "./PhotoVault";
import { useModalChrome } from "../../lib/useModalChrome";
import type { ExpenseCategory } from "../../lib/types";

/**
 * 재고 "AI 자동" 모드 (체크리스트 #4) — 가장 낮은 진입장벽.
 * 사장님이 영수증을 사진 한 장 찍으면 /api/ai/receipt(Gemini Vision)가
 * 금액·날짜·항목·분류를 읽어 매출장부 비용(expense)으로 자동 채운다.
 * 간편 모드(#3)와 동일하게 매출 대비 원가율을 함께 보여줘 화면이 비지 않게 한다.
 */

const CATEGORIES: ExpenseCategory[] = ["material", "rent", "utility", "marketing", "other"];

interface Draft {
  amount: string;
  date: string;
  category: ExpenseCategory;
  memo: string;
}

export function AiInventory({ storeId, modeTabs }: { storeId: string; modeTabs: React.ReactNode }) {
  const { orders, expenses, addExpense } = useStore();
  const lang = useLanguage();
  const today = localTodayStr();
  const fileRef = useRef<HTMLInputElement>(null);

  const [period, setPeriod] = useState<"week" | "month">("month");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  // 모달 공통 UX — ESC 닫기 + body 스크롤 잠금 (다른 모달들과 동일 규약)
  useModalChrome(!!draft, () => setDraft(null));

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

  // 영수증 사진 선택 → 압축 → AI 추출 → 확인 모달 prefill
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setError(null);
    setScanning(true);
    try {
      const image = await resizeImage(file);
      const res = await fetch(api("/api/ai/receipt"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        if (res.status === 503 || data?.error === "AI_NOT_CONFIGURED") {
          setError(t("inv.ai.notConfigured", lang));
        } else if (res.status === 429 && typeof data?.error === "string") {
          // 요청 과다 — 서버가 내려준 구체 안내('분당 4회 제한'·'10초 후 재시도')를 그대로 노출.
          // 일반 실패 문구('다시 찍어주세요')로 덮으면 재촬영 → 또 429 악순환에 빠진다.
          setError(data.error);
        } else {
          setError(t("inv.ai.failed", lang));
        }
        return;
      }
      const data = (await res.json()) as { amount?: number; vendor?: string; date?: string; category?: string; memo?: string };
      const memo = [data.vendor, data.memo].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
      const category = (CATEGORIES as string[]).includes(data.category ?? "") ? (data.category as ExpenseCategory) : "material";
      setDraft({
        amount: data.amount && data.amount > 0 ? String(data.amount) : "",
        date: data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : today,
        category,
        memo,
      });
    } catch {
      setError(t("inv.ai.failed", lang));
    } finally {
      setScanning(false);
    }
  };

  const openManual = () => {
    setError(null);
    setDraft({ amount: "", date: today, category: "material", memo: "" });
  };

  const save = async () => {
    if (!draft) return;
    const amt = Number(draft.amount);
    if (!amt || amt <= 0 || !draft.date || busy) return;
    setBusy(true);
    try {
      await addExpense(storeId, { category: draft.category, amount: amt, date: draft.date, memo: draft.memo.trim() || undefined });
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full h-11 px-3 rounded-xl border border-[var(--color-line)] text-[14px] font-medium bg-white";

  return (
    <OwnerShell title={t("inv.title", lang)}>
      <div className="max-w-[760px] mx-auto pb-12">
        {modeTabs}
        <p className="text-[13px] text-[var(--color-ink-600)] mb-4 leading-relaxed">{t("inv.ai.hint", lang)}</p>

        {/* 기간 토글 */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--color-navy-50)] rounded-[12px] max-w-[240px] mb-4">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
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

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />

        {/* 영수증 촬영 CTA */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="w-full h-14 rounded-2xl bg-[var(--color-navy-700)] text-white font-bold inline-flex items-center justify-center gap-2 shadow-[var(--shadow-navy)] disabled:opacity-60 mb-2"
        >
          {scanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("inv.ai.scanning", lang)}
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              {t("inv.ai.scan", lang)}
              <Sparkles className="w-4 h-4 opacity-80" />
            </>
          )}
        </button>
        <button
          onClick={openManual}
          className="w-full h-11 rounded-xl bg-[var(--color-bg)] text-[var(--color-ink-700)] font-bold inline-flex items-center justify-center gap-1.5 mb-2"
        >
          <Plus className="w-4 h-4" />
          {t("inv.ai.manualAdd", lang)}
        </button>

        {error && (
          <p className="text-[12.5px] text-[#c0392b] bg-[#fdecea] rounded-xl px-3 py-2.5 mb-3 leading-relaxed">{error}</p>
        )}

        {/* 최근 구매 */}
        <p className="text-[12px] font-bold text-[var(--color-ink-500)] mb-2 mt-3">{t("inv.simple.recentPurchases", lang)}</p>
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

      {/* AI 결과 확인 / 직접 입력 모달 */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setDraft(null)}>
          <div
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("inv.ai.confirmTitle", lang)}
            className="w-full max-w-[400px] bg-white rounded-t-[24px] sm:rounded-2xl p-5 pb-[max(env(safe-area-inset-bottom),20px)] max-h-[88vh] overflow-y-auto"
          >
            <h2 className="text-[17px] font-extrabold text-[var(--color-navy-900)] mb-1">{t("inv.ai.confirmTitle", lang)}</h2>
            <p className="text-[12.5px] text-[var(--color-ink-500)] mb-4 leading-relaxed">{t("inv.ai.confirmHint", lang)}</p>

            <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("settle.categoryLabel", lang)}</label>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft({ ...draft, category: c })}
                  aria-pressed={draft.category === c}
                  className={`h-10 rounded-[10px] text-[12.5px] font-bold transition-colors ${
                    draft.category === c ? "bg-[var(--color-navy-700)] text-white" : "bg-[var(--color-bg)] text-[var(--color-ink-600)]"
                  }`}
                >
                  {t(`settle.cat.${c}`, lang)}
                </button>
              ))}
            </div>

            <label htmlFor="ai-amount" className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("inv.ai.amount", lang)}</label>
            <input
              id="ai-amount"
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.amount}
              onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })}
              placeholder="0"
              className={`${field} tabular-nums mb-3`}
              // AI 가 금액을 이미 채운 경우(검토 흐름)엔 자동 포커스로 모바일 키보드를 띄우지 않음.
              // 직접 입력(빈 금액)일 때만 바로 입력할 수 있게 포커스.
              autoFocus={!draft.amount}
            />
            <label htmlFor="ai-date" className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("inv.ai.date", lang)}</label>
            <input
              id="ai-date"
              type="date"
              value={draft.date}
              max={today}
              onChange={(ev) => setDraft({ ...draft, date: ev.target.value })}
              className={`${field} tabular-nums mb-3`}
            />
            <label htmlFor="ai-memo" className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("inv.ai.memo", lang)}</label>
            <input
              id="ai-memo"
              value={draft.memo}
              onChange={(ev) => setDraft({ ...draft, memo: ev.target.value })}
              placeholder={t("inv.ai.memoPh", lang)}
              className={`${field} mb-4`}
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDraft(null)} className="h-11 rounded-xl bg-[var(--color-bg)] font-bold text-[var(--color-ink-700)]">{t("inv.ai.cancel", lang)}</button>
              <button onClick={save} disabled={busy || !draft.amount} className="h-11 rounded-xl bg-[var(--color-navy-700)] text-white font-bold disabled:opacity-50">{t("inv.ai.save", lang)}</button>
            </div>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}
