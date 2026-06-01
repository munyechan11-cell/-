import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Phone, Briefcase, MessageCircle, Crown } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatPhoneNumber, digitsOnly } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { useStore } from "../../store/store";
import { signInWithGoogle, signInWithKakao } from "../../lib/auth";
import { cn } from "../../lib/cn";

type Mode = "login" | "signup";

export default function StaffLogin() {
  const nav = useNavigate();
  const { login, users } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(false);

  const afterStaffLogin = () => {
    // 직원: 가입 후 store-search → pending → /staff
    nav("/biz/staff/store-search", { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10 || !name.trim()) {
      showToast("이름과 전화번호를 정확히 입력해 주세요.", "error");
      return;
    }
    // 10분 이상 묵은 stash는 무시 (옛 시도가 의도치 않게 적용되는 사고 방지)
    const stash =
      typeof window !== "undefined"
        ? sessionStorage.getItem("gyeol:pending-staff-social")
        : null;
    let pendingSocial: { id: string; provider: "google" | "kakao"; avatarUrl?: string } | null = null;
    if (stash) {
      try {
        const parsed = JSON.parse(stash) as { id: string; provider: "google" | "kakao"; avatarUrl?: string; ts?: number };
        const fresh = !parsed.ts || Date.now() - parsed.ts < 10 * 60 * 1000;
        if (fresh && parsed.id && parsed.provider) {
          pendingSocial = { id: parsed.id, provider: parsed.provider, avatarUrl: parsed.avatarUrl };
        } else {
          sessionStorage.removeItem("gyeol:pending-staff-social");
        }
      } catch {
        sessionStorage.removeItem("gyeol:pending-staff-social");
      }
    }

    setLoading(true);
    try {
      await login({
        phone,
        name,
        role: "staff",
        socialId: pendingSocial?.id,
        socialProvider: pendingSocial?.provider,
        authType: pendingSocial?.provider ?? "phone",
        avatarUrl: pendingSocial?.avatarUrl,
        position: mode === "signup" ? position || undefined : undefined,
        signInOnly: mode === "login" && !pendingSocial,
      } as any);
      if (pendingSocial) sessionStorage.removeItem("gyeol:pending-staff-social");
      afterStaffLogin();
    } catch (e: any) {
      showToast(
        mode === "login"
          ? "일치하는 직원 계정이 없어요. '신규 등록' 탭으로 가입해 주세요."
          : `가입 실패: ${e?.message ?? ""}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSocial = async (provider: "google" | "kakao") => {
    setLoading(true);
    try {
      const res = provider === "google" ? await signInWithGoogle() : await signInWithKakao();

      const existing = users.find(
        (u) =>
          u.role === "staff" &&
          u.status !== "deleted" &&
          (u.socialIds?.includes(res.id) ||
            u.googleId === res.id ||
            u.kakaoId === res.id)
      );

      if (existing) {
        await login({
          phone: existing.phone ?? "",
          name: existing.name,
          role: "staff",
          socialId: res.id,
          socialProvider: provider,
          authType: provider,
          avatarUrl: res.avatarUrl,
        });
        afterStaffLogin();
        return;
      }

      // 신규: 가입 모드에 social 정보 stash
      setMode("signup");
      if (res.name) setName(res.name);
      sessionStorage.setItem(
        "gyeol:pending-staff-social",
        JSON.stringify({ id: res.id, provider, avatarUrl: res.avatarUrl, ts: Date.now() })
      );
      showToast("성함·전화번호·직책 입력 후 가입을 완료해 주세요.", "info");
    } catch (e: any) {
      showToast(`소셜 로그인 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const finalizeSocialSignup = async () => {
    const stash = sessionStorage.getItem("gyeol:pending-staff-social");
    if (!stash) return submit({ preventDefault: () => {} } as React.FormEvent);
    const social = JSON.parse(stash) as { id: string; provider: "google" | "kakao"; avatarUrl?: string };
    if (!name.trim()) {
      showToast("성함을 입력해 주세요.", "error");
      return;
    }
    setLoading(true);
    try {
      await login({
        phone: digitsOnly(phone),
        name,
        role: "staff",
        socialId: social.id,
        socialProvider: social.provider,
        authType: social.provider,
        avatarUrl: social.avatarUrl,
        position: position || undefined,
      } as any);
      sessionStorage.removeItem("gyeol:pending-staff-social");
      afterStaffLogin();
    } catch (e: any) {
      showToast(`가입 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const hasSocialPending =
    typeof window !== "undefined" && !!sessionStorage.getItem("gyeol:pending-staff-social");

  return (
    <MobileShell>
      <TopBar title="직원 로그인" back />
      <div className="px-6 pt-4 pb-16">
        {/* 사장님/직원 구분 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Link
            to="/biz/owner/login"
            className="rounded-[14px] border-[1.5px] border-[var(--color-line)] bg-white p-3 flex items-center gap-2 hover:border-[var(--color-navy-700)] transition-colors"
          >
            <Crown className="w-4 h-4 text-[var(--color-ink-500)]" />
            <div>
              <p className="text-[10px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">사장님이세요?</p>
              <p className="text-[13px] font-extrabold text-[var(--color-ink-700)]">사장님 로그인 →</p>
            </div>
          </Link>
          <div className="rounded-[14px] border-2 border-[var(--color-mint-500)] bg-[var(--color-mint-50)] p-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--color-mint-700)]" />
            <div>
              <p className="text-[10px] font-bold text-[var(--color-mint-700)] uppercase tracking-wide">현재 화면</p>
              <p className="text-[13px] font-extrabold text-[var(--color-navy-900)]">직원</p>
            </div>
          </div>
        </div>

        <h1 className="headline-section mb-1">
          {mode === "login" ? "직원 로그인" : "직원 가입"}
        </h1>
        <p className="body-md text-[var(--color-ink-500)]">
          가입 후 일하시는 매장을 검색해 합류 요청을 보내세요.
        </p>

        <div className="mt-6 grid grid-cols-2 p-1 bg-[var(--color-navy-50)] rounded-[14px]">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "h-11 rounded-[10px] text-[13.5px] font-bold tracking-tight transition-all",
                mode === m
                  ? "bg-white text-[var(--color-navy-800)] shadow-[var(--shadow-press)]"
                  : "text-[var(--color-ink-500)]"
              )}
            >
              {m === "login" ? "로그인" : "신규 등록"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            if (hasSocialPending && mode === "signup") {
              e.preventDefault();
              finalizeSocialSignup();
            } else submit(e);
          }}
          className="mt-7 space-y-4"
        >
          <Input
            label="성함"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={hasSocialPending && mode === "signup" ? "전화번호 (선택)" : "전화번호"}
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            inputMode="numeric"
            leftSlot={<Phone className="w-4 h-4" />}
          />
          {mode === "signup" && (
            <Input
              label="직책 (선택)"
              placeholder="예) 홀, 주방"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              leftSlot={<Briefcase className="w-4 h-4" />}
            />
          )}
          <Button
            block
            type="submit"
            loading={loading}
            disabled={!name || (!hasSocialPending && !phone)}
          >
            {mode === "login" ? "로그인" : "가입하기"}
          </Button>
        </form>

        {mode === "login" && !hasSocialPending && (
          <>
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
      </div>
    </MobileShell>
  );
}
