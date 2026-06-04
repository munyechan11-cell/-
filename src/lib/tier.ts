import type { Tier, Visit } from "./types";
import { t, getLanguage, type Lang } from "./i18n";

export const TIER_ORDER: Tier[] = ["일반", "브론즈", "실버", "골드", "다이아", "VIP"];

const TIER_THRESHOLDS: { tier: Tier; min: number }[] = [
  { tier: "VIP", min: 12 },
  { tier: "다이아", min: 8 },
  { tier: "골드", min: 6 },
  { tier: "실버", min: 4 },
  { tier: "브론즈", min: 2 },
  { tier: "일반", min: 0 },
];

export function getCustomerTier(visitCount: number): Tier {
  for (const t of TIER_THRESHOLDS) if (visitCount >= t.min) return t.tier;
  return "일반";
}

export function getNextTier(current: Tier): { tier: Tier; min: number } | null {
  const idx = TIER_ORDER.indexOf(current);
  if (idx < 0 || idx === TIER_ORDER.length - 1) return null;
  const next = TIER_ORDER[idx + 1];
  const t = TIER_THRESHOLDS.find((x) => x.tier === next);
  return t ? { tier: next, min: t.min } : null;
}

export function getEffectiveTier(
  visitCount: number,
  override?: Tier | "auto" | null
): Tier {
  if (override && override !== "auto") return override;
  return getCustomerTier(visitCount);
}

export const TIER_BADGE: Record<Tier, { label: string; bg: string; text: string }> = {
  일반: { label: "일반", bg: "bg-[var(--color-ink-50)]", text: "text-[var(--color-ink-500)]" },
  브론즈: { label: "브론즈", bg: "bg-[#fef0e0]", text: "text-[#b45309]" },
  실버: { label: "실버", bg: "bg-[#eef2f7]", text: "text-[#475569]" },
  골드: { label: "골드", bg: "bg-[#fff8d6]", text: "text-[#a16207]" },
  다이아: { label: "다이아", bg: "bg-[var(--color-mint-100)]", text: "text-[var(--color-mint-700)]" },
  VIP: { label: "VIP", bg: "bg-[var(--color-navy-100)]", text: "text-[var(--color-navy-700)]" },
};

// --- RFM ---
export interface RFM {
  r: 1 | 2 | 3 | 4 | 5;
  f: 1 | 2 | 3 | 4 | 5;
  m: 1 | 2 | 3 | 4 | 5;
}

export function calculateRFM(visits: Visit[], now = Date.now()): RFM {
  if (visits.length === 0) return { r: 1, f: 1, m: 1 };
  const last = visits.reduce((mx, v) => Math.max(mx, new Date(v.date).getTime()), 0);
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);
  const r: RFM["r"] = (daysSince <= 7 ? 5 : daysSince <= 14 ? 4 : daysSince <= 30 ? 3 : daysSince <= 60 ? 2 : 1) as RFM["r"];
  const freq = visits.length;
  const f: RFM["f"] = (freq >= 10 ? 5 : freq >= 5 ? 4 : freq >= 3 ? 3 : freq >= 2 ? 2 : 1) as RFM["f"];
  const totalAmount = visits.reduce((s, v) => s + (v.totalAmount ?? 0), 0);
  const avg = totalAmount / Math.max(freq, 1);
  const m: RFM["m"] = (avg >= 50000 ? 5 : avg >= 30000 ? 4 : avg >= 15000 ? 3 : avg >= 8000 ? 2 : 1) as RFM["m"];
  return { r, f, m };
}

export type ClusterId = "vip" | "new" | "slipping" | "cold" | "whale" | "regular";

export interface Cluster {
  id: ClusterId;
  label: string;
  tone: string;
}

const CLUSTER_TONE: Record<ClusterId, string> = {
  vip: "text-[#a16207] bg-[#fff8d6]",
  whale: "text-[var(--color-navy-700)] bg-[var(--color-navy-100)]",
  new: "text-[#1a5fa8] bg-[#e6f0fb]",
  slipping: "text-[#9f1239] bg-[#fef2f2]",
  cold: "text-[var(--color-ink-500)] bg-[var(--color-ink-50)]",
  regular: "text-[var(--color-ink-700)] bg-[var(--color-ink-50)]",
};

const CLUSTER_LABEL_KEY: Record<ClusterId, string> = {
  vip: "cluster.vip",
  whale: "cluster.whale",
  new: "cluster.new",
  slipping: "cluster.slipping",
  cold: "cluster.cold",
  regular: "cluster.regular",
};

function clusterOf(id: ClusterId, lang?: Lang): Cluster {
  return { id, label: t(CLUSTER_LABEL_KEY[id], lang ?? getLanguage()), tone: CLUSTER_TONE[id] };
}

export function getRFMCluster(rfm: RFM, lang?: Lang): Cluster {
  const { r, f, m } = rfm;
  if (r >= 4 && f >= 4) return clusterOf("vip", lang);
  if (f >= 4 && m >= 4) return clusterOf("whale", lang);
  if (r >= 4 && f < 3) return clusterOf("new", lang);
  if (r < 3 && f >= 4) return clusterOf("slipping", lang);
  if (r < 2) return clusterOf("cold", lang);
  return clusterOf("regular", lang);
}

const INSIGHT_KEY: Record<ClusterId, string> = {
  vip: "insight.vip",
  whale: "insight.whale",
  new: "insight.new",
  slipping: "insight.slipping",
  cold: "insight.cold",
  regular: "insight.regular",
};

/** Legacy: 호출 시점의 currentLang 으로 동적 lookup. */
export const DEFAULT_INSIGHTS: Record<ClusterId, string> = new Proxy({} as Record<ClusterId, string>, {
  get(_target, prop: string) {
    if (prop in INSIGHT_KEY) {
      return t(INSIGHT_KEY[prop as ClusterId], getLanguage());
    }
    return undefined;
  },
}) as Record<ClusterId, string>;
