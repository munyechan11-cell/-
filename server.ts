import express from 'express';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
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
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
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
app.post('/api/ai/floor-plan', async (req, res) => {
  const { image, canvasWidth = 1000, canvasHeight = 700 } = req.body ?? {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'image (data URL) is required' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !anthropicKey && !openaiKey) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  }

  const systemPrompt =
    `당신은 식당 도면을 분석해 테이블 배치를 추출하는 비전 엔지니어입니다. ` +
    `입력은 정밀한 CAD 도면일 수도, 사장님이 손가락으로 끄적인 거친 스케치일 수도 있습니다. ` +
    `손그림은 사각형/원/네모박스가 테이블, 큰 사각형이 룸, 벽 끝의 작은 표시가 출입구를 의미하는 경우가 많습니다. ` +
    `이미지에서 테이블/룸/출입구를 찾아 ${canvasWidth}x${canvasHeight} 좌표계로 정규화해 반환하세요. ` +
    `JSON만 출력하고 그 외 텍스트는 절대 포함하지 마세요. 스키마: ` +
    `{"tables":[{"number":1,"type":"table"|"room"|"door","x":120,"y":80,"width":70,"height":70,"shape":"square"|"circle","seats":4}]}. ` +
    `규칙: number는 1부터 순차 부여. x,y는 좌상단 기준 픽셀. 일반 테이블은 70x70(원형이면 shape=circle), 룸은 150x80, 출입구는 60x60·type=door·seats 생략 가능. ` +
    `좌석수는 도면의 의자 수 또는 면적으로 추정. 명백한 객체만 추출 — 애매하면 누락이 과추출보다 낫습니다. 비어 보이면 빈 배열을 반환하세요.`;

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
      const apiRes = await fetch(
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
                  { text: `이 도면을 분석하여 ${canvasWidth}x${canvasHeight} 좌표계의 테이블 배치 JSON을 반환하세요.` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              maxOutputTokens: 4000,
            },
          }),
        }
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

      const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
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
                { type: 'text', text: `이 도면을 분석하여 ${canvasWidth}x${canvasHeight} 좌표계의 테이블 배치 JSON을 반환하세요.` },
              ],
            },
          ],
        }),
      });
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
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
              { type: 'text', text: `이 도면을 분석하여 ${canvasWidth}x${canvasHeight} 좌표계의 테이블 배치 JSON을 반환하세요.` },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 4000,
      }),
    });
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

function extractJson(text: string): any {
  // 모델이 ```json ... ``` 블록으로 감쌀 경우 대비
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    // 첫 { 부터 마지막 } 까지 슬라이스
    const i = raw.indexOf('{');
    const j = raw.lastIndexOf('}');
    if (i >= 0 && j > i) return JSON.parse(raw.slice(i, j + 1));
    throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  }
}

// --- ORDER STATUS WEBHOOK (from Foodtech or internal) ---
app.post('/api/webhook/order-status', async (req, res) => {
  const { orderId, status, timestamp } = req.body;
  console.log(`[Webhook] Order ${orderId} status changed to: ${status} at ${timestamp || new Date().toISOString()}`);
  
  // Note: In this architecture, Firestore updates are handled client-side via the store.
  // This webhook endpoint is for external POS systems (e.g., Foodtech) to notify status changes.
  // If Firebase Admin SDK is configured, server-side updates can be added here.
  
  res.json({ received: true, orderId, status });
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
