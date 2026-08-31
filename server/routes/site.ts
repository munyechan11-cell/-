import { Router } from 'express';
import { getFirebaseAdmin } from '../lib/firebase.js';
import { isValidStoreId } from '../lib/storeAuth.js';

const router = Router();


// ============================================================
// 가게 공개 브랜드 사이트 데이터 (TODO 8-2) — 로그인 없이 고객이 보는 매장 사이트.
// 서버가 "공개해도 되는 필드만" 선별해 반환(개인정보 최소화: 리뷰는 이름 첫 글자만, 연락처는 매장 대표번호만).
// 이미지는 기존 공개 이미지 서빙(/api/marketing/image/:photoId) 재사용.
// ============================================================
router.get('/api/site/:storeId', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const storeId = String(req.params.storeId || '');
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'bad storeId' });
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data() as any;
    if (owner?.role !== 'owner') return res.status(404).json({ error: 'not a store' }); // 명시적 owner만(fail-closed)
    const cfg = owner?.storeConfig ?? {};

    // 메뉴 — 판매중인 것만(최대 60). 카테고리 보존.
    const menuSnap = await fs.collection('menus').where('storeId', '==', storeId).limit(150).get();
    const menu = menuSnap.docs.map((d) => d.data() as any)
      .filter((m) => m && m.isAvailable !== false && m.name)
      .slice(0, 60)
      .map((m) => {
        // 메뉴 사진이 인라인 base64 data URL 이면 응답에서 제외 — 공개 JSON 폭증·egress·LCP 방지(갤러리처럼 별도 서빙 전까지 안전장치). http(s) URL 만 통과.
        const raw = typeof m.imageUrl === 'string' ? m.imageUrl : '';
        return {
          name: String(m.name).slice(0, 60),
          price: Number(m.price) || 0,
          category: String(m.category || '').slice(0, 30),
          imageUrl: raw.startsWith('data:') || raw.length > 2048 ? '' : raw,
          description: typeof m.description === 'string' ? m.description.slice(0, 200) : '',
        };
      });

    // 리뷰 + 갤러리 — photos 컬렉션.
    const photoSnap = await fs.collection('photos').where('storeId', '==', storeId).limit(400).get();
    const photos = photoSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const reviews = photos
      .filter((p) => p.type === 'review' && typeof p.reviewText === 'string' && p.reviewText.trim())
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 8)
      .map((p) => ({
        rating: Number(p.rating) || 0,
        text: String(p.reviewText).slice(0, 280),
        name: (String(p.customerName || '').trim()[0] || '·') + '님', // 이름 첫 글자만 노출
        date: String(p.createdAt || '').slice(0, 10),
        photoId: null, // 손님 리뷰 사진은 공개 동의 절차 전까지 미노출(개인정보 — 얼굴 등 가능)
      }));
    // 갤러리(히어로/배경) — 매장 소유 '메뉴' 사진만(손님·리뷰 사진 제외: 동의 없는 개인정보 노출 방지)
    const gallery = photos
      .filter((p) => p.type === 'menu' && typeof p.imageData === 'string')
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 8)
      .map((p) => p.id);

    const ch = cfg?.publishing?.channels ?? {};
    return res.json({
      store: {
        name: String(owner?.restaurantName || '우리 가게').slice(0, 60),
        fontTheme: typeof cfg?.fontTheme === 'string' ? cfg.fontTheme : '', // 8-1 글꼴 프리셋
        tagline: typeof cfg?.tagline === 'string' ? cfg.tagline.slice(0, 80) : '', // 사이트 부제(선택)
        address: typeof cfg?.address === 'string' ? cfg.address.slice(0, 120) : '', // 사이트 주소(선택)
        // 개인 휴대폰은 노출하지 않음 — AI 예약을 켠 매장의 대표번호만(끄면 비노출).
        phone: cfg?.aiReservation?.enabled === true && typeof cfg?.aiReservation?.phoneNumber === 'string' ? cfg.aiReservation.phoneNumber : '',
        businessHours: owner?.businessHours || null,
        temporarilyClosed: !!owner?.temporarilyClosed,
        instagram: ch.instagram?.username || cfg?.publishing?.instagramUsername || '',
      },
      menu,
      reviews,
      gallery,
    });
  } catch (e: any) { console.error('[site]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

export default router;
