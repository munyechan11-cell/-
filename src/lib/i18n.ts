import { useSyncExternalStore } from "react";

// ============================================================
// 가벼운 자체 i18n — 외부 라이브러리 없이 localStorage 기반.
// 점진 적용용 스캐폴딩: 새 라벨은 dict 에 추가하고, 각 화면에서 t(key) 로 호출하면 됨.
// ============================================================

export type Lang = "ko" | "en";
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "en", label: "English", native: "English" },
];

const STORAGE_KEY = "gyeol-lang";
const DEFAULT_LANG: Lang = "ko";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    // localStorage 차단 환경 — 기본값
  }
  return DEFAULT_LANG;
}

let currentLang: Lang = getInitialLang();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setLanguage(lang: Lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 저장 실패해도 메모리 상태는 유지
  }
  document.documentElement.lang = lang;
  listeners.forEach((cb) => cb());
}

export function getLanguage(): Lang {
  return currentLang;
}

// 동기화 — useSyncExternalStore 로 컴포넌트에서 안전하게 구독
export function useLanguage(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => currentLang,
    () => DEFAULT_LANG
  );
}

// ============================================================
// 사전 — 새 키는 여기 추가. 적용은 화면별로 점진적으로.
// 누락된 키는 한국어 fallback, 한국어도 없으면 key 그대로 반환.
// ============================================================
type Dict = Record<string, string>;

const DICT: Record<Lang, Dict> = {
  ko: {
    "nav.home": "홈",
    "nav.menu": "메뉴",
    "nav.coupons": "쿠폰",
    "nav.profile": "내 정보",
    "settings.language": "언어 설정",
    "settings.language.desc": "원하는 언어를 선택하세요. 적용된 화면만 변경됩니다.",
  },
  en: {
    "nav.home": "Home",
    "nav.menu": "Menu",
    "nav.coupons": "Coupons",
    "nav.profile": "Profile",
    "settings.language": "Language",
    "settings.language.desc": "Pick your language. Only translated screens will change.",
  },
};

export function t(key: string, lang: Lang = currentLang): string {
  return DICT[lang]?.[key] ?? DICT.ko[key] ?? key;
}

// 초기 lang 속성 — html 태그에 반영
if (typeof document !== "undefined") {
  document.documentElement.lang = currentLang;
}
