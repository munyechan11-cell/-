/**
 * 토스페이먼츠 결제창(v2) 래퍼.
 * - 손님/사장님이 카드결제를 시작하면 토스 결제창을 띄우고, 성공 시 successUrl(/pay/success)
 *   로 리다이렉트된다. 그 화면에서 서버 confirm + 주문 paid 처리.
 * - clientKey 는 매장별(owner.tossClientKey). 없으면 토스 공개 테스트 키로 폴백 →
 *   사장님이 BrandSettings 에 본인 키를 넣으면 그대로 운영 전환.
 * - SDK 는 index.html 에서 https://js.tosspayments.com/v2/standard 로 전역 로드.
 */

// 토스 공개 문서용 테스트 클라이언트 키. 운영 시 BrandSettings 의 매장 키로 대체됨.
export const TOSS_TEST_CLIENT_KEY = "test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

const PAY_CTX_KEY = "gyeol_pay_ctx";

export interface PayContext {
  storeId: string;
  tableNumber: number;
  customerId: string;
  amount: number;
  /** 결제 시작 시점의 미결제 주문 id — confirm 성공 후 이 주문들만 paid (왕복 중 추가된 주문 제외) */
  orderIds: string[];
}

/** 결제 시작 시 컨텍스트를 sessionStorage 에 보관 — 리다이렉트 후 successUrl 에서 복원. */
function savePayContext(orderId: string, ctx: PayContext) {
  try {
    sessionStorage.setItem(PAY_CTX_KEY, JSON.stringify({ orderId, ctx }));
  } catch {
    /* sessionStorage 불가 환경 — 무시 */
  }
}

export function loadPayContext(orderId: string): PayContext | null {
  try {
    const raw = sessionStorage.getItem(PAY_CTX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { orderId: string; ctx: PayContext };
    return parsed.orderId === orderId ? parsed.ctx : null;
  } catch {
    return null;
  }
}

export function clearPayContext() {
  try {
    sessionStorage.removeItem(PAY_CTX_KEY);
  } catch {
    /* noop */
  }
}

/** 카드 결제창을 띄운다. 성공/실패는 successUrl·failUrl 로 리다이렉트되어 처리됨. */
export async function startCardPayment(opts: {
  clientKey?: string;
  storeId: string;
  tableNumber: number;
  customerId: string;
  amount: number;
  orderName: string;
  orderIds: string[];
}): Promise<void> {
  const TP = (window as any).TossPayments;
  if (typeof TP !== "function") throw new Error("toss-sdk-not-loaded");

  // 토스 orderId 규칙: 6~64자 영숫자/-/_. storeId(uid)+table+timestamp 로 고유 생성.
  const orderId = `gyeol_${opts.storeId}_${opts.tableNumber}_${Date.now()}`
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  savePayContext(orderId, {
    storeId: opts.storeId,
    tableNumber: opts.tableNumber,
    customerId: opts.customerId,
    amount: opts.amount,
    orderIds: opts.orderIds,
  });

  const tossPayments = TP(opts.clientKey || TOSS_TEST_CLIENT_KEY);
  const payment = tossPayments.payment({ customerKey: TP.ANONYMOUS });
  await payment.requestPayment({
    method: "CARD",
    amount: { currency: "KRW", value: opts.amount },
    orderId,
    orderName: opts.orderName,
    successUrl: `${window.location.origin}/pay/success`,
    failUrl: `${window.location.origin}/pay/fail`,
  });
}
