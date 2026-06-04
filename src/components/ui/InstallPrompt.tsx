import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useLanguage, t } from "../../lib/i18n";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const LS_DISMISSED = "gyeol:install-dismissed";

/**
 * PWA 설치 프롬프트.
 * - Android / desktop Chrome·Edge: beforeinstallprompt 이벤트를 캐치해 직접 띄움
 * - iOS Safari: 설치 이벤트 없음 → "홈 화면에 추가" 가이드 토스트
 * 사용자가 닫으면 30일간 다시 띄우지 않음.
 */
export function InstallPrompt() {
  const lang = useLanguage();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const dismissed = Number(localStorage.getItem(LS_DISMISSED) || 0);
    if (Date.now() - dismissed < 30 * 86_400_000) return;

    // 이미 standalone(설치된 상태)이면 표시 안 함
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);

    // iOS Safari 감지
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    if (isIos && isSafari) {
      // 사이트 진입 후 10초 후 힌트
      const t = setTimeout(() => setIosHint(true), 10_000);
      return () => clearTimeout(t);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
  }, []);

  const dismiss = () => {
    localStorage.setItem(LS_DISMISSED, String(Date.now()));
    setDeferred(null);
    setIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (deferred) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[440px] z-50 bg-[var(--color-navy-700)] text-white rounded-2xl shadow-[var(--shadow-lifted)] p-4 flex items-center gap-3 animate-[gyeol-slide-up_.25s_ease-out]">
        <div className="w-11 h-11 rounded-xl bg-white/15 inline-flex items-center justify-center shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold">{t("install.title", lang)}</p>
          <p className="text-[12px] opacity-80">{t("install.desc", lang)}</p>
        </div>
        <button
          onClick={install}
          className="h-9 px-4 rounded-full bg-[var(--color-mint-500)] text-white text-[13px] font-extrabold shrink-0"
        >
          {t("install.btn", lang)}
        </button>
        <button onClick={dismiss} className="w-8 h-8 rounded-full hover:bg-white/10 inline-flex items-center justify-center shrink-0" aria-label={t("install.close", lang)}>
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[440px] z-50 bg-white border border-[var(--color-line)] rounded-2xl shadow-[var(--shadow-lifted)] p-4 animate-[gyeol-slide-up_.25s_ease-out]">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--color-mint-100)] text-[var(--color-mint-700)] inline-flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold text-[var(--color-navy-900)]">{t("install.ios.title", lang)}</p>
            <p className="text-[12px] text-[var(--color-ink-600)] leading-relaxed mt-0.5">
              {t("install.ios.descPrefix", lang)} <span className="inline-block px-1.5 py-0.5 rounded bg-[var(--color-bg)] font-mono text-[11px]">⎙</span> {t("install.ios.descSuffix", lang)}
            </p>
          </div>
          <button onClick={dismiss} className="w-8 h-8 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center shrink-0" aria-label={t("install.close", lang)}>
            <X className="w-4 h-4 text-[var(--color-ink-500)]" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
