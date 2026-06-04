/**
 * 사장님 디바이스로 푸시를 보내는 클라이언트 트리거.
 * store.tsx 의 핵심 흐름(주문 생성, 결제 요청, 직원 가입 요청, 쿠폰 요청) 끝에서 호출.
 *
 * 실패는 silent — 푸시는 부가 기능이지 핵심 흐름을 막아선 안 됨.
 */
import { api } from "./api";

type PushKind = "new-order" | "payment-request" | "staff-join" | "coupon-request" | "test";

interface SendInput {
  storeId: string;
  kind: PushKind;
  title: string;
  body: string;
  focusUrl?: string;
  tag?: string;
}

export async function sendOwnerPush(input: SendInput): Promise<void> {
  if (!input.storeId) return;
  try {
    void fetch(api("/api/push/send-to-owner"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      // 본 흐름 차단 안 함
      keepalive: true,
    });
  } catch (e: any) {
    console.warn("[push trigger] silent fail", e?.message);
  }
}
