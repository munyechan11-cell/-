import express from 'express';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';

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
app.use(express.json({ limit: '10mb' }));

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- TOSS PAYMENTS CONFIRM API ---
app.post('/api/payment/confirm', async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;

  if (!TOSS_SECRET_KEY) {
    return res.status(500).json({ error: 'Toss Secret Key not configured on server.' });
  }

  try {
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`
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
    res.status(500).json({ error: error.message });
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
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
`.trim();

  const userMsg = `매장명: ${input.context.storeName ?? '매장'}
기간: ${input.context.period ?? '최근'}

사장님 질문: "${input.question}"

매장 데이터:
${JSON.stringify(input.context, null, 2)}

위 데이터로 사장님 질문에 답해주세요.`;

  try {
    if (geminiKey) {
      const apiRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userMsg }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
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
  kind: "new-order" | "payment-request" | "staff-join" | "coupon-request" | "test";
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

        const batch = db.batch();
        let n = 0;
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
        };

        for (const [cid, last] of lastVisit) {
          if (n >= 450) { capped++; break; } // batch 한도 안전 — 초과분은 다음 실행에서 처리
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
