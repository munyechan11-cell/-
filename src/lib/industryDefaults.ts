import type { Industry } from "./types";

/**
 * 업종별 기본 원재료 — 가입 직후 "빈 화면"을 없애 진입장벽을 낮춘다(ERP 차용 후속).
 * 이름은 한국어 기본값으로 깔고, 단가·재고는 0으로 둔다(사장이 단가 간편계산으로 채움).
 * 사장이 이름/단위를 자유롭게 수정·삭제할 수 있으므로 다국어화하지 않는다(데이터, UI 아님).
 */
export const INDUSTRY_INGREDIENTS: Record<Industry, { name: string; unit: string }[]> = {
  cafe: [
    { name: "원두", unit: "g" },
    { name: "우유", unit: "ml" },
    { name: "바닐라 시럽", unit: "ml" },
    { name: "얼음", unit: "g" },
    { name: "테이크아웃 컵", unit: "개" },
    { name: "휘핑크림", unit: "ml" },
  ],
  meat: [
    { name: "삼겹살", unit: "g" },
    { name: "목살", unit: "g" },
    { name: "상추", unit: "g" },
    { name: "쌈장", unit: "g" },
    { name: "마늘", unit: "g" },
    { name: "소주", unit: "병" },
  ],
  bakery: [
    { name: "밀가루", unit: "g" },
    { name: "버터", unit: "g" },
    { name: "설탕", unit: "g" },
    { name: "계란", unit: "개" },
    { name: "이스트", unit: "g" },
    { name: "생크림", unit: "ml" },
  ],
  general: [
    { name: "식용유", unit: "ml" },
    { name: "소금", unit: "g" },
    { name: "설탕", unit: "g" },
    { name: "간장", unit: "ml" },
    { name: "일회용 용기", unit: "개" },
  ],
};
