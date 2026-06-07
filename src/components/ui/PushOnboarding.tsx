/**
 * 첫 진입 푸시 권한 자동 요청.
 *
 * 사장님/직원이 로그인된 상태로 처음 BizShell(owner/staff)에 진입했을 때
 * Notification.permission === "default" 면 우선 사전 안내 카드를 띄움.
 *   - 'Allow' → 시스템 권한 다이얼로그 → 허용 시 FCM 토큰 발급 + Firestore 등록
 *   - 'Later' → 7일 cooldown
 *
 * 시스템 권한 팝업을 곧장 띄우지 않는 이유:
 *   브라우저들이 "사용자 의도 없이 띄우면" 다이얼로그를 영구 차단으로 처리하기 시작했고,
 *   사용자도 어디서 왔는지 모르는 권한 요청을 거부할 확률이 높음.
 *   사전 카드에서 '왜 필요한지'를 설명하면 수락률이 크게 올라간다 (Safari/Chrome 권장 패턴).
 *
 * iOS Safari (홈 화면 미설치):
 *   FCM이 동작하지 않으므로 가이드 카드로 분기. InstallPrompt 가 별도로 떠 있음.
 */
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useStore } from "../../store/store";
import {
  isPushSupported,
  getPermissionState,
  registerOwnerDevice,
} from "../../lib/pushNotifications";
import { showToast } from "../../lib/toast";
import { useLanguage, t } from "../../lib/i18n";

const LS_KEY = "gyeol:push-onboard";
const COOLDOWN_MS = 7 * 86_400_000; // 7일

interface StoredState {
  declined?: boolean;
  ts?: number;
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as StoredState) : {};
  } catch {
    return {};
  }
}

function saveState(s: StoredState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

export function PushOnboarding() {
  const lang = useLanguage();
  const { currentUser } = useStore();
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 사장님/직원/손님 모두 — 로그인 상태일 때만
    // 손님: 쿠폰·혜택 도착 알림을 받게 하여 재방문 유도(소셜 손님 도달 보강)
    if (!currentUser) return;
    if (currentUser.role !== "owner" && currentUser.role !== "staff" && currentUser.role !== "customer") return;

    // 7일 cooldown 체크
    const stored = loadState();
    if (stored.declined && stored.ts && Date.now() - stored.ts < COOLDOWN_MS) return;

    // 지원 여부 + 권한 상태 비동기 점검
    let cancelled = false;
    (async () => {
      const supported = await isPushSupported();
      if (cancelled) return;
      if (!supported) {
        // iOS Safari (PWA 미설치): 가이드 분기
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isIos = /iPhone|iPad|iPod/.test(ua);
        const isStandalone =
          typeof window !== "undefined" &&
          (window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as any).standalone === true);
        if (isIos && !isStandalone) setIosHint(true);
        return;
      }
      const perm = await getPermissionState();
      if (cancelled) return;
      if (perm === "default") setShow(true);
    })();

    return () => {
      cancelled = true;
    };
    // currentUser 전체 객체 변경 시마다 재실행하면 불필요한 비동기 폭주 — id/role 만으로 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, currentUser?.employerStoreId]);

  const dismiss = (declined: boolean) => {
    saveState({ declined, ts: Date.now() });
    setShow(false);
    setIosHint(false);
  };

  const enable = async () => {
    if (!currentUser) return;
    setBusy(true);
    try {
      // 사장님 본인 매장에 토큰 등록. 직원의 경우 employerStoreId 우선.
      const targetUserId =
        currentUser.role === "staff" && currentUser.employerStoreId
          ? currentUser.employerStoreId
          : currentUser.id;
      const r = await registerOwnerDevice(targetUserId);
      if (r.ok) {
        showToast(t("pushOnboard.toast.granted", lang), "success");
        dismiss(false);
      } else if (r.reason === "denied") {
        showToast(t("pushOnboard.toast.denied", lang), "error");
        dismiss(true);
      } else if (r.reason === "unsupported") {
        showToast(t("pushOnboard.toast.unsupported", lang), "info");
        dismiss(true);
      } else {
        // 기타 실패(VAPID 미설정 등)는 조용히 닫음 — 사장님이 설정 페이지에서 다시 시도 가능
        dismiss(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (iosHint) {
    return (
      <Card>
        <Inner
          title={t("pushOnboard.iosTitle", lang)}
          desc={t("pushOnboard.iosDesc", lang)}
          onClose={() => dismiss(true)}
        />
      </Card>
    );
  }
  if (!show) return null;

  return (
    <Card>
      <Inner
        title={t("pushOnboard.title", lang)}
        desc={t("pushOnboard.desc", lang)}
        onClose={() => dismiss(true)}
        primary={{
          label: t("pushOnboard.allow", lang),
          onClick: enable,
          busy,
        }}
        secondary={{
          label: t("pushOnboard.later", lang),
          onClick: () => dismiss(true),
        }}
      />
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[440px] z-50 bg-white border border-[var(--color-line)] rounded-2xl shadow-[var(--shadow-lifted)] p-4 animate-[gyeol-slide-up_.25s_ease-out]">
      {children}
    </div>
  );
}

function Inner({
  title,
  desc,
  onClose,
  primary,
  secondary,
}: {
  title: string;
  desc: string;
  onClose: () => void;
  primary?: { label: string; onClick: () => void; busy?: boolean };
  secondary?: { label: string; onClick: () => void };
}) {
  const lang = useLanguage();
  return (
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-xl bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center shrink-0">
        <Bell className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-extrabold text-[var(--color-navy-900)]">{title}</p>
        <p className="text-[12.5px] text-[var(--color-ink-600)] leading-relaxed mt-0.5">{desc}</p>
        {(primary || secondary) && (
          <div className="mt-3 flex items-center gap-2">
            {primary && (
              <button
                onClick={primary.onClick}
                disabled={primary.busy}
                className="h-9 px-4 rounded-full bg-[var(--color-navy-700)] text-white text-[12.5px] font-extrabold disabled:opacity-50"
              >
                {primary.busy ? "…" : primary.label}
              </button>
            )}
            {secondary && (
              <button
                onClick={secondary.onClick}
                className="h-9 px-3 rounded-full text-[12.5px] font-bold text-[var(--color-ink-600)] hover:bg-[var(--color-bg)]"
              >
                {secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        aria-label={t("common.close", lang)}
        className="w-8 h-8 rounded-full hover:bg-[var(--color-bg)] inline-flex items-center justify-center shrink-0"
      >
        <X className="w-4 h-4 text-[var(--color-ink-500)]" />
      </button>
    </div>
  );
}
