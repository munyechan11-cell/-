import { Link } from "react-router-dom";
import { QrCode, ArrowRight, Shield, ShieldCheck, Sparkles, Zap, User as UserIcon } from "lucide-react";
import { useStore } from "../store/store";
import { useLanguage, t } from "../lib/i18n";

export default function Home() {
  const { currentUser } = useStore();
  const isCustomer = currentUser?.role === "customer";
  const lang = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[var(--color-bg)]">
      {/* Top bar */}
      <header className="container-app flex items-center justify-between h-16 lg:h-20">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-[var(--color-navy-700)] text-white text-lg lg:text-xl font-extrabold flex items-center justify-center shadow-[var(--shadow-navy)]">
            결
          </span>
          <span className="text-[15px] font-bold text-[var(--color-navy-900)] tracking-tight">
            Gyeol Cloud
          </span>
        </div>
        <Link
          to="/master"
          className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-ink-500)] hover:text-[var(--color-navy-700)] transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          {t("landing.master", lang)}
        </Link>
      </header>

      {/* Hero */}
      <section className="container-app pt-8 lg:pt-20 pb-10 lg:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <span className="chip mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            {t("landing.chip", lang)}
          </span>
          <h1 className="headline-hero">
            {t("landing.heroLine1", lang)}
            <br />
            {t("landing.heroLine2", lang)}
            <br />
            <span className="text-[var(--color-navy-700)]">{t("landing.heroLine3", lang)}</span>
          </h1>
          <p className="body-lg mt-5 lg:mt-7 text-[var(--color-ink-600)] max-w-[520px]">
            {t("landing.subtitle", lang)}
          </p>

          {/* CTA */}
          <div className="mt-8 lg:mt-10 grid sm:grid-cols-2 gap-3 max-w-[560px]">
            {isCustomer ? (
              <Link
                to="/customer"
                className="group rounded-2xl bg-[var(--color-navy-700)] text-white p-5 lg:p-6 flex items-center gap-4 shadow-[var(--shadow-navy)] hover:-translate-y-0.5 transition-transform sm:col-span-2"
              >
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] opacity-80 font-bold uppercase tracking-wider mb-0.5">
                    {t("landing.welcomeUser", lang, { name: currentUser.name })}
                  </div>
                  <div className="text-[17px] font-extrabold tracking-tight">{t("landing.goMyGyeol", lang)}</div>
                </div>
                <ArrowRight className="w-5 h-5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ) : (
              <>
                <Link
                  to="/customer/login"
                  className="group rounded-2xl bg-[var(--color-navy-700)] text-white p-5 lg:p-6 flex items-center gap-4 shadow-[var(--shadow-navy)] hover:-translate-y-0.5 transition-transform"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] opacity-80 font-bold uppercase tracking-wider mb-0.5">
                      {t("landing.customer", lang)}
                    </div>
                    <div className="text-[17px] font-extrabold tracking-tight">{t("landing.loginOrSignup", lang)}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  to="/scan"
                  className="group rounded-2xl bg-white border border-[var(--color-line)] p-5 lg:p-6 flex items-center gap-4 hover:-translate-y-0.5 transition-transform shadow-[var(--shadow-card)]"
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-mint-100)] flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-[var(--color-mint-700)]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] text-[var(--color-ink-500)] font-bold uppercase tracking-wider mb-0.5">
                      {t("landing.storeQr", lang)}
                    </div>
                    <div className="text-[17px] font-extrabold text-[var(--color-navy-900)] tracking-tight">
                      {t("landing.scanNow", lang)}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[var(--color-ink-400)] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}

          </div>

          {/* Trust signals */}
          <div className="hidden lg:flex items-center gap-6 mt-10 text-[12px] text-[var(--color-ink-500)] font-semibold">
            <Feature icon={<ShieldCheck className="w-4 h-4 text-[var(--color-mint-600)]" />}>
              {t("landing.feat.sync", lang)}
            </Feature>
            <Feature icon={<Zap className="w-4 h-4 text-[var(--color-mint-600)]" />}>
              {t("landing.feat.offline", lang)}
            </Feature>
            <Feature icon={<Sparkles className="w-4 h-4 text-[var(--color-mint-600)]" />}>
              {t("landing.feat.tier", lang)}
            </Feature>
          </div>
        </div>

        {/* Right preview - phone frame (desktop only) */}
        <div className="hidden lg:flex justify-center relative">
          <div className="relative w-[320px] h-[640px] rounded-[44px] bg-[var(--color-navy-900)] p-3 shadow-[0_30px_80px_-20px_rgba(11,18,32,0.5)]">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-[var(--color-navy-900)] rounded-b-2xl z-10" />
            <div className="w-full h-full rounded-[34px] bg-white overflow-hidden flex flex-col">
              <div className="px-6 pt-12 pb-5 bg-gradient-to-b from-[var(--color-navy-700)] to-[var(--color-navy-800)] text-white">
                <p className="text-[11px] opacity-70 font-bold uppercase tracking-wider">VIP 단골</p>
                <p className="text-[26px] font-extrabold mt-1">단골마스터</p>
                <div className="mt-4 h-2 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full w-[78%] bg-[var(--color-mint-400)]" />
                </div>
                <p className="text-[11px] opacity-70 mt-2">다음 등급까지 2회</p>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="card p-3 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-mint-100)] text-[var(--color-mint-700)] font-extrabold inline-flex items-center justify-center text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-[var(--color-navy-900)]">테이블 3번 이용 중</p>
                    <p className="text-[10px] text-[var(--color-mint-700)] font-semibold">이용 시간 12:34</p>
                  </div>
                </div>
                <div className="card p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="chip text-[10px] px-2 py-0.5">VIP</span>
                    <span className="text-[10px] text-[var(--color-ink-500)] font-semibold">사용 가능</span>
                  </div>
                  <p className="text-[12px] font-bold text-[var(--color-navy-900)]">사장님 특별 서비스</p>
                </div>
                <div className="card p-3">
                  <p className="text-[10px] font-bold text-[var(--color-ink-500)] mb-1">최근 방문</p>
                  <p className="text-[12px] font-semibold text-[var(--color-navy-900)]">11월 28일 · 테이블 3</p>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative blob */}
          <div className="absolute -z-10 -inset-10 bg-gradient-to-br from-[var(--color-mint-100)] to-transparent blur-3xl" />
        </div>
      </section>

      {/* Bottom mobile-only management link */}
      <div className="container-app sm:hidden pb-8">
        <Link
          to="/master"
          className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[var(--color-ink-400)] hover:text-[var(--color-navy-700)]"
        >
          <Shield className="w-3.5 h-3.5" />
          {t("landing.master", lang)}
        </Link>
      </div>

      <footer className="container-app py-6 border-t border-[var(--color-line-soft)] flex flex-col items-center gap-2.5">
        <p className="text-[11px] text-[var(--color-ink-400)] font-semibold tracking-wider">
          {t("landing.tagline", lang)}
        </p>
        <Link
          to="/biz"
          className="text-[11px] text-[var(--color-ink-400)] hover:text-[var(--color-navy-700)] font-medium opacity-70 hover:opacity-100 transition-opacity"
        >
          {t("landing.bizEntry", lang)}
        </Link>
      </footer>
    </div>
  );
}

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      {children}
    </div>
  );
}
