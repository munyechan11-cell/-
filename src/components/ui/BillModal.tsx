import { useEffect } from "react";
import { X, Printer, CreditCard } from "lucide-react";
import { Button } from "./Button";
import { useEscapeClose } from "../../lib/useEscapeClose";
import type { Order } from "../../lib/types";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";

interface Props {
  storeName: string;
  tableNumber?: number;
  customerName: string;
  orders: Order[];
  unpaidTotal: number;
  paidTotal: number;
  onClose: () => void;
  onPay?: () => void;
  canPay: boolean;
}

/**
 * 손님이 자기 자리에서 영수증/계산서를 펼쳐 보는 모달.
 * 합계, 미결제 분리 표시, 결제 버튼 포함.
 */
export function BillModal({
  storeName,
  tableNumber,
  customerName,
  orders,
  unpaidTotal,
  paidTotal,
  onClose,
  onPay,
  canPay,
}: Props) {
  useEscapeClose(true, onClose);
  const lang = useLanguage();

  // 모달 열려있을 땐 body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const totalAll = unpaidTotal + paidTotal;
  // 한국 음식점 표준 — 메뉴가는 부가세 포함가. 총액에서 역산:
  //   공급가액 = 총액 / 1.1,  부가세 = 총액 - 공급가액 (= 총액 / 11)
  const VAT_RATE = 0.1;
  const vatOf = (total: number) => Math.round((total * VAT_RATE) / (1 + VAT_RATE));
  const supplyOf = (total: number) => total - vatOf(total);
  const unpaidVat = vatOf(unpaidTotal);
  const unpaidSupply = supplyOf(unpaidTotal);
  const totalVat = vatOf(totalAll);
  const totalSupply = supplyOf(totalAll);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] sm:my-4 max-h-[92vh] overflow-hidden flex flex-col animate-[gyeol-slide-up_.2s_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
          <div>
            <p className="label-xs">{t("bill.title", lang)}</p>
            <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] tracking-tight">
              {storeName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
            aria-label={t("bill.close", lang)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-3 bg-[var(--color-bg)] border-b border-[var(--color-line)] flex items-center gap-3 text-[13px]">
          <span className="font-semibold text-[var(--color-ink-700)]">
            {t("bill.customer", lang, { name: customerName })}
          </span>
          {tableNumber && (
            <span className="px-2.5 py-1 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)] font-bold text-[12px]">
              {t("bill.table", lang, { n: tableNumber })}
            </span>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {orders.length === 0 ? (
            <p className="text-center text-[14px] text-[var(--color-ink-500)] py-8">
              {t("bill.empty", lang)}
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="border-b border-[var(--color-line-soft)] pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[12px] text-[var(--color-ink-600)] font-semibold tabular-nums">
                      {new Date(o.createdAt).toLocaleTimeString(lang === "en" ? "en-US" : "ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {o.paymentStatus === "paid" ? (
                      <span className="text-[11px] font-bold text-[var(--color-mint-700)] bg-[var(--color-mint-100)] px-1.5 py-0.5 rounded">
                        {t("bill.paid", lang)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--color-warn)] bg-[#fff1e0] px-1.5 py-0.5 rounded">
                        {t("bill.unpaid", lang)}
                      </span>
                    )}
                  </div>
                  <ul className="text-[14px] space-y-1">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="text-[var(--color-ink-700)] font-medium min-w-0 break-keep">
                          {it.name}{" "}
                          <span className="text-[var(--color-ink-600)] font-normal">×{it.quantity}</span>
                        </span>
                        <span className="tabular-nums text-[var(--color-navy-900)] font-bold shrink-0">
                          {fmtKRW(it.price * it.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 pt-2 border-t border-dashed border-[var(--color-line)] space-y-0.5 text-[12px]">
                    <div className="flex justify-between text-[var(--color-ink-500)]">
                      <span>{t("bill.supply", lang)}</span>
                      <span className="tabular-nums">{fmtKRW(supplyOf(o.totalAmount))}</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-ink-500)]">
                      <span>{t("bill.vat", lang)}</span>
                      <span className="tabular-nums">{fmtKRW(vatOf(o.totalAmount))}</span>
                    </div>
                    <div className="flex justify-between text-[13px] font-bold pt-0.5">
                      <span className="text-[var(--color-ink-700)]">{t("bill.subtotal", lang)}</span>
                      <span className="text-[var(--color-navy-900)] tabular-nums">
                        {fmtKRW(o.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {orders.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--color-line)] bg-white">
            {paidTotal > 0 && (
              <div className="flex justify-between text-[13px] mb-1.5">
                <span className="text-[var(--color-mint-700)] font-bold">{t("bill.paid", lang)}</span>
                <span className="tabular-nums text-[var(--color-mint-700)] font-bold">
                  {fmtKRW(paidTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[14px] mb-2">
              <span className="text-[var(--color-warn)] font-bold">{t("bill.unpaid", lang)}</span>
              <span className="tabular-nums text-[var(--color-warn)] font-bold">
                {fmtKRW(unpaidTotal)}
              </span>
            </div>
            {/* 세금 breakdown — 결제 시 정확한 세금 내역 안내 */}
            <div className="mt-2 pt-2 border-t border-dashed border-[var(--color-line)] space-y-1 text-[12.5px]">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-0.5">
                {t("bill.unpaidBreakdown", lang)}
              </p>
              <div className="flex justify-between text-[var(--color-ink-600)]">
                <span>{t("bill.supply", lang)}</span>
                <span className="tabular-nums">{fmtKRW(unpaidSupply)}</span>
              </div>
              <div className="flex justify-between text-[var(--color-ink-600)]">
                <span>{t("bill.vat", lang)}</span>
                <span className="tabular-nums">{fmtKRW(unpaidVat)}</span>
              </div>
            </div>
            <div className="flex justify-between text-[20px] font-extrabold pt-2 mt-2 border-t-2 border-[var(--color-navy-900)]">
              <span className="text-[var(--color-navy-900)]">{t("bill.total", lang)}</span>
              <span className="text-[var(--color-navy-900)] tabular-nums">
                {fmtKRW(totalAll)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-[var(--color-ink-500)] mt-0.5">
              <span>{t("bill.totalSupply", lang, { amount: fmtKRW(totalSupply) })}</span>
              <span>{t("bill.totalVat", lang, { amount: fmtKRW(totalVat) })}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                {t("bill.print", lang)}
              </Button>
              <Button
                disabled={!canPay || unpaidTotal === 0}
                onClick={onPay}
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                {unpaidTotal > 0
                  ? t("bill.payAmount", lang, { amount: fmtKRW(unpaidTotal) })
                  : t("bill.payDisabled", lang)}
              </Button>
            </div>
            {!canPay && unpaidTotal > 0 && (
              <p className="text-[12px] text-[var(--color-ink-600)] mt-2 text-center">
                {t("bill.needTable", lang)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
