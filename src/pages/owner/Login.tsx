import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Phone,
  Store as StoreIcon,
  Receipt,
  KeyRound,
  Info,
  MessageCircle,
  Briefcase,
  Crown,
} from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatPhoneNumber, digitsOnly } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { useStore } from "../../store/store";
import { cn } from "../../lib/cn";
import { POS_VENDORS, getVendor, type PosVendor } from "../../lib/posVendors";
import { signInWithGoogle, signInWithKakao } from "../../lib/auth";

type Mode = "login" | "signup";

export default function OwnerLogin() {
  const nav = useNavigate();
  const { login, users } = useStore();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [posVendor, setPosVendor] = useState<PosVendor>("none");
  const [posApiKey, setPosApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const vendorInfo = useMemo(() => getVendor(posVendor), [posVendor]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10 || !name.trim()) {
      showToast("이름과 전화번호를 정확히 입력해 주세요.", "error");
      return;
    }
    if (mode === "signup" && !restaurantName.trim()) {
      showToast("매장명을 입력해 주세요.", "error");
      return;
    }
    setLoading(true);
    try {
      await login({
        phone,
        name,
        role: "owner",
        restaurantName: restaurantName || undefined,
        authType: "phone",
        posVendor: mode === "signup" ? posVendor : undefined,
        posApiKey: mode === "signup" ? posApiKey || undefined : undefined,
        signInOnly: mode === "login",
      });
      nav("/owner", { replace: true });
    } catch (e: any) {
      showToast(
        mode === "login"
          ? "일치하는 사장님 계정이 없어요. '신규 등록' 탭으로 가입해 주세요."
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

      // 기존 owner 계정 매칭
      const existing = users.find(
        (u) =>
          u.role === "owner" &&
          u.status !== "deleted" &&
          (u.socialIds?.includes(res.id) ||
            u.googleId === res.id ||
            u.kakaoId === res.id)
      );

      if (existing) {
        await login({
          phone: existing.phone ?? "",
          name: existing.name,
          role: "owner",
          socialId: res.id,
          socialProvider: provider,
          authType: provider,
          avatarUrl: res.avatarUrl,
        });
        nav("/owner", { replace: true });
        return;
      }

      // 신규: 가입 모드로 전환, 소셜 정보 미리 채움
      if (mode === "login") {
        showToast("기존 사장님 계정이 없어요. 매장명/POS 정보를 입력하고 등록하세요.", "info");
      }
      setMode("signup");
      if (res.name) setName(res.name);
      // 가입 정보가 채워진 form으로 — 사용자가 매장명 등 입력 후 일반 가입 흐름
      // signupRef stored social info
      sessionStorage.setItem(
        "gyeol:pending-owner-social",
        JSON.stringify({ id: res.id, provider, avatarUrl: res.avatarUrl })
      );
      showToast("매장명과 POS 정보를 입력하고 가입을 완료하세요.", "info");
    } catch (e: any) {
      showToast(`소셜 로그인 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // 가입 시 보관된 social 정보 사용
  const finalizeSocialSignup = async () => {
    const stash = sessionStorage.getItem("gyeol:pending-owner-social");
    if (!stash) return;
    const social = JSON.parse(stash) as { id: string; provider: "google" | "kakao"; avatarUrl?: string };
    if (!restaurantName.trim() || !name.trim()) {
      showToast("성함과 매장명을 입력해 주세요.", "error");
      return;
    }
    setLoading(true);
    try {
      await login({
        phone: digitsOnly(phone), // 빈값 허용
        name,
        role: "owner",
        restaurantName,
        socialId: social.id,
        socialProvider: social.provider,
        authType: social.provider,
        avatarUrl: social.avatarUrl,
        posVendor,
        posApiKey: posApiKey || undefined,
      });
      sessionStorage.removeItem("gyeol:pending-owner-social");
      nav("/owner", { replace: true });
    } catch (e: any) {
      showToast(`가입 실패: ${e?.message ?? ""}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const hasSocialPending = typeof window !== "undefined" && !!sessionStorage.getItem("gyeol:pending-owner-social");

  return (
    <MobileShell>
      <TopBar title="사장님 콘솔" back />
      <div className="px-6 pt-4 pb-16">
        {/* 사장님/직원 구분 안내 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="rounded-[14px] border-2 border-[var(--color-navy-700)] bg-[var(--color-navy-50)] p-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-[var(--color-navy-700)]" />
            <div>
              <p className="text-[10px] font-bold text-[var(--color-navy-700)] uppercase tracking-wide">현재 화면</p>
              <p className="text-[13px] font-extrabold text-[var(--color-navy-900)]">사장님</p>
            </div>
          </div>
          <Link
            to="/staff/login"
            className="rounded-[14px] border-[1.5px] border-[var(--color-line)] bg-white p-3 flex items-center gap-2 hover:border-[var(--color-mint-500)] transition-colors"
          >
            <Briefcase className="w-4 h-4 text-[var(--color-ink-500)]" />
            <div>
              <p className="text-[10px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">직원이세요?</p>
              <p className="text-[13px] font-extrabold text-[var(--color-ink-700)]">직원 가입 →</p>
            </div>
          </Link>
        </div>

        <h1 className="headline-section mb-1">
          {mode === "login" ? "사장님 로그인" : hasSocialPending ? "사장님 가입 (소셜)" : "신규 가맹 등록"}
        </h1>
        <p className="body-md text-[var(--color-ink-500)]">
          매장을 단단하게 관리하는 결의 시작.
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
            } else {
              submit(e);
            }
          }}
          className="mt-7 space-y-4"
        >
          <Input
            label="성함"
            placeholder="대표자 성함"
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
            <>
              <Input
                label="매장명"
                placeholder="예) 결 카페"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                leftSlot={<StoreIcon className="w-4 h-4" />}
              />

              <div>
                <label className="block text-[13px] font-semibold text-[var(--color-navy-800)] mb-2">
                  사용 중인 POS
                </label>
                <div className="relative">
                  <select
                    value={posVendor}
                    onChange={(e) => setPosVendor(e.target.value as PosVendor)}
                    className="input-field appearance-none pr-10"
                  >
                    {POS_VENDORS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <Receipt className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] pointer-events-none" />
                </div>
              </div>

              {vendorInfo.needsApiKey ? (
                <Input
                  label={`${vendorInfo.keyLabel ?? "API 키"} (선택)`}
                  placeholder={vendorInfo.placeholder ?? "선택 입력"}
                  value={posApiKey}
                  onChange={(e) => setPosApiKey(e.target.value)}
                  leftSlot={<KeyRound className="w-4 h-4" />}
                  hint={
                    posApiKey
                      ? vendorInfo.hint ?? "주문이 자동으로 POS로 전달됩니다."
                      : "비워두면 영수증 자동 인쇄로 동작합니다."
                  }
                />
              ) : (
                <div className="flex items-start gap-2 p-3.5 rounded-[14px] bg-[var(--color-mint-50)] border border-[var(--color-mint-200)]">
                  <Info className="w-4 h-4 text-[var(--color-mint-700)] mt-0.5 shrink-0" />
                  <p className="text-[12px] text-[var(--color-mint-700)] font-semibold leading-relaxed">
                    {vendorInfo.hint ?? "POS를 사용하지 않습니다."}
                    <br />
                    <span className="font-medium opacity-90">
                      주문이 접수될 때마다 영수증 인쇄 창이 자동으로 열립니다.
                    </span>
                  </p>
                </div>
              )}
            </>
          )}

          <Button
            block
            type="submit"
            loading={loading}
            disabled={!name || (mode === "signup" && !restaurantName) || (!hasSocialPending && !phone)}
          >
            {mode === "login" ? "로그인" : "가맹 등록하기"}
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

        {mode === "signup" && !hasSocialPending && (
          <p className="mt-4 text-[12px] text-[var(--color-ink-500)] text-center">
            가입 시 매장당 기본 테이블 15개가 자동으로 생성됩니다.
          </p>
        )}
      </div>
    </MobileShell>
  );
}
