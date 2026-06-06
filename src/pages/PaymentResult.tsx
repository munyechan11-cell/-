import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useStore } from "../store/store";
import { useLanguage, t, fmtKRW } from "../lib/i18n";
import { loadPayContext, clearPayContext } from "../lib/tossPayments";
import { MobileShell } from "../components/layout/MobileShell";
import { Button } from "../components/ui/Button";

/**
 * 토스 결제창 successUrl(/pay/success)·failUrl(/pay/fail) 처리 화면.
 * success: 서버 confirm + 주문 paid 처리 후 결과 표시. fail: 안내만.
 */
export default function PaymentResult({ mode }: { mode: "success" | "fail" }) {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { confirmTossPayment } = useStore();
  const lang = useLanguage();
  const ranRef = useRef(false);
  const [state, setState] = useState<"processing" | "ok" | "fail">(
    mode === "fail" ? "fail" : "processing"
  );
  const [amount, setAmount] = useState(0);
  const [backTo, setBackTo] = useState("/customer");

  useEffect(() => {
    if (mode !== "success" || ranRef.current) return;
    ranRef.current = true; // 결제 confirm 은 1회만 (StrictMode 이중 실행·새로고침 방지)

    const paymentKey = sp.get("paymentKey");
    const orderId = sp.get("orderId");
    const amt = Number(sp.get("amount"));
    if (!paymentKey || !orderId || !Number.isFinite(amt)) {
      setState("fail");
      return;
    }
    const ctx = loadPayContext(orderId);
    if (!ctx) {
      setState("fail");
      return;
    }
    setAmount(amt);
    setBackTo(`/customer/store/${ctx.storeId}`);
    confirmTossPayment({
      storeId: ctx.storeId,
      customerId: ctx.customerId,
      tableNumber: ctx.tableNumber,
      paymentKey,
      orderId,
      amount: amt,
    })
      .then(() => {
        clearPayContext();
        setState("ok");
      })
      .catch(() => setState("fail"));
  }, [mode]);

  return (
    <MobileShell framed={false}>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
        {state === "processing" && (
          <>
            <Loader2 className="w-12 h-12 text-[var(--color-navy-700)] animate-spin" />
            <p className="text-[15px] font-bold text-[var(--color-navy-900)]">
              {t("pay.processing", lang)}
            </p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-16 h-16 text-[var(--color-mint-500)]" />
            <h1 className="text-[20px] font-extrabold text-[var(--color-navy-900)]">
              {t("pay.successTitle", lang)}
            </h1>
            <p className="text-[14px] text-[var(--color-ink-600)]">
              {t("pay.successDesc", lang, { amount: fmtKRW(amount, lang) })}
            </p>
            <Button onClick={() => nav(backTo, { replace: true })} className="mt-2">
              {t("pay.back", lang)}
            </Button>
          </>
        )}
        {state === "fail" && (
          <>
            <XCircle className="w-16 h-16 text-[var(--color-danger)]" />
            <h1 className="text-[20px] font-extrabold text-[var(--color-navy-900)]">
              {t("pay.failTitle", lang)}
            </h1>
            <p className="text-[14px] text-[var(--color-ink-600)]">{t("pay.failDesc", lang)}</p>
            <Button onClick={() => nav(backTo, { replace: true })} className="mt-2">
              {t("pay.back", lang)}
            </Button>
          </>
        )}
      </div>
    </MobileShell>
  );
}
