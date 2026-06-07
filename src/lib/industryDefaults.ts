import type { Industry } from "./types";

/**
 * 업종별 기본 원재료 — 가입 직후 "빈 화면"을 없애 진입장벽을 낮춘다(ERP 차용 후속).
 * unitCost 는 한국 시세 기준 "대략 참고 단가"(원/단위). 사장이 입고·간편계산으로 조정하면 된다.
 * 단가가 있어야 메뉴 원가가 0이 아니라 "대충이라도" 계산되어 마진 감을 바로 잡을 수 있다.
 * 이름·단위·단가 모두 수정 가능하므로 다국어화하지 않는다(데이터, UI 아님).
 */
export const INDUSTRY_INGREDIENTS: Record<
  Industry,
  { name: string; unit: string; unitCost: number }[]
> = {
  cafe: [
    { name: "원두", unit: "g", unitCost: 30 },
    { name: "우유", unit: "ml", unitCost: 1.2 },
    { name: "바닐라 시럽", unit: "ml", unitCost: 8 },
    { name: "얼음", unit: "g", unitCost: 0.5 },
    { name: "테이크아웃 컵", unit: "개", unitCost: 50 },
    { name: "휘핑크림", unit: "ml", unitCost: 5 },
  ],
  meat: [
    { name: "삼겹살", unit: "g", unitCost: 25 },
    { name: "목살", unit: "g", unitCost: 22 },
    { name: "상추", unit: "g", unitCost: 10 },
    { name: "쌈장", unit: "g", unitCost: 8 },
    { name: "마늘", unit: "g", unitCost: 12 },
    { name: "소주", unit: "병", unitCost: 1200 },
  ],
  bakery: [
    { name: "밀가루", unit: "g", unitCost: 2 },
    { name: "버터", unit: "g", unitCost: 15 },
    { name: "설탕", unit: "g", unitCost: 2 },
    { name: "계란", unit: "개", unitCost: 300 },
    { name: "이스트", unit: "g", unitCost: 30 },
    { name: "생크림", unit: "ml", unitCost: 8 },
  ],
  general: [
    { name: "식용유", unit: "ml", unitCost: 3 },
    { name: "소금", unit: "g", unitCost: 1 },
    { name: "설탕", unit: "g", unitCost: 2 },
    { name: "간장", unit: "ml", unitCost: 5 },
    { name: "일회용 용기", unit: "개", unitCost: 80 },
  ],
};
