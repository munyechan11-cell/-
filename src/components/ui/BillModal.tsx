import { useEffect } from "react";
import { X, Printer, CreditCard } from "lucide-react";
import { Button } from "./Button";
import { useEscapeClose } from "../../lib/useEscapeClose";
import type { Order } from "../../lib/types";

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

  // 모달 열려있을 땐 body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const totalAll = unpaidTotal + paidTotal;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] sm:my-4 max-h-[92vh] overflow-hidden flex flex-col animate-[gyeol-slide-up_.2s_ease-out]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)]">
          <div>
            <p className="label-xs">계산서</p>
            <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] tracking-tight">
              {storeName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-3 bg-[var(--color-bg)] border-b border-[var(--color-line)] flex items-center gap-3 text-[13px]">
          <span className="font-semibold text-[var(--color-ink-700)]">{customerName} 님</span>
          {tableNumber && (
            <span className="px-2.5 py-1 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)] font-bold text-[11px]">
              테이블 {tableNumber}
            </span>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {orders.length === 0 ? (
            <p className="text-center text-[14px] text-[var(--color-ink-500)] py-8">
              주문 내역이 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="border-b border-[var(--color-line-soft)] pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-[var(--color-ink-500)] font-semibold tabular-nums">
                      {new Date(o.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {o.paymentStatus === "paid" ? (
                      <span className="text-[10px] font-bold text-[var(--color-mint-700)] bg-[var(--color-mint-100)] px-1.5 py-0.5 rounded">
                        결제 완료
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[var(--color-warn)] bg-[#fff1e0] px-1.5 py-0.5 rounded">
                        미결제
                      </span>
                    )}
                  </div>
                  <ul className="text-[14px] space-y-1">
                    {o.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="text-[var(--color-ink-700)] font-medium min-w-0 truncate">
                          {it.name}{" "}
                          <span className="text-[var(--color-ink-500)] font-normal">×{it.quantity}</span>
                        </span>
                        <span className="tabular-nums text-[var(--color-navy-900)] font-bold shrink-0">
                          ₩ {(it.price * it.quantity).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 pt-2 border-t border-dashed border-[var(--color-line)] flex justify-between text-[12px] font-bold">
                    <span className="text-[var(--color-ink-500)]">소계</span>
                    <span className="text-[var(--color-navy-900)] tabular-nums">
                      ₩ {o.totalAmount.toLocaleString()}
                    </span>
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
                <span className="text-[var(--color-mint-700)] font-bold">결제 완료</span>
                <span className="tabular-nums text-[var(--color-mint-700)] font-bold">
                  ₩ {paidTotal.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[14px] mb-2">
              <span className="text-[var(--color-warn)] font-bold">미결제</span>
              <span className="tabular-nums text-[var(--color-warn)] font-bold">
                ₩ {unpaidTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-[20px] font-extrabold pt-2 border-t-2 border-[var(--color-navy-900)]">
              <span className="text-[var(--color-navy-900)]">총 합계</span>
              <span className="text-[var(--color-navy-900)] tabular-nums">
                ₩ {totalAll.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                인쇄
              </Button>
              <Button
                disabled={!canPay || unpaidTotal === 0}
                onClick={onPay}
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                {unpaidTotal > 0 ? `결제하기 (₩ ${unpaidTotal.toLocaleString()})` : "결제 완료"}
              </Button>
            </div>
            {!canPay && unpaidTotal > 0 && (
              <p className="text-[11px] text-[var(--color-ink-500)] mt-2 text-center">
                테이블 이용 중일 때만 결제할 수 있어요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
