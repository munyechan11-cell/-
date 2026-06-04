/**
 * 테이블 8단계 워크플로우 — 단일 진실원.
 *
 * 모든 화면(사장님 대시보드, 테이블 편집, 손님 화면)은
 * 여기서 라벨·색·다음 액션을 가져와 일관되게 보여준다.
 */
import type { TableStatus } from "./types";

/** 화면 표시용 정규화 — 'dirty' 같은 legacy 값을 'cleaning' 으로 맵핑 */
export function normalizeStatus(s?: TableStatus | string | null): TableStatus {
  if (!s) return "available";
  if (s === "dirty") return "cleaning";
  if (
    s === "available" || s === "reserved" || s === "setup" ||
    s === "occupied" || s === "dining" || s === "paid" || s === "cleaning"
  ) return s;
  return "available";
}

export const STATUS_LABEL: Record<TableStatus, string> = {
  available: "비어있음",
  reserved: "예약됨",
  setup: "세팅완료",
  occupied: "손님입장",
  dining: "식사중",
  paid: "결제완료",
  cleaning: "청소·정리중",
  dirty: "청소·정리중",
};

/** 카드 / 모달 헤더용 색상 클래스 (tailwind class) */
export const STATUS_BADGE: Record<TableStatus, { bg: string; text: string; dot: string }> = {
  available: { bg: "bg-white border border-[var(--color-line)]", text: "text-[var(--color-ink-600)]", dot: "bg-[var(--color-ink-300)]" },
  reserved:  { bg: "bg-[#f1ecff]", text: "text-[#6d4cdf]", dot: "bg-[#6d4cdf]" },
  setup:     { bg: "bg-[#fff8e6]", text: "text-[#b07b00]", dot: "bg-[#f0b400]" },
  occupied:  { bg: "bg-[var(--color-mint-50)]", text: "text-[var(--color-mint-700)]", dot: "bg-[var(--color-mint-400)]" },
  dining:    { bg: "bg-[var(--color-mint-100)]", text: "text-[var(--color-mint-700)]", dot: "bg-[var(--color-mint-700)]" },
  paid:      { bg: "bg-[var(--color-navy-100)]", text: "text-[var(--color-navy-700)]", dot: "bg-[var(--color-navy-700)]" },
  cleaning:  { bg: "bg-[#fff1e0]", text: "text-[var(--color-warn)]", dot: "bg-[var(--color-warn)]" },
  dirty:     { bg: "bg-[#fff1e0]", text: "text-[var(--color-warn)]", dot: "bg-[var(--color-warn)]" },
};

/** 정렬 우선순위 (낮을수록 위) — 활성 순서대로 */
export const STATUS_ORDER: Record<TableStatus, number> = {
  cleaning: 0,
  dirty: 0,
  paid: 1,
  dining: 2,
  occupied: 3,
  setup: 4,
  reserved: 5,
  available: 6,
};

/** 단계 번호 (1~7) — UI 진행 바·툴팁에 사용 */
export const STATUS_STEP: Record<TableStatus, number> = {
  available: 1,
  reserved: 2,
  setup: 3,
  occupied: 4,
  dining: 5,
  paid: 6,
  cleaning: 7,
  dirty: 7,
};

/**
 * 다음 단계 수동 전이 — 사장님이 모달에서 누를 버튼.
 * available 에서 갈 수 있는 가지: → reserved 또는 → setup
 * 그 외 단계는 단방향.
 */
export interface ManualTransition {
  /** 버튼 라벨 */
  label: string;
  /** 다음 status */
  to: TableStatus;
  /** 시각 강조 톤 (primary / mint / warn / outline) */
  tone: "primary" | "mint" | "warn" | "outline";
}

export function nextManualTransitions(current: TableStatus): ManualTransition[] {
  switch (normalizeStatus(current)) {
    case "available":
      return [
        { label: "예약 표시", to: "reserved", tone: "outline" },
        { label: "세팅 완료", to: "setup", tone: "primary" },
      ];
    case "reserved":
      return [
        { label: "세팅 완료", to: "setup", tone: "primary" },
        { label: "예약 취소", to: "available", tone: "outline" },
      ];
    case "setup":
      return [
        { label: "예약 표시", to: "reserved", tone: "outline" },
        { label: "비어있음으로 되돌리기", to: "available", tone: "outline" },
      ];
    // occupied / dining / paid 는 자동 전이만. 수동 옵션은 모달 별도 액션
    case "occupied":
    case "dining":
      return [];  // 결제 승인·퇴장 처리는 별도 액션 영역에서
    case "paid":
      return [
        { label: "정리 시작", to: "cleaning", tone: "warn" },
      ];
    case "cleaning":
    case "dirty":
      return [
        { label: "청소 완료 → 비어있음", to: "available", tone: "mint" },
      ];
    default:
      return [];
  }
}
