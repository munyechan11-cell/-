/**
 * Firebase Cloud Messaging 백그라운드 서비스 워커.
 * 결 웹앱이 닫혀있거나 백그라운드일 때 푸시를 받아 시스템 알림으로 표시.
 *
 * Firebase JS SDK 의 onBackgroundMessage 가 자동으로 알림을 띄우지만,
 * 알림 클릭 시 결 앱 페이지로 이동시키는 핸들러는 수동 등록.
 */

// Firebase compat SDK — 서비스 워커에서 ESM import 가 안정적이지 않아 compat 사용
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// ⚠️ 결-TEST Firebase 설정 — 운영용 키로 교체할 경우 여기도 갱신.
//    클라이언트 키라 공개되어도 안전 (Firebase 룰이 보안).
firebase.initializeApp({
  apiKey: "AIzaSyCa28EjvwF9N6dBIXnpWp94q1KmrdiZgyU",
  authDomain: "gyeol-proj.firebaseapp.com",
  projectId: "gyeol-proj",
  messagingSenderId: "0",  // 동적으로 설정 안 됨 — Firebase 가 내부적으로 처리
});

const messaging = firebase.messaging();

// 백그라운드 메시지 — Firebase 가 기본 알림을 띄우지만, 메시지 가공 가능
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? payload.data?.title ?? "결 알림";
  const body = payload.notification?.body ?? payload.data?.body ?? "";
  const focusUrl = payload.data?.focus_url ?? "/biz/owner";
  const tag = payload.data?.tag ?? "gyeol-default";

  self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag,
    data: { focus_url: focusUrl },
    // requireInteraction: true,  // 사용자가 직접 닫을 때까지 유지 — 결제·신규주문엔 적용
  });
});

// 알림 클릭 — 결 페이지로 점프 (이미 열린 탭 우선)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.focus_url || "/biz/owner";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        // 같은 origin 의 열린 탭이 있으면 focus + 내비
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      // 열린 탭이 없으면 새 창
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
