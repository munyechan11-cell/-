/**
 * Firebase Auth Phone Verification 헬퍼.
 *
 * 사용 흐름:
 *   1. ensureRecaptcha(containerId) — invisible reCAPTCHA 컨테이너 마운트 (1회)
 *   2. sendVerificationCode("010-1234-5678") → ConfirmationResult
 *   3. user 가 받은 6자리 코드 입력 → confirmCode(result, code) → 검증된 phoneNumber 반환
 *
 * 주의:
 *   - 부팅 시 익명 로그인된 상태라면 phone 인증 시 익명 → phone account 로 자동 업그레이드됨.
 *     기존 소셜 계정과 연결하려면 confirmCode 호출 후 우리 측 users.{id}.phoneVerifiedAt 갱신만으로 충분 —
 *     phone Firebase user 는 검증 용도로만 사용하고 즉시 sign out 처리.
 *   - reCAPTCHA Verifier 는 한 번 호출되면 재사용 불가 — 매 send 마다 새로 생성.
 *
 * 비용 (한국 +82): SMS 1건당 약 $0.05. 무료 할당 미적용.
 * 비용 누수 방지 — 발송 직전에 E.164 변환 + 정규식 검증.
 */
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * 'YYYY-MM-DD' 폼이 아닌 한국식 전화번호("010-1234-5678", "01012345678") 를
 * E.164 형식("+821012345678") 으로 변환. 변환 실패 시 null.
 */
export function toE164KR(phone: string): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  // 010, 011, 016, 017, 018, 019, 070, 02, 0xx
  // 가장 흔한 010 (11자리), 그 외 0X로 시작하는 9~11자리
  if (digits.startsWith("82")) return `+${digits}`;
  if (!digits.startsWith("0")) return null;
  // 0 제거 후 +82 prefix
  return `+82${digits.slice(1)}`;
}

/**
 * E.164 한국 번호 정합성 — +8210, +8211 등으로 시작하고 10~11자리 끝.
 */
export function isValidKRPhone(phone: string): boolean {
  const e164 = toE164KR(phone);
  if (!e164) return false;
  return /^\+82[1-9]\d{7,10}$/.test(e164);
}

let recaptcha: RecaptchaVerifier | null = null;
let recaptchaContainerId: string | null = null;

/**
 * Invisible reCAPTCHA Verifier 1회 생성 또는 재사용.
 * 호출자가 button container DOM id 를 전달 — 그 안에 invisible badge 가 마운트됨.
 *
 * RecaptchaVerifier 인스턴스는 verify() 호출 후 토큰이 소진되면 자동 reset 되지만,
 * 안전하게 매 send 전에 .clear() 후 새로 만들어 사용.
 */
function getOrCreateRecaptcha(containerId: string): RecaptchaVerifier {
  if (!auth) throw new Error("Firebase Auth not configured");
  if (recaptcha && recaptchaContainerId === containerId) {
    return recaptcha;
  }
  try {
    recaptcha?.clear();
  } catch {}
  recaptcha = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  });
  recaptchaContainerId = containerId;
  return recaptcha;
}

/**
 * 인증번호 SMS 발송.
 * @param phone 한국식 전화번호 ("010-1234-5678" 등). 내부에서 E.164 변환.
 * @param containerId invisible reCAPTCHA 가 마운트될 DOM id (사라지지 않게 send 동안 유지)
 * @returns ConfirmationResult — confirmCode 에 전달
 * @throws Firebase 오류 (auth/invalid-phone-number, auth/too-many-requests 등)
 */
export async function sendVerificationCode(
  phone: string,
  containerId: string
): Promise<ConfirmationResult> {
  if (!auth) throw new Error("Firebase Auth not configured");
  const e164 = toE164KR(phone);
  if (!e164 || !isValidKRPhone(phone)) {
    throw new Error("invalid-phone");
  }
  const verifier = getOrCreateRecaptcha(containerId);
  return await signInWithPhoneNumber(auth, e164, verifier);
}

/**
 * 6자리 코드 검증. 성공 시 Firebase user 의 phoneNumber 반환.
 * 즉시 sign out 처리해서 익명/소셜 세션이 phone user 로 바뀌는 사이드이펙트 차단.
 */
export async function confirmCode(
  result: ConfirmationResult,
  code: string
): Promise<string> {
  const cred = await result.confirm(code);
  const phone = cred.user.phoneNumber ?? "";
  // phone 검증 용도로만 사용 — 실제 앱 세션은 우리 users 컬렉션 기반이라
  // 익명/소셜 세션을 그대로 두려면 sign out 후 다시 익명 토큰 받기.
  // 다만 phone 인증 후 sign out 하면 현재 카카오/구글 사용자가 로그아웃되는
  // 사이드이펙트 발생 가능. 호출처에서 인증 직후 우리 store 의 login() 을
  // 곧장 호출해 다시 세션을 회복하는 패턴으로 사용.
  try {
    if (auth) await signOut(auth);
  } catch {}
  return phone;
}

/** 컴포넌트 언마운트 시 호출 — invisible reCAPTCHA DOM 정리. */
export function clearRecaptcha() {
  try {
    recaptcha?.clear();
  } catch {}
  recaptcha = null;
  recaptchaContainerId = null;
}
