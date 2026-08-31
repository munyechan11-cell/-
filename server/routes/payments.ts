import { Router } from 'express';
import admin from 'firebase-admin';
import { getFirebaseAdmin } from '../lib/firebase.js';

const router = Router();


// --- TOSS PAYMENTS CONFIRM API ---
router.post('/api/payment/confirm', async (req, res) => {
  const { paymentKey, orderId, amount, storeId } = req.body;

  // 멀티테넌트 — 매장별 시크릿 키 우선(각 매장 토스로 정산), 없으면 서버 환경변수 폴백(테스트용)
  let secretKey = process.env.TOSS_SECRET_KEY;
  if (storeId) {
    try {
      const admin = getFirebaseAdmin();
      if (admin) {
        const snap = await admin.firestore().collection('store_secrets').doc(storeId).get();
        const k = snap.data()?.tossSecretKey;
        if (typeof k === 'string' && k) secretKey = k;
      }
    } catch (e: any) {
      console.warn('[toss] store secret lookup failed', e?.message);
    }
  }

  if (!secretKey) {
    return res.status(500).json({ error: 'Toss Secret Key not configured.' });
  }

  try {
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Toss Confirm Error]', data);
      return res.status(response.status).json({ error: data.message || 'Payment confirmation failed' });
    }

    console.log(`[Toss] Payment confirmed: ${orderId}, amount: ${amount}`);
    res.json({ success: true, payment: data });
  } catch (error: any) {
    console.error('[Toss Error]', error.message);
    res.status(500).json({ error: '결제 확인에 실패했어요. 잠시 후 다시 시도해 주세요.' }); // 내부 오류 메시지 비노출

  }
});

// --- 매장 토스 시크릿 키 저장 (멀티테넌트) ---
// store_secrets 는 firestore.rules 에서 클라이언트 완전 차단 — 서버 Admin SDK 만 접근한다.
// 사장님이 브랜드설정에서 시크릿 키를 입력하면 이 엔드포인트로 안전하게 저장된다.
router.post('/api/store/toss-secret', async (req, res) => {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return res.status(500).json({ error: 'admin-not-configured' });
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'unauthorized' });
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'invalid-token' });
    }
    const { storeId, secretKey } = req.body ?? {};
    if (!storeId) return res.status(400).json({ error: 'storeId required' });
    if (!secretKey || typeof secretKey !== 'string') {
      return res.status(400).json({ error: 'secretKey required' });
    }
    await admin
      .firestore()
      .collection('store_secrets')
      .doc(storeId)
      .set({ tossSecretKey: secretKey, updatedAt: new Date().toISOString() }, { merge: true });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[toss-secret] failed', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

export default router;
