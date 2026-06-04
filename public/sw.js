/**
 * 결(Gyeol) PWA 서비스 워커 — v3 (2026-06).
 *
 * 전략:
 *  - 네비게이션(HTML) : network-first, 네트워크 실패 시 캐시 → 최후 fallback HTML
 *  - 정적 자산(JS/CSS/이미지/폰트) : stale-while-revalidate
 *    (즉시 캐시 반환 + 백그라운드에서 새 버전 가져와 캐시 갱신)
 *  - API / Firebase / 외부 도메인 : 캐시 안 함, 그냥 네트워크
 *  - 새 SW 등록되면 skipWaiting + clients.claim 으로 즉시 활성화
 *  - activate 시 옛 캐시 정리
 *
 * 이전(v1) 의 단순 cache-first 가 옛 index.html 을 반환하면 그 안에 박힌
 * JS 해시가 새 빌드와 안 맞아 404·흰 화면 → 'PWA가 화면을 불러오지 못했습니다'
 * 사고가 발생. v3 는 HTML 만 항상 네트워크 우선이라 새 빌드 즉시 반영.
 */

const VERSION = "v3-2026-06-04";
const RUNTIME_CACHE = `gyeol-runtime-${VERSION}`;
const ASSET_CACHE = `gyeol-assets-${VERSION}`;

// 최소 essential — 오프라인 fallback 용
const ESSENTIAL = ["/", "/index.html", "/manifest.json", "/icon.svg"];

// ============================================================
// install — essential 만 미리 캐시, 새 SW 즉시 활성화
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.addAll(ESSENTIAL).catch(() => {
        // essential 일부가 없어도 install 자체는 성공시킴 (오프라인 first-install 보호)
      })
    )
  );
  self.skipWaiting();
});

// ============================================================
// activate — 옛 버전 캐시 삭제 + 모든 탭에 새 SW 적용
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ============================================================
// fetch — 요청 종류별 전략
// ============================================================

const isApiOrAuthRequest = (url) => {
  const u = new URL(url);
  // 결 API 서비스 (다른 origin) 또는 같은 origin /api/*
  if (u.pathname.startsWith("/api/")) return true;
  if (u.hostname.includes("gyeol-api.onrender.com")) return true;
  if (u.hostname.includes("gyeol.onrender.com")) return true;
  // Firebase / Google
  if (u.hostname.includes("firebaseio.com")) return true;
  if (u.hostname.includes("firestore.googleapis.com")) return true;
  if (u.hostname.includes("googleapis.com")) return true;
  if (u.hostname.includes("identitytoolkit")) return true;
  if (u.hostname.includes("securetoken")) return true;
  if (u.hostname.includes("gstatic.com") && u.pathname.includes("firebase")) return true;
  // 카카오/네이버 OAuth
  if (u.hostname.includes("kakao.com")) return true;
  if (u.hostname.includes("kakaocdn.net")) return true;
  if (u.hostname.includes("naver.com")) return true;
  return false;
};

const isNavigationRequest = (req) =>
  req.mode === "navigate" || (req.method === "GET" && req.headers.get("accept")?.includes("text/html"));

const isStaticAsset = (url) => {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return false;
  return /\.(?:js|css|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|otf)$/i.test(u.pathname);
};

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 외부 API / Firebase 등 — 워커 개입 X
  if (isApiOrAuthRequest(req.url)) {
    return; // 기본 네트워크
  }

  // HTML 네비게이션 — network-first + offline fallback
  if (isNavigationRequest(req)) {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // 정적 자산 — stale-while-revalidate
  if (isStaticAsset(req.url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 그 외 (cross-origin 등) — 그냥 네트워크
});

async function networkFirstNavigation(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    // 200 응답이면 캐시 갱신
    if (fresh && fresh.ok) {
      cache.put("/index.html", fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    // 네트워크 실패 — 캐시된 index.html → 최후엔 minimal HTML
    const cached = (await cache.match("/index.html")) || (await cache.match("/")) || (await cache.match(req));
    if (cached) return cached;
    return new Response(
      `<!doctype html><html lang="ko"><meta charset="utf-8"><title>결 - 오프라인</title>
       <body style="font-family:-apple-system,sans-serif;padding:40px;text-align:center;color:#173762">
       <h1 style="font-size:18px">📡 인터넷에 연결할 수 없어요</h1>
       <p style="font-size:14px;color:#6b7589">네트워크를 확인하고 다시 시도해 주세요.</p>
       <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;background:#173762;color:#fff;border:0;border-radius:10px;font-weight:700;cursor:pointer">새로고침</button>
       </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 }
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  // 캐시 있으면 즉시 반환 + 백그라운드 갱신
  if (cached) {
    // 갱신은 await 하지 않음
    void fetchPromise;
    return cached;
  }
  // 캐시 없으면 네트워크 결과 대기 → 실패 시 빈 응답 대신 명시적 에러
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  return new Response("", { status: 504, statusText: "Asset fetch failed (offline)" });
}

// ============================================================
// 메시지 수신 — 페이지에서 SW 갱신 트리거 가능 (clearAndReload 등)
// ============================================================
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        const clients = await self.clients.matchAll();
        clients.forEach((c) => c.postMessage({ type: "CACHES_CLEARED" }));
      })()
    );
  }
});
