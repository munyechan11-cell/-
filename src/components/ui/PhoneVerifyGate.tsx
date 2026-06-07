/**
 * 기존 가입자(phoneVerifiedAt 누락) 1회 강제 SMS 인증 게이트.
 *
 * 로그인된 사용자가 phoneVerifiedAt 없으면 어디서든 모달을 띄워 인증.
 * 인증 성공 후 markPhoneVerified() 호출 → users.{id}.phoneVerifiedAt 마킹 → 모달 사라짐.
 *
 * 로그인 시점에는 SMS 인증을 요구하지 않는다(사용자 요청). 단, 이미 로그인된 상태에서
 * 미인증인 경우만 게이트가 노출되어 다음 진입을 막는다.
 *
 * 게이트 비활성 조건:
 *   - 미로그인
 *   - phoneVerifiedAt 가 이미 있음
 *   - phone 이 비어있음 (인증할 번호 자체가 없음 — 소셜 가입자 중 phone 비입력 케이스)
 */
import { useState } from "react";
import { useStore } from "../../store/store";
import { PhoneVerifyModal } from "./PhoneVerifyModal";

export function PhoneVerifyGate() {
  const { currentUser, markPhoneVerified } = useStore();
  // 로컬 toggle — 인증 성공 후에도 Firestore 반영 전 깜빡임 방지
  const [done, setDone] = useState(false);

  if (!currentUser) return null;
  if (currentUser.role !== "owner" && currentUser.role !== "staff" && currentUser.role !== "customer") return null;
  if (currentUser.phoneVerifiedAt) return null; // 가입 시 1회 인증 완료 → 재인증 없음
  if (!currentUser.phone) return null; // 인증할 번호 없음
  if (done) return null;

  return (
    <PhoneVerifyModal
      initialPhone={currentUser.phone}
      grandfather
      onVerified={async (e164) => {
        setDone(true);
        try {
          await markPhoneVerified(currentUser.id, e164 || undefined);
        } catch {
          // 실패해도 모달은 닫고 다음 진입 시 다시 시도 — 부분 실패가 사용자를 영구히 가두지 않게.
        }
      }}
    />
  );
}
