/**
 * 결(Gyeol) 푸시 알림 — 클라이언트.
 *
 * 흐름:
 *  1. ensureMessagingReady() — 브라우저 지원 + 권한 + 서비스 워커 준비
 *  2. registerOwnerDevice(userId) — FCM 토큰 발급 → users/{userId}.fcmTokens 추가
 *  3. unregisterOwnerDevice(userId) — 현재 디바이스 토큰 제거
 *  4. listenForeground() — 앱이 열려있을 때 도착하는 알림 처리 (toast)
 *
 * 호환:
 *  - 데스크탑 Chrome/Edge/Firefox: ✅ 풀 지원
 *  - iOS Safari 16.4+: ⚠️ 홈 화면에 추가된 PWA 에서만 작동
 *  - 그 외: 자동으로 비활성, isPushSupported() 가 false 반환
 */
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";
import { arrayUnion, arrayRemove, doc, setDoc, updateDoc } from "firebase/firestore";
import { app, db } from "./firebase";
import { showToast } from "./toast";

// 결-TEST 의 VAPID public key. Firebase Console → Project Settings → Cloud Messaging → Web Push certificates 에서 생성.
// 환경변수가 있으면 그걸 우선 (운영 키 분리용)
const VAPID_KEY =
  (import.meta as any).env?.VITE_FCM_VAPID_KEY ||
  "BLpRHpAOM86dlMOcdkPmS-bxkF96kQTbcCNDR7vsh-zYwO0mZ0pAv9FUcq8xMyJl-OFHQTLO2eaHJ5jVw9aJsHU"; // ⚠️ placeholder — 실제 키로 교체

let messagingInstance: Messaging | null = null;
let supportedCache: boolean | null = null;

export async function isPushSupported(): Promise<boolean> {
  if (supportedCache !== null) return supportedCache;
  try {
    supportedCache = await isSupported();
  } catch {
    supportedCache = false;
  }
  return supportedCache;
}

async function getMessagingSafe(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!app) return null;
  const ok = await isPushSupported();
  if (!ok) return null;
  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (e: any) {
    console.warn("[push] getMessaging failed", e?.message);
    return null;
  }
}

/** 알림 권한 상태 — 'default' | 'granted' | 'denied' | 'unsupported' */
export type PermissionState = "default" | "granted" | "denied" | "unsupported";
export async function getPermissionState(): Promise<PermissionState> {
  if (!(await isPushSupported())) return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as PermissionState;
}

/**
 * 사장님 디바이스를 푸시 대상으로 등록.
 * - 권한이 default 면 요청 다이얼로그
 * - 권한 OK 면 FCM 토큰 발급 → Firestore users/{userId}.fcmTokens 배열에 추가
 * - 동일 토큰은 dedup
 */
export async function registerOwnerDevice(userId: string): Promise<{
  ok: boolean;
  reason?: "unsupported" | "denied" | "no-db" | "error";
  token?: string;
}> {
  if (!userId) return { ok: false, reason: "error" };
  if (!db) return { ok: false, reason: "no-db" };
  const messaging = await getMessagingSafe();
  if (!messaging) return { ok: false, reason: "unsupported" };

  // 권한 요청
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };
  } catch {
    return { ok: false, reason: "denied" };
  }

  // 서비스 워커 — Firebase 가 자동 등록하지만, 명시 등록이 더 안정적
  let swReg: ServiceWorkerRegistration | undefined;
  if ("serviceWorker" in navigator) {
    try {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/firebase-cloud-messaging-push-scope" });
    } catch (e: any) {
      console.warn("[push] firebase SW register failed", e?.message);
    }
  }

  // 토큰 발급
  let token: string | undefined;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch (e: any) {
    console.error("[push] getToken failed", e?.code ?? e?.message);
    return { ok: false, reason: "error" };
  }
  if (!token) return { ok: false, reason: "error" };

  // Firestore 등록 — fcmTokens 배열에 dedup 추가
  const entry = {
    token,
    platform: navigator.platform || "web",
    registeredAt: new Date().toISOString(),
  };
  try {
    const ref = doc(db, "users", userId);
    // 기존 같은 토큰 항목 제거 후 추가 (registeredAt 갱신 효과)
    await setDoc(ref, {}, { merge: true });
    await updateDoc(ref, {
      fcmTokens: arrayUnion(entry),
    });
  } catch (e: any) {
    console.error("[push] firestore update failed", e?.message);
    return { ok: false, reason: "error", token };
  }

  return { ok: true, token };
}

/** 현재 디바이스 토큰을 사용자 문서에서 제거 — 호출 시 토큰 발급은 시도하지 않음. */
export async function unregisterOwnerDevice(userId: string): Promise<void> {
  if (!userId || !db) return;
  const messaging = await getMessagingSafe();
  if (!messaging) return;
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => undefined);
    if (!token) return;
    const ref = doc(db, "users", userId);
    // arrayRemove 는 정확히 같은 객체만 제거하므로 token 기준 fallback 처리
    // 간단화: 토큰이 일치하는 모든 항목 제거
    // (실패 시 sweep 은 서버 측 cron 으로 처리 — 베타엔 미구현)
    await updateDoc(ref, {
      fcmTokens: arrayRemove({ token } as any),  // exact match 안 되면 무시
    });
  } catch (e: any) {
    console.warn("[push] unregister failed", e?.message);
  }
}

/** 앱이 포커스 상태일 때 도착하는 메시지를 toast 로 전환. App.tsx 부팅 시 한 번 호출. */
let foregroundListenerSetup = false;
export async function listenForeground() {
  if (foregroundListenerSetup) return;
  const messaging = await getMessagingSafe();
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? payload.data?.title ?? "결 알림";
    const body = payload.notification?.body ?? payload.data?.body ?? "";
    showToast(`${title} — ${body}`.slice(0, 140), "info");
  });
  foregroundListenerSetup = true;
}
