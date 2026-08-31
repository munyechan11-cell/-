import { Router } from 'express';
import { getFirebaseAdmin } from '../lib/firebase.js';
import { buildSitePayload } from '../lib/sitePayload.js';

const router = Router();

// 가게 공개 브랜드 사이트 데이터. 공개 필드 선별 규칙은 lib/sitePayload.ts 에 있다
// (Next.js 서버 렌더와 공유하기 위해 분리). 여기는 HTTP 껍데기만.
router.get('/api/site/:storeId', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const result = await buildSitePayload(adminApp.firestore(), String(req.params.storeId || ''));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json(result.data);
  } catch (e: any) {
    console.error('[site]', e?.message);
    res.status(500).json({ error: e?.message ?? 'failed' });
  }
});

export default router;
