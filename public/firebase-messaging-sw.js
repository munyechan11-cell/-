/**
 * Firebase Cloud Messaging 백그라운드 서비스 워커.
 * 결 웹앱이 닫혀있거나 백그라운드일 때 푸시를 받아 시스템 알림으로 표시.
 *
 * ⚠️ 서비스 워커는 환경변수 못 받음 — Firebase 설정값을 직접 박아넣음.
 *   결-TEST 클라이언트 키 (Firebase 룰이 보안 책임). 운영 프로젝트 분리 시 갱신.
 */

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCa28EjvwF9N6dBIXnpWp94q1KmrdiZgyU",
  authDomain: "gyeol-proj.firebaseapp.com",
  projectId: "gyeol-proj",
  storageBucket: "gyeol-proj.firebasestorage.app",
  messagingSenderId: "780655756249",
  appId: "1:780655756249:web:e1a4c3ff1048318e46cfc8",
});

const messaging = firebase.messaging();

// 백그라운드 메시지 — 시스템 알림 표시
messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    "결 알림";
  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    "";
  const focusUrl = (payload.data && payload.data.focus_url) || "/biz/owner";
  const tag = (payload.data && payload.data.tag) || "gyeol-default";

  self.registration.showNotification(title, {
    body: body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: tag,
    data: { focus_url: focusUrl },
    requireInteraction: tag.startsWith("gyeol-order") || tag.startsWith("gyeol-pay"),
  });
});

// 알림 클릭 — 결 페이지로 점프 (이미 열린 탭 우선)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.focus_url) || "/biz/owner";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              try { client.navigate(url); } catch (e) { /* same-origin only */ }
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// 활성화 즉시 — 새 SW 가 등록되면 이전 SW 대체
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
