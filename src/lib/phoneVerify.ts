/**
 * Firebase Auth Phone Verification 헬퍼.
 *
 * ⚠️ 메인 세션 보호 — 전화 인증은 "보조 Firebase 앱"으로 격리한다.
 *   signInWithPhoneNumber() 는 호출한 auth 의 currentUser 를 phone 계정으로 바꿔버린다.
 *   메인 auth 로 하면 로그인된 Google/익명 세션이 파괴되고, 그걸 signOut→익명 회복으로
 *   메우던 기존 방식이 불안정해 Firestore 쓰기에서 permission-denied("권한이 없습니다")를
 *   유발했다. → 보조 앱으로 분리해 메인 세션을 절대 건드리지 않는다.
 *   인증 성공 후 호출처는 "원래 메인 세션 토큰"으로 users.{id}.phoneVerifiedAt 를 쓴다.
 *
 * 사용 흐름:
 *   1. sendVerificationCode("010-1234-5678", containerId) → ConfirmationResult (SMS 발송)
 *   2. confirmCode(result, code) → 검증된 phoneNumber 반환 (보조 세션만 정리)
 *
 * 비용 (한국 +82): SMS 1건당 약 $0.05. 발송 직전 E.164 변환 + 정규식 검증으로 누수 차단.
 */
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  getAuth,
  signOut,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { firebaseConfig } from "./firebase";

// 전화 인증 전용 보조 앱 — 메인 세션과 분리. 1회 생성 후 재사용.
let secondaryAuth: Auth | null = null;
function getSecondaryAuth(): Auth {
  if (secondaryAuth) return secondaryAuth;
  const existing = getApps().find((a) => a.name === "gyeol-phone-verify");
  const app2 = existing ?? initializeApp(firebaseConfig, "gyeol-phone-verify");
  secondaryAuth = getAuth(app2);
  return secondaryAuth;
}

/**
 * 한국식 전화번호("010-1234-5678", "01012345678") → E.164("+821012345678"). 실패 시 null.
 */
export function toE164KR(phone: string): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  // 82로 시작하면 이미 국가코드 포함, 0으로 시작하면 0 제거 후 +82
  if (digits.startsWith("82")) return `+${digits}`;
  if (!digits.startsWith("0")) return null;
  return `+82${digits.slice(1)}`;
}

/** E.164 한국 번호 정합성 — +8210 등으로 시작하고 적정 자리수. */
export function isValidKRPhone(phone: string): boolean {
  const e164 = toE164KR(phone);
  if (!e164) return false;
  return /^\+82[1-9]\d{7,10}$/.test(e164);
}

let recaptcha: RecaptchaVerifier | null = null;

/**
 * Invisible reCAPTCHA — 매 send 마다 새로 생성(토큰은 verify 1회 후 소진).
 * 보조 auth 에 바인딩한다.
 */
function createFreshRecaptcha(containerId: string): RecaptchaVerifier {
  const a = getSecondaryAuth();
  try {
    recaptcha?.clear();
  } catch (e) {
    console.warn("[phoneVerify] recaptcha clear failed", (e as any)?.message);
  }
  recaptcha = new RecaptchaVerifier(a, containerId, { size: "invisible" });
  return recaptcha;
}

/**
 * 인증번호 SMS 발송 (보조 앱 사용 — 메인 세션 불변).
 * @throws Firebase 오류 (auth/invalid-phone-number, auth/too-many-requests 등) / "invalid-phone"
 */
export async function sendVerificationCode(
  phone: string,
  containerId: string
): Promise<ConfirmationResult> {
  const e164 = toE164KR(phone);
  if (!e164 || !isValidKRPhone(phone)) {
    throw new Error("invalid-phone");
  }
  const verifier = createFreshRecaptcha(containerId);
  return await signInWithPhoneNumber(getSecondaryAuth(), e164, verifier);
}

/**
 * 6자리 코드 검증. 성공 시 검증된 phoneNumber 반환.
 * 보조 세션만 sign out 한다 — 메인(소셜/익명) 세션은 그대로 유지되어,
 * 직후 markPhoneVerified 의 Firestore 쓰기가 원래 토큰으로 정상 통과한다.
 */
export async function confirmCode(
  result: ConfirmationResult,
  code: string
): Promise<string> {
  const cred = await result.confirm(code);
  const phone = cred.user.phoneNumber ?? "";
  try {
    await signOut(getSecondaryAuth());
  } catch (e) {
    console.warn("[phoneVerify] secondary signOut failed", (e as any)?.message);
  }
  return phone;
}

/** 컴포넌트 언마운트 시 호출 — invisible reCAPTCHA DOM 정리. */
export function clearRecaptcha() {
  try {
    recaptcha?.clear();
  } catch (e) {
    console.warn("[phoneVerify] clear failed", (e as any)?.message);
  }
  recaptcha = null;
}
