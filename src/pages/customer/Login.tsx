import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle, Phone, Mars, Venus, Check } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatPhoneNumber } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { useStore } from "../../store/store";
import { signInWithGoogle, signInWithKakao } from "../../lib/auth";
import { cn } from "../../lib/cn";

type Step = 1 | 2 | 3;

export default function CustomerLogin() {
  const nav = useNavigate();
  const { storeId } = useParams();
  const [params] = useSearchParams();
  const tableNum = params.get("table");
  const { login } = useStore();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [social, setSocial] = useState<{ id: string; provider: "google" | "kakao"; avatarUrl?: string } | null>(
    null
  );
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeService, setAgreeService] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [loading, setLoading] = useState(false);

  const onAfterLogin = () => {
    // QR로 진입한 경우만 그 매장으로 복귀, 그 외엔 내 개인 대시보드
    const target = storeId
      ? tableNum
        ? `/customer/store/${storeId}/table/${tableNum}`
        : `/customer/store/${storeId}`
      : "/customer";
    nav(target, { replace: true });
  };

  const handleSocial = async (provider: "google" | "kakao") => {
    setLoading(true);
    try {
      const res = provider === "google" ? await signInWithGoogle() : await signInWithKakao();
      setSocial({ id: res.id, provider, avatarUrl: res.avatarUrl });
      if (res.name) setName(res.name);
      setStep(2);
    } catch (e: any) {
      showToast(`소셜 연동 실패: ${e?.message ?? "알 수 없는 오류"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const submitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      showToast("이름과 전화번호를 정확히 입력해 주세요.", "error");
      return;
    }
    setStep(2);
  };

  const submitStep2 = () => {
    if (!gender) {
      showToast("성별을 선택해 주세요.", "error");
      return;
    }
    if (!birthYear || !birthMonth || !birthDay) {
      showToast("생년월일을 입력해 주세요.", "error");
      return;
    }
    setStep(3);
  };

  const submitStep3 = async () => {
    if (!agreePrivacy || !agreeService) {
      showToast("필수 약관에 동의해 주세요.", "error");
      return;
    }
    setLoading(true);
    try {
      await login({
        phone,
        name,
        role: "customer",
        socialId: social?.id,
        socialProvider: social?.provider,
        authType: social?.provider ?? "phone",
        avatarUrl: social?.avatarUrl,
        gender: gender ?? undefined,
        birthYear: birthYear ? Number(birthYear) : undefined,
        birthday: `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`,
        privacyAgreedAt: new Date().toISOString(),
      });
      onAfterLogin();
    } catch (e: any) {
      showToast(`가입 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <TopBar title={step === 1 ? "고객 로그인" : `회원가입 ${step - 1}/2`} back />
      <div className="px-6 pt-2">
        <Stepper step={step} />

        {step === 1 && (
          <>
            <h1 className="headline-section mt-6 mb-1">반갑습니다</h1>
            <p className="body-md text-[var(--color-ink-500)]">
              전화번호로 단골 혜택을 시작해 보세요.
            </p>
            <form onSubmit={submitStep1} className="mt-7 space-y-4">
              <Input
                label="이름"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Input
                label="전화번호"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                inputMode="numeric"
                autoComplete="tel"
                leftSlot={<Phone className="w-4 h-4" />}
              />
              <Button block type="submit" disabled={!phone || !name}>
                다음
              </Button>
            </form>

            <div className="my-7 flex items-center gap-3 text-[12px] text-[var(--color-ink-300)] font-semibold">
              <div className="flex-1 h-px bg-[var(--color-line)]" />
              또는 소셜로
              <div className="flex-1 h-px bg-[var(--color-line)]" />
            </div>
            <div className="space-y-3">
              <Button variant="outline" block onClick={() => handleSocial("google")} loading={loading}>
                Google로 계속하기
              </Button>
              <button
                onClick={() => handleSocial("kakao")}
                disabled={loading}
                className="w-full h-14 rounded-[14px] bg-[#FEE500] text-[#191919] font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                <MessageCircle className="w-5 h-5" />
                카카오로 계속하기
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="headline-section mt-6 mb-1">기본 정보</h2>
            <p className="body-md text-[var(--color-ink-500)]">
              맞춤 혜택을 위해 사용됩니다.
            </p>

            <div className="mt-7">
              <p className="text-[13px] font-semibold text-[var(--color-navy-800)] mb-2">성별</p>
              <div className="grid grid-cols-2 gap-3">
                <GenderChip active={gender === "male"} onClick={() => setGender("male")}>
                  <Mars className="w-4 h-4" /> 남성
                </GenderChip>
                <GenderChip active={gender === "female"} onClick={() => setGender("female")}>
                  <Venus className="w-4 h-4" /> 여성
                </GenderChip>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[13px] font-semibold text-[var(--color-navy-800)] mb-2">생년월일</p>
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="YYYY" inputMode="numeric" maxLength={4} value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))} />
                <Input placeholder="MM" inputMode="numeric" maxLength={2} value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, ""))} />
                <Input placeholder="DD" inputMode="numeric" maxLength={2} value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>

            <Button block className="mt-8" onClick={submitStep2}>다음</Button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="headline-section mt-6 mb-1">약관 동의</h2>
            <p className="body-md text-[var(--color-ink-500)]">
              아래 내용을 확인하고 동의해 주세요.
            </p>

            <div className="mt-7 space-y-3">
              <Agree
                checked={agreePrivacy && agreeService && agreeMarketing}
                onClick={() => {
                  const next = !(agreePrivacy && agreeService && agreeMarketing);
                  setAgreePrivacy(next);
                  setAgreeService(next);
                  setAgreeMarketing(next);
                }}
                bold
              >
                전체 동의
              </Agree>
              <div className="h-px bg-[var(--color-line)]" />
              <Agree checked={agreePrivacy} onClick={() => setAgreePrivacy((v) => !v)}>
                <span className="text-[var(--color-danger)] mr-1">[필수]</span> 개인정보 처리방침
              </Agree>
              <Agree checked={agreeService} onClick={() => setAgreeService((v) => !v)}>
                <span className="text-[var(--color-danger)] mr-1">[필수]</span> 서비스 이용약관
              </Agree>
              <Agree checked={agreeMarketing} onClick={() => setAgreeMarketing((v) => !v)}>
                <span className="text-[var(--color-ink-500)] mr-1">[선택]</span> 마케팅 정보 수신
              </Agree>
            </div>

            <Button block className="mt-8" onClick={submitStep3} loading={loading}>
              가입 완료
            </Button>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            s <= step ? "bg-[var(--color-navy-700)]" : "bg-[var(--color-ink-100)]"
          )}
        />
      ))}
    </div>
  );
}

function GenderChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-14 rounded-[14px] font-bold text-[15px] inline-flex items-center justify-center gap-2 border-[1.5px] transition-all",
        active
          ? "border-[var(--color-navy-700)] bg-[var(--color-navy-50)] text-[var(--color-navy-800)]"
          : "border-[var(--color-line)] bg-white text-[var(--color-ink-500)]"
      )}
    >
      {children}
    </button>
  );
}

function Agree({
  checked,
  onClick,
  children,
  bold,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 text-left"
    >
      <span
        className={cn(
          "w-6 h-6 rounded-md border-[1.5px] flex items-center justify-center transition-colors",
          checked
            ? "bg-[var(--color-navy-700)] border-[var(--color-navy-700)]"
            : "border-[var(--color-ink-300)] bg-white"
        )}
      >
        {checked && <Check className="w-4 h-4 text-white" />}
      </span>
      <span
        className={cn(
          "text-[14px]",
          bold ? "font-extrabold text-[var(--color-navy-900)]" : "font-medium text-[var(--color-ink-700)]"
        )}
      >
        {children}
      </span>
    </button>
  );
}
