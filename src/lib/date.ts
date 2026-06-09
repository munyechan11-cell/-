// ============================================================
// 날짜 유틸 — 로컬(기기/매장) 타임존 기준.
//
// ⚠️ new Date().toISOString().slice(0, 10) 은 UTC 기준이라
//    한국(KST=UTC+9) 자정~오전 9시 사이엔 날짜가 하루 전으로 밀린다.
//    (예: KST 6/8 02:00 → UTC 6/7 17:00 → "2026-06-07")
//    매출/구매/예약처럼 "매장의 오늘"을 따져야 하는 곳에서 이 헬퍼를 쓸 것.
//    같은 패턴이 businessHours.ts·csv.ts·store.tsx 에 흩어져 있던 것을 통일.
// ============================================================

/** 로컬 타임존 기준 YYYY-MM-DD 문자열. 기본값은 오늘. */
export function localTodayStr(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
