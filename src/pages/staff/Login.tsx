import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Phone, Briefcase, MessageCircle, Crown } from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatPhoneNumber, digitsOnly } from "../../lib/ids";
import { showToast } from "../../lib/toast";
import { useStore } from "../../store/store";
import { signInWithGoogle, signInWithKakao, consumeGoogleRedirect } from "../../lib/auth";
import type { SocialResult } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { useLanguage, t } from "../../lib/i18n";

type Mode = "login" | "signup";

export default function StaffLogin() {
  const nav = useNavigate();
  const { login, users } = useStore();
  const lang = useLanguage();
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
      showToast(t("slogin.err.required", lang), "error");
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
          ? t("slogin.err.notFound", lang)
          : t("slogin.err.signupFail", lang, { msg: e?.message ?? "" }),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const applySocialResult = async (res: SocialResult) => {
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
        socialProvider: res.provider,
        authType: res.provider,
        avatarUrl: res.avatarUrl,
      });
      afterStaffLogin();
      return;
    }

    setMode("signup");
    if (res.name) setName(res.name);
    sessionStorage.setItem(
      "gyeol:pending-staff-social",
      JSON.stringify({ id: res.id, provider: res.provider, avatarUrl: res.avatarUrl, ts: Date.now() })
    );
    showToast(t("slogin.info.completeSignup", lang), "info");
  };

  // 인앱 브라우저 Google redirect 결과 회수
  useEffect(() => {
    consumeGoogleRedirect()
      .then((res) => { if (res) return applySocialResult(res); })
      .catch((e) => showToast(t("slogin.err.socialFail", lang, { msg: e?.message ?? "" }), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSocial = async (provider: "google" | "kakao") => {
    setLoading(true);
    try {
      const res = provider === "google" ? await signInWithGoogle() : await signInWithKakao();
      await applySocialResult(res);
    } catch (e: any) {
      if (e?.message === "REDIRECT_IN_PROGRESS") return;
      showToast(t("slogin.err.socialFail", lang, { msg: e?.message ?? "" }), "error");
    } finally {
      setLoading(false);
    }
  };

  const finalizeSocialSignup = async () => {
    const stash = sessionStorage.getItem("gyeol:pending-staff-social");
    if (!stash) return submit({ preventDefault: () => {} } as React.FormEvent);
    const social = JSON.parse(stash) as { id: string; provider: "google" | "kakao"; avatarUrl?: string };
    if (!name.trim()) {
      showToast(t("slogin.err.nameRequired", lang), "error");
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
      showToast(t("slogin.err.signupFail", lang, { msg: e?.message ?? "" }), "error");
    } finally {
      setLoading(false);
    }
  };

  const hasSocialPending =
    typeof window !== "undefined" && !!sessionStorage.getItem("gyeol:pending-staff-social");

  return (
    <MobileShell>
      <TopBar title={t("slogin.title.login", lang)} back />
      <div className="px-6 pt-4 pb-16">
        {/* 사장님/직원 구분 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Link
            to="/biz/owner/login"
            className="rounded-[14px] border-[1.5px] border-[var(--color-line)] bg-white p-3 flex items-center gap-2 hover:border-[var(--color-navy-700)] transition-colors"
          >
            <Crown className="w-4 h-4 text-[var(--color-ink-500)]" />
            <div>
              <p className="text-[10px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">{t("slogin.role.ownerQ", lang)}</p>
              <p className="text-[13px] font-extrabold text-[var(--color-ink-700)]">{t("slogin.role.ownerCta", lang)}</p>
            </div>
          </Link>
          <div className="rounded-[14px] border-2 border-[var(--color-mint-500)] bg-[var(--color-mint-50)] p-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--color-mint-700)]" />
            <div>
              <p className="text-[10px] font-bold text-[var(--color-mint-700)] uppercase tracking-wide">{t("slogin.role.current", lang)}</p>
              <p className="text-[13px] font-extrabold text-[var(--color-navy-900)]">{t("slogin.role.staff", lang)}</p>
            </div>
          </div>
        </div>

        <h1 className="headline-section mb-1">
          {mode === "login" ? t("slogin.title.login", lang) : t("slogin.title.signup", lang)}
        </h1>
        <p className="body-md text-[var(--color-ink-500)]">
          {t("slogin.desc", lang)}
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
              {m === "login" ? t("slogin.mode.login", lang) : t("slogin.mode.signup", lang)}
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
            label={t("slogin.field.name", lang)}
            placeholder={t("slogin.field.namePh", lang)}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={hasSocialPending && mode === "signup" ? t("slogin.field.phoneOptional", lang) : t("slogin.field.phone", lang)}
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            inputMode="numeric"
            leftSlot={<Phone className="w-4 h-4" />}
          />
          {mode === "signup" && (
            <Input
              label={t("slogin.field.position", lang)}
              placeholder={t("slogin.field.positionPh", lang)}
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
            {mode === "login" ? t("slogin.btn.login", lang) : t("slogin.btn.signup", lang)}
          </Button>
        </form>

        {mode === "login" && !hasSocialPending && (
          <>
            <div className="my-7 flex items-center gap-3 text-[12px] text-[var(--color-ink-300)] font-semibold">
              <div className="flex-1 h-px bg-[var(--color-line)]" />
              {t("slogin.orSocial", lang)}
              <div className="flex-1 h-px bg-[var(--color-line)]" />
            </div>
            <div className="space-y-3">
              <Button variant="outline" block onClick={() => handleSocial("google")} loading={loading}>
                {t("slogin.btn.googleContinue", lang)}
              </Button>
              <button
                onClick={() => handleSocial("kakao")}
                disabled={loading}
                className="w-full h-14 rounded-[14px] bg-[#FEE500] text-[#191919] font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                <MessageCircle className="w-5 h-5" />
                {t("slogin.btn.kakaoContinue", lang)}
              </button>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
