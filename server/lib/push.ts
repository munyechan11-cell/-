import { getFirebaseAdmin } from '../lib/firebase.js';


// ============================================================
// PUSH NOTIFICATIONS — 사장님 디바이스에 FCM 메시지 발송
// ============================================================
// 호출처: 클라이언트(store.tsx) 가 주문/결제요청/직원가입 등 트리거 후 호출.
// 서버: users/{storeId}.fcmTokens 배열을 읽어 모든 디바이스에 multicast.
// 권한: 추후 Firestore 룰 + 서명 토큰으로 강화. 베타엔 storeId 단순 전달.

interface PushIn {
  storeId: string;
  kind: "new-order" | "payment-request" | "staff-join" | "coupon-request" | "test" | "coupon-issued" | "ai-reservation";
  title: string;
  body: string;
  focusUrl?: string;
  /** 같은 tag 의 알림은 OS 가 묶어 표시 — 'order-T5' 처럼 */
  tag?: string;
}

export async function sendPushToOwner(input: PushIn): Promise<{ sent: number; failed: number; }> {
  const adminApp = getFirebaseAdmin();
  if (!adminApp) return { sent: 0, failed: 0 };
  try {
    const snap = await adminApp.firestore().collection('users').doc(input.storeId).get();
    if (!snap.exists) return { sent: 0, failed: 0 };
    const data = snap.data() as any;
    const tokens: string[] = (data?.fcmTokens ?? [])
      .map((e: any) => e?.token)
      .filter((t: any) => typeof t === 'string' && t.length > 20);
    if (tokens.length === 0) return { sent: 0, failed: 0 };

    // 사장님이 종류별로 OFF 했으면 건너뛰기
    const prefs = data?.pushPrefs ?? {};
    const enabled =
      (input.kind === 'new-order' && prefs.newOrder !== false) ||
      (input.kind === 'payment-request' && prefs.paymentRequest !== false) ||
      (input.kind === 'staff-join' && prefs.staffJoin !== false) ||
      (input.kind === 'coupon-request' && prefs.couponRequest !== false) ||
      input.kind === 'coupon-issued' || // 손님 쿠폰/혜택 도착 — 기본 ON
      input.kind === 'ai-reservation' || // AI 전화 예약 접수 — 기본 ON (중요 알림)
      input.kind === 'test';
    if (!enabled) return { sent: 0, failed: 0 };

    const message = {
      tokens,
      notification: { title: input.title, body: input.body },
      data: {
        title: input.title,
        body: input.body,
        focus_url: input.focusUrl ?? '/biz/owner',
        tag: input.tag ?? `gyeol-${input.kind}`,
      },
      webpush: {
        fcmOptions: { link: input.focusUrl ?? '/biz/owner' },
        notification: {
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: input.tag ?? `gyeol-${input.kind}`,
          requireInteraction: input.kind === 'new-order' || input.kind === 'payment-request',
        },
      },
    };
    const res = await adminApp.messaging().sendEachForMulticast(message as any);

    // 만료/잘못된 토큰 정리 — best-effort
    const stale: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
          stale.push(tokens[i]);
        }
      }
    });
    if (stale.length > 0) {
      try {
        const remaining = (data?.fcmTokens ?? []).filter((e: any) => !stale.includes(e?.token));
        await adminApp.firestore().collection('users').doc(input.storeId).update({ fcmTokens: remaining });
        console.log(`[push] cleaned ${stale.length} stale tokens for ${input.storeId}`);
      } catch (e: any) {
        console.warn('[push] cleanup skip', e?.message);
      }
    }

    return { sent: res.successCount, failed: res.failureCount };
  } catch (e: any) {
    console.error('[push] sendPushToOwner failed', e?.message ?? e);
    return { sent: 0, failed: 0 };
  }
}
