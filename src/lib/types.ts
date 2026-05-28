export type Role = "customer" | "owner";
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
  storeConfig?: StoreConfig;
  rewardBalance?: number;
  lat?: number;
  lng?: number;
  birthYear?: number;
  birthday?: string;
  ageGroup?: string;
  privacyAgreedAt?: string;
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

export type TableStatus = "available" | "occupied" | "paid" | "dirty";
export interface TableDoc {
  id: string;
  number: number;
  storeId: string;
  currentCustomerId?: string | null;
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
  paymentStatus?: "unpaid" | "paid" | "refunded";
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
  type: "menu" | "customer";
  imageData: string;
  orderId?: string;
  tableNumber?: number;
  customerId?: string;
  customerName?: string;
  menuName?: string;
  snsConsent?: boolean;
  consentedAt?: string;
  pairedPhotoId?: string;
  createdAt: string;
}
