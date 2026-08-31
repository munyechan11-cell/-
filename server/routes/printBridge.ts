import { Router } from 'express';
import admin from 'firebase-admin';
import { getFirebaseAdmin } from '../lib/firebase.js';

const router = Router();


// ============================================================
// PRINT BRIDGE — 영수증 인쇄 에이전트 페어링 API
// ============================================================
// 흐름:
//   1) POST /api/print-bridge/issue-code — 사장님이 결 웹앱에서 호출
//      → 6자리 랜덤 코드 생성, Firestore pairing_codes/{code} 에 5분 TTL 로 저장
//      → 클라이언트는 코드를 사장님에게 화면 표시
//   2) POST /api/print-bridge/exchange { code } — 에이전트(트레이 앱)가 호출
//      → 코드 유효성 검증 → Firebase Custom Token 발급 → 코드 즉시 삭제
//      → 에이전트는 토큰으로 익명-동급 인증 (uid = ownerUid) 후 print_jobs 구독

// 단순 코드 발급 rate limit — 매장당 1분에 3회까지
const pairingBuckets = new Map<string, { count: number; resetAt: number }>();
const checkPairingRate = (storeId: string): boolean => {
  const now = Date.now();
  const b = pairingBuckets.get(storeId);
  if (!b || now > b.resetAt) {
    pairingBuckets.set(storeId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= 3) return false;
  b.count += 1;
  return true;
};

router.post('/api/print-bridge/issue-code', async (req, res) => {
  try {
    const { storeId, ownerName } = req.body ?? {};
    if (!storeId || typeof storeId !== 'string') {
      return res.status(400).json({ error: 'storeId required' });
    }
    if (!checkPairingRate(storeId)) {
      return res.status(429).json({ error: '코드 발급이 너무 잦아요. 1분 후 다시 시도해 주세요.' });
    }
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });

    // 6자리 코드 — 0 으로 시작 가능 (보안상 큰 문제 아님, 짧은 TTL 로 보완)
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    const expiresAtMs = Date.now() + 5 * 60_000;

    const fs = adminApp.firestore();
    await fs.collection('pairing_codes').doc(code).set({
      storeId,
      ownerName: ownerName ?? null,
      expiresAt: expiresAtMs,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ code, expiresAt: new Date(expiresAtMs).toISOString() });
  } catch (e: any) {
    console.error('[print-bridge/issue-code]', e?.message ?? e);
    res.status(500).json({ error: e?.message ?? '페어링 코드 발급 실패' });
  }
});

router.post('/api/print-bridge/exchange', async (req, res) => {
  try {
    const { code, deviceName } = req.body ?? {};
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '6자리 코드가 필요합니다.' });
    }
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });

    const fs = adminApp.firestore();
    const docRef = fs.collection('pairing_codes').doc(code);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: '코드가 만료되었거나 잘못된 코드입니다.' });
    }
    const data = snap.data() as { storeId: string; expiresAt: number };
    if (Date.now() > data.expiresAt) {
      await docRef.delete().catch(() => {});
      return res.status(410).json({ error: '코드 유효 시간(5분)이 지났어요. 새 코드를 발급받아 주세요.' });
    }

    // 에이전트용 Custom Token — uid 는 매장 owner 의 storeId (단순화).
    // claim 으로 role 과 storeId 를 박아둬 Firestore 룰에서 추가 검증 가능.
    const token = await adminApp.auth().createCustomToken(data.storeId, {
      role: 'print-bridge',
      storeId: data.storeId,
    });

    // 사장님 user 문서에 페어링 디바이스 정보 기록 (UX 용)
    try {
      await fs.collection('users').doc(data.storeId).set({
        printBridgeDevice: {
          name: deviceName ?? null,
          pairedAt: new Date().toISOString(),
        },
      }, { merge: true });
    } catch (e: any) {
      console.warn('[print-bridge/exchange] device record skip', e?.message);
    }

    // 코드는 1회용 — 즉시 삭제
    await docRef.delete().catch(() => {});

    res.json({ token, storeId: data.storeId });
  } catch (e: any) {
    console.error('[print-bridge/exchange]', e?.message ?? e);
    res.status(500).json({ error: e?.message ?? '페어링 교환 실패' });
  }
});

export default router;
