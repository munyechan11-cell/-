/**
 * 새 주문 알림 — 알림음 + 진동 + 브라우저 알림.
 * 자동재생 정책상 사용자가 한 번 클릭한 후에만 소리가 납니다.
 */

let audioCtx: AudioContext | null = null;
let userInteracted = false;

if (typeof window !== "undefined") {
  const markInteracted = () => {
    userInteracted = true;
    window.removeEventListener("pointerdown", markInteracted);
    window.removeEventListener("keydown", markInteracted);
  };
  window.addEventListener("pointerdown", markInteracted, { once: true });
  window.addEventListener("keydown", markInteracted, { once: true });
}

function getCtx(): AudioContext | null {
  if (!userInteracted) return null;
  if (!audioCtx) {
    const Ctor: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  // Chrome 자동재생 정책으로 가끔 suspended 상태로 시작 → resume
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** 새 주문 알림음 — "딩-동" 2음 차임 */
export function playChime() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const tone = (freq: number, start: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.3, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);
  };

  tone(880, 0, 0.3);   // 솔#
  tone(1320, 0.18, 0.4); // 미 (한 옥타브 위)
}

/** 진동 (모바일) */
export function vibratePattern() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([120, 60, 120]);
  }
}

/** 브라우저 알림 (옵트인) */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "gyeol-order",
      requireInteraction: false,
    });
    // 클릭하면 창 포커스
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => n.close(), 8000);
  } catch {
    /* Safari macOS 11+ 에서 Notification 생성자 거부 가능 */
  }
}

/** 모두 합쳐서 호출하는 헬퍼 */
export function notifyNewOrder(message: string) {
  playChime();
  vibratePattern();
  showBrowserNotification("새 주문이 들어왔어요", message);
}
