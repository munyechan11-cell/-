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
app.use(express.json());

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
