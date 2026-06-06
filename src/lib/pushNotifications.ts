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
import { arrayRemove, arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { app, db, ensureAnonymousAuth } from "./firebase";
import { showToast } from "./toast";

// Firebase Console → Project Settings → Cloud Messaging → Web Push certificates 에서 생성한 키.
// 환경변수가 있으면 그걸 우선 (운영 키 분리 가능).
const VAPID_KEY_ENV = ((import.meta as any).env?.VITE_FCM_VAPID_KEY as string | undefined)?.trim();
// 빈 값·placeholder 감지 — 잘못된 키로 호출하지 않도록.
const VAPID_KEY = VAPID_KEY_ENV || "";
const isVapidConfigured = (): boolean => {
  // VAPID public key 는 보통 'B' 로 시작하는 88자 base64url. 70자 이상이면 일단 시도.
  return !!VAPID_KEY && VAPID_KEY.length >= 70;
};

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

/** 등록 실패 reason — UI 에서 친화적 메시지로 변환 */
export type RegisterReason =
  | "unsupported"
  | "denied"
  | "no-vapid"
  | "sw-register-failed"
  | "no-db"
  | "no-auth"
  | "firestore-error"
  | "error";

/**
 * 사장님 디바이스를 푸시 대상으로 등록.
 * - 권한이 default 면 요청 다이얼로그
 * - 권한 OK 면 FCM 토큰 발급 → Firestore users/{userId}.fcmTokens 배열에 추가
 * - 동일 토큰은 dedup
 */
export async function registerOwnerDevice(userId: string): Promise<{
  ok: boolean;
  reason?: RegisterReason;
  detail?: string;
  token?: string;
}> {
  if (!userId) return { ok: false, reason: "error", detail: "userId 없음" };
  if (!db) return { ok: false, reason: "no-db" };

  // VAPID 키 검증 — placeholder 면 즉시 차단 (잘못된 키로 Firebase 호출 시 invalid 에러 + 토큰 발급 거부)
  if (!isVapidConfigured()) {
    return {
      ok: false,
      reason: "no-vapid",
      detail: "VAPID 공개 키가 설정되지 않았어요. (VITE_FCM_VAPID_KEY)",
    };
  }

  const messaging = await getMessagingSafe();
  if (!messaging) return { ok: false, reason: "unsupported" };

  // 익명 인증 보장 — Firestore 룰의 signedIn() 게이트 통과용
  try {
    await ensureAnonymousAuth();
  } catch (e: any) {
    return { ok: false, reason: "no-auth", detail: e?.message };
  }

  // 권한 요청 (다이얼로그)
  let perm: NotificationPermission;
  try {
    perm = await Notification.requestPermission();
  } catch (e: any) {
    return { ok: false, reason: "denied", detail: e?.message };
  }
  if (perm !== "granted") return { ok: false, reason: "denied" };

  // 서비스 워커 등록 — Firebase 가 자동으로도 등록하지만 명시 등록이 더 안정적
  let swReg: ServiceWorkerRegistration | undefined;
  if ("serviceWorker" in navigator) {
    try {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      });
      // 활성화 대기 (최대 3초)
      if (swReg.installing) {
        await new Promise<void>((resolve) => {
          const inst = swReg!.installing!;
          // resolve 시점·타임아웃 양쪽에서 리스너를 제거 — 안 그러면 activated 가
          // 안 올 때 statechange 리스너가 영구히 남아 권한 재시도마다 누적됨.
          const finish = () => {
            clearTimeout(timer);
            inst.removeEventListener("statechange", onChange);
            resolve();
          };
          const onChange = () => { if (inst.state === "activated") finish(); };
          const timer = setTimeout(finish, 3000);
          inst.addEventListener("statechange", onChange);
        });
      }
    } catch (e: any) {
      console.error("[push] SW register failed", e);
      return { ok: false, reason: "sw-register-failed", detail: e?.message };
    }
  } else {
    return { ok: false, reason: "sw-register-failed", detail: "Service Worker 미지원 브라우저" };
  }

  // 토큰 발급
  let token: string | undefined;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch (e: any) {
    const code = e?.code ?? "";
    const msg = e?.message ?? String(e);
    console.error("[push] getToken failed", code, msg);
    // Firebase 에러 코드별 분류
    if (code.includes("messaging/permission-blocked") || code.includes("permission")) {
      return { ok: false, reason: "denied", detail: msg };
    }
    if (code.includes("messaging/invalid-vapid-key") || msg.toLowerCase().includes("vapid")) {
      return { ok: false, reason: "no-vapid", detail: msg };
    }
    if (code.includes("messaging/failed-service-worker-registration") || code.includes("service-worker")) {
      return { ok: false, reason: "sw-register-failed", detail: msg };
    }
    return { ok: false, reason: "error", detail: `${code} ${msg}` };
  }
  if (!token) return { ok: false, reason: "error", detail: "토큰 발급 결과가 비어있음" };

  // Firestore 등록 — fcmTokens 배열에 dedup 추가.
  // 기존 버그: entry 에 registeredAt(매번 다른 ISO) 가 포함되어 arrayUnion
  // equality 매칭이 실패 → 같은 token 이라도 매번 새 entry 가 누적되어
  // doc 이 비대해지고 stale token 으로 FCM 호출 폭주.
  // 해결: 현재 entry 들을 getDoc 으로 읽어 같은 token 의 옛 entry 들은
  // 모두 arrayRemove 한 뒤 새 entry 를 arrayUnion. 동일 token 1건만 유지.
  const entry = {
    token,
    platform: navigator.platform || "web",
    registeredAt: new Date().toISOString(),
  };
  try {
    const ref = doc(db, "users", userId);
    let stale: Array<unknown> = [];
    try {
      const snap = await getDoc(ref);
      const existing = (snap.data()?.fcmTokens as Array<{ token?: string }>) ?? [];
      stale = existing.filter((e) => e?.token === token);
    } catch {
      // 권한/없음 — 빈 배열로 진행
    }
    if (stale.length > 0) {
      // arrayRemove 는 한 번에 여러 인자 받음
      await setDoc(
        ref,
        { fcmTokens: arrayRemove(...(stale as any[])) },
        { merge: true }
      );
    }
    await setDoc(
      ref,
      { fcmTokens: arrayUnion(entry) },
      { merge: true }
    );
  } catch (e: any) {
    console.error("[push] firestore update failed", e?.code, e?.message);
    return { ok: false, reason: "firestore-error", detail: e?.message, token };
  }

  return { ok: true, token };
}

/**
 * 현재 디바이스 토큰을 사용자 문서에서 제거 — 호출 시 토큰 발급은 시도하지 않음.
 *
 * 주의: 등록 시 `{token, platform, registeredAt}` 객체로 저장되었기 때문에
 * `arrayRemove({token})` 만으로는 매칭이 안 된다 (Firestore arrayRemove 는
 * 완전 일치만 제거). 따라서 users 문서를 한 번 읽어 그 token 을 가진 entry
 * 전체를 매칭해서 제거한다.
 */
export async function unregisterOwnerDevice(userId: string): Promise<void> {
  if (!userId || !db) return;
  const messaging = await getMessagingSafe();
  if (!messaging || !isVapidConfigured()) return;
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => undefined);
    if (!token) return;
    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);
    const tokens: Array<{ token: string }> = (snap.data()?.fcmTokens as any) ?? [];
    const target = tokens.find((e) => e?.token === token);
    if (!target) return;
    await updateDoc(ref, {
      fcmTokens: arrayRemove(target as any),
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
