/**
 * 매장 영업 시간 — 단일 진실원.
 *
 * 사용:
 *  const status = getStoreOpenStatus(owner);
 *  if (!status.open) showToast(status.reason);
 *
 * 정책:
 *  1. owner.temporarilyClosed === true 면 즉시 closed (긴급 임시 마감)
 *  2. owner.businessHours 미설정 / open24h → 항상 open
 *  3. 오늘 날짜가 closedDates 에 있으면 closed
 *  4. weekly[요일].closed → closed
 *  5. weekly[요일].open ~ close 범위 내면 open
 *     · 단, breakStart~breakEnd 사이면 break (closed 로 취급)
 */
import type { BusinessHours, User } from "./types";
import { t, getLanguage, type Lang } from "./i18n";

export type StoreOpenStatus =
  | { open: true; until?: string }
  | {
      open: false;
      /** 이미 i18n 처리된 사용자용 문구 (deprecated 호환). 새 호출자는 reasonKey 사용. */
      reason: string;
      /** i18n 키 — 호출자가 t(reasonKey, lang, reasonVars) 로 직접 처리할 수 있게 함. */
      reasonKey?: string;
      reasonVars?: Record<string, string | number>;
      from?: string;
    };

const DAY_KEYS = ["bh.day.sun", "bh.day.mon", "bh.day.tue", "bh.day.wed", "bh.day.thu", "bh.day.fri", "bh.day.sat"] as const;
const dayLabel = ["일", "월", "화", "수", "목", "금", "토"] as const;

function toMin(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function todayStr(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getStoreOpenStatus(
  owner: Pick<User, "temporarilyClosed" | "temporaryClosedReason" | "businessHours"> | null | undefined,
  now: Date = new Date()
): StoreOpenStatus {
  if (!owner) return { open: true }; // 정보 없으면 막지 않음

  // 1) 긴급 임시 마감 — 최우선
  if (owner.temporarilyClosed) {
    const customReason = owner.temporaryClosedReason;
    return {
      open: false,
      reason: customReason || t("bh.emergencyDefault", getLanguage()),
      reasonKey: customReason ? undefined : "bh.emergencyDefault",
    };
  }

  const bh: BusinessHours | undefined = owner.businessHours;
  if (!bh) return { open: true };           // 미설정이면 항상 영업 중
  if (bh.open24h) return { open: true };

  // 2) 임시 휴무일 (날짜 매칭)
  const today = todayStr(now);
  if (bh.closedDates?.includes(today)) {
    return { open: false, reason: t("bh.todayHoliday", getLanguage()), reasonKey: "bh.todayHoliday" };
  }

  // 3) 요일별 영업 시간
  const day = now.getDay(); // 0=일
  const w = bh.weekly?.[day];
  if (!w || w.closed) {
    const L = getLanguage();
    const dayName = t(DAY_KEYS[day], L);
    return {
      open: false,
      reason: t("bh.weekdayHoliday", L, { day: dayName }),
      reasonKey: "bh.weekdayHoliday",
      reasonVars: { day: dayName },
    };
  }
  const openM = toMin(w.open);
  const closeM = toMin(w.close);
  if (openM == null || closeM == null) return { open: true };

  const cur = now.getHours() * 60 + now.getMinutes();

  // 마감 시각이 자정을 넘는 경우(예: 09:00 ~ 02:00) — 다음날 새벽까지
  // closeM <= openM 이면 마감이 다음날
  let isInWindow: boolean;
  if (closeM <= openM) {
    // 새벽 마감 케이스
    isInWindow = cur >= openM || cur < closeM;
  } else {
    isInWindow = cur >= openM && cur < closeM;
  }

  if (!isInWindow) {
    const L = getLanguage();
    if (cur < openM && closeM > openM) {
      return {
        open: false,
        reason: t("bh.opensAt", L, { time: w.open ?? "" }),
        reasonKey: "bh.opensAt",
        reasonVars: { time: w.open ?? "" },
        from: w.open,
      };
    }
    return { open: false, reason: t("bh.notOpen", L), reasonKey: "bh.notOpen" };
  }

  // 4) 휴게시간 — 자정 넘는 케이스도 처리 (예: 영업 21:00~02:00, 휴게 23:00~00:30)
  const breakStart = toMin(w.breakStart);
  const breakEnd = toMin(w.breakEnd);
  if (breakStart != null && breakEnd != null) {
    let inBreak: boolean;
    if (breakEnd <= breakStart) {
      // 자정 넘는 휴게시간
      inBreak = cur >= breakStart || cur < breakEnd;
    } else {
      inBreak = cur >= breakStart && cur < breakEnd;
    }
    if (inBreak) {
      const L = getLanguage();
      return {
        open: false,
        reason: t("bh.breakTime", L, { start: w.breakStart ?? "", end: w.breakEnd ?? "" }),
        reasonKey: "bh.breakTime",
        reasonVars: { start: w.breakStart ?? "", end: w.breakEnd ?? "" },
        from: w.breakEnd,
      };
    }
  }

  return { open: true, until: w.close };
}

/** UI 표시용 — 요약 한 줄. lang 인자 없으면 currentLang fallback. */
export function summarizeStatus(s: StoreOpenStatus, lang?: Lang): string {
  const L = lang ?? getLanguage();
  if (s.open === true) {
    return s.until ? t("bh.openLine", L, { until: s.until }) : t("bh.openShort", L);
  }
  // reasonKey 가 있으면 lang 에 맞게 다시 lookup (호출자가 다른 lang 으로 부른 경우 정확히 반영)
  if (s.reasonKey) return t(s.reasonKey, L, s.reasonVars);
  return s.reason;
}

export const DAY_LABELS = dayLabel;

/** 빈 영업 시간 초기값 — 7일 09:00~22:00 기본 */
export function defaultBusinessHours(): BusinessHours {
  return {
    weekly: Array.from({ length: 7 }, () => ({ open: "09:00", close: "22:00", closed: false })),
    closedDates: [],
    open24h: false,
  };
}
