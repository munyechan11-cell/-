import type { StaffLevel } from "./types";

// ============================================================
// 직원 권한 — 단일 진실 원천(STAFF_FEATURES).
//
// NAV 필터(OwnerShell)·라우트 가드(App)·등급 설정 UI(Staff) 가 모두 이 배열을 참조한다.
// 권한 = 등급(staffLevel) 기본 + 사장님 개별 추가(extraPerms) 2개 레이어.
//   · 등급별 기본: minLevel 이하 직원이면 자동 접근 (알바<정규직<매니저<실장 누적)
//   · 개별 추가: 사장님이 특정 직원에게 minLevel 을 넘어 개별 허용 (개방적 매핑까지 자유 조정)
// 목록에 없는 경로(키오스크·브랜드설정 등) = 사장 전용. 직원에게 절대 노출/허용되지 않는다.
// ============================================================

export const STAFF_LEVELS: StaffLevel[] = [1, 2, 3, 4];

/** 등급 → i18n 키 접미사. t(`staffLevel.${key}`) 로 화면 표시. */
export const STAFF_LEVEL_KEY: Record<StaffLevel, string> = {
  1: "part",
  2: "regular",
  3: "manager",
  4: "director",
};

export interface StaffFeature {
  /** 라우트 경로 (NAV.to 와 동일) */
  path: string;
  /** 이 기능을 기본 포함하는 최소 등급 */
  minLevel: StaffLevel;
  /** 표시 라벨 i18n 키 (ownerNav.* 재사용) */
  labelKey: string;
}

/** 표준 매핑 — 등급별 기본 권한. 사장님은 직원별로 extraPerms 를 더해 개방적으로 확장할 수 있다. */
export const STAFF_FEATURES: StaffFeature[] = [
  // lv1 알바생 — 현장 운영
  { path: "/biz/owner/orders", minLevel: 1, labelKey: "ownerNav.orders" },
  { path: "/biz/owner/quick-order", minLevel: 1, labelKey: "ownerNav.quickOrder" },
  { path: "/biz/owner/kitchen", minLevel: 1, labelKey: "ownerNav.kitchen" },
  { path: "/biz/owner/tables", minLevel: 1, labelKey: "ownerNav.tables" },
  { path: "/biz/owner/menus", minLevel: 1, labelKey: "ownerNav.menus" },
  { path: "/biz/owner/reservations", minLevel: 1, labelKey: "ownerNav.reservations" },
  { path: "/biz/owner/photos", minLevel: 1, labelKey: "ownerNav.reviews" },
  { path: "/biz/owner/qr-print", minLevel: 1, labelKey: "ownerNav.qrPrint" },
  { path: "/biz/owner/help", minLevel: 1, labelKey: "ownerNav.help" },
  // lv2 정규직 — + 고객관계
  { path: "/biz/owner/customers", minLevel: 2, labelKey: "ownerNav.customers" },
  { path: "/biz/owner/marketing", minLevel: 2, labelKey: "ownerNav.marketing" },
  // lv3 매니저 — + 경영 분석
  { path: "/biz/owner/inventory", minLevel: 3, labelKey: "ownerNav.inventory" },
  { path: "/biz/owner/statistics", minLevel: 3, labelKey: "ownerNav.statistics" },
  // lv4 실장 — + 정산·인사
  { path: "/biz/owner/settlement", minLevel: 4, labelKey: "ownerNav.settlement" },
  { path: "/biz/owner/staff", minLevel: 4, labelKey: "ownerNav.staff" },
];

const MIN_LEVEL = new Map(STAFF_FEATURES.map((f) => [f.path, f.minLevel]));

/** 경로의 기본 최소 등급. 사장 전용(목록에 없음)이면 undefined. */
export function staffMinLevel(path: string): StaffLevel | undefined {
  return MIN_LEVEL.get(path);
}

/** 직원이 경로에 접근 가능? 등급 기본 충족 OR 사장님이 개별 허용(extraPerms). */
export function canStaffAccess(path: string, level: StaffLevel, extraPerms?: string[]): boolean {
  const need = MIN_LEVEL.get(path);
  if (need == null) return false; // 사장 전용
  return level >= need || (extraPerms?.includes(path) ?? false);
}

/** 출근하지 않아도 접근 가능한 경로 — 등급과 별개 축(예약·도움말). */
export const STAFF_FREE_PATHS = new Set(["/biz/owner/reservations", "/biz/owner/help"]);
