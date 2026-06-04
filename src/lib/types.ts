export type Role = "customer" | "owner" | "staff";
export type StaffStatus = "pending" | "approved" | "rejected";
export type AuthType = "phone" | "google" | "kakao";
export type Industry = "cafe" | "meat" | "bakery" | "general";
export type RewardType = "point" | "stamp";
export type Tier = "일반" | "브론즈" | "실버" | "골드" | "다이아" | "VIP";

export interface StoreConfig {
  industry: Industry;
  rewardType: RewardType;
  pointRate?: number;
  stampMax?: number;
  marketingTriggers?: { inactiveDays?: number; birthdayCoupon?: boolean };
  smsApiKey?: string;
  alimtalkSenderId?: string;
  defaultDashboardView?: "grid" | "map";
  crmCustomInsights?: Record<string, string>;
  locationAccessOnly?: boolean;
  allowedRadius?: number;
  tossClientKey?: string;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  restaurantName?: string;
  storeId?: string;
  googleId?: string;
  kakaoId?: string;
  socialIds?: string[];
  authType?: AuthType;
  status?: "active" | "deleted";
  linkedProviders?: ("google" | "kakao")[];
  isPohangResident?: boolean;
  gender?: "male" | "female";
  memo?: string;
  tierNames?: Record<string, string>;
  tierRewards?: Record<string, string>;
  avatarUrl?: string;
  aligoKey?: string;
  aligoUserId?: string;
  aligoSender?: string;
  smsGatewayUrl?: string;
  foodtechStoreCode?: string;
  /** 사용 중인 POS 벤더 */
  posVendor?: string;
  /** POS API Key 또는 매장 코드 (벤더별로 의미 다름). 비어 있으면 영수증 인쇄 폴백 */
  posApiKey?: string;
  /** 영수증 인쇄 브릿지 사용 의도 (사장님 토글). PC 트레이 앱이 페어링되면 자동으로 큐 발행 */
  printBridgeEnabled?: boolean;
  /** 매장 영업 시간 — 요일별 (다음 turn 에 풀 구현 예정). 미설정 시 항상 영업 중으로 간주 */
  businessHours?: BusinessHours;
  /** 임시 마감(긴급 휴무) — 사장님 헤더 토글로 즉시 ON/OFF */
  temporarilyClosed?: boolean;
  /** 임시 마감 사유 (선택) */
  temporaryClosedReason?: string;
  /** FCM 디바이스 토큰 목록 — 사장님 폰/PC 여러 대 가능. 다중 발송용 */
  fcmTokens?: Array<{ token: string; platform?: string; registeredAt: string }>;
  /** 푸시 알림 종류별 ON/OFF — 사장님이 BrandSettings 에서 조정 */
  pushPrefs?: {
    newOrder?: boolean;       // 새 주문 도착
    paymentRequest?: boolean; // 결제 요청
    staffJoin?: boolean;      // 직원 가입 요청
    couponRequest?: boolean;  // 쿠폰 사용 요청
  };
  /** 페어링된 에이전트 식별자 (디바이스명·OS·페어링 시각). 페어링 해제 시 비움 */
  printBridgeDevice?: { name?: string; pairedAt: string };
  /** 에이전트 마지막 하트비트 시각 — 60초 이상 지나면 '오프라인'으로 표시 */
  printBridgeHeartbeatAt?: string;
  storeConfig?: StoreConfig;
  rewardBalance?: number;
  lat?: number;
  lng?: number;
  birthYear?: number;
  birthday?: string;
  ageGroup?: string;
  privacyAgreedAt?: string;
  /** 직원 전용: 소속 매장 owner id */
  employerStoreId?: string;
  /** 직원 전용: 소속 매장 승인 상태 */
  employerStatus?: StaffStatus;
  /** 직원 전용: 직책/포지션 (홀, 주방 등) */
  position?: string;
  /** 직원 전용: 가입 요청 시각 */
  joinRequestedAt?: string;
}

export interface Shift {
  id: string;
  staffId: string;
  storeId: string;
  clockInAt: string;
  clockOutAt?: string | null;
}

export interface Visit {
  id: string;
  customerId: string;
  storeId: string;
  date: string;
  tableNumber: number;
  totalAmount?: number;
}

export type CouponStatus = "available" | "pending" | "used";
export interface Coupon {
  id: string;
  customerId: string;
  storeId: string;
  type: string;
  description: string;
  status: CouponStatus;
  issuedAt: string;
  usedAt?: string;
  usedAtTable?: number;
}

/**
 * 테이블 8단계 워크플로우 (2026-06).
 *
 * 자동 = 시스템이 트리거 (loadOrders, enterTable, approvePayment 등)
 * 수동 = 사장님/직원이 모달에서 버튼 클릭
 *
 *  1. available  비어있음    자동 (초기/청소완료 시 복귀)
 *  2. reserved   예약됨      수동 (사장님이 예약 입력 또는 직접 표시)
 *  3. setup      세팅완료    수동 (사장님 "준비됐어요" → 손님 입장 대기)
 *  4. occupied   손님입장    자동 (QR enterTable)
 *  5. dining     식사중      자동 (첫 주문 발생 시)
 *  6. paid       결제완료    자동 (approvePayment)
 *  7. cleaning   청소·정리중 수동 (사장님 "정리 시작")
 *  8. → available 청소완료    수동 (사장님 "정리 완료") → 비어있음 자동 복귀
 *
 * 'dirty' 는 호환을 위한 alias → cleaning 으로 매핑.
 */
/**
 * 매장 영업 시간 — 요일별 + 휴게시간 + 휴무일.
 * day 인덱스: 0=일, 1=월, ..., 6=토.
 */
export interface BusinessHours {
  /** 요일별 영업 시간. 각 요일은 ranges 0개 = 휴무, 1개 이상 = 영업 (휴게시간 분리 시 ranges 가 2개) */
  weekly?: Array<{
    open?: string;  // "HH:MM" (예: "09:00")
    close?: string; // "HH:MM" (예: "22:00")
    closed?: boolean; // true 면 그 요일 휴무
    breakStart?: string;
    breakEnd?: string;
  }>;
  /** 특정 날짜 휴무 (YYYY-MM-DD 목록) — 명절·임시휴무 등 */
  closedDates?: string[];
  /** 24시 영업 여부 (true 면 weekly 무시) */
  open24h?: boolean;
}

export type TableStatus =
  | "available"
  | "reserved"
  | "setup"
  | "occupied"
  | "dining"
  | "paid"
  | "cleaning"
  | "dirty";  // legacy alias for cleaning
export interface TableDoc {
  id: string;
  number: number;
  storeId: string;
  currentCustomerId?: string | null;
  /** 함께 앉은 손님 customerId 들 (currentCustomerId 포함). 합석·인원 수 표시용 */
  occupantIds?: string[];
  /** 캐시된 대표 손님 이름 — 사장님 화면에서 빠르게 표시 */
  currentCustomerName?: string | null;
  /** 인원수 (사장님이 입력 또는 손님이 진입 시 선언). 미정이면 null */
  partySize?: number | null;
  sessionStartTime?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  seats: number;
  isRoom?: boolean;
  type?: "table" | "room" | "corridor" | "pos" | "door";
  shape?: "square" | "circle";
  sectionId?: string;
  status?: TableStatus;
}

export interface Section {
  id: string;
  storeId: string;
  name: string;
  order: number;
}

export interface Communication {
  id: string;
  customerId: string;
  storeId: string;
  type: "coupon" | "message";
  senderRole?: "owner" | "customer";
  content: string;
  date: string;
}

export interface TierOverride {
  customerId: string;
  storeId: string;
  tier: Tier | "auto";
}

export interface Menu {
  id: string;
  storeId: string;
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  description?: string;
  isAvailable?: boolean;
  posProductCode?: string;
}

export type OrderStatus = "pending" | "accepted" | "cooking" | "served" | "cancelled";
export interface OrderItem {
  menuId: string;
  name: string;
  quantity: number;
  price: number;
}
export interface Order {
  id: string;
  storeId: string;
  tableNumber: number;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentStatus?: "unpaid" | "requested" | "paid" | "refunded";
  createdAt: string;
}

export type ReservationStatus = "confirmed" | "cancelled" | "completed" | "no-show";
export interface Reservation {
  id: string;
  storeId: string;
  date: string;
  time: string;
  tableNumber: number;
  partySize: number;
  customerName: string;
  customerPhone: string;
  memo?: string;
  status: ReservationStatus;
  createdAt: string;
}

export interface Photo {
  id: string;
  storeId: string;
  /** "review": 손님이 결제 시 남긴 리뷰(글/별점, 사진은 선택). "menu"/"customer": 매장 운영용 사진. */
  type: "menu" | "customer" | "review";
  /** 리뷰는 사진 없어도 됨 — 글/별점만으로 저장 가능. */
  imageData?: string;
  orderId?: string;
  tableNumber?: number;
  customerId?: string;
  customerName?: string;
  menuName?: string;
  snsConsent?: boolean;
  consentedAt?: string;
  pairedPhotoId?: string;
  /** 리뷰 별점 1~5 (선택). */
  rating?: number;
  /** 리뷰 본문 (선택). */
  reviewText?: string;
  /** 외부 채널 자동 업로드 상태 — 추후 블로그/구글 리뷰 연동 대비. */
  syncedTo?: {
    google?: { id?: string; syncedAt: string };
    blog?: { id?: string; syncedAt: string };
  };
  createdAt: string;
}
