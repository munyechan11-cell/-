import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { Menu, OptionGroup, SelectedOption } from "../../lib/types";
import { useLanguage, t, fmtKRW, type Lang } from "../../lib/i18n";
import { useEscapeClose } from "../../lib/useEscapeClose";
import { cn } from "../../lib/cn";

interface Props {
  menu: Menu;
  /** 키오스크 등 기기 언어와 무관하게 매장 언어를 강제하고 싶을 때 */
  lang?: Lang;
  onConfirm: (selected: SelectedOption[], unitPrice: number) => void;
  onClose: () => void;
}

/**
 * 메뉴 옵션 선택 모달 — 주문 3면(손님·POS·키오스크)에서 공유.
 * 단일선택=라디오, 복수선택=체크박스. 필수 단일그룹은 첫 옵션 기본 선택.
 * 단가 = 기본가 + Σ(선택옵션 가감액), 0원 이하면 담기 차단.
 */
export function OptionPickerModal({ menu, lang: langProp, onConfirm, onClose }: Props) {
  const ctxLang = useLanguage();
  const lang = langProp ?? ctxLang;
  const groups = menu.optionGroups ?? [];

  // groupId -> 선택된 optionId[]
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups) {
      // 필수 단일선택은 첫 옵션 기본값 → 즉시 담아도 항상 유효
      init[g.id] = g.required && !g.multiSelect && g.options[0] ? [g.options[0].id] : [];
    }
    return init;
  });
  useEscapeClose(true, onClose);

  const toggle = (g: OptionGroup, optId: string) => {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.multiSelect) {
        return { ...prev, [g.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      // 단일선택: 필수는 항상 1개 유지(교체), 선택형은 같은 걸 다시 누르면 해제
      if (cur.includes(optId) && !g.required) return { ...prev, [g.id]: [] };
      return { ...prev, [g.id]: [optId] };
    });
  };

  const selectedOptions: SelectedOption[] = useMemo(() => {
    const out: SelectedOption[] = [];
    for (const g of groups) {
      for (const optId of sel[g.id] ?? []) {
        const o = g.options.find((x) => x.id === optId);
        if (o) out.push({ groupId: g.id, groupName: g.name, optionId: o.id, optionName: o.name, priceDelta: o.priceDelta });
      }
    }
    return out;
  }, [groups, sel]);

  const unitPrice = menu.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
  const missingRequired = groups.some((g) => g.required && (sel[g.id]?.length ?? 0) === 0);
  const priceTooLow = unitPrice <= 0;
  const canConfirm = !missingRequired && !priceTooLow;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom),20px)] sm:pb-6 max-h-[88vh] flex flex-col"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-4 sm:hidden" />
        <h2 className="text-[18px] font-extrabold text-[var(--color-navy-900)] break-keep">{menu.name}</h2>
        <p className="text-[13px] font-semibold text-[var(--color-ink-500)] mb-3">{fmtKRW(menu.price, lang)}</p>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[14px] font-bold text-[var(--color-navy-900)]">{g.name}</span>
                <span
                  className={cn(
                    "text-[11px] font-bold px-1.5 py-0.5 rounded-full",
                    g.required
                      ? "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]"
                      : "bg-[var(--color-bg)] text-[var(--color-ink-400)]"
                  )}
                >
                  {g.required ? t("opt.requiredBadge", lang) : t("opt.optionalBadge", lang)}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const on = (sel[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g, o.id)}
                      aria-pressed={on}
                      className={cn(
                        "w-full flex items-center gap-2.5 h-11 px-3 rounded-xl border text-left transition-colors",
                        on ? "border-[var(--color-navy-700)] bg-[var(--color-navy-50)]" : "border-[var(--color-line)] bg-white"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 inline-flex items-center justify-center flex-shrink-0 border-2",
                          g.multiSelect ? "rounded-md" : "rounded-full",
                          on ? "border-[var(--color-navy-700)] bg-[var(--color-navy-700)] text-white" : "border-[var(--color-ink-300)]"
                        )}
                      >
                        {on && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 text-[14px] font-semibold text-[var(--color-navy-900)] break-keep">{o.name}</span>
                      {o.priceDelta !== 0 && (
                        <span className="text-[13px] font-bold text-[var(--color-ink-600)] flex-shrink-0">
                          {o.priceDelta > 0 ? "+" : "−"}
                          {fmtKRW(Math.abs(o.priceDelta), lang)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {priceTooLow && <p className="text-[12px] font-semibold text-[var(--color-danger)] mt-3">{t("opt.priceTooLow", lang)}</p>}
        <button
          type="button"
          onClick={() => canConfirm && onConfirm(selectedOptions, unitPrice)}
          disabled={!canConfirm}
          className="mt-4 h-12 rounded-2xl bg-[var(--color-navy-700)] text-white font-bold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-40 shadow-[var(--shadow-navy)]"
        >
          {t("opt.confirm", lang)} · {fmtKRW(unitPrice, lang)}
        </button>
      </div>
    </div>
  );
}
