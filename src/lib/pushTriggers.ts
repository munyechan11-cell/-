/**
 * 사장님 디바이스로 푸시를 보내는 클라이언트 트리거.
 * store.tsx 의 핵심 흐름(주문 생성, 결제 요청, 직원 가입 요청, 쿠폰 요청) 끝에서 호출.
 *
 * 보안:
 *   서버 /api/push/send-to-owner 는 Firebase ID Token 검증.
 *   호출 시 익명 또는 소셜 인증된 토큰을 Authorization 헤더에 자동 첨부.
 *
 * 실패는 silent — 푸시는 부가 기능이지 핵심 흐름을 막아선 안 됨.
 */
import { auth } from "./firebase";
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
    // ID Token 확보 — 익명/소셜 어떤 인증이든 OK (서버는 verifyIdToken 만 함)
    let idToken: string | null = null;
    try {
      idToken = (await auth?.currentUser?.getIdToken()) ?? null;
    } catch {
      // 토큰 발급 실패 — 인증 안 된 상태. silent 처리.
    }
    if (!idToken) return; // 인증 없으면 발송 시도조차 안 함

    void fetch(api("/api/push/send-to-owner"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch (e: any) {
    console.warn("[push trigger] silent fail", e?.message);
  }
}
