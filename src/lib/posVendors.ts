export type PosVendor =
  | "none"
  | "toss"
  | "easypos"
  | "okpos"
  | "unipos"
  | "foodtech"
  | "solbipos"
  | "payhere"
  | "catonepos"
  | "duripos"
  | "kispos"
  | "lpos"
  | "kiosk"
  | "smartro"
  | "kicc"
  | "etc";

export interface PosVendorInfo {
  id: PosVendor;
  label: string;
  /** 해당 벤더가 API 키를 사용하는지 (false면 매장 코드/없음) */
  needsApiKey: boolean;
  /** 키 필드 라벨 */
  keyLabel?: string;
  /** 입력 placeholder */
  placeholder?: string;
  /** 도움말 */
  hint?: string;
}

export const POS_VENDORS: PosVendorInfo[] = [
  { id: "none", label: "POS 미사용 (영수증 자동 인쇄)", needsApiKey: false, hint: "주문 접수 시 영수증 인쇄 창이 자동으로 열립니다." },
  { id: "toss", label: "토스 플레이스", needsApiKey: true, keyLabel: "Secret Key", placeholder: "test_sk_…", hint: "토스페이먼츠 시크릿 키" },
  { id: "easypos", label: "이지포스", needsApiKey: true, keyLabel: "매장 코드 / API 키", placeholder: "예: 1234567890" },
  { id: "okpos", label: "오케이포스 (OKPOS)", needsApiKey: true, keyLabel: "가맹점 ID", placeholder: "OKPOS_…" },
  { id: "unipos", label: "유니포스", needsApiKey: true, keyLabel: "매장 코드", placeholder: "UP_…" },
  { id: "foodtech", label: "푸드테크 POS", needsApiKey: true, keyLabel: "매장 코드", placeholder: "예: FT-2024-0001" },
  { id: "solbipos", label: "솔비포스", needsApiKey: true, keyLabel: "매장 코드", placeholder: "SB_…" },
  { id: "payhere", label: "페이히어 (PAYHERE)", needsApiKey: true, keyLabel: "API Token", placeholder: "ph_live_…" },
  { id: "catonepos", label: "캣원포스 (CatOne)", needsApiKey: true, keyLabel: "API Key", placeholder: "CAT_…" },
  { id: "duripos", label: "두리포스", needsApiKey: true, keyLabel: "매장 코드", placeholder: "DR_…" },
  { id: "kispos", label: "KIS POS", needsApiKey: true, keyLabel: "가맹점 번호", placeholder: "KIS-…" },
  { id: "lpos", label: "엘포스 (LPOS)", needsApiKey: true, keyLabel: "API Key", placeholder: "LP_…" },
  { id: "smartro", label: "스마트로", needsApiKey: true, keyLabel: "MID", placeholder: "smart_…" },
  { id: "kicc", label: "KICC (한국정보통신)", needsApiKey: true, keyLabel: "가맹점 번호", placeholder: "KICC-…" },
  { id: "kiosk", label: "키오스크형 POS", needsApiKey: true, keyLabel: "디바이스 ID", placeholder: "KIOSK-…" },
  { id: "etc", label: "기타 / 직접 연동", needsApiKey: true, keyLabel: "API 엔드포인트 또는 키", placeholder: "https://api.example.com/orders" },
];

export function getVendor(id?: PosVendor | string | null): PosVendorInfo {
  return POS_VENDORS.find((v) => v.id === id) ?? POS_VENDORS[0];
}
