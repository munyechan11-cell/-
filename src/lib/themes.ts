// ============================================================
// 매장별 색 테마 — 업종에 맞는 분위기를 매장이 직접 고른다.
// 기본 "결" 테마는 index.css 의 @theme 값을 그대로 쓰고(오버라이드 없음),
// 그 외 테마는 primary/accent 두 앵커 색에서 스케일을 생성해
// --color-navy-* (primary) / --color-mint-* (accent) 변수를 런타임에 덮어쓴다.
// 앱 전체가 이 변수를 참조하므로 모든 화면 색이 한 번에 바뀐다.
// ============================================================
import type { Industry } from "./types";

export interface ThemeDef {
  id: string;
  /** 사장님 화면에 보일 이름 */
  name: string;
  /** 스와치 옆 이모지 */
  emoji: string;
  /** 한 줄 설명 */
  desc: string;
  /** primary(=navy 자리) 700 단계 앵커 색 */
  primary: string;
  /** accent(=mint 자리) 500 단계 앵커 색 */
  accent: string;
  /** 페이지 배경 살짝 톤 (없으면 기본 회백색 유지) */
  bg?: string;
  /** 이 업종에 특히 어울림 — 추천 뱃지 표시용 */
  recommendedFor?: Industry[];
}

/** 기본 테마 id — 변수 오버라이드 없이 index.css 원본을 사용 */
export const DEFAULT_THEME_ID = "gyeol";

export const THEMES: ThemeDef[] = [
  {
    id: "gyeol",
    name: "결 (기본)",
    emoji: "🌊",
    desc: "딥 네이비 + 민트. 깔끔하고 신뢰감 있는 기본 톤.",
    primary: "#173762",
    accent: "#00a39e",
    recommendedFor: ["general"],
  },
  {
    id: "cafe-brown",
    name: "카페 브라운",
    emoji: "☕",
    desc: "따뜻한 원두 브라운 + 라떼 크림. 차분한 카페 무드.",
    primary: "#6f4e37",
    accent: "#c8a06a",
    bg: "#faf7f3",
    recommendedFor: ["cafe"],
  },
  {
    id: "meat-classic",
    name: "고깃집 레드",
    emoji: "🥩",
    desc: "숯불 레드 + 노릇한 골드. 정통 고깃집 기본 색.",
    primary: "#b3322c",
    accent: "#dca23c",
    bg: "#faf6f4",
    recommendedFor: ["meat"],
  },
  {
    id: "modern-white",
    name: "모던 화이트",
    emoji: "🤍",
    desc: "차콜 그레이 + 샴페인 골드. 깔끔·고급 모던 고깃집.",
    primary: "#3a3f47",
    accent: "#b08d57",
    bg: "#f7f7f8",
    recommendedFor: ["meat"],
  },
  {
    id: "chinese-warm",
    name: "중식 주홍",
    emoji: "🥢",
    desc: "너무 쨍하지 않은 주홍 레드 + 황금. 따뜻한 조화.",
    primary: "#a8332a",
    accent: "#d9a441",
    bg: "#faf6f3",
    recommendedFor: ["general"],
  },
  {
    id: "forest-green",
    name: "한식 포레스트",
    emoji: "🌿",
    desc: "깊은 숲 그린 + 누룽지 골드. 건강·한식 분위기.",
    primary: "#2f6b4f",
    accent: "#d99a2b",
    bg: "#f5f9f6",
    recommendedFor: ["general"],
  },
  {
    id: "bakery-cream",
    name: "베이커리 크림",
    emoji: "🥐",
    desc: "구움 브라운 + 부드러운 핑크. 포근한 베이커리.",
    primary: "#b5654d",
    accent: "#e29aa0",
    bg: "#fcf8f5",
    recommendedFor: ["bakery"],
  },
  {
    id: "ocean-blue",
    name: "오션 블루",
    emoji: "🐟",
    desc: "시원한 바다 블루 + 선명한 옐로. 분식·해산물.",
    primary: "#1f6f8b",
    accent: "#f0a500",
    bg: "#f4f8fa",
    recommendedFor: ["general"],
  },
  {
    id: "plum-wine",
    name: "플럼 와인",
    emoji: "🍷",
    desc: "깊은 자두 와인 + 카멜. 이자카야·와인바 무드.",
    primary: "#6d2b4f",
    accent: "#c98b54",
    bg: "#f9f5f7",
    recommendedFor: ["general"],
  },
  {
    id: "charcoal-gold",
    name: "차콜 골드",
    emoji: "🖤",
    desc: "블랙 차콜 + 샴페인 골드. 고급 다이닝·바.",
    primary: "#2b2b2e",
    accent: "#c9a44c",
    bg: "#f6f6f7",
    recommendedFor: ["general"],
  },
  {
    id: "sunset-orange",
    name: "선셋 오렌지",
    emoji: "🍗",
    desc: "활기찬 노을 오렌지 + 토마토 레드. 치킨·분식.",
    primary: "#cf6a1f",
    accent: "#e94f37",
    bg: "#fdf7f2",
    recommendedFor: ["general"],
  },
];

export function getTheme(id?: string | null): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** 업종 기본 추천 테마 — 매장이 아직 테마를 안 고른 경우 폴백 */
export function defaultThemeForIndustry(industry?: Industry): string {
  switch (industry) {
    case "cafe": return "cafe-brown";
    case "meat": return "meat-classic";
    case "bakery": return "bakery-cream";
    default: return DEFAULT_THEME_ID;
  }
}

// ---------- 색 유틸 ----------
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("");
}
/** base 색을 target(흰색/검정) 쪽으로 ratio(0~1) 만큼 섞는다 */
function mix(base: string, target: [number, number, number], ratio: number) {
  const [r, g, b] = hexToRgb(base);
  return rgbToHex(
    r + (target[0] - r) * ratio,
    g + (target[1] - g) * ratio,
    b + (target[2] - b) * ratio,
  );
}
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [17, 18, 28];

/** WCAG 상대휘도 */
function relLum([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** 배경색(hex) 위에 올릴 전경색 — 흰색/잉크 중 대비가 더 큰 쪽. 밝은 accent 위 흰 글씨 가독성 붕괴 방지. */
function bestOn(hex: string): string {
  const L = relLum(hexToRgb(hex));
  const cWhite = 1.05 / (L + 0.05);
  const cInk = (L + 0.05) / (relLum(BLACK) + 0.05);
  return cInk > cWhite ? rgbToHex(...BLACK) : "#ffffff";
}
/** hex 배경 위 흰 텍스트의 대비비 */
function contrastWithWhite(hex: string) {
  return 1.05 / (relLum(hexToRgb(hex)) + 0.05);
}
/**
 * primary 앵커가 너무 밝아 흰 텍스트 대비가 AA(4.5:1) 미만이면, 만족할 때까지 한 톤씩 어둡게 보정.
 * navy-700 배경 + 흰 텍스트 패턴이 앱 전반 50곳+ 에 쓰이므로, 앵커 하나만 보정해 전 사용처를 한 번에 안전화한다.
 * (베이커리 크림·선셋 오렌지처럼 밝은 추천색만 살짝 어두워지고 나머지 테마는 그대로.)
 */
function ensureReadableOnWhiteText(hex: string, min = 4.5): string {
  let c = hex;
  let guard = 0;
  while (contrastWithWhite(c) < min && guard < 16) {
    c = mix(c, BLACK, 0.06);
    guard++;
  }
  return c;
}

/** primary(=navy 자리) 50~900 스케일. 700 단계가 앵커(base). */
function primaryScale(base: string): Record<string, string> {
  return {
    "--color-navy-50": mix(base, WHITE, 0.93),
    "--color-navy-100": mix(base, WHITE, 0.85),
    "--color-navy-200": mix(base, WHITE, 0.68),
    "--color-navy-300": mix(base, WHITE, 0.48),
    "--color-navy-400": mix(base, WHITE, 0.28),
    "--color-navy-500": mix(base, WHITE, 0.14),
    "--color-navy-600": mix(base, WHITE, 0.06),
    "--color-navy-700": base,
    "--color-navy-800": mix(base, BLACK, 0.22),
    "--color-navy-900": mix(base, BLACK, 0.45),
  };
}
/** accent(=mint 자리) 50~700 스케일. 500 단계가 앵커(base). */
function accentScale(base: string): Record<string, string> {
  return {
    "--color-mint-50": mix(base, WHITE, 0.90),
    "--color-mint-100": mix(base, WHITE, 0.78),
    "--color-mint-200": mix(base, WHITE, 0.55),
    "--color-mint-300": mix(base, WHITE, 0.32),
    "--color-mint-400": mix(base, WHITE, 0.14),
    "--color-mint-500": base,
    "--color-mint-600": mix(base, BLACK, 0.20),
    "--color-mint-700": mix(base, BLACK, 0.40),
  };
}

const MANAGED_VARS = [
  ...Object.keys(primaryScale("#000000")),
  ...Object.keys(accentScale("#000000")),
  "--color-bg", "--color-bg-alt", "--shadow-navy", "--shadow-mint",
  "--color-on-primary", "--color-on-accent",
];

const LS_THEME = "gyeol:theme";

/**
 * 테마를 :root 에 적용. 기본 테마는 오버라이드를 제거해 index.css 원본을 복원.
 * persist=true 일 때만 localStorage 에 영속화한다 — 미리보기(휘발성)가 캐시를 오염시키지 않도록
 * '적용'과 '영속화'를 분리. 저장 확정·부팅·컨텍스트 적용에서만 persist:true 를 넘긴다.
 */
export function applyTheme(themeId?: string | null, opts?: { persist?: boolean }) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = getTheme(themeId);

  // 먼저 관리 변수 초기화 (이전 테마 잔여 제거)
  MANAGED_VARS.forEach((v) => root.style.removeProperty(v));

  if (opts?.persist) {
    try { localStorage.setItem(LS_THEME, theme.id); } catch { /* 무시 */ }
  }

  if (theme.id === DEFAULT_THEME_ID) return; // 기본은 index.css 그대로

  // 밝은 primary 는 흰 텍스트 AA 를 만족하도록 자동으로 살짝 어둡게 (navy-700+흰글씨 패턴 전역 보정).
  const primaryBase = ensureReadableOnWhiteText(theme.primary);
  const vars = { ...primaryScale(primaryBase), ...accentScale(theme.accent) };
  Object.entries(vars).forEach(([k, val]) => root.style.setProperty(k, val));

  if (theme.bg) {
    root.style.setProperty("--color-bg", theme.bg);
    root.style.setProperty("--color-bg-alt", mix(theme.bg, BLACK, 0.04));
  }
  // primary/accent 위에 올릴 전경색 — 밝은 테마에서 흰 텍스트가 묻히지 않도록 명도로 자동 선택.
  // 컴포넌트는 text-[var(--color-on-accent,white)] 처럼 fallback 흰색을 두므로 기본 테마는 영향 없음.
  root.style.setProperty("--color-on-primary", bestOn(primaryBase));
  root.style.setProperty("--color-on-accent", bestOn(theme.accent));
  const [pr, pg, pb] = hexToRgb(primaryBase);
  const [ar, ag, ab] = hexToRgb(theme.accent);
  root.style.setProperty("--shadow-navy", `0 8px 24px rgba(${pr}, ${pg}, ${pb}, 0.30)`);
  root.style.setProperty("--shadow-mint", `0 8px 24px rgba(${ar}, ${ag}, ${ab}, 0.26)`);
}

/** 부팅 시 localStorage 캐시 테마를 즉시 적용 — store 로드 전 깜빡임 방지 */
export function bootstrapTheme() {
  if (typeof window === "undefined") return;
  try {
    const cached = localStorage.getItem(LS_THEME);
    if (cached) applyTheme(cached, { persist: true });
  } catch { /* 무시 */ }
}
