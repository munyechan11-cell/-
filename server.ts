import express from 'express';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// 헬스 체크 — Render 가 부팅 후 / 와 /api/health 둘 다 폴링.
// 둘 중 하나라도 200 응답이 없으면 'Timed Out' 으로 배포 실패 처리됨.
// 라우터 가장 위에 둬서 다른 미들웨어 부작용을 받지 않게.
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));
// CORS — 운영 환경에서는 ALLOWED_ORIGINS(콤마구분) 으로 제한, 미설정이면 same-origin만 허용
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // 같은 출처(서버 사이드 호출 등) 는 origin 헤더가 없음 — 허용
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true); // 미설정이면 기존 동작 유지
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
// AI 비전 요청용 이미지(base64 데이터 URL)는 100kb를 쉽게 넘어가므로 한도 상향
// verify: 웹훅 서명 검증을 위해 원본(raw) 바디를 보관 — 파싱 후엔 재구성이 불가.
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));

// Helper to get base URL
const getBaseUrl = () => {
  return process.env.APP_URL || 'http://localhost:3000';
};

// Lazy initialize Firebase Admin
let adminApp: admin.app.App | null = null;
function getFirebaseAdmin() {
  if (!adminApp) {
    if (admin.apps.length > 0) {
      adminApp = admin.app();
      return adminApp;
    }

    // 우선순위 1: FIREBASE_SERVICE_ACCOUNT_BASE64 (전체 JSON 을 base64 로 인코딩한 단일 값)
    // Render UI 가 PEM 멀티라인을 자동 줄바꿈으로 망가뜨리는 사고를 100% 회피.
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
    if (b64) {
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        const sa = JSON.parse(decoded);
        adminApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: sa.project_id,
            clientEmail: sa.client_email,
            privateKey: sa.private_key,
          }),
        });
        console.log('[Firebase Admin] initialized via FIREBASE_SERVICE_ACCOUNT_BASE64');
        return adminApp;
      } catch (e: any) {
        console.error('[Firebase Admin] base64 decode failed —', e?.message ?? e);
        // fallthrough → 개별 환경변수 시도
      }
    }

    // 우선순위 2: 개별 환경변수 (기존 호환)
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    // PRIVATE_KEY 입력 사고 전수 정상화:
    //  · 양끝 따옴표·쉼표·공백
    //  · '\n' 리터럴 / 실제 줄바꿈 / CRLF 혼재
    //  · UI 에서 자동 줄바꿈된 PEM
    // → BEGIN/END 사이의 모든 공백을 제거 후 64자 라인으로 표준 PEM 재조립
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      privateKey = privateKey.trim();
      // 양끝 따옴표·쉼표 strip
      if (/^["'].*["']\s*,?\s*$/s.test(privateKey)) {
        privateKey = privateKey.replace(/^["']/, '').replace(/["']\s*,?\s*$/, '');
      }
      // '\n' 리터럴 → 실제 줄바꿈, CRLF 통일
      privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

      // PEM 표준 재조립 — 어떤 형태로 들어왔든 BEGIN/END 사이를 정규화
      const m = privateKey.match(/-----BEGIN[^-]*PRIVATE KEY-----([\s\S]*?)-----END[^-]*PRIVATE KEY-----/);
      if (m) {
        const header = privateKey.match(/-----BEGIN[^-]*PRIVATE KEY-----/)?.[0] ?? '-----BEGIN PRIVATE KEY-----';
        const footer = privateKey.match(/-----END[^-]*PRIVATE KEY-----/)?.[0] ?? '-----END PRIVATE KEY-----';
        const body = m[1].replace(/[\s\\]+/g, '');           // 공백·백슬래시 전부 제거
        const lines = body.match(/.{1,64}/g) ?? [];          // 64자 라인으로 분할
        privateKey = `${header}\n${lines.join('\n')}\n${footer}\n`;
      }
    }
    
    if (projectId && clientEmail && privateKey) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
    } else {
      console.warn('Firebase Admin SDK credentials missing. Custom token generation will fail.');
    }
  }
  return adminApp;
}

// API Routes
app.get('/api/auth/kakao/url', (req, res) => {
  const redirectUri = `${getBaseUrl()}/api/auth/kakao/callback`;
  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'KAKAO_CLIENT_ID is not set' });
  
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  res.json({ url });
});

app.get('/api/auth/kakao/callback', async (req, res) => {
  const { code } = req.query;
  const redirectUri = `${getBaseUrl()}/api/auth/kakao/callback`;
  const clientId = process.env.KAKAO_CLIENT_ID;
  
  try {
    // 1. Get Token
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId || '',
        redirect_uri: redirectUri,
        code: code as string,
      })
    });
    const tokenData = await tokenRes.json();
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }
    
    // 2. Get User Info
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    
    if (userData.code && userData.code < 0) {
      throw new Error(userData.msg || 'Failed to fetch user profile');
    }
    
    // 3. Firebase Custom Token
    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) throw new Error('Firebase Admin not configured');
    
    const uid = `kakao:${userData.id}`;
    
    // Try to create or update user
    try {
      await firebaseAdmin.auth().getUser(uid);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        await firebaseAdmin.auth().createUser({
          uid,
          displayName: userData.properties?.nickname,
          photoURL: userData.properties?.profile_image,
        });
      } else {
        throw e;
      }
    }
    
    const customToken = await firebaseAdmin.auth().createCustomToken(uid);
    
    res.send(`
      <html><body><script>
        const tokenData = ${JSON.stringify({ type: 'OAUTH_AUTH_SUCCESS', token: customToken, provider: 'kakao' })};
        tokenData.timestamp = Date.now();
        
        // 1. Try postMessage
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(tokenData, '*');
        }
        
        // 2. Write to localStorage for cross-tab communication (fallback)
        try {
          localStorage.setItem('oauth_token_data', JSON.stringify(tokenData));
        } catch (e) {
          console.error('localStorage error', e);
        }
        
        // 3. Try to close the window
        window.close();
        
        // 4. If window didn't close (e.g. mobile Safari), show message
        setTimeout(() => {
          document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;padding:20px;"><div><h2 style="color:#4CAF50;margin-bottom:10px;">로그인 성공!</h2><p style="color:#666;margin-bottom:20px;">원래 화면으로 돌아가주세요.<br>이 창은 닫으셔도 됩니다.</p><button onclick="window.close()" style="padding:10px 20px;background:#4CAF50;color:white;border:none;border-radius:5px;font-size:16px;cursor:pointer;">창 닫기</button></div></div>';
        }, 500);
      </script></body></html>
    `);
  } catch (err: any) {
    console.error('Kakao Auth Error:', err);
    const safeMessage = String(err?.message || 'Unknown error')
      .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const errorPayload = JSON.stringify({ type: 'OAUTH_AUTH_ERROR', error: String(err?.message || 'Unknown error') });
    res.status(500).send(`
      <html><body>
        <p>Authentication failed: ${safeMessage}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage(${errorPayload}, '*');
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body></html>
    `);
  }
});

// Naver URL
app.get('/api/auth/naver/url', (req, res) => {
  const redirectUri = `${getBaseUrl()}/api/auth/naver/callback`;
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'NAVER_CLIENT_ID is not set' });
  
  const state = Math.random().toString(36).substring(7);
  const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
  res.json({ url });
});

// Naver Callback
app.get('/api/auth/naver/callback', async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  
  try {
    const tokenRes = await fetch(`https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}&state=${state}`);
    const tokenData = await tokenRes.json();
    
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }
    
    const userRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    
    if (userData.resultcode !== '00') {
      throw new Error(userData.message || 'Failed to fetch user profile');
    }
    
    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) throw new Error('Firebase Admin not configured');
    
    const uid = `naver:${userData.response.id}`;
    
    try {
      await firebaseAdmin.auth().getUser(uid);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        await firebaseAdmin.auth().createUser({
          uid,
          displayName: userData.response.name || userData.response.nickname,
          email: userData.response.email,
          photoURL: userData.response.profile_image,
        });
      } else {
        throw e;
      }
    }
    
    const customToken = await firebaseAdmin.auth().createCustomToken(uid);
    
    res.send(`
      <html><body><script>
        const tokenData = ${JSON.stringify({ type: 'OAUTH_AUTH_SUCCESS', token: customToken, provider: 'naver' })};
        tokenData.timestamp = Date.now();
        
        // 1. Try postMessage
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(tokenData, '*');
        }
        
        // 2. Write to localStorage for cross-tab communication (fallback)
        try {
          localStorage.setItem('oauth_token_data', JSON.stringify(tokenData));
        } catch (e) {
          console.error('localStorage error', e);
        }
        
        // 3. Try to close the window
        window.close();
        
        // 4. If window didn't close (e.g. mobile Safari), show message
        setTimeout(() => {
          document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;text-align:center;padding:20px;"><div><h2 style="color:#03C75A;margin-bottom:10px;">로그인 성공!</h2><p style="color:#666;margin-bottom:20px;">원래 화면으로 돌아가주세요.<br>이 창은 닫으셔도 됩니다.</p><button onclick="window.close()" style="padding:10px 20px;background:#03C75A;color:white;border:none;border-radius:5px;font-size:16px;cursor:pointer;">창 닫기</button></div></div>';
        }, 500);
      </script></body></html>
    `);
  } catch (err: any) {
    console.error('Naver Auth Error:', err);
    const safeMessage = String(err?.message || 'Unknown error')
      .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const errorPayload = JSON.stringify({ type: 'OAUTH_AUTH_ERROR', error: String(err?.message || 'Unknown error') });
    res.status(500).send(`
      <html><body>
        <p>Authentication failed: ${safeMessage}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage(${errorPayload}, '*');
            setTimeout(() => window.close(), 2000);
          }
        </script>
      </body></html>
    `);
  }
});

// --- FOODTECH POS RELAY API ---
app.post('/api/order/relay-to-pos', async (req, res) => {
  const { orderId, foodtechStoreCode, tableNumber, items, totalAmount } = req.body;

  const FOODTECH_API_KEY = process.env.FOODTECH_API_KEY;
  
  if (!FOODTECH_API_KEY || FOODTECH_API_KEY === 'YOUR_REAL_KEY_HERE') {
    console.warn(`[Foodtech Relay] API Key not set. Order ${orderId} logged locally only.`);
    return res.json({ success: true, mode: 'test', message: 'POS relay skipped (no API key). Order saved to Firestore only.' });
  }

  try {
    const FOODTECH_API_URL = process.env.FOODTECH_API_URL || 'https://api.foodtech.co.kr/v1/order/relay';
    
    const relayPayload = {
      store_code: foodtechStoreCode,
      order_id: orderId,
      order_type: 'WEB_QR',
      table_no: tableNumber,
      order_items: items.map((item: any) => ({
        product_code: item.posCode || '9999',
        product_name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      amount: {
        total: totalAmount,
        payment: totalAmount
      },
      payment_type: 'PREPAID',
      ordered_at: new Date().toISOString()
    };

    const response = await fetch(FOODTECH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FOODTECH_API_KEY}`,
        'X-Request-Id': orderId
      },
      body: JSON.stringify(relayPayload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Foodtech Relay] HTTP ${response.status}: ${errorBody}`);
      return res.status(502).json({ success: false, error: `POS relay failed (HTTP ${response.status})` });
    }

    const result = await response.json();
    console.log(`[Foodtech Relay] Order ${orderId} successfully relayed to store ${foodtechStoreCode}`);
    res.json({ success: true, mode: 'live', posResponse: result });

  } catch (error: any) {
    console.error('[Relay Error]', error.message);
    res.status(500).json({ success: false, error: 'POS 전송에 실패했어요. 잠시 후 다시 시도해 주세요.' }); // 내부 오류 메시지 비노출

  }
});

// --- TOSS PAYMENTS CONFIRM API ---
app.post('/api/payment/confirm', async (req, res) => {
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
app.post('/api/store/toss-secret', async (req, res) => {
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

// ============================================================
// 토스플레이스(오프라인 토스 POS) 매출 연동 — Open API 웹훅 + 조회 보정
//
//   ※ 토스페이먼츠(PG)와 완전 별개 제품. 인증키도 따로다
//      (x-access-key / x-secret-key + 웹훅 Secret). 토스페이먼츠 sk_ 로는 안 됨.
//
//   흐름: POS 결제 → 토스플레이스가 /api/tossplace/webhook 으로 POST
//        → 서명검증(HMAC-SHA256) → merchantId→storeId 매핑
//        → orders 컬렉션에 'paid' 주문으로 기록 → 사장님 대시보드/정산 매출에 자동 반영
//          (클라이언트가 orders 를 storeId 로 구독하므로 별도 작업 불필요).
//
//   ⚠️ TODO(키 발급 후 실페이로드로 확정): 결제완료 이벤트 type 문자열, data 안의
//      금액/결제ID/시각 필드명, 그리고 조회 API 의 정확한 base URL·경로·응답 형태.
//      첫 수신 시 전체 페이로드를 로깅하니 그걸로 매핑을 확정한다.
// ============================================================

// TODO: 토스플레이스 Open API 실제 base URL 확인 (docs.tossplace.com).
// 실제 토스플레이스 Open API 호스트는 open-api (하이픈). openapi(하이픈X)는 DNS 미존재 → fetch failed.
const TOSSPLACE_API_BASE = process.env.TOSSPLACE_API_BASE || 'https://open-api.tossplace.com';

/** 토스플레이스 결제 1건을 orders 에 멱등 upsert. 문서 id = tossplace_<paymentId> 라 재수신·중복 안전. */
async function upsertTossPlacePayment(
  db: admin.firestore.Firestore,
  storeId: string,
  p: { paymentId: string; amount: number; method?: 'card' | 'cash'; paidAt?: string }
): Promise<void> {
  const orderId = `tossplace_${p.paymentId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
  await db.collection('orders').doc(orderId).set(
    {
      storeId,
      tableNumber: 0, // POS 외부결제 — 앱 테이블과 무관 (테이블 흐름에서 제외)
      customerId: '',
      items: [{ menuId: '', name: '토스 POS 결제', quantity: 1, price: p.amount }],
      totalAmount: p.amount,
      status: 'served', // 활성주문(주방/테이블)에서 빠지도록
      paymentStatus: 'paid',
      paymentMethod: p.method ?? 'card',
      source: 'tossplace',
      createdAt: p.paidAt ?? new Date().toISOString(),
    },
    { merge: true }
  );
}

/** 페이로드/거래객체에서 결제 정보를 방어적으로 추출 (필드명이 문서상 미확정이라 폭넓게 매칭). */
function extractTossPlacePayment(d: any): { paymentId?: string; amount: number; method: 'card' | 'cash'; paidAt?: string } {
  const paymentId = d?.paymentId || d?.id || d?.orderId || d?.transactionId;
  const amount = Number(d?.amount?.total ?? d?.totalAmount ?? d?.totalPrice ?? d?.paymentAmount ?? d?.approvedAmount ?? d?.amount ?? 0);
  const method = /cash|현금/i.test(String(d?.method ?? d?.payMethod ?? d?.paymentMethod ?? '')) ? 'cash' : 'card';
  const paidAt = d?.approvedAt || d?.paidAt || d?.completedAt || d?.createdAt;
  return { paymentId, amount, method, paidAt };
}

// --- 토스플레이스 연동 설정 저장 (인증 필요) ---
// 비밀 키는 store_secrets(서버 전용), merchantId→storeId 역매핑은 merchant_map(서버 전용),
// 비밀 아닌 표시 정보(tossPlace)는 users 문서에 저장한다.
app.post('/api/store/tossplace-config', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: 'admin-not-configured' });
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'unauthorized' });
    try {
      await adminApp.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'invalid-token' });
    }
    const { storeId, merchantId, accessKey, secretKey, webhookSecret } = req.body ?? {};
    if (!storeId) return res.status(400).json({ error: 'storeId required' });
    if (!merchantId) return res.status(400).json({ error: 'merchantId required' });

    const db = adminApp.firestore();
    const now = new Date().toISOString();
    const secretPatch: Record<string, any> = { tossPlaceMerchantId: String(merchantId), updatedAt: now };
    if (accessKey) secretPatch.tossPlaceAccessKey = accessKey;
    if (secretKey) secretPatch.tossPlaceSecretKey = secretKey;
    if (webhookSecret) secretPatch.tossPlaceWebhookSecret = webhookSecret;
    await db.collection('store_secrets').doc(storeId).set(secretPatch, { merge: true });
    await db.collection('merchant_map').doc(String(merchantId)).set({ storeId, updatedAt: now }, { merge: true });
    await db.collection('users').doc(storeId).set({ tossPlace: { merchantId: String(merchantId), connectedAt: now } }, { merge: true });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[tossplace-config] failed', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// --- 토스플레이스 웹훅 수신 (인증 없음 — 서명으로 검증) ---
app.post('/api/tossplace/webhook', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: 'admin-not-configured' });
    const db = adminApp.firestore();

    const body = req.body ?? {};
    // merchantId 위치가 payload 형태마다 다를 수 있어 여러 곳 탐색
    const merchantId = body.merchantId ?? body.data?.merchantId ?? body.storeId ?? body.data?.storeId ?? body.mid ?? body.data?.mid;
    const evtType = String(body?.type ?? body?.eventType ?? body?.event ?? '');
    // 진단 기록 — 웹훅이 "도착했는지/형태/결과"를 앱에서 확인할 수 있게. 실패해도 웹훅 처리엔 영향 X.
    const writeDiag = async (outcome: string, extra?: any) => {
      try {
        await db.collection('tossplace_diag').doc('last').set({
          receivedAt: new Date().toISOString(),
          merchantId: merchantId != null ? String(merchantId) : null,
          type: evtType,
          topKeys: body && typeof body === 'object' ? Object.keys(body).slice(0, 25) : [],
          dataKeys: body?.data && typeof body.data === 'object' ? Object.keys(body.data).slice(0, 25) : [],
          hasSig: !!req.headers['x-toss-signature'],
          outcome,
          ...(extra || {}),
        });
      } catch { /* diag 실패 무시 */ }
    };

    if (!merchantId) { await writeDiag('no-merchantId'); return res.status(400).json({ error: 'merchantId missing' }); }

    // merchantId → storeId
    const mapSnap = await db.collection('merchant_map').doc(String(merchantId)).get();
    const storeId = mapSnap.data()?.storeId as string | undefined;
    if (!storeId) {
      console.warn('[tossplace webhook] unknown merchantId', merchantId);
      await writeDiag('not-mapped');
      return res.status(404).json({ error: 'merchant not mapped' });
    }

    // 서명검증 — HMAC-SHA256( `${timestamp}.${rawBody}` ), header x-toss-signature: "v1=<hex>"
    // 웹훅 Secret: 매장별 저장값 우선, 없으면 앱 단위 환경변수(플랫폼 모델 — 결이 앱 1개로 다수 매장 수신).
    const secret =
      ((await db.collection('store_secrets').doc(storeId).get()).data()?.tossPlaceWebhookSecret as string | undefined) ??
      process.env.TOSSPLACE_WEBHOOK_SECRET;
    const sigHeader = String(req.headers['x-toss-signature'] || '');
    const timestamp = String(req.headers['x-toss-timestamp'] || '');
    const raw: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
    if (secret) {
      const expected = 'v1=' + createHmac('sha256', secret).update(`${timestamp}.${raw.toString('utf8')}`).digest('hex');
      const a = Buffer.from(sigHeader);
      const b = Buffer.from(expected);
      const ok = a.length === b.length && timingSafeEqual(a, b);
      if (!ok) {
        console.warn('[tossplace webhook] signature mismatch', { merchantId });
        await writeDiag('sig-mismatch', { storeId });
        return res.status(401).json({ error: 'invalid signature' });
      }
    } else {
      console.warn('[tossplace webhook] no webhook secret set — skipping verify', { storeId });
    }

    console.log('[tossplace webhook]', evtType, JSON.stringify(body).slice(0, 1200));

    // 결제/주문 완료 계열 이벤트면 매출 기록. type 이 미상이거나 결제/주문 계열이면 시도(amount>0 + 멱등 upsert 라 안전).
    let recorded = false;
    if (!evtType || /payment|order|결제|주문|sale|approv|paid|complete|done/i.test(evtType)) {
      const { paymentId, amount, method, paidAt } = extractTossPlacePayment(body.data ?? body);
      if (paymentId && amount > 0) {
        await upsertTossPlacePayment(db, storeId, { paymentId: String(paymentId), amount, method, paidAt });
        recorded = true;
        console.log('[tossplace webhook] recorded', { storeId, paymentId, amount });
      }
    }
    await writeDiag(recorded ? 'recorded' : 'received-not-recorded', { storeId });
    res.json({ ok: true, recorded });
  } catch (e: any) {
    console.error('[tossplace webhook] failed', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// --- 토스플레이스 웹훅 진단 — 마지막 수신 웹훅(도착여부·형태·결과) 조회. "결제했는데 안 잡힘" 원인 파악용 ---
app.post('/api/store/tossplace-diag', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: 'admin-not-configured' });
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'unauthorized' });
    try { await adminApp.auth().verifyIdToken(idToken); } catch { return res.status(401).json({ error: 'invalid-token' }); }
    const snap = await adminApp.firestore().collection('tossplace_diag').doc('last').get();
    res.json({ ok: true, last: snap.exists ? snap.data() : null });
  } catch (e: any) {
    console.error('[tossplace-diag] failed', e?.message);
    res.status(500).json({ error: 'diag failed' });
  }
});

// --- 토스플레이스 매출 수동 동기화/보정 (인증 필요) — 웹훅 누락분 백필 ---
app.post('/api/store/tossplace-sync', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: 'admin-not-configured' });
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'unauthorized' });
    try {
      await adminApp.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'invalid-token' });
    }
    const { storeId } = req.body ?? {};
    if (!storeId) return res.status(400).json({ error: 'storeId required' });

    const db = adminApp.firestore();
    const sec = (await db.collection('store_secrets').doc(storeId).get()).data() ?? {};
    // 키: 매장별 저장값 우선, 없으면 앱 단위 환경변수(플랫폼 모델). merchantId 는 매장 식별·API 경로용이라 항상 매장별.
    const accessKey = sec.tossPlaceAccessKey ?? process.env.TOSSPLACE_ACCESS_KEY;
    const secretKey = sec.tossPlaceSecretKey ?? process.env.TOSSPLACE_SECRET_KEY;
    const merchantId = sec.tossPlaceMerchantId;
    if (!accessKey || !secretKey || !merchantId) {
      return res.status(400).json({ error: 'tossplace-not-configured' });
    }

    // 가맹점 전체 "결제목록" API 는 없음(개별/주문별만) → 주문목록(Order API)으로 백필. 기본 COMPLETED+CANCELLED 조회.
    // 날짜범위(from~to) — ISO 8601 로는 빈 결과여서 epoch(밀리초 숫자)로 시도. 최근 365일.
    const toTs = Date.now();
    const fromTs = Date.now() - 365 * 86400000;
    const url = `${TOSSPLACE_API_BASE}/api-public/openapi/v1/merchants/${encodeURIComponent(merchantId)}/order/orders?page=1&size=500&sortOrder=DESC&from=${fromTs}&to=${toTs}`;
    const r = await fetch(url, { headers: { 'x-access-key': accessKey, 'x-secret-key': secretKey, 'content-type': 'application/json' } });
    const text = await r.text();
    if (!r.ok) {
      console.error('[tossplace sync] api error', r.status, text.slice(0, 300));
      return res.status(502).json({ error: 'tossplace-api-error', status: r.status, detail: text.slice(0, 300) });
    }
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'parse-error' });
    }
    // 공통 응답 봉투 해제: { resultType:"SUCCESS", success: <Order[] 또는 페이지객체> }
    const root = payload?.success ?? payload;
    const list: any[] = Array.isArray(root) ? root : (root?.content ?? root?.orders ?? root?.list ?? root?.data ?? []);
    let recorded = 0;
    for (const d of list) {
      if (/CANCEL/i.test(String(d?.state ?? d?.orderState ?? d?.status ?? ''))) continue; // 취소 주문 제외
      const { paymentId, amount, method, paidAt } = extractTossPlacePayment(d);
      if (!paymentId || amount <= 0) continue;
      await upsertTossPlacePayment(db, storeId, { paymentId: String(paymentId), amount, method, paidAt });
      recorded++;
    }
    // recorded=0 이면 원인 진단용 봉투 구조(값 아닌 '키/타입'만) 회신 — 주문0건인지 파싱미스인지 구분
    let debug: any;
    if (recorded === 0) {
      const succ = payload?.success;
      debug = {
        topKeys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 20) : typeof payload,
        successType: Array.isArray(succ) ? `array(${succ.length})` : succ && typeof succ === 'object' ? 'object' : String(succ),
        successKeys: succ && typeof succ === 'object' && !Array.isArray(succ) ? Object.keys(succ).slice(0, 20) : undefined,
        itemKeys: list[0] && typeof list[0] === 'object' ? Object.keys(list[0]).slice(0, 30) : undefined,
      };
    }
    res.json({ ok: true, fetched: list.length, recorded, ...(debug ? { debug } : {}) });
  } catch (e: any) {
    console.error('[tossplace sync] failed', e?.message);
    res.status(500).json({ error: e?.message });
  }
});

// --- AI FLOOR PLAN ANALYSIS ---
// 도면 이미지를 Claude/OpenAI Vision으로 분석해 테이블 배치 좌표 추출

// IP별 단순 토큰 버킷 — AI API 키 비용 폭주 방지 (10초당 1회, 분당 4회)
const aiBuckets = new Map<string, { tokens: number; updatedAt: number; minuteCount: number; minuteStart: number }>();
const checkAiRateLimit = (ip: string): { ok: boolean; reason?: string } => {
  const now = Date.now();
  let b = aiBuckets.get(ip);
  if (!b) {
    b = { tokens: 1, updatedAt: now, minuteCount: 0, minuteStart: now };
    aiBuckets.set(ip, b);
  }
  // 10초 토큰: 최대 1
  const refill = Math.floor((now - b.updatedAt) / 10000);
  if (refill > 0) {
    b.tokens = Math.min(1, b.tokens + refill);
    b.updatedAt = now;
  }
  // 분당 카운트 리셋
  if (now - b.minuteStart > 60000) { b.minuteStart = now; b.minuteCount = 0; }
  if (b.minuteCount >= 4) return { ok: false, reason: 'minute' };
  if (b.tokens < 1) return { ok: false, reason: 'second' };
  b.tokens -= 1;
  b.minuteCount += 1;
  // 메모리 청소 — 1만 개 넘으면 가장 오래된 것 정리
  if (aiBuckets.size > 10000) {
    const cutoff = now - 600000;
    for (const [k, v] of aiBuckets) if (v.updatedAt < cutoff) aiBuckets.delete(k);
  }
  return { ok: true };
};

// fetch with timeout — AI API가 영영 안 돌아오는 사고 방지
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

app.post('/api/ai/floor-plan', async (req, res) => {
  // Rate limit — trust proxy=1 설정 하에서 req.ip 는 proxy 가 검증한 첫 X-Forwarded-For 값.
  // raw 헤더를 직접 fallback 으로 쓰면 클라이언트가 IP 를 위조해 rate limit 우회 가능 → req.ip 만 신뢰.
  const ip = String(req.ip || 'unknown').split(',')[0].trim();
  const rl = checkAiRateLimit(ip);
  if (!rl.ok) {
    return res.status(429).json({
      error: rl.reason === 'minute'
        ? '잠시 후 다시 시도해 주세요 (분당 4회 제한).'
        : '요청이 너무 빠릅니다. 10초 후 다시 시도해 주세요.',
    });
  }
  const { image, canvasWidth = 1000, canvasHeight = 700 } = req.body ?? {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image (data URL) is required' });
  }
  // base64 본문 크기 가드 — express.json 의 10mb 한도와 별개로 AI 비용 폭주·요청 거부 방어
  // 8MB raw 이상 차단 (base64 인코딩 후 ~10.7MB → 한도 근접)
  const MAX_IMG_BYTES = 8 * 1024 * 1024;
  const b64Body = image.split(',')[1] ?? '';
  const approxBytes = Math.floor((b64Body.length * 3) / 4);
  if (approxBytes > MAX_IMG_BYTES) {
    return res.status(413).json({ error: '도면 이미지가 너무 큽니다. 8MB 이하로 줄여 주세요.' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !anthropicKey && !openaiKey) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  }

  // 정규화 좌표 (0-1) 사용 — 이미지 종횡비와 무관하게 클라이언트가 캔버스에 정확히 매핑 가능
  const systemPrompt = `
당신은 식당 도면(CAD 도면 또는 사장님이 그린 손스케치)을 분석해 두 가지를 분리해서 추출합니다.

## 핵심 원칙
1. **테이블(tables)** = 손님이 실제로 앉는 자리만. 사각형/원형 박스로 그려진 자리, 의자에 둘러싸인 자리.
2. **구조물(structures)** = 벽, 출입구(문), 룸(방) 경계, 카운터 등 자리가 아닌 모든 것.
3. 벽/문/룸 경계는 **절대 tables 배열에 넣지 마세요.** 그건 structures 입니다.
4. 룸(별실)은 그 자체로 자리가 아닙니다. 룸 안에 그려진 개별 테이블만 tables에 넣고, 룸 경계는 structures에 넣으세요.
5. 도면에 번호가 적혀 있으면 그 번호를 그대로 사용. 없으면 좌상단부터 행 우선으로 1,2,3... 부여.

## 좌표 규칙 (매우 중요)
- 모든 x, y, width, height는 **이미지 너비/높이에 대한 0~1 정규화 비율**입니다.
- 예: 이미지 좌상단 = (0, 0), 우하단 = (1, 1), 중앙 = (0.5, 0.5)
- 이미지에서 보이는 위치에 정확히 맞추세요. 임의로 재배치하지 마세요.

## 출력 스키마 (JSON만, 다른 텍스트 금지)
{
  "tables": [
    { "number": 1, "x": 0.12, "y": 0.08, "width": 0.07, "height": 0.07, "shape": "square"|"circle", "seats": 4 }
  ],
  "structures": [
    { "kind": "wall"|"door"|"room"|"counter", "x": 0.0, "y": 0.0, "width": 0.5, "height": 0.02, "label": "주방" }
  ]
}

## 손그림 해석 규칙
- 작은 사각형/원 = 일반 테이블 (보통 width 0.04~0.10)
- 큰 사각형 = 룸 또는 구역 (structures.kind="room")
- 직선/실선 = 벽 (structures.kind="wall", 얇은 height/width)
- 호 모양/벽 끝의 빈 틈 = 출입구 (structures.kind="door")
- "주방", "카운터", "화장실" 같은 글씨가 있는 영역 = structures.kind="counter" (label에 글씨 그대로)

## 누락 우선 원칙
명백한 객체만 추출. 애매하면 누락이 과추출보다 훨씬 낫습니다.
도면이 거의 비어 보이면 빈 배열 두 개를 반환하세요: {"tables":[],"structures":[]}.
`.trim();

  try {
    // 우선순위: Gemini(무료) → Anthropic → OpenAI
    if (geminiKey) {
      const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'invalid image data URL' });
      const mediaType = m[1];
      const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
      if (!ALLOWED.has(mediaType)) {
        return res.status(400).json({ error: `unsupported image type: ${mediaType}` });
      }
      const b64 = m[2];

      // gemini-2.5-flash는 무료 티어 포함, 비전 + JSON 응답 모두 지원
      const apiRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: mediaType, data: b64 } },
                  { text: `이 도면을 분석해 tables(실제 자리)와 structures(벽·문·룸·카운터)를 분리하여 0~1 정규화 좌표 JSON으로 반환하세요. 도면에서 보이는 위치를 정확히 따르고, 임의 재배치 금지.` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              maxOutputTokens: 4000,
              thinkingConfig: { thinkingBudget: 0 }, // thinking 끔 — 복잡 도면에서 출력 토큰 잘림·지연 방지
            },
          }),
        },
        30000 // 30초 timeout — Gemini가 안 돌아오는 사고 방지
      );
      if (!apiRes.ok) {
        const t = await apiRes.text();
        throw new Error(`Gemini ${apiRes.status}: ${t.slice(0, 200)}`);
      }
      const data: any = await apiRes.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const json = extractJson(text);
      return res.json(json);
    }

    if (anthropicKey) {
      const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'invalid image data URL' });
      const mediaType = m[1];
      // Anthropic Vision이 지원하는 타입만 허용 (svg·heic 등 거부)
      const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
      if (!ALLOWED.has(mediaType)) {
        return res.status(400).json({ error: `unsupported image type: ${mediaType}` });
      }
      const b64 = m[2];

      const apiRes = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
                { type: 'text', text: `이 도면을 분석해 tables(실제 자리)와 structures(벽·문·룸·카운터)를 분리하여 0~1 정규화 좌표 JSON으로 반환하세요. 도면에서 보이는 위치를 정확히 따르고, 임의 재배치 금지.` },
              ],
            },
          ],
        }),
      }, 30000);
      if (!apiRes.ok) {
        const t = await apiRes.text();
        throw new Error(`Anthropic ${apiRes.status}: ${t.slice(0, 200)}`);
      }
      const data: any = await apiRes.json();
      const text = data?.content?.[0]?.text ?? '';
      const json = extractJson(text);
      return res.json(json);
    }

    // OpenAI fallback
    const apiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `이 도면을 분석해 tables(실제 자리)와 structures(벽·문·룸·카운터)를 분리하여 0~1 정규화 좌표 JSON으로 반환하세요. 도면에서 보이는 위치를 정확히 따르고, 임의 재배치 금지.` },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    }, 30000);
    if (!apiRes.ok) {
      const t = await apiRes.text();
      throw new Error(`OpenAI ${apiRes.status}: ${t.slice(0, 200)}`);
    }
    const data: any = await apiRes.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const json = extractJson(text);
    return res.json(json);
  } catch (e: any) {
    console.error('[AI floor-plan]', e?.message ?? e);
    res.status(500).json({ error: e?.message ?? 'AI 분석 실패' });
  }
});

// ============================================================
// AI RECEIPT — 영수증 사진에서 지출 정보 추출 (ERP 진입장벽↓)
// 영수증 촬영 한 장으로 매출장부 비용 입력을 자동 채운다.
// ============================================================
app.post('/api/ai/receipt', async (req, res) => {
  const ip = String(req.ip || 'unknown').split(',')[0].trim();
  const rl = checkAiRateLimit(ip);
  if (!rl.ok) {
    return res.status(429).json({
      error: rl.reason === 'minute'
        ? '잠시 후 다시 시도해 주세요 (분당 4회 제한).'
        : '요청이 너무 빠릅니다. 10초 후 다시 시도해 주세요.',
    });
  }
  const { image } = req.body ?? {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image (data URL) is required' });
  }
  const MAX_IMG_BYTES = 8 * 1024 * 1024;
  const b64Body = image.split(',')[1] ?? '';
  if (Math.floor((b64Body.length * 3) / 4) > MAX_IMG_BYTES) {
    return res.status(413).json({ error: '영수증 이미지가 너무 큽니다. 8MB 이하로 줄여 주세요.' });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'invalid image data URL' });
  const mediaType = m[1];
  const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  if (!ALLOWED.has(mediaType)) {
    return res.status(400).json({ error: `unsupported image type: ${mediaType}` });
  }
  const b64 = m[2];
  const todayKST = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const systemPrompt = `당신은 한국 식당 사장님의 영수증·거래명세서 사진에서 지출 정보를 추출합니다.
JSON 만 출력. 스키마:
{ "amount": 숫자, "vendor": "상호명", "date": "YYYY-MM-DD", "category": "rent|material|utility|marketing|other", "memo": "간단 메모" }
규칙:
- amount: 최종 결제 합계(VAT 포함). 콤마·₩·"원" 제거하고 숫자만.
- date: 영수증 발행일. 안 보이면 "${todayKST}".
- category: 임대료=rent, 식자재·재료·매입=material, 전기·가스·수도·통신=utility, 광고·마케팅=marketing, 그 외=other.
- vendor: 가맹점/상호명. 없으면 "".
- memo: 주요 품목 한 줄 요약(선택).
- 안 보이는 값은 비우되 amount 는 최선 추정. 애매하면 category="other".`;
  try {
    const apiRes = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: mediaType, data: b64 } },
                { text: '이 영수증에서 지출 정보를 위 스키마 JSON 으로 추출하세요.' },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
      30000
    );
    if (!apiRes.ok) {
      const t = await apiRes.text();
      throw new Error(`Gemini ${apiRes.status}: ${t.slice(0, 200)}`);
    }
    const data: any = await apiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.json(extractReceipt(text, todayKST));
  } catch (e: any) {
    console.error('[AI receipt]', e?.message ?? e);
    res.status(500).json({ error: e?.message ?? '영수증 분석 실패' });
  }
});

// ============================================================
// AI MENU BOARD — 메뉴판 사진 한 장에서 메뉴 일괄 추출 + 자동 분류
// 사장님이 메뉴판/입간판/인쇄 메뉴 사진을 올리면 모든 메뉴를 {이름,가격,분류} 로 뽑아,
// 검토 화면에서 확인 후 한 번에 등록한다. (receipt 핸들러와 동일 구조 — 프롬프트/추출기만 다름)
// ============================================================
app.post('/api/ai/menu-board', async (req, res) => {
  const ip = String(req.ip || 'unknown').split(',')[0].trim();
  const rl = checkAiRateLimit(ip);
  if (!rl.ok) {
    return res.status(429).json({
      error: rl.reason === 'minute'
        ? '잠시 후 다시 시도해 주세요 (분당 4회 제한).'
        : '요청이 너무 빠릅니다. 10초 후 다시 시도해 주세요.',
    });
  }
  const { image } = req.body ?? {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image (data URL) is required' });
  }
  const MAX_IMG_BYTES = 8 * 1024 * 1024;
  const b64Body = image.split(',')[1] ?? '';
  if (Math.floor((b64Body.length * 3) / 4) > MAX_IMG_BYTES) {
    return res.status(413).json({ error: '메뉴판 이미지가 너무 큽니다. 8MB 이하로 줄여 주세요.' });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'invalid image data URL' });
  const mediaType = m[1];
  const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  if (!ALLOWED.has(mediaType)) {
    return res.status(400).json({ error: `unsupported image type: ${mediaType}` });
  }
  const b64 = m[2];
  const systemPrompt = `당신은 한국 식당·카페의 메뉴판(메뉴 보드, 입간판, 인쇄 메뉴, 손글씨 메뉴 포함) 사진에서 판매 메뉴를 빠짐없이 추출합니다. JSON 만 출력합니다.
스키마: { "items": [ { "name": "메뉴 이름", "price": 숫자, "category": "분류" } ] }
규칙:
- 사진에 보이는 모든 개별 메뉴를 한 항목씩 추출한다. 사이즈/옵션(HOT/ICE, R/L)이 한 줄에 묶여 있으면 대표 1개로 만들고 가장 잘 보이는 가격을 price 로 쓴다.
- name: 메뉴 이름만. 가격·단위·설명은 넣지 않는다.
- price: 숫자만. 콤마·₩·"원"·".-" 등은 제거한다. 가격이 안 보이면 0. 보이지 않는 자릿수를 추측해 만들지 않는다.
- category: 메뉴판에 인쇄된 분류 머리글(예: COFFEE, 논커피, 디저트, 브런치)이 있으면 그 이름을 그대로(한글 우선) 사용한다. 머리글이 없으면 메뉴 성격으로 추론한다(라떼·아메리카노→"커피", 에이드·스무디→"논커피", 케이크·쿠키→"디저트"). 같은 묶음 메뉴는 같은 category 문자열을 쓴다.
- 분류가 도저히 불명확하면 category="기타".
- 메뉴가 아닌 문구(가게 이름, 영업시간, 전화번호, 와이파이, 인사말)는 제외한다.
- 확실한 메뉴만 넣고, 없는 메뉴를 지어내지 않는다.`;
  try {
    const apiRes = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: mediaType, data: b64 } },
                { text: '이 메뉴판 사진에서 모든 메뉴를 위 스키마 JSON 으로 추출하세요.' },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
      30000
    );
    if (!apiRes.ok) {
      const t = await apiRes.text();
      throw new Error(`Gemini ${apiRes.status}: ${t.slice(0, 200)}`);
    }
    const data: any = await apiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    // 응답에 텍스트가 없으면(예: API 형식 오류) 빈 메뉴가 아니라 실패로 처리 → 클라가 "빈 메뉴"로 오인하지 않게
    if (typeof text !== 'string') throw new Error('unexpected Gemini response shape');
    return res.json(extractMenuBoard(text));
  } catch (e: any) {
    console.error('[AI menu-board]', e?.message ?? e);
    // 내부 오류 메시지(Gemini 원문 등)를 클라이언트에 노출하지 않음 — 서버 로그로만
    res.status(500).json({ error: '메뉴판 분석에 실패했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

// ============================================================
// AI BUSINESS INSIGHT — 매장 데이터 자연어 분석
// ============================================================
// 사장님이 통계 페이지에서 미리 정의된 질문을 클릭 → 매장 요약 데이터 +
// 질문을 AI 에 전달 → 자연어 분석 답변 반환.
// 데이터 자체는 클라이언트가 요약해서 보냄 (Firebase Admin 으로 다시 읽지 않음 — 비용 절감).

interface InsightIn {
  storeId: string;
  question: string;          // 사장님이 본 질문 문장
  context: {
    storeName?: string;
    period?: string;         // '이번 달' / '지난 7일' 등
    revenue?: number;
    orderCount?: number;
    customerCount?: number;
    topMenus?: Array<{ name: string; count: number; revenue: number }>;
    topCustomers?: Array<{ name?: string; visits: number; lastVisit?: string; totalSpent?: number }>;
    churnedCustomers?: Array<{ name?: string; lastVisit?: string; visits?: number }>;
    hourlyDistribution?: Record<string, number>;
    weekdayDistribution?: Record<string, number>;
    prevPeriodRevenue?: number;
  };
}

// AI 인사이트 IP rate limit — 분당 10회 (도면 분석보다 가벼움)
const aiInsightBuckets = new Map<string, { count: number; resetAt: number }>();
const checkInsightRate = (ip: string): boolean => {
  const now = Date.now();
  const b = aiInsightBuckets.get(ip);
  if (!b || now > b.resetAt) {
    aiInsightBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= 10) return false;
  b.count += 1;
  return true;
};

// AI 출력 언어 — 사장님 UI 언어로 답하도록(4개국어 앱). 미지정 시 한국어.
const LANG_NAME: Record<string, string> = { ko: '한국어', en: 'English', vi: 'Tiếng Việt', zh: '中文' };
const langName = (l: any) => LANG_NAME[String(l)] || '한국어';
const langDirective = (l: any) => `\n[출력 언어] 위 지시와 무관하게 응답 전체를 반드시 ${langName(l)}로만 작성하세요(면책 문구도 그 언어로 번역). 숫자 천단위 콤마·₩ 표기는 유지.`;

// ============================================================
// 세무 AI (TODO 8-3) — 매출·지출 데이터로 절세 관점의 "과정→결과" 설명 생성.
// 참고용 추정만 제공하고, 정확한 신고·절세는 세무사 상담을 권한다(면책 명시).
// ============================================================
app.post('/api/ai/tax', async (req, res) => {
  const ip = String(req.ip || 'unknown').split(',')[0].trim();
  if (!checkInsightRate(ip)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요. (분당 10회 제한)' });
  const { storeName, bizType, period, revenue, orderCount, expenses, lang } = req.body ?? {};
  if (typeof revenue !== 'number' || revenue < 0) return res.status(400).json({ error: 'revenue required' });
  const expSafe = expenses && typeof expenses === 'object' ? expenses : {};
  const won = (n: any) => '₩' + (Number(n) || 0).toLocaleString('en-US');

  const sys = `당신은 한국 소상공인을 돕는 친절한 세무 도우미입니다. 아래 매장 데이터로 절세·감세를 이해하도록 "과정을 단계별로" 보여주고 "결과(개략 추정)"까지 이어지게 설명하세요.
[출력 구조 — 각 단계를 "1) 제목" 형식으로]
1) 매출 정리 — 기간 매출의 의미(부가세 포함/별도 개념 간단히)
2) 비용·공제 정리 — 카테고리별 지출을 경비처리 관점에서 짚기(임대료·인건비·재료비·공과금·광고비는 대표적 필요경비). 누락하기 쉬운 경비 환기
3) 예상 세금(개략) — 부가가치세(일반/간이 구분이 있다는 점)와 종합소득세를 "대략 어떤 과정으로" 계산하는지 보여주고, 단정 없이 범위로 감 잡게(정확한 세율·공제는 사장님 상황마다 다름을 명시)
4) 절세 포인트 3가지 — 이 데이터 기준 실천 가능한 것(적격증빙 수취, 사업용 카드·계좌 분리, 노란우산공제, 경비 누락 방지 등)
5) 신고 준비 체크리스트 — 다음 신고 때 챙길 것 3~4개
[규칙] 쉬운 한국어, 숫자는 천단위 콤마(₩). 마크다운 헤더(#) 금지(단계 제목은 "1) ..."). 확정적 세액 단정·과장 금지. 데이터가 적으면 솔직히 말하기.
마지막 줄에 반드시: "※ 참고용 추정이에요. 정확한 신고·절세는 세무사나 홈택스 상담을 권해드려요."`;
  const user = `매장명: ${String(storeName || '우리 가게').slice(0, 60)} / 업종: ${String(bizType || '일반')} / 기간: ${String(period || '이번 달')}
매출(결제완료): ${won(revenue)} (주문 ${Number(orderCount) || 0}건)
지출(카테고리별): ${Object.entries(expSafe).map(([k, v]) => `${k}=${won(v)}`).join(', ') || '없음'}
위 데이터로 절세 관점의 과정→결과 설명을 작성해 주세요.`;

  try {
    const text = await callLLMText(sys + langDirective(lang), user, 1500);
    if (text === null) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    if (!text.trim()) return res.status(502).json({ error: 'AI_EMPTY' }); // 빈 응답(안전필터·조기종료) → 실패 처리
    return res.json({ text });
  } catch (e: any) {
    console.error('[ai/tax]', e?.message);
    return res.status(502).json({ error: 'AI_CALL_FAILED' });
  }
});

// ============================================================
// 소상공인 지원정보 AI 맞춤 추천 (TODO 8-4) — 업종·지역 기준 신청해볼 만한 지원제도 추천.
// 공고·자격은 수시로 바뀌므로 공식 사이트(소상공인24/기업마당) 확인을 권한다(면책).
// ============================================================
app.post('/api/ai/support', async (req, res) => {
  const ip = String(req.ip || 'unknown').split(',')[0].trim();
  if (!checkInsightRate(ip)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요. (분당 10회 제한)' });
  const { storeName, bizType, region, lang, employeeCount, monthlyRevenue } = req.body ?? {};
  const sys = `당신은 한국 소상공인 지원제도 안내 도우미입니다. 아래 매장 정보를 보고 지금 신청해볼 만한 정부·지자체·공공 지원제도를 "맞춤"으로 추천하세요.
[출력] 3~5개를 "• 제도명 — 한 줄 설명 — 누구에게 좋은지/어떻게 신청" 형식으로. 업종·지역·직원수·매출 규모를 반영(예: 직원 있으면 두루누리, 1인이면 1인 소상공인 고용보험, 매출 적으면 카드수수료 우대). 자격은 공고마다 다르니 단정·과장 금지.
대표 상시 제도(소상공인 정책자금=저금리 융자, 노란우산공제=폐업·노후 대비+소득공제, 두루누리 사회보험료 지원, 카드수수료 우대(영세가맹점), 1인 소상공인 고용보험료 지원, 온누리·지역화폐 가맹, 지자체 소상공인 지원) 중 적합한 것 + 업종 특화가 있으면 함께.
규칙: 쉬운 한국어. 주어진 매장 정보(지역·업종·수치)는 그대로 사용하고, 없는 지역·숫자를 절대 지어내지 말 것. "반드시 받는다"식 확정·과장 금지(자격·금액은 공고마다 다름 명시). 마크다운 헤더(#) 금지.
마지막 줄에 반드시: "※ 공고·자격은 수시로 바뀌어요. 신청 전 소상공인24(sbiz24.kr)·기업마당(bizinfo.go.kr)에서 꼭 확인하세요."`;
  const staff = Number(employeeCount);
  const rev = Number(monthlyRevenue);
  const user = `매장명: ${String(storeName || '우리 가게').slice(0, 60)} / 업종: ${String(bizType || '일반')} / 지역: ${String(region || '미상').slice(0, 40)}`
    + ` / 직원수: ${Number.isFinite(staff) && staff >= 0 ? staff + '명' : '미상'}`
    + ` / 최근 월매출(대략): ${Number.isFinite(rev) && rev > 0 ? '약 ' + Math.round(rev).toLocaleString('ko-KR') + '원' : '미상'}`;
  try {
    const text = await callLLMText(sys + langDirective(lang), user, 1100);
    if (text === null) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
    if (!text.trim()) return res.status(502).json({ error: 'AI_EMPTY' });
    return res.json({ text });
  } catch (e: any) {
    console.error('[ai/support]', e?.message);
    return res.status(502).json({ error: 'AI_CALL_FAILED' });
  }
});

app.post('/api/ai/insight', async (req, res) => {
  // Rate limit
  const ip = String(req.ip || 'unknown').split(',')[0].trim();
  if (!checkInsightRate(ip)) {
    return res.status(429).json({ error: '잠시 후 다시 시도해 주세요. (분당 10회 제한)' });
  }

  const input = req.body as InsightIn;
  if (!input?.question || !input?.context) {
    return res.status(400).json({ error: 'question, context required' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !anthropicKey && !openaiKey) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  }

  const systemPrompt = `
당신은 한국 식당 사장님의 매장 분석 비서입니다.
아래 매장 데이터와 사장님 질문을 보고 친절하고 실용적인 조언을 한국어로 답하세요.

## 답변 규칙
1. 4-60대 사장님도 쉽게 이해할 수 있는 평이한 한국어 사용. 전문 용어 X.
2. 숫자는 한국식 천 단위 콤마 (예: ₩1,234,000).
3. 답변 길이: 200~400자. 너무 길지 않게.
4. 구조: 핵심 결론 한 줄 → 근거 2-3개 → 다음 액션 제안 1개.
5. 손님 이름은 그대로 사용 (예: '홍길동 손님').
6. 데이터가 부족하면 솔직히 '아직 데이터가 부족해요' 라고 말하기.
7. 친근한 어조 ('~네요', '~을 추천드려요').
8. 절대 마크다운 헤더(#) 사용 금지. 일반 줄바꿈만.
9. 이모지는 답변 시작에 1개만 (예: 📈 / ⭐ / 💔).
`.trim() + langDirective((req.body as any)?.lang);

  const userMsg = `매장명: ${input.context.storeName ?? '매장'}
기간: ${input.context.period ?? '최근'}

사장님 질문: "${input.question}"

매장 데이터:
${JSON.stringify(input.context, null, 2)}

위 데이터로 사장님 질문에 답해주세요.`;

  try {
    if (geminiKey) {
      const apiRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
        20000
      );
      if (!apiRes.ok) throw new Error(`Gemini ${apiRes.status}: ${(await apiRes.text()).slice(0, 200)}`);
      const data: any = await apiRes.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      return res.json({ answer });
    }
    if (anthropicKey) {
      const apiRes = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      }, 20000);
      if (!apiRes.ok) throw new Error(`Anthropic ${apiRes.status}: ${(await apiRes.text()).slice(0, 200)}`);
      const data: any = await apiRes.json();
      const answer = data?.content?.[0]?.text?.trim() ?? '';
      return res.json({ answer });
    }
    // OpenAI fallback
    const apiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
      }),
    }, 20000);
    if (!apiRes.ok) throw new Error(`OpenAI ${apiRes.status}: ${(await apiRes.text()).slice(0, 200)}`);
    const data: any = await apiRes.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() ?? '';
    return res.json({ answer });
  } catch (e: any) {
    console.error('[AI insight]', e?.message ?? e);
    res.status(500).json({ error: e?.message ?? 'AI 분석 실패' });
  }
});

function extractJson(text: string): { tables: any[]; structures: any[] } {
  // 모델이 ```json ... ``` 블록으로 감쌀 경우 대비
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 첫 { 부터 마지막 } 까지 슬라이스 — 단, 두 인덱스가 모두 명확한 JSON 객체 경계여야 함
    const i = raw.indexOf('{');
    const j = raw.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
    try { parsed = JSON.parse(raw.slice(i, j + 1)); }
    catch { throw new Error('AI 응답을 JSON 으로 파싱할 수 없습니다.'); }
  }
  // 스키마 가드 — 모델이 다른 모양으로 답해도 클라이언트는 항상 동일한 구조를 받도록
  const tables = Array.isArray(parsed?.tables) ? parsed.tables : [];
  const structures = Array.isArray(parsed?.structures) ? parsed.structures : [];
  return { tables, structures };
}

// ```json 펜스/잡음을 걷어내고 첫 JSON 객체만 파싱 — 실패 시 {} 반환(영수증은 부분값도 살림)
function parseLooseJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    const i = raw.indexOf('{');
    const j = raw.lastIndexOf('}');
    if (i < 0 || j <= i) return {};
    try { return JSON.parse(raw.slice(i, j + 1)); }
    catch { return {}; }
  }
}

// 영수증 AI 응답 정규화 — 클라이언트가 항상 동일한 지출 스키마를 받도록 가드.
// (floor-plan 의 extractJson 은 {tables,structures} 전용이라 영수증엔 쓰면 안 됨)
const RECEIPT_CATEGORIES = new Set(['rent', 'material', 'utility', 'marketing', 'other']);
function extractReceipt(
  text: string,
  fallbackDate: string,
): { amount: number; vendor: string; date: string; category: string; memo: string } {
  const parsed = parseLooseJson(text) ?? {};
  // amount — 숫자/문자(₩·콤마·"원") 혼재 정상화
  let amount = 0;
  const a = parsed?.amount;
  if (typeof a === 'number' && isFinite(a)) amount = Math.max(0, Math.round(a));
  else if (typeof a === 'string') {
    const n = Number(a.replace(/[^0-9.]/g, ''));
    if (isFinite(n)) amount = Math.max(0, Math.round(n));
  }
  // date — YYYY-MM-DD 만 신뢰, 아니면 오늘(KST)
  const date =
    typeof parsed?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : fallbackDate;
  const category = RECEIPT_CATEGORIES.has(parsed?.category) ? parsed.category : 'other';
  const vendor = typeof parsed?.vendor === 'string' ? parsed.vendor.trim().slice(0, 80) : '';
  const memo = typeof parsed?.memo === 'string' ? parsed.memo.trim().slice(0, 200) : '';
  return { amount, vendor, date, category, memo };
}

// 메뉴판 AI 응답 정규화 — 항상 { items: [{name, price, category}] } 로 가드.
// 최상위가 배열일 수도, {items:[...]} 일 수도 있어 parseLooseJson(객체 전용) 대신 별도 처리.
function extractMenuBoard(text: string): { items: { name: string; price: number; category: string }[] } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 배열([..]) 또는 객체({..}) 경계로 슬라이스 재시도 (maxOutputTokens 잘림 대비)
    const s = raw.search(/[[{]/);
    const e = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
    if (s < 0 || e <= s) return { items: [] };
    try { parsed = JSON.parse(raw.slice(s, e + 1)); }
    catch { return { items: [] }; }
  }
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
  const items: { name: string; price: number; category: string }[] = [];
  for (const e of arr) {
    const name = typeof e?.name === 'string' ? e.name.trim().slice(0, 80) : '';
    if (!name) continue;
    // price — 숫자/문자(₩·콤마·"원") 혼재 정상화 (extractReceipt amount 와 동일 로직)
    let price = 0;
    const p = e?.price;
    if (typeof p === 'number' && isFinite(p)) price = Math.max(0, Math.round(p));
    else if (typeof p === 'string') {
      const n = Number(p.replace(/[^0-9.]/g, ''));
      if (isFinite(n)) price = Math.max(0, Math.round(n));
    }
    const category = typeof e?.category === 'string' ? e.category.trim().slice(0, 40) : '';
    items.push({ name, price, category });
    if (items.length >= 60) break; // 과도한 항목 방어
  }
  return { items };
}

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

app.post('/api/print-bridge/issue-code', async (req, res) => {
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

app.post('/api/print-bridge/exchange', async (req, res) => {
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

async function sendPushToOwner(input: PushIn): Promise<{ sent: number; failed: number; }> {
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

app.post('/api/push/send-to-owner', async (req, res) => {
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

// ============================================================
// AI 예약 두뇌 (TODO 6-1) — 전화 AI·외부 음성채널이 호출하는 서버 엔드포인트.
//   /availability : 영업시간·테이블·기존예약으로 빈자리 판단(읽기)
//   /create       : 검증 통과 시 예약 생성 + 테이블 reserved + 사장님 푸시(쓰기)
// 전화 연동 전에 두뇌만 독립 테스트 가능. 서버-서버 호출이므로 공유키(AI_RESERVATION_KEY)로 보호.
// ============================================================
const RES_DURATION_MIN = 90; // 한 예약이 테이블을 점유하는 기본 시간(분)

function hmToMin(hm: string): number {
  const [h, m] = String(hm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minToHm(total: number): string {
  const t = ((total % 1440) + 1440) % 1440; // 0~1439 로 래핑
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
// 영업시간 판단 — 클라이언트 businessHours.ts(단일 진실원) 규칙과 동일하게.
// 자정 넘는 영업(예: 18:00~02:00)·자정 넘는 휴게시간·마감 정각 배제(half-open [open,close))·open24h 우선 처리.
function isStoreOpenAt(owner: any, date: string, time: string): boolean {
  if (owner?.temporarilyClosed) return false;
  const bh = owner?.businessHours;
  if (!bh) return true; // 미설정 = 항상 영업으로 간주
  if (bh.open24h) return true; // 24시간 영업은 closedDates 보다 우선 (client businessHours.ts:67 과 동일)
  if (Array.isArray(bh.closedDates) && bh.closedDates.includes(date)) return false;
  const day = new Date(`${date}T00:00:00`).getDay(); // 0=일
  const wk = bh.weekly?.[day];
  if (!wk || wk.closed) return false;
  const t = hmToMin(time);
  const openM = hmToMin(wk.open ?? '00:00');
  const closeM = hmToMin(wk.close ?? '23:59');
  // 마감 분은 닫힘으로(half-open). 자정 넘김(closeM<=openM)이면 [open,24:00)+[00:00,close).
  const inWindow = closeM <= openM ? t >= openM || t < closeM : t >= openM && t < closeM;
  if (!inWindow) return false;
  if (wk.breakStart && wk.breakEnd) {
    const bs = hmToMin(wk.breakStart);
    const be = hmToMin(wk.breakEnd);
    const inBreak = be <= bs ? t >= bs || t < be : t >= bs && t < be; // 자정 넘는 휴게도 처리
    if (inBreak) return false;
  }
  return true;
}
// 메모리상 빈 테이블 선택 — 요청 시간 ±durationMin 으로 점유 중이지 않은, 인원 충족 최소 테이블.
function pickFreeTable(tables: any[], reservations: any[], time: string, partySize: number, durationMin: number) {
  const reqMin = hmToMin(time);
  const taken = new Set<number>(
    reservations
      .filter((r: any) => r.status === 'confirmed' && Math.abs(hmToMin(r.time) - reqMin) < durationMin)
      .map((r: any) => r.tableNumber)
  );
  return tables
    .filter((tb: any) => tb.type == null || tb.type === 'table' || tb.type === 'room')
    .filter((tb: any) => (tb.seats ?? 0) >= partySize && !taken.has(tb.number))
    .sort((a: any, b: any) => (a.seats ?? 0) - (b.seats ?? 0))[0] ?? null; // 가장 작은 적합 테이블 우선
}
// 한 매장·하루의 테이블·예약을 1회만 조회 (slots 처럼 여러 시간대 반복 검사 시 읽기 비용 절감)
async function loadStoreDay(fs: any, storeId: string, date: string) {
  const [tablesSnap, resSnap] = await Promise.all([
    fs.collection('tables').where('storeId', '==', storeId).get(),
    fs.collection('reservations').where('storeId', '==', storeId).where('date', '==', date).get(),
  ]);
  return {
    tables: tablesSnap.docs.map((d: any) => d.data()),
    reservations: resSnap.docs.map((d: any) => d.data()),
  };
}
async function findFreeTable(
  fs: any,
  storeId: string,
  date: string,
  time: string,
  partySize: number,
  durationMin: number = RES_DURATION_MIN
) {
  const { tables, reservations } = await loadStoreDay(fs, storeId, date);
  return pickFreeTable(tables, reservations, time, partySize, durationMin);
}
/** 매장의 AI 예약 설정 — 활성화 여부 + 점유시간(분). 비활성 매장은 예약 두뇌가 거부. */
function aiReservationConfig(owner: any): { enabled: boolean; durationMin: number } {
  const c = owner?.storeConfig?.aiReservation ?? {};
  return {
    enabled: c.enabled === true,
    durationMin: Math.max(15, Math.min(360, Number(c.durationMin) || RES_DURATION_MIN)),
  };
}

// 다중 제공자 LLM 텍스트 생성 — Gemini→Anthropic→OpenAI 폴백(insight/floor-plan 과 동일 패턴).
// 설정된 키가 하나도 없으면 null 반환(호출부가 503 처리). 대화 이해·문구 생성 전용(예약 확정은 서버가 결정).
async function callLLMText(systemPrompt: string, userMsg: string, maxTokens = 600): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !anthropicKey && !openaiKey) return null; // 키 0개 = 미설정 → 호출부 503
  // 각 제공자를 try/catch 로 감싸 런타임 장애 시 다음 제공자로 폴백. 전부 실패하면 마지막 에러를 throw(호출부 502).
  let lastErr: any;
  if (geminiKey) {
    try {
      const r = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey }, body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          // thinking 끔 — 2.5-flash 는 기본 thinking 이 출력 토큰을 먹어 본문이 잘리고 느려짐. 텍스트 생성엔 불필요.
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
        }) }, 20000);
      if (!r.ok) throw new Error(`Gemini ${r.status}`);
      const d: any = await r.json();
      return d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (e: any) { lastErr = e; console.warn('[callLLMText] gemini fail', e?.message); }
  }
  if (anthropicKey) {
    try {
      const r = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
      }, 20000);
      if (!r.ok) throw new Error(`Anthropic ${r.status}`);
      const d: any = await r.json();
      return d?.content?.[0]?.text?.trim() ?? '';
    } catch (e: any) { lastErr = e; console.warn('[callLLMText] anthropic fail', e?.message); }
  }
  if (openaiKey) {
    try {
      const r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.3, max_tokens: maxTokens, messages: [
          { role: 'system', content: systemPrompt }, { role: 'user', content: userMsg },
        ] }),
      }, 20000);
      if (!r.ok) throw new Error(`OpenAI ${r.status}`);
      const d: any = await r.json();
      return d?.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (e: any) { lastErr = e; console.warn('[callLLMText] openai fail', e?.message); }
  }
  throw lastErr ?? new Error('All LLM providers failed');
}

interface BookInput { date: string; time: string; partySize: number; customerName: string; customerPhone: string; memo?: string; }
type BookResult =
  | { status: 'closed' }
  | { status: 'duplicate'; existing: { date: string; time: string; partySize: number; tableNumber: number } }
  | { status: 'too_large'; maxSeats: number }
  | { status: 'full' }
  | { status: 'ok'; reservation: any };
// 결정론적 예약 처리 — 영업시간·중복·빈자리를 서버가 판단하고 생성한다.
// LLM 이 "예약됐다"를 임의로 말하지 못하게, 실제 booking 은 항상 이 함수가 단일 진실로 수행.
// 읽기(테이블·당일예약) + 판정 + 쓰기(예약·테이블상태)를 한 트랜잭션으로 묶어, 동시 통화가
// 같은 테이블을 동시에 예약하는 더블북을 막는다(충돌 시 Firestore 가 자동 재시도 → 재판정).
async function tryBookReservation(fs: any, owner: any, storeId: string, input: BookInput, durationMin: number): Promise<BookResult> {
  if (!isStoreOpenAt(owner, input.date, input.time)) return { status: 'closed' };
  const normPhone = String(input.customerPhone).replace(/[^\d+]/g, '').slice(0, 20);
  const reqMin = hmToMin(input.time);
  const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result: BookResult = await fs.runTransaction(async (tx: any) => {
    // 트랜잭션 내 읽기는 쓰기보다 먼저. 충돌(읽은 문서가 커밋 전 변경)이면 콜백 전체가 재실행된다.
    const tablesQ = fs.collection('tables').where('storeId', '==', storeId);
    const resQ = fs.collection('reservations').where('storeId', '==', storeId).where('date', '==', input.date);
    const [tablesSnap, resSnap] = await Promise.all([tx.get(tablesQ), tx.get(resQ)]);
    const tables = tablesSnap.docs.map((d: any) => d.data());
    const reservations = resSnap.docs.map((d: any) => d.data());

    // 중복: 같은 번호 + 시간 겹침(±durationMin)만. 같은 날 다른 시간대(점심/저녁)는 허용.
    const dup = reservations.find((r: any) => r.status === 'confirmed'
      && String(r.customerPhone || '').replace(/[^\d+]/g, '') === normPhone
      && Math.abs(hmToMin(r.time) - reqMin) < durationMin);
    if (dup) return { status: 'duplicate', existing: { date: dup.date, time: dup.time, partySize: dup.partySize, tableNumber: dup.tableNumber } } as BookResult;

    // 인원이 매장 최대 수용을 넘으면 '만석'과 구분(어떤 시간/날짜로도 불가).
    const maxSeats = tables
      .filter((tb: any) => tb.type == null || tb.type === 'table' || tb.type === 'room')
      .reduce((mx: number, tb: any) => Math.max(mx, tb.seats ?? 0), 0);
    if (input.partySize > maxSeats) return { status: 'too_large', maxSeats } as BookResult;

    const table = pickFreeTable(tables, reservations, input.time, input.partySize, durationMin);
    if (!table) return { status: 'full' } as BookResult;

    const reservation = {
      id, storeId, date: input.date, time: input.time,
      tableNumber: table.number,
      partySize: input.partySize,
      customerName: String(input.customerName).slice(0, 40),
      customerPhone: normPhone,
      memo: input.memo ? String(input.memo).slice(0, 200) : 'AI 전화 예약',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    tx.set(fs.collection('reservations').doc(id), reservation);
    // 테이블 reserved 전이 (점유 중이면 보호 — 읽어둔 table.status 로 판단, 같은 tx 라 원자적)
    const cur = (table as any).status;
    if (!cur || cur === 'available' || cur === 'setup' || cur === 'reserved') {
      tx.set(fs.collection('tables').doc(`${storeId}_${table.number}`), { status: 'reserved' }, { merge: true });
    }
    return { status: 'ok', reservation } as BookResult;
  });

  // 푸시는 트랜잭션 밖(부수효과 — 재시도/커밋과 분리). 예약 성공 시에만.
  if (result.status === 'ok') {
    try {
      await sendPushToOwner({
        storeId, kind: 'ai-reservation', title: 'AI 전화 예약 접수',
        body: `${input.date} ${input.time} · ${input.partySize}명 · ${result.reservation.customerName} (${result.reservation.tableNumber}번 테이블)`,
        focusUrl: '/biz/owner/reservations', tag: `ai-res-${id}`,
      });
    } catch (e: any) {
      console.warn('[tryBookReservation] push fail', e?.message);
    }
  }
  return result;
}
// Firestore 문서 ID 로 안전한 storeId 인지 — 빈값·슬래시·예약어(__x__)·과도한 길이 차단.
// (잘못된 id 를 .doc() 에 넘기면 Firestore 가 throw → 내부 에러 500 노출되므로 미리 400 으로 거른다.)
function isValidStoreId(id: any): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/') && !/^__.*__$/.test(id);
}
// 공유키 인증 — 미설정 시 503(실수로 공개 방지). 음성채널 webhook 은 x-ai-key 헤더로 호출.
function checkAiReservationAuth(req: any, res: any): boolean {
  const key = process.env.AI_RESERVATION_KEY;
  if (!key) { res.status(503).json({ error: 'AI_RESERVATION_NOT_CONFIGURED' }); return false; }
  if (req.headers['x-ai-key'] !== key) { res.status(401).json({ error: 'invalid key' }); return false; }
  return true;
}
// 예약 대화(/agent) rate limit — 매장당 분당 20회. LLM 호출/장애 증폭 방지(IP 아닌 storeId 기준 — 음성 webhook 은 IP 공유).
const agentBuckets = new Map<string, { count: number; resetAt: number }>();
const checkAgentRate = (storeId: string): boolean => {
  const now = Date.now();
  if (agentBuckets.size > 5000) agentBuckets.clear(); // 메모리 가드
  const b = agentBuckets.get(storeId);
  if (!b || now > b.resetAt) { agentBuckets.set(storeId, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count >= 20) return false;
  b.count += 1;
  return true;
};
// 마케팅 생성 rate limit — 매장당 분당 10회. insight 와 버킷 분리 + storeId 기준이라
// (인증이 없는 엔드포인트라도) 한 매장이 유발할 수 있는 LLM 비용을 매장 단위로 묶는다.
const marketingBuckets = new Map<string, { count: number; resetAt: number }>();
const checkMarketingRate = (storeId: string): boolean => {
  const now = Date.now();
  if (marketingBuckets.size > 5000) marketingBuckets.clear();
  const b = marketingBuckets.get(storeId);
  if (!b || now > b.resetAt) { marketingBuckets.set(storeId, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count >= 10) return false;
  b.count += 1;
  return true;
};

app.post('/api/reservation/availability', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, date, time, partySize } = req.body ?? {};
    if (!isValidStoreId(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) {
      return res.status(400).json({ error: 'storeId, date(YYYY-MM-DD), time(HH:MM) required' });
    }
    const size = Math.max(1, Math.min(99, Number(partySize) || 1));
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled', available: false });
    if (!isStoreOpenAt(owner, date, time)) {
      return res.json({ available: false, reason: 'closed', alternatives: [] });
    }
    const table = await findFreeTable(fs, storeId, date, time, size, durationMin);
    if (table) return res.json({ available: true, tableNumber: table.number, seats: table.seats });
    // 만석 — 같은 날 ±30/60/90분 대안 시간 탐색(영업시간 내 + 빈자리 있는 슬롯)
    const alternatives: string[] = [];
    for (const delta of [30, -30, 60, -60, 90, -90, 120, -120]) {
      const alt = minToHm(hmToMin(time) + delta);
      if (isStoreOpenAt(owner, date, alt) && (await findFreeTable(fs, storeId, date, alt, size, durationMin))) {
        alternatives.push(alt);
        if (alternatives.length >= 3) break;
      }
    }
    return res.json({ available: false, reason: 'full', alternatives });
  } catch (e: any) {
    console.error('[reservation/availability]', e?.message);
    res.status(500).json({ error: e?.message ?? 'availability check failed' });
  }
});

app.post('/api/reservation/create', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, date, time, partySize, customerName, customerPhone, memo } = req.body ?? {};
    if (!isValidStoreId(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '') || !customerName || !customerPhone) {
      return res.status(400).json({ error: 'storeId, date, time, customerName, customerPhone required' });
    }
    const size = Math.max(1, Math.min(99, Number(partySize) || 1));
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled', available: false });

    const result = await tryBookReservation(fs, owner, storeId, { date, time, partySize: size, customerName, customerPhone, memo }, durationMin);
    if (result.status === 'closed') return res.status(409).json({ error: 'closed', available: false });
    if (result.status === 'duplicate') {
      return res.status(409).json({ error: 'duplicate', message: '같은 번호로 비슷한 시간대 예약이 이미 있어요.', existing: result.existing });
    }
    if (result.status === 'too_large') return res.status(409).json({ error: 'too_large', maxSeats: result.maxSeats, available: false });
    if (result.status === 'full') return res.status(409).json({ error: 'full', available: false });
    return res.json({ ok: true, reservation: result.reservation });
  } catch (e: any) {
    console.error('[reservation/create]', e?.message);
    res.status(500).json({ error: e?.message ?? 'reservation create failed' });
  }
});

// 전화번호 → storeId 매핑 — 음성채널이 통화 시작 시 호출해 "어느 매장 예약인지" 식별.
// 가게마다 전화번호가 다르므로(storeConfig.aiReservation.phoneNumber) 이 번호로 매장을 찾는다.
app.post('/api/reservation/resolve-store', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const norm = String(req.body?.phoneNumber || '').replace(/[^\d+]/g, '');
    if (!norm) return res.status(400).json({ error: 'phoneNumber required' });
    const fs = adminApp.firestore();
    const snap = await fs
      .collection('users')
      .where('storeConfig.aiReservation.phoneNumber', '==', norm)
      .limit(5)
      .get();
    const store = snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }))
      .find((u: any) => u.role === 'owner' && u.storeConfig?.aiReservation?.enabled === true);
    if (!store) return res.status(404).json({ matched: false, error: 'store not found or AI disabled' });
    return res.json({
      matched: true,
      storeId: store.id,
      restaurantName: store.restaurantName ?? '',
      greeting: store.storeConfig?.aiReservation?.greeting || '',
    });
  } catch (e: any) {
    console.error('[reservation/resolve-store]', e?.message);
    res.status(500).json({ error: e?.message ?? 'resolve failed' });
  }
});

// 예약 가능 시간대 목록 — AI 가 "○시, ○시 가능해요" 라고 손님에게 대안을 제시할 때 사용.
app.post('/api/reservation/slots', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, date, partySize, intervalMin } = req.body ?? {};
    if (!isValidStoreId(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ error: 'storeId, date(YYYY-MM-DD) required' });
    }
    const size = Math.max(1, Math.min(99, Number(partySize) || 1));
    const step = Math.max(15, Math.min(120, Number(intervalMin) || 30));
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled' });
    // 테이블·당일 예약을 1회만 조회 후, step 간격으로 영업시간을 훑어 빈자리 있는 시간만 수집(최대 20개).
    const { tables, reservations } = await loadStoreDay(fs, storeId, date);
    const slots: string[] = [];
    for (let m = 0; m < 1440 && slots.length < 20; m += step) {
      const time = minToHm(m);
      if (!isStoreOpenAt(owner, date, time)) continue;
      if (pickFreeTable(tables, reservations, time, size, durationMin)) slots.push(time);
    }
    return res.json({ date, partySize: size, slots });
  } catch (e: any) {
    console.error('[reservation/slots]', e?.message);
    res.status(500).json({ error: e?.message ?? 'slots failed' });
  }
});

// ============================================================
// 예약 대화 두뇌 (TODO 6-4) — 벤더 중립. 음성채널(또는 텍스트)이 대화 누적(messages)을 보내면
// LLM 이 발화를 이해해 예약 정보를 모으고 다음 질문을 만든다. 단, 실제 예약 확정은 항상 서버
// (tryBookReservation)가 결정론적으로 수행 — LLM 이 "예약됐다"를 임의로 말하지 못하게 한다.
// 어떤 음성 플랫폼(Vapi/Retell/Twilio+Realtime)을 골라도 이 엔드포인트를 그대로 붙일 수 있다.
// ============================================================
app.post('/api/reservation/agent', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, messages, today } = req.body ?? {};
    if (!isValidStoreId(storeId) || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'storeId, messages[] required' });
    }
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled' });

    const storeName = owner?.restaurantName || '저희 매장';
    const greeting = owner?.storeConfig?.aiReservation?.greeting || `안녕하세요, ${storeName}입니다. 예약 도와드릴까요?`;

    // 정규화된 대화 — role: 'user'(손님) | 'assistant'(AI)
    const convo = messages
      .filter((m: any) => m && typeof m.content === 'string')
      .map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 500) }));
    const userTurns = convo.filter((m: any) => m.role === 'user');
    // 첫 턴(손님 발화 없음) → 인사말만 (LLM 호출 없음 — rate limit 전에 처리)
    if (userTurns.length === 0) return res.json({ reply: greeting, intent: {}, done: false });

    // rate limit (LLM 호출 비용·장애 증폭 방지)
    if (!checkAgentRate(storeId)) {
      return res.status(429).json({ error: 'rate_limited', reply: '잠시만요, 곧 다시 도와드릴게요.' });
    }
    // 대화 턴 상한 — 정보 수렴 실패(LLM 오작동·형식 거부) 시 무한 되묻기 대신 사람 연결로 종료
    if (userTurns.length > 12) {
      return res.json({ reply: '예약 정보를 정확히 확인하기 어려워요. 잠시 후 직원이 직접 도와드릴게요. 감사합니다.', intent: {}, done: true, reason: 'handoff' });
    }

    const todayKst = (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today))
      ? today
      : new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST 오늘

    const sys = `당신은 한국 식당 "${storeName}"의 친절한 전화 예약 접수원입니다. 손님과의 대화에서 예약 정보를 수집하세요.
오늘 날짜: ${todayKst}. 손님이 "내일", "이번주 토요일", "저녁 7시" 처럼 말하면 구체적 날짜(YYYY-MM-DD)와 24시간 시간(HH:MM)으로 변환하세요.
수집 항목: date(YYYY-MM-DD), time(HH:MM, 24시간), partySize(인원 수 정수), customerName(예약자 성함), customerPhone(연락처 숫자).
반드시 아래 JSON 객체 하나만 출력하세요. 그 외 설명·마크다운·코드펜스 금지:
{"date":"","time":"","partySize":0,"customerName":"","customerPhone":"","reply":"손님에게 할 다음 말","allCollected":false}
규칙:
- 아직 모르는 항목은 빈 문자열 또는 0 으로 두세요.
- reply 는 한국어 존댓말 1~2문장. 부족한 항목을 한 번에 하나씩 자연스럽게 물어보세요.
- 모든 항목을 다 알게 되면 allCollected=true 로 하고, reply 는 "잠시만요, 자리 확인해 드릴게요" 같은 짧은 말로 하세요. 예약 확정/완료는 시스템이 판단하므로 절대 "예약됐어요/완료됐어요" 라고 단정하지 마세요.
- 전화번호는 손님이 말한 숫자를 그대로 적으세요(하이픈 유무 무관).`;

    const userMsg = convo.map((m: any) => `${m.role === 'user' ? '손님' : '상담원'}: ${m.content}`).join('\n');

    let text: string | null;
    try {
      text = await callLLMText(sys, userMsg, 500);
    } catch (e: any) {
      console.error('[reservation/agent] llm', e?.message);
      return res.status(502).json({ error: 'AI_CALL_FAILED', reply: '죄송해요, 잠시 통화가 어려워요. 잠시 후 다시 시도해 주세요.' });
    }
    if (text === null) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' }); // 키 미설정
    if (!text.trim()) {
      // 호출은 됐으나 빈 응답 — 손님이 방금 말한 정보를 무시한 듯한 '더 알려주세요' 대신 재시도 유도
      return res.status(502).json({ error: 'AI_EMPTY_RESPONSE', reply: '죄송해요, 잘 못 들었어요. 다시 한 번 말씀해 주시겠어요?' });
    }

    const ext = parseLooseJson(text) || {};
    const intent = {
      date: /^\d{4}-\d{2}-\d{2}$/.test(ext.date || '') ? ext.date : undefined,
      time: /^\d{2}:\d{2}$/.test(ext.time || '') ? ext.time : undefined,
      partySize: Number(ext.partySize) > 0 ? Math.min(99, Math.floor(Number(ext.partySize))) : undefined,
      customerName: ext.customerName ? String(ext.customerName).slice(0, 40) : undefined,
      customerPhone: ext.customerPhone ? String(ext.customerPhone).replace(/[^\d+]/g, '').slice(0, 20) : undefined,
    };
    const haveAll = intent.date && intent.time && intent.partySize && intent.customerName && intent.customerPhone;
    const askReply = (typeof ext.reply === 'string' && ext.reply.trim()) ? ext.reply.trim() : '예약 정보를 조금만 더 알려주세요.';

    // 정보가 아직 부족 → 다음 질문(LLM 문구) 반환
    if (!haveAll) {
      return res.json({ reply: askReply, intent, done: false });
    }

    // 모든 정보 수집됨 → 서버가 결정론적으로 예약 시도
    const result = await tryBookReservation(fs, owner, storeId, intent as BookInput, durationMin);
    if (result.status === 'ok') {
      const r = result.reservation;
      return res.json({
        reply: `예약이 확정됐어요! ${r.date} ${r.time}, ${r.partySize}명, ${r.customerName}님 — ${r.tableNumber}번 테이블로 모실게요. 감사합니다 😊`,
        intent, booked: true, reservation: r, done: true,
      });
    }
    if (result.status === 'duplicate') {
      // 같은 시간대 중복 — 변경/추가는 서버가 처리 못 하므로(엔드포인트 없음) 거짓 약속 대신 매장 안내로 종료.
      const e = result.existing;
      return res.json({
        reply: `같은 번호로 ${e.date} ${e.time} 예약이 이미 있어요. 변경이나 추가 예약은 매장으로 직접 전화 주시면 도와드릴게요. 감사합니다.`,
        intent, done: true, reason: 'duplicate', existing: e,
      });
    }
    if (result.status === 'too_large') {
      // 인원이 최대 테이블 수용을 넘음 — 어떤 시간/날짜로도 불가하니 무의미한 대안 대신 명확히 안내하고 종료.
      return res.json({
        reply: `죄송해요, ${intent.partySize}명을 한 테이블로는 모시기 어려워요(최대 ${result.maxSeats}명). 단체석은 매장으로 직접 문의 부탁드려요.`,
        intent, done: true, reason: 'too_large', maxSeats: result.maxSeats,
      });
    }
    if (result.status === 'closed') {
      return res.json({ reply: `${intent.date} ${intent.time}은 영업시간이 아니에요. 다른 시간은 어떠세요?`, intent, done: false, reason: 'closed' });
    }
    // 만석 → 같은 날 대안 시간 제시 (하루 데이터 1회만 로드 후 메모리상 검사 — N+1 읽기 제거)
    const alts: string[] = [];
    const { tables: dayTables, reservations: dayRes } = await loadStoreDay(fs, storeId, intent.date!);
    for (const delta of [30, -30, 60, -60, 90, -90, 120, -120]) {
      const alt = minToHm(hmToMin(intent.time!) + delta);
      if (isStoreOpenAt(owner, intent.date!, alt) && pickFreeTable(dayTables, dayRes, alt, intent.partySize!, durationMin)) {
        alts.push(alt);
        if (alts.length >= 3) break;
      }
    }
    const reply = alts.length
      ? `${intent.time}은 자리가 다 찼어요. ${alts.join(', ')} 중에는 가능한데, 어느 시간이 좋으세요?`
      : `${intent.date}은 예약이 가득 찼어요. 다른 날짜는 어떠세요?`;
    return res.json({ reply, intent, done: false, reason: 'full', alternatives: alts });
  } catch (e: any) {
    console.error('[reservation/agent]', e?.message);
    res.status(500).json({ error: e?.message ?? 'agent failed' });
  }
});

// ============================================================
// Retell 어댑터 — Retell custom function 형식({ args })을 받아 예약 로직에 연결.
// storeId 는 Retell "Query Parameters"(가게별 고정값)로 받아 LLM 이 못 건드린다.
// 사업 결과(closed/full/duplicate/too_large)는 200 + ok/available:false 로 돌려줘
// Retell LLM 이 에러가 아닌 정상 도구 응답으로 읽고 손님에게 안내하게 한다.
// ============================================================
function retellArgs(req: any): any {
  const b = req.body ?? {};
  return b && typeof b.args === 'object' && b.args ? b.args : b; // { args } 형식 우선, flat 도 허용
}

app.post('/api/retell/availability', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const storeId = String(req.query.storeId || '');
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId(query) required' });
    const a = retellArgs(req);
    const date = String(a.date || '');
    const time = String(a.time || '');
    const size = Math.max(1, Math.min(99, Number(a.partySize) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.json({ available: false, message: '날짜(YYYY-MM-DD)와 시간(HH:MM) 형식이 필요해요.' });
    }
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled' });
    if (!isStoreOpenAt(owner, date, time)) return res.json({ available: false, reason: 'closed' });
    const table = await findFreeTable(fs, storeId, date, time, size, durationMin);
    if (table) return res.json({ available: true, tableNumber: table.number });
    const { tables, reservations } = await loadStoreDay(fs, storeId, date);
    const alternatives: string[] = [];
    for (const delta of [30, -30, 60, -60, 90, -90, 120, -120]) {
      const alt = minToHm(hmToMin(time) + delta);
      if (isStoreOpenAt(owner, date, alt) && pickFreeTable(tables, reservations, alt, size, durationMin)) {
        alternatives.push(alt);
        if (alternatives.length >= 3) break;
      }
    }
    return res.json({ available: false, reason: 'full', alternatives });
  } catch (e: any) { console.error('[retell/availability]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

app.post('/api/retell/slots', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const storeId = String(req.query.storeId || '');
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId(query) required' });
    const a = retellArgs(req);
    const date = String(a.date || '');
    const size = Math.max(1, Math.min(99, Number(a.partySize) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.json({ slots: [], message: '날짜(YYYY-MM-DD)가 필요해요.' });
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled' });
    const { tables, reservations } = await loadStoreDay(fs, storeId, date);
    const slots: string[] = [];
    for (let m = 0; m < 1440 && slots.length < 20; m += 30) {
      const time = minToHm(m);
      if (isStoreOpenAt(owner, date, time) && pickFreeTable(tables, reservations, time, size, durationMin)) slots.push(time);
    }
    return res.json({ date, slots });
  } catch (e: any) { console.error('[retell/slots]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

app.post('/api/retell/book', async (req, res) => {
  try {
    if (!checkAiReservationAuth(req, res)) return;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const storeId = String(req.query.storeId || '');
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId(query) required' });
    const a = retellArgs(req);
    const date = String(a.date || '');
    const time = String(a.time || '');
    const size = Math.max(1, Math.min(99, Number(a.partySize) || 1));
    const customerName = String(a.customerName || '').trim();
    const customerPhone = String(a.customerPhone || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !customerName || !customerPhone) {
      return res.json({ ok: false, error: 'missing', message: '날짜·시간·인원·성함·연락처가 모두 필요해요.' });
    }
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data();
    const { enabled, durationMin } = aiReservationConfig(owner);
    if (!enabled) return res.status(403).json({ error: 'ai_disabled' });
    const result = await tryBookReservation(fs, owner, storeId, { date, time, partySize: size, customerName, customerPhone }, durationMin);
    if (result.status === 'ok') return res.json({ ok: true, date, time, partySize: size, tableNumber: result.reservation.tableNumber, customerName });
    if (result.status === 'duplicate') return res.json({ ok: false, error: 'duplicate', existing: result.existing });
    if (result.status === 'too_large') return res.json({ ok: false, error: 'too_large', maxSeats: result.maxSeats });
    if (result.status === 'closed') return res.json({ ok: false, error: 'closed' });
    return res.json({ ok: false, error: 'full' });
  } catch (e: any) { console.error('[retell/book]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

// ============================================================
// 마케팅 자율 에이전트 — 콘텐츠 생성 (TODO 7-2)
// 매장 마케팅 프로필(톤·타깃·키워드·금지어)을 반영해 게시물/응대 초안 텍스트를 생성한다.
// 서버는 '텍스트만' 만들고, 실제 초안 저장은 클라이언트가 addMarketingDraft(source:'agent')로
// 'draft' 상태로 넣는다 → 승인 게이트 유지. 금지어 포함 시 bannedHit 로 알려 승인 전에 검토하게 한다.
// ============================================================
app.post('/api/marketing/generate', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, channel, kind, topic, reviewText, rating, lang } = req.body ?? {};
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId required' });
    // 매장당 분당 10회 (storeId 기준 — 인증 없는 엔드포인트라도 매장 단위로 LLM 비용을 묶음)
    if (!checkMarketingRate(storeId)) {
      return res.status(429).json({ error: '잠시 후 다시 시도해 주세요. (분당 10회 제한)' });
    }
    const ch: string = ['instagram', 'naverPlace', 'general'].includes(channel) ? channel : 'instagram';
    const kd: string = kind === 'reply' ? 'reply' : 'post';

    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data() as any;
    const m = owner?.storeConfig?.marketingAgent ?? {};
    if (m.enabled !== true) return res.status(403).json({ error: 'marketing_disabled' });

    const storeName = owner?.restaurantName || '우리 가게';
    const industry = owner?.storeConfig?.industry || 'general';
    const channelLabel = ch === 'instagram' ? '인스타그램' : ch === 'naverPlace' ? '네이버플레이스' : '일반 SNS';
    const banned = String(m.bannedWords || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    const toneLine = m.tone || '친근하고 따뜻하게';
    const targetLine = m.target || '동네 손님';
    const kwLine = m.keywords || '(없음)';
    const banLine = banned.length ? banned.join(', ') : '(없음)';
    // 평문 캡션 출력(JSON 강제 X) — LLM 이 자연스럽게 쓰게 해 품질↑, JSON 파싱 실패로 원문 노출되는 사고 방지.
    const sys = kd === 'post'
      ? `당신은 한국 동네 상권을 가장 잘 아는 SNS 마케팅 전문가입니다. 매장 "${storeName}"(업종: ${industry})의 ${channelLabel} 홍보 게시물 캡션을 씁니다.
목표: 읽는 사람이 "가보고 싶다 / 주문하고 싶다"는 마음이 들어 실제 방문·주문으로 이어지게.
[작성 구조]
1) 첫 줄: 시선을 확 끄는 후킹 한 문장 (질문·공감·한정·강렬한 감각 묘사 중 하나).
2) 본문: 메뉴·분위기·혜택을 오감(맛·향·식감·온도·소리)과 구체적 디테일로 생생하게. 2~4문장.
3) 마무리: 명확한 행동 유도(방문·주문·예약·저장) + 넛지 1가지(영업시간·한정 수량·위치 등).
4) 해시태그: 한 줄 띄우고 8~12개. 브랜드 + 동네/지역 + 업종/메뉴 + 상황(데이트·혼밥·점심 등) 섞어서.
[반영] 말투/톤: ${toneLine} · 타깃: ${targetLine} · 강조 키워드: ${kwLine}
[금지어(절대 사용 금지)]: ${banLine}
[규칙] 자연스러운 한국어. 이모지는 1~4개만 자연스럽게. 줄바꿈으로 읽기 쉽게. 과장·허위·의학적 효능 주장 금지.
출력은 게시물 캡션 본문만 — 설명·머리말·따옴표·코드펜스·JSON 절대 금지.`
      : `당신은 매장 "${storeName}"(업종: ${industry}) 사장님을 대신해 손님 리뷰/문의에 답하는 전문가입니다.
따뜻하고 진심 어리되 전문적인 답글을 쓰세요: 감사 인사 + 리뷰의 구체적 내용에 공감/언급 + (낮은 평점이면) 정중한 사과와 구체적 개선 약속 + 재방문 초대. 2~4문장.
변명·논쟁·복붙 느낌 금지. 말투/톤: ${toneLine}. 금지어(절대 금지): ${banLine}.
출력은 답글 본문만 — 설명·따옴표·코드펜스·JSON 절대 금지.`;
    let userMsg: string;
    if (kd === 'reply' && reviewText && String(reviewText).trim()) {
      // 리뷰 응대 초안 (7-5) — 실제 손님 리뷰에 답하는 초안
      const stars = Number(rating) >= 1 && Number(rating) <= 5 ? `${Math.round(Number(rating))}점` : '평점 없음';
      userMsg = `아래 손님 리뷰에 답하는 사장님 답글을 작성해 주세요.\n[별점] ${stars}\n[리뷰] ${String(reviewText).trim().slice(0, 600)}`;
    } else if (topic && String(topic).trim()) {
      userMsg = `이번 게시물 주제/소재: ${String(topic).trim().slice(0, 200)}`;
    } else {
      userMsg = kd === 'post' ? '오늘 올릴 만한, 매력적인 홍보 게시물 캡션을 만들어 주세요.' : '손님 리뷰/문의에 대한 정중한 응대 초안을 만들어 주세요.';
    }

    let text: string | null;
    try {
      text = await callLLMText(sys + langDirective(lang), userMsg, 900);
    } catch (e: any) {
      console.error('[marketing/generate] llm', e?.message);
      return res.status(502).json({ error: 'AI_CALL_FAILED' });
    }
    if (text === null) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });

    // 기대: 평문 캡션. 혹시 JSON/코드펜스로 감싸 오면 견고하게 content 추출(원문 JSON 노출 사고 방지).
    let content = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    if (content.startsWith('{')) {
      const parsed = parseLooseJson(content);
      if (parsed && typeof parsed.content === 'string' && parsed.content.trim()) {
        let c = String(parsed.content).trim();
        const tags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((tg: any) => typeof tg === 'string') : [];
        if (kd === 'post' && tags.length && !/#/.test(c)) {
          c += '\n\n' + tags.map((tg: string) => (tg.startsWith('#') ? tg : `#${tg.replace(/\s+/g, '')}`)).join(' ');
        }
        content = c;
      } else {
        // JSON.parse 실패(본문에 줄바꿈 등)해도 원문 JSON 노출 방지 — content 필드 값을 관대하게 추출
        const mm = content.match(/"content"\s*:\s*"([\s\S]*?)"\s*[,}]/);
        if (mm) content = mm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, ' ').trim();
      }
    }
    // 모델이 캡션을 따옴표로 감싸는 경우 양끝 제거
    content = content.replace(/^["'“”]+/, '').replace(/["'“”]+$/, '').trim().slice(0, 2000);
    if (!content) return res.status(502).json({ error: 'AI_EMPTY' });
    // 제목 = 첫 의미있는 줄(해시태그/기호 제외)에서 추출, 목록 표시용.
    const firstLine = content.split('\n').map((s) => s.trim()).find((s) => s && !s.startsWith('#')) || content;
    const title = firstLine.replace(/[#*_`>]/g, '').trim().slice(0, 40) || undefined;
    // 금지어 가드(7-7) — 자동 제거 대신 표시해 승인 전 사람이 검토하도록.
    const bannedHit = banned.filter((b: string) => content.includes(b));
    return res.json({ title, content, channel: ch, kind: kd, bannedHit });
  } catch (e: any) {
    console.error('[marketing/generate]', e?.message);
    res.status(500).json({ error: e?.message ?? 'generate failed' });
  }
});

// ============================================================
// 마케팅 채널 발행 (TODO 7-4) — Zernio 소셜 발행 대행 API로 인스타그램 게시.
// 매장별 Zernio 계정(storeConfig.publishing.instagramAccountId)으로 발행. ZERNIO_API_KEY 는 결 플랫폼 공용.
// 인스타는 미디어(이미지) 필수 — imageUrl(공개 URL) 없으면 거부. 승인된 초안만 클라이언트가 호출.
// ============================================================
// 결 요금제(향후): 채널 무료 1개 / ₩10,000=3개 / 그 이상 구독제 · 자동홍보 프로 ₩25,000(3개)·맥스 ₩40,000(무제한).
// 베타 기간에는 전부 무료 — 과금 게이트는 MARKETING_BILLING='on' 일 때만 적용(기본 off).
const MARKETING_BILLING_ENFORCED = process.env.MARKETING_BILLING === 'on';
const PLAN_PRO_PRICE_KRW = 10000;
const FREE_CHANNEL_LIMIT = 1;
const SUPPORTED_PLATFORMS = ['instagram', 'googlebusiness'];
// 매장에 연결된 채널 목록 — 신규 channels 맵 + (구) 단일 인스타 필드 호환.
function connectedChannels(owner: any): Array<{ platform: string; accountId: string; username?: string }> {
  const pub = owner?.storeConfig?.publishing ?? {};
  const out: Array<{ platform: string; accountId: string; username?: string }> = [];
  const ch = pub.channels && typeof pub.channels === 'object' ? pub.channels : {};
  for (const [platform, v] of Object.entries(ch)) {
    const acc = (v as any)?.accountId;
    if (acc) out.push({ platform, accountId: String(acc), username: (v as any)?.username });
  }
  // 구 단일 인스타 호환 (channels.instagram 없을 때만)
  if (pub.instagramAccountId && !(ch as any).instagram) out.push({ platform: 'instagram', accountId: String(pub.instagramAccountId), username: pub.instagramUsername });
  return out;
}

type MediaItem = { type: 'image' | 'video'; url: string };
async function zernioPublish(content: string, mediaItems: MediaItem[], platforms: Array<{ platform: string; accountId: string }>): Promise<{ ok: boolean; error?: string; data?: any; status?: number }> {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) return { ok: false, error: 'ZERNIO_NOT_CONFIGURED' };
  if (!platforms.length) return { ok: false, error: 'no_channels' };
  if (!mediaItems.length) return { ok: false, error: 'image_required' };
  const r = await fetchWithTimeout('https://zernio.com/api/v1/posts', {
    method: 'POST',
    // x-request-id: 매 호출 새 UUID — ~5분 재시도 멱등성. 24h 내 동일 콘텐츠 재발행은 Zernio 가 409.
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'x-request-id': randomUUID() },
    body: JSON.stringify({
      content: content.slice(0, 2200), // 인스타 캡션 최대 2200자
      // 1개=단일 / 2~10개=캐러셀(자동, 별도 flag 불필요) / [{type:'video'}]=릴스(세로 9:16 자동 릴스)
      mediaItems,
      platforms, // [{platform:'instagram',accountId}, ...] — 한 번에 여러 채널 발행
      publishNow: true,
    }),
  }, 30000);
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: data?.error || data?.message || `zernio ${r.status}`, data, status: r.status };
  return { ok: true, data };
}

app.post('/api/marketing/publish', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, content, imageUrl, photoId, photoIds, videoUrl, platforms } = req.body ?? {};
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId required' });
    if (!checkMarketingRate(storeId)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요. (분당 10회 제한)' });
    if (!content || !String(content).trim()) return res.status(400).json({ error: 'content_required' });
    if (!process.env.ZERNIO_API_KEY) return res.status(503).json({ error: 'ZERNIO_NOT_CONFIGURED' });
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data() as any;
    let targets = connectedChannels(owner);
    // 요청에 특정 채널만 지정되면 그것만 (연결된 것 중에서)
    if (Array.isArray(platforms) && platforms.length) {
      const want = new Set(platforms.map((p: any) => String(p)));
      targets = targets.filter((t) => want.has(t.platform));
    }
    if (!targets.length) return res.status(400).json({ error: 'no_channel_connected' });
    // 미디어 구성: 영상(릴스) > 사진 여러 장(캐러셀) > 사진 1장 / imageUrl(호환).
    // photoId/photoIds 는 우리 서버가 그 매장 사진을 공개 이미지로 서빙하는 URL(base64 → 공개 URL).
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
    const toImgUrl = (id: string) => `${proto}://${req.get('host')}/api/marketing/image/${encodeURIComponent(id)}?storeId=${encodeURIComponent(storeId)}`;
    let mediaItems: MediaItem[] = [];
    if (videoUrl && /^https:\/\/.+/i.test(String(videoUrl))) {
      mediaItems = [{ type: 'video', url: String(videoUrl) }]; // 릴스 — 공개 HTTPS 영상 URL (Zernio 가 직접 fetch)
    } else if (Array.isArray(photoIds) && photoIds.length) {
      const ids = [...new Set(photoIds.filter((id: any) => typeof id === 'string' && isValidStoreId(id)))].slice(0, 10); // 중복 제거 후 인스타 캐러셀 최대 10장
      mediaItems = ids.map((id: string) => ({ type: 'image' as const, url: toImgUrl(id) }));
    } else if (photoId && typeof photoId === 'string' && isValidStoreId(photoId)) {
      mediaItems = [{ type: 'image', url: toImgUrl(photoId) }]; // 단일(기존 호환)
    } else if (imageUrl && /^https:\/\/.+/i.test(String(imageUrl))) {
      mediaItems = [{ type: 'image', url: String(imageUrl) }]; // 단일 URL(기존 호환, 공개 HTTPS만)
    }
    if (!mediaItems.length) return res.status(400).json({ error: 'image_required' });
    // 캐러셀(여러 장)·릴스(영상)는 인스타만 — 구글 비즈니스는 1장·영상 미지원.
    const isVideo = mediaItems.some((m) => m.type === 'video');
    if (isVideo || mediaItems.length > 1) targets = targets.filter((t) => t.platform === 'instagram');
    if (!targets.length) return res.status(400).json({ error: isVideo ? 'reel_needs_instagram' : 'carousel_needs_instagram' });
    const r = await zernioPublish(String(content), mediaItems, targets.map((t) => ({ platform: t.platform, accountId: t.accountId })));
    if (!r.ok) {
      const code = r.error === 'ZERNIO_NOT_CONFIGURED' ? 503 : r.status === 409 ? 409 : 502;
      return res.status(code).json({ error: r.status === 409 ? 'duplicate' : (r.error || 'publish_failed') });
    }
    return res.json({ ok: true, result: r.data, channels: targets.map((t) => t.platform) });
  } catch (e: any) { console.error('[marketing/publish]', e?.message); res.status(500).json({ error: e?.message ?? 'publish failed' }); }
});

// 매장 사진(photos.imageData base64)을 공개 이미지 바이트로 서빙 — Zernio 가 인스타 발행 시 이 URL 을 fetch.
// (base64 data URL 은 Zernio 가 못 가져오므로, 우리 서버가 실제 이미지로 변환해 공개 URL 제공.)
app.get('/api/marketing/image/:photoId', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).end();
    const photoId = String(req.params.photoId || '');
    const storeId = String(req.query.storeId || '');
    if (!isValidStoreId(photoId) || !isValidStoreId(storeId)) return res.status(400).end();
    const snap = await adminApp.firestore().collection('photos').doc(photoId).get();
    if (!snap.exists) return res.status(404).end();
    const pdata = snap.data() as any;
    if (pdata?.storeId !== storeId) return res.status(404).end(); // 매장 경계 강제 — 타매장 사진 IDOR 차단
    const img = pdata?.imageData;
    if (typeof img !== 'string') return res.status(404).end();
    const m = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) return res.status(404).end();
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(Buffer.from(m[2], 'base64'));
  } catch (e: any) { console.error('[marketing/image]', e?.message); res.status(500).end(); }
});

// ============================================================
// 가게 공개 브랜드 사이트 데이터 (TODO 8-2) — 로그인 없이 고객이 보는 매장 사이트.
// 서버가 "공개해도 되는 필드만" 선별해 반환(개인정보 최소화: 리뷰는 이름 첫 글자만, 연락처는 매장 대표번호만).
// 이미지는 기존 공개 이미지 서빙(/api/marketing/image/:photoId) 재사용.
// ============================================================
app.get('/api/site/:storeId', async (req, res) => {
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

// ============================================================
// 소셜 채널 셀프 연결 (TODO 7-4) — 각 사장님이 결 안에서 자기 채널(인스타·구글 비즈니스)을 직접 연결.
//  1) connect-url: 매장 전용 Zernio 프로필 확보 → OAuth authUrl 반환(사장님이 자기 계정 로그인·허용)
//                   2번째 채널부터는 결 Pro 요금제(월 ₩10,000) 필요 — free 면 402 upgrade_required
//  2) connect-finish: OAuth 후 그 프로필의 해당 채널 계정 id 를 storeConfig.publishing.channels 에 자동 저장
//  3) disconnect: 연결 해제(우리 쪽 매핑 제거)
// 사장님은 Zernio 대시보드/계정id 를 볼 필요 없음.
// ============================================================
async function zernioApi(method: string, path: string, body?: any): Promise<{ ok: boolean; status: number; data: any }> {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) return { ok: false, status: 503, data: { error: 'ZERNIO_NOT_CONFIGURED' } };
  const r = await fetchWithTimeout(`https://zernio.com/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, 30000);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
// storeConfig.publishing.* 만 안전하게 갱신 (Admin set merge — 다른 storeConfig 필드 보존; 중첩 map 은 deep-merge)
async function savePublishing(fs: any, storeId: string, patch: Record<string, any>) {
  await fs.collection('users').doc(storeId).set({ storeConfig: { publishing: patch } }, { merge: true });
}
// Zernio /accounts 의 platform 문자열이 우리 platform 키와 같은 채널인지 (구글은 표기 변형 흡수)
function zernioAccountMatches(accPlatform: string, ours: string): boolean {
  const p = String(accPlatform || '').toLowerCase().replace(/[_-]/g, '');
  if (ours === 'instagram') return p === 'instagram';
  if (ours === 'googlebusiness') return p === 'googlebusiness' || p === 'google' || p === 'gmb' || p === 'googlemybusiness';
  return p === ours;
}

app.post('/api/marketing/connect-url', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, platform, redirectUrl } = req.body ?? {};
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId required' });
    if (!SUPPORTED_PLATFORMS.includes(String(platform))) return res.status(400).json({ error: 'unsupported_platform' });
    if (!checkMarketingRate(storeId)) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요.' });
    if (!process.env.ZERNIO_API_KEY) return res.status(503).json({ error: 'ZERNIO_NOT_CONFIGURED' });
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data() as any;
    // 요금제 게이트(베타엔 off): 이미 연결된 다른 채널이 있고(=2번째 채널) free 면 Pro 필요
    const plan = owner?.storeConfig?.plan === 'pro' ? 'pro' : 'free';
    const existing = connectedChannels(owner);
    const already = existing.some((c) => c.platform === platform);
    if (MARKETING_BILLING_ENFORCED && !already && existing.length >= FREE_CHANNEL_LIMIT && plan !== 'pro') {
      return res.status(402).json({ error: 'upgrade_required', plan, priceKrw: PLAN_PRO_PRICE_KRW, freeLimit: FREE_CHANNEL_LIMIT });
    }
    let profileId = owner?.storeConfig?.publishing?.zernioProfileId;
    if (!profileId) {
      // 매장 전용 프로필 생성 (각 가게의 소셜 계정을 묶는 단위)
      const created = await zernioApi('POST', '/profiles', { name: String(owner?.restaurantName || storeId).slice(0, 60), description: `gyeol:${storeId}` });
      profileId = created.data?._id || created.data?.profile?._id || created.data?.id;
      if (!created.ok || !profileId) return res.status(502).json({ error: 'profile_create_failed' });
      await savePublishing(fs, storeId, { zernioProfileId: profileId });
    }
    // redirect_url: OAuth 완료 후 Zernio 대시보드(로그인 벽) 대신 우리 앱으로 복귀 → ?connected={platform}&accountId=...&username=...
    let connectPath = `/connect/${platform}?profileId=${encodeURIComponent(profileId)}`;
    if (redirectUrl && /^https:\/\/.+/i.test(String(redirectUrl)) && String(redirectUrl).length < 500) {
      connectPath += `&redirect_url=${encodeURIComponent(String(redirectUrl))}`;
    }
    const conn = await zernioApi('GET', connectPath);
    const authUrl = conn.data?.authUrl || conn.data?.url;
    if (!conn.ok || !authUrl) return res.status(502).json({ error: 'connect_url_failed' });
    return res.json({ authUrl });
  } catch (e: any) { console.error('[connect-url]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

app.post('/api/marketing/connect-finish', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, platform } = req.body ?? {};
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId required' });
    if (!SUPPORTED_PLATFORMS.includes(String(platform))) return res.status(400).json({ error: 'unsupported_platform' });
    if (!process.env.ZERNIO_API_KEY) return res.status(503).json({ error: 'ZERNIO_NOT_CONFIGURED' });
    const fs = adminApp.firestore();
    const ownerSnap = await fs.collection('users').doc(storeId).get();
    if (!ownerSnap.exists) return res.status(404).json({ error: 'store not found' });
    const owner = ownerSnap.data() as any;
    const profileId = owner?.storeConfig?.publishing?.zernioProfileId;
    if (!profileId) return res.status(400).json({ error: 'no_profile' });
    const list = await zernioApi('GET', '/accounts');
    if (!list.ok) return res.status(502).json({ error: 'accounts_failed' });
    const accounts: any[] = Array.isArray(list.data?.accounts) ? list.data.accounts : [];
    const acc = accounts
      .filter((a) => zernioAccountMatches(a.platform, String(platform)) && (a.profileId?._id === profileId || a.profileId === profileId))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    if (!acc) return res.json({ connected: false }); // 아직 OAuth 미완료
    const username = acc?.metadata?.profileData?.username || acc?.metadata?.profileData?.name || acc?.displayName || '';
    await savePublishing(fs, storeId, { channels: { [String(platform)]: { accountId: acc._id, username } } });
    return res.json({ connected: true, platform, username, accountId: acc._id });
  } catch (e: any) { console.error('[connect-finish]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

app.post('/api/marketing/disconnect', async (req, res) => {
  try {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(503).json({ error: 'FIREBASE_ADMIN_NOT_CONFIGURED' });
    const { storeId, platform } = req.body ?? {};
    if (!isValidStoreId(storeId)) return res.status(400).json({ error: 'storeId required' });
    if (!SUPPORTED_PLATFORMS.includes(String(platform))) return res.status(400).json({ error: 'unsupported_platform' });
    const fs = adminApp.firestore();
    const del = admin.firestore.FieldValue.delete();
    const patch: Record<string, any> = { channels: { [String(platform)]: del } };
    // 인스타는 구 단일 필드도 같이 제거(호환 fallback 이 남지 않도록)
    if (platform === 'instagram') { patch.instagramAccountId = del; patch.instagramUsername = del; }
    await fs.collection('users').doc(storeId).set({ storeConfig: { publishing: patch } }, { merge: true });
    return res.json({ ok: true });
  } catch (e: any) { console.error('[disconnect]', e?.message); res.status(500).json({ error: e?.message ?? 'failed' }); }
});

// --- ORDER STATUS WEBHOOK (from Foodtech or internal) ---
app.post('/api/webhook/order-status', async (req, res) => {
  const { orderId, status, timestamp } = req.body;
  console.log(`[Webhook] Order ${orderId} status changed to: ${status} at ${timestamp || new Date().toISOString()}`);
  
  // Note: In this architecture, Firestore updates are handled client-side via the store.
  // This webhook endpoint is for external POS systems (e.g., Foodtech) to notify status changes.
  // If Firebase Admin SDK is configured, server-side updates can be added here.
  
  res.json({ received: true, orderId, status });
});

// --- MARKETING AUTOMATION (생일/이탈 쿠폰 자동 발급) ---
// 각 매장의 marketingTriggers 에 따라 발급. 중복 방지: 같은 type available 보유 시 skip → 매일 돌아도 1장만.
async function runMarketingAutomation(db: any): Promise<{ birthdayIssued: number; winbackIssued: number; capped: number }> {
    // KST(UTC+9) 기준 오늘 — 생일/경과일 판정
    const kstMs = Date.now() + 9 * 3600 * 1000;
    const kst = new Date(kstMs);
    const todayMMDD = `${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;

    const usersSnap = await db.collection('users').get();
    const userById = new Map<string, any>();
    const owners: any[] = [];
    usersSnap.docs.forEach((d) => {
      const u = { id: d.id, ...(d.data() as any) };
      userById.set(d.id, u);
      if (u.role === 'owner') owners.push(u);
    });

    let birthdayIssued = 0;
    let winbackIssued = 0;
    let capped = 0;

    for (const owner of owners) {
      const triggers = owner.storeConfig?.marketingTriggers ?? {};
      if (!triggers.birthdayCoupon && !triggers.inactiveDays) continue;
      const storeId = owner.id;
      try {
        // 매장 손님별 마지막 방문일
        const visitsSnap = await db.collection('visits').where('storeId', '==', storeId).get();
        const lastVisit = new Map<string, string>();
        visitsSnap.docs.forEach((v) => {
          const d = v.data() as any;
          const prev = lastVisit.get(d.customerId);
          if (!prev || d.date > prev) lastVisit.set(d.customerId, d.date);
        });
        if (lastVisit.size === 0) continue;

        // 기존 available 쿠폰 — 중복 발급 방지
        const cpSnap = await db
          .collection('coupons')
          .where('storeId', '==', storeId)
          .where('status', '==', 'available')
          .get();
        const held = new Set<string>();
        cpSnap.docs.forEach((c) => {
          const d = c.data() as any;
          held.add(`${d.customerId}|${d.type}`);
        });

        const winbackCutoff = triggers.inactiveDays
          ? new Date(kstMs - triggers.inactiveDays * 86400000).toISOString().slice(0, 10)
          : null;

        let batch = db.batch();
        let n = 0;
        const pushTargets: Array<{ cid: string; type: string }> = [];
        const issue = (cid: string, type: string, descKey: string) => {
          const ref = db.collection('coupons').doc();
          batch.set(ref, {
            id: ref.id,
            customerId: cid,
            storeId,
            type,
            description: '',
            descKey,
            status: 'available',
            issuedAt: new Date().toISOString(),
          });
          n++;
          pushTargets.push({ cid, type });
        };

        for (const [cid, last] of lastVisit) {
          if (n >= 450) { await batch.commit(); batch = db.batch(); n = 0; capped++; } // 450 단위 chunk 커밋 — 대형 매장도 누락 없이 전량 처리
          const u = userById.get(cid);
          if (!u) continue;
          if (
            triggers.birthdayCoupon &&
            u.birthday &&
            String(u.birthday).slice(5) === todayMMDD &&
            !held.has(`${cid}|birthday`)
          ) {
            issue(cid, 'birthday', 'coupon.birthday');
            birthdayIssued++;
          }
          if (winbackCutoff && last < winbackCutoff && !held.has(`${cid}|winback`)) {
            issue(cid, 'winback', 'coupon.winback');
            winbackIssued++;
          }
        }
        if (n > 0) await batch.commit();

        // 발급받은 손님에게 쿠폰 도착 푸시(도달 보강). 토큰 미등록 손님은 자동 스킵(sent:0).
        const storeName = owner.restaurantName || '단골 매장';
        for (const tgt of pushTargets) {
          const title = tgt.type === 'birthday'
            ? '🎂 생일 축하 쿠폰이 도착했어요'
            : '🎁 다시 만나요, 쿠폰이 도착했어요';
          await sendPushToOwner({
            storeId: tgt.cid, // 손님 users 문서로 발송(필드명만 storeId)
            kind: 'coupon-issued',
            title,
            body: `${storeName}에서 보낸 혜택을 쿠폰함에서 확인해보세요`,
            focusUrl: '/customer',
          });
        }
      } catch (e: any) {
        console.error(`[marketing-cron] store ${storeId} failed`, e?.message);
      }
    }

    console.log(`[marketing-cron] birthday=${birthdayIssued} winback=${winbackIssued} capped=${capped}`);
    return { birthdayIssued, winbackIssued, capped };
}

// 외부 cron(cron-job.org 등)이 매일 호출. 무료 cron 타임아웃·cold start 와 무관하도록
// 기본은 즉시 응답 후 백그라운드에서 발급 진행. ?sync=1 이면 동기 실행해 결과 반환(수동 테스트용).
// GET·POST 모두 허용 — cron 서비스가 method 설정을 못 바꿔도 동작(보안은 x-cron-secret 헤더).
app.all('/api/cron/marketing', async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const adminApp = getFirebaseAdmin();
  if (!adminApp) return res.status(500).json({ error: 'admin-not-configured' });
  const db = adminApp.firestore();

  if (req.query.sync === '1') {
    try {
      res.json({ ok: true, ...(await runMarketingAutomation(db)) });
    } catch (e: any) {
      console.error('[marketing-cron] failed', e?.message);
      res.status(500).json({ error: e?.message });
    }
    return;
  }
  // 즉시 응답 → 외부 cron 이 기다리지 않아도 됨. 발급은 백그라운드에서 진행.
  res.json({ ok: true, accepted: true });
  runMarketingAutomation(db).catch((e) => console.error('[marketing-cron] failed', e?.message));
});

// Optimized startServer for faster Render ready-signal
async function startServer() {
  // 1. Open port EARLY to tell Render we are live
  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[READY] Server running on port ${PORT}`);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.SERVE_STATIC === "false") {
    // API 전용 모드 — Static Site 가 프론트를 따로 호스팅함 (Render Static Site + CDN)
    // 정적 파일 서빙·SPA fallback 둘 다 끔. 알려지지 않은 경로는 404 로 끝.
    app.use((req, res, next) => {
      if (req.method === "GET" && req.path === "/") {
        return res.json({ ok: true, mode: "api-only" });
      }
      next();
    });
    console.log("[Mode] API-only (SERVE_STATIC=false)");
  } else {
    // 2. Production: Concurrent path detection
    const fs = await import('fs');
    let distPath = path.join(process.cwd(), 'dist');
    
    // Check most likely path first, then alternates only if needed
    if (!fs.existsSync(distPath)) {
      const alternates = [
        path.join(__dirname, 'dist'),
        path.join(process.cwd(), '..', 'dist')
      ];
      for (const alt of alternates) {
        if (fs.existsSync(alt)) {
          distPath = alt;
          break;
        }
      }
    }

    // Diagnostic logging in background to avoid blocking
    setImmediate(() => {
      if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        console.log(`[Production] Assets served from: ${distPath}`);
      } else {
        console.error(`[CRITICAL] dist folder not found!`);
      }
    });

    // 3. Serve static files
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true,
      index: false
    }));

    // 4. Robust catch-all
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      const ext = path.extname(req.path).toLowerCase();
      if (['.js', '.css', '.png', '.jpg', '.svg', '.ico', '.json', '.webp', '.map'].includes(ext)) {
        return res.status(404).send('Asset missing');
      }
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) res.status(500).send('Server configuration issue');
      });
    });
  }
}

startServer().catch(console.error);
