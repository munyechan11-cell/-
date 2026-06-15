import { t, type Lang } from "./i18n";
import type { Industry } from "./types";

/**
 * 8-9: 업종별 조리 과정 라벨.
 *
 * 같은 "조리 시작/조리 중"이라도 업종에 맞는 동사로 보여준다.
 *  · 고기집(meat) = 굽기, 카페(cafe) = 추출, 베이커리(bakery) = 베이킹, 그 외(general) = 조리(기존).
 * general 은 기존 kds.* 키를 재사용하고, 나머지는 업종 전용 키(kds.start.{ind} / kds.cooking.{ind}).
 */
export function cookStartLabel(industry: Industry | undefined, lang: Lang): string {
  return industry && industry !== "general" ? t(`kds.start.${industry}`, lang) : t("kds.startCooking", lang);
}
export function cookingNowLabel(industry: Industry | undefined, lang: Lang): string {
  return industry && industry !== "general" ? t(`kds.cooking.${industry}`, lang) : t("kds.cooking", lang);
}
