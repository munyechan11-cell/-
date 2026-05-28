import type { Tier, Visit } from "./types";

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

export function getRFMCluster(rfm: RFM): Cluster {
  const { r, f, m } = rfm;
  if (r >= 4 && f >= 4) return { id: "vip", label: "VIP 레전드", tone: "text-[#a16207] bg-[#fff8d6]" };
  if (f >= 4 && m >= 4) return { id: "whale", label: "잠재 큰손", tone: "text-[var(--color-navy-700)] bg-[var(--color-navy-100)]" };
  if (r >= 4 && f < 3) return { id: "new", label: "유망 신규", tone: "text-[#1a5fa8] bg-[#e6f0fb]" };
  if (r < 3 && f >= 4) return { id: "slipping", label: "이탈 위험 충성", tone: "text-[#9f1239] bg-[#fef2f2]" };
  if (r < 2) return { id: "cold", label: "장기 휴면", tone: "text-[var(--color-ink-500)] bg-[var(--color-ink-50)]" };
  return { id: "regular", label: "일반 고객", tone: "text-[var(--color-ink-700)] bg-[var(--color-ink-50)]" };
}

export const DEFAULT_INSIGHTS: Record<ClusterId, string> = {
  vip: "VIP 전용 시그니처 메뉴를 슬쩍 권해 보세요.",
  whale: "객단가가 높습니다. 프리미엄 옵션을 추천해 보세요.",
  new: "두 번째 방문 유도 쿠폰을 발급해 보세요.",
  slipping: "재방문 인사 메시지를 보내 보세요.",
  cold: "휴면 복귀 쿠폰으로 다시 모셔보세요.",
  regular: "다음 방문에 사용 가능한 작은 혜택을 제안해 보세요.",
};
