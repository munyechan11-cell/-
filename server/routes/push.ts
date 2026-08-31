import { Router } from 'express';
import { getFirebaseAdmin } from '../lib/firebase.js';
import { sendPushToOwner } from '../lib/push.js';

const router = Router();


/**
 * 발송 트리거 — 호출자가 인증된 사용자임을 검증.
 *
 * 보안 정책 (2026-06):
 *   요청 헤더 Authorization: Bearer <ID_TOKEN> 필수.
 *   ID Token 의 uid 만 storeId 로 푸시 발송 허용.
 *   ※ 결의 user.id 가 auth.uid 와 다를 수 있으나 (베타 한계),
 *     이 엔드포인트는 적어도 '인증된 클라이언트' 만 호출 가능 → 외부 우회 차단.
 *   ※ 추가로 IP 별 분당 60회 rate limit.
 */
const pushIpBuckets = new Map<string, { count: number; resetAt: number }>();
const checkPushRate = (ip: string): boolean => {
  const now = Date.now();
  const b = pushIpBuckets.get(ip);
  if (!b || now > b.resetAt) {
    pushIpBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= 60) return false;
  b.count += 1;
  return true;
};

router.post('/api/push/send-to-owner', async (req, res) => {
  try {
    // 1) Rate limit
    const ip = String(req.ip || 'unknown').split(',')[0].trim();
    if (!checkPushRate(ip)) {
      return res.status(429).json({ error: '요청이 너무 잦아요. 1분 후 다시 시도해 주세요.' });
    }

    // 2) Firebase ID Token 검증 — 인증된 사용자만 호출 가능
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });

    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      return res.status(401).json({ error: 'Authorization header required' });
    }
    try {
      await adminApp.auth().verifyIdToken(m[1]);
    } catch (e: any) {
      return res.status(401).json({ error: 'invalid token' });
    }

    // 3) 입력 검증
    const { storeId, kind, title, body, focusUrl, tag } = req.body ?? {};
    if (!storeId || !kind || !title) {
      return res.status(400).json({ error: 'storeId, kind, title required' });
    }
    const validKinds = ['new-order', 'payment-request', 'staff-join', 'coupon-request', 'test'];
    if (!validKinds.includes(kind)) {
      return res.status(400).json({ error: 'invalid kind' });
    }

    const r = await sendPushToOwner({ storeId, kind, title, body: body ?? '', focusUrl, tag });
    res.json(r);
  } catch (e: any) {
    console.error('[push] endpoint error', e?.message);
    res.status(500).json({ error: e?.message ?? 'push send failed' });
  }
});

export default router;
