import { Router } from 'express';
import { getBaseUrl, getFirebaseAdmin } from '../lib/firebase.js';

const router = Router();


// API Routes
router.get('/api/auth/kakao/url', (req, res) => {
  const redirectUri = `${getBaseUrl()}/api/auth/kakao/callback`;
  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'KAKAO_CLIENT_ID is not set' });
  
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  res.json({ url });
});

router.get('/api/auth/kakao/callback', async (req, res) => {
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
router.get('/api/auth/naver/url', (req, res) => {
  const redirectUri = `${getBaseUrl()}/api/auth/naver/callback`;
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'NAVER_CLIENT_ID is not set' });
  
  const state = Math.random().toString(36).substring(7);
  const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
  res.json({ url });
});

// Naver Callback
router.get('/api/auth/naver/callback', async (req, res) => {
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

export default router;
