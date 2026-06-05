/**
 * 전화번호 SMS 인증 모달.
 *
 * 두 가지 모드:
 *   1. signup — 가입 폼에서 호출. phone 은 외부에서 받고, 인증 성공 시 onVerified() 콜백.
 *      'X' / '나중에' 버튼 동작은 외부에서 결정 (signup 흐름에선 차단 권장).
 *   2. grandfather — 기존 가입자 강제 인증. 로그인 직후 phoneVerifiedAt 가 없으면 띄움.
 *      현재 phone 이 user.phone 인 점은 외부가 보장.
 *
 * 비용 누수 차단:
 *   - send 전 isValidKRPhone() 정규식 검증
 *   - 60초 재발송 쿨다운
 *   - busy 가드로 더블 클릭 방지
 *
 * UX:
 *   - reCAPTCHA badge invisible (auto)
 *   - 발송 후 코드 입력 단계로 자동 전환
 *   - 코드 자동 포커스
 *   - 모달 esc/배경 닫기 — signup 모드에선 차단, grandfather 모드에선 허용 안 함(강제)
 */
import { useEffect, useRef, useState } from "react";
import { Phone, ShieldCheck, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { formatPhoneNumber, digitsOnly } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { useLanguage, t } from "../../lib/i18n";
import {
  sendVerificationCode,
  confirmCode,
  isValidKRPhone,
  clearRecaptcha,
} from "../../lib/phoneVerify";
import type { ConfirmationResult } from "firebase/auth";

const RESEND_COOLDOWN_SEC = 60;
const RECAPTCHA_CONTAINER_ID = "gyeol-recaptcha-container";

interface Props {
  /** 사전 입력된 전화번호 (가입 폼에서 받은 값). 비어 있으면 입력 폼 노출. */
  initialPhone?: string;
  /** grandfather 모드 — 기존 가입자 1회 강제 인증. 메시지 문구가 다름. */
  grandfather?: boolean;
  /** 닫기 허용 여부. signup/grandfather 모두 기본 false (인증 마쳐야 진행). */
  allowClose?: boolean;
  onClose?: () => void;
  onVerified: (e164: string) => void;
}

export function PhoneVerifyModal({
  initialPhone = "",
  grandfather = false,
  allowClose = false,
  onClose,
  onVerified,
}: Props) {
  const lang = useLanguage();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const confirmRef = useRef<ConfirmationResult | null>(null);

  // 쿨다운 타이머
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // 언마운트 시 reCAPTCHA 정리
  useEffect(() => {
    return () => clearRecaptcha();
  }, []);

  const send = async () => {
    if (sending) return;
    if (!isValidKRPhone(phone)) {
      showToast(t("phoneVerify.toast.invalidPhone", lang), "error");
      return;
    }
    setSending(true);
    try {
      const result = await sendVerificationCode(phone, RECAPTCHA_CONTAINER_ID);
      confirmRef.current = result;
      setStage("code");
      setCooldown(RESEND_COOLDOWN_SEC);
      showToast(t("phoneVerify.toast.sent", lang), "info");
    } catch (e: any) {
      const msg = e?.code === "auth/invalid-phone-number"
        ? t("phoneVerify.toast.invalidPhone", lang)
        : e?.message ?? "";
      showToast(t("phoneVerify.toast.sendFail", lang, { msg }), "error");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (verifying) return;
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      showToast(t("phoneVerify.toast.codeEmpty", lang), "error");
      return;
    }
    if (!confirmRef.current) {
      showToast(t("phoneVerify.toast.expired", lang), "error");
      setStage("phone");
      return;
    }
    setVerifying(true);
    try {
      const verifiedE164 = await confirmCode(confirmRef.current, cleanCode);
      showToast(t("phoneVerify.toast.verified", lang), "success");
      onVerified(verifiedE164);
    } catch (e: any) {
      const code = String(e?.code ?? "");
      if (code.includes("invalid-verification-code")) {
        showToast(t("phoneVerify.toast.wrongCode", lang), "error");
      } else if (code.includes("code-expired")) {
        showToast(t("phoneVerify.toast.expired", lang), "error");
        setStage("phone");
        confirmRef.current = null;
      } else {
        showToast(t("phoneVerify.toast.sendFail", lang, { msg: e?.message ?? "" }), "error");
      }
    } finally {
      setVerifying(false);
    }
  };

  const tryClose = () => {
    if (!allowClose) {
      showToast(t("phoneVerify.skipBlocked", lang), "info");
      return;
    }
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) tryClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-[440px] bg-white sm:rounded-[20px] rounded-t-[20px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[92vh] overflow-y-auto"
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold text-[var(--color-navy-900)]">
              {t("phoneVerify.title", lang)}
            </h2>
            <p className="text-[12px] text-[var(--color-ink-500)] leading-snug">
              {grandfather ? t("phoneVerify.descGrandfather", lang) : t("phoneVerify.desc", lang)}
            </p>
          </div>
          {allowClose && (
            <button
              onClick={tryClose}
              aria-label={t("common.close", lang)}
              className="w-9 h-9 rounded-full hover:bg-[var(--color-ink-50)] inline-flex items-center justify-center"
            >
              <X className="w-4 h-4 text-[var(--color-ink-500)]" />
            </button>
          )}
        </div>

        {/* Stage 1: 전화번호 입력 + 발송 */}
        {stage === "phone" && (
          <div className="space-y-3">
            <Input
              label={t("phoneVerify.phone", lang)}
              placeholder={t("phoneVerify.phonePh", lang)}
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              inputMode="numeric"
              leftSlot={<Phone className="w-4 h-4" />}
              disabled={!!initialPhone && !grandfather /* 가입 폼에서 받은 번호는 잠금 */}
            />
            <Button
              block
              onClick={send}
              loading={sending}
              disabled={!isValidKRPhone(phone) || sending}
            >
              {t("phoneVerify.send", lang)}
            </Button>
          </div>
        )}

        {/* Stage 2: 코드 입력 + 검증 */}
        {stage === "code" && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[var(--color-ink-600)] tabular-nums">
              {phone}
            </p>
            <Input
              label={t("phoneVerify.codeLabel", lang)}
              placeholder={t("phoneVerify.codePh", lang)}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
            />
            <Button
              block
              onClick={verify}
              loading={verifying}
              disabled={code.length !== 6 || verifying}
            >
              {t("phoneVerify.confirm", lang)}
            </Button>
            <button
              type="button"
              onClick={send}
              disabled={cooldown > 0 || sending}
              className="w-full h-9 text-[12.5px] font-bold text-[var(--color-ink-600)] hover:text-[var(--color-navy-700)] disabled:opacity-50"
            >
              {cooldown > 0
                ? t("phoneVerify.resendIn", lang, { n: cooldown })
                : t("phoneVerify.resend", lang)}
            </button>
          </div>
        )}

        {/* invisible reCAPTCHA 마운트 지점 — DOM 에 존재해야 verify() 가 동작 */}
        <div id={RECAPTCHA_CONTAINER_ID} className="mt-2" />
        <p className="text-[10.5px] text-[var(--color-ink-400)] mt-3 leading-relaxed">
          protected by reCAPTCHA · {digitsOnly(phone).length} digits
        </p>
      </div>
    </div>
  );
}
