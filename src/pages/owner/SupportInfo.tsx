import { useState } from "react";
import { Landmark, Sparkles, ExternalLink } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { useLanguage, t } from "../../lib/i18n";
import { showToast } from "../../lib/toast";
import { api } from "../../lib/api";

/**
 * 소상공인 지원정보 추천 (TODO 8-4).
 *
 * 라이브 정부 데이터 API가 없어, "검증된 상시 지원제도 큐레이션 + AI 맞춤 추천"으로 제공.
 * 공고·자격은 수시로 바뀌므로 공식 사이트(소상공인24/기업마당) 확인을 권한다(면책).
 * 지원제도명·설명은 한국 정부 고유명사라 데이터로 한국어 유지, 화면 chrome 은 i18n.
 */
const PROGRAMS: { title: string; desc: string; link: string }[] = [
  { title: "소상공인 정책자금 (융자)", desc: "소상공인시장진흥공단의 저금리 운영·시설 자금. 사업자등록한 소상공인 대상.", link: "https://www.sbiz24.kr" },
  { title: "노란우산공제", desc: "폐업·노후 대비 공제 + 납입액 소득공제, 압류 보호. 자영업자·소상공인.", link: "https://www.8899.or.kr" },
  { title: "두루누리 사회보험료 지원", desc: "10인 미만 사업장의 저임금 근로자 고용보험·국민연금 보험료 일부 지원.", link: "https://www.insurancesupport.or.kr" },
  { title: "카드수수료 우대 (영세·중소가맹점)", desc: "연매출 기준 영세가맹점은 신용카드 우대 수수료율이 자동 적용돼요.", link: "https://www.bizinfo.go.kr" },
  { title: "1인 소상공인 고용보험료 지원", desc: "고용보험에 가입한 1인 자영업자의 보험료 일부 지원(지역별 상이).", link: "https://www.sbiz24.kr" },
  { title: "온누리상품권·지역화폐 가맹", desc: "지역화폐·온누리 가맹 시 매출 유입 + 지역 소비 진작 효과.", link: "https://www.sbiz24.kr" },
  { title: "지자체 소상공인 지원", desc: "지자체별 임대료·간판·방역·교육 등 수시 지원. 우리 지역 공고를 확인하세요.", link: "https://www.gov.kr" },
];

// AI 응답의 가벼운 마크다운(•/* 글머리, **굵게**)을 깔끔히 렌더 — 평문에 별표가 그대로 보이던 문제 해결
function renderSupport(text: string) {
  return text.split("\n").map((raw, i) => {
    const line = raw.trim();
    if (!line) return <div key={i} className="h-1.5" />;
    const isBullet = /^[*\-•·]\s+/.test(line);
    const body = line.replace(/^[*\-•·]\s+/, "");
    const nodes = body.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      /^\*\*[^*]+\*\*$/.test(p) ? (
        <strong key={j} className="font-bold text-[var(--color-navy-900)]">{p.slice(2, -2)}</strong>
      ) : (
        <span key={j}>{p}</span>
      )
    );
    return isBullet ? (
      <p key={i} className="flex gap-1.5">
        <span className="text-[var(--color-mint-600)] flex-shrink-0">•</span>
        <span className="flex-1">{nodes}</span>
      </p>
    ) : (
      <p key={i}>{nodes}</p>
    );
  });
}

export default function SupportInfo() {
  const { currentUser, users, effectiveStoreId, orders } = useStore();
  const lang = useLanguage();
  const storeId = effectiveStoreId;
  const owner = users.find((u) => u.id === storeId) ?? currentUser;
  // 맞춤화용 가게 데이터 — 직원 수 + 최근 30일 결제완료 매출(대략)
  const staffCount = users.filter((u) => u.employerStoreId === storeId).length;
  const monthlyRevenue = orders
    .filter((o) => o.storeId === storeId && o.paymentStatus === "paid" && Date.now() - new Date(o.createdAt).getTime() <= 30 * 86400000)
    .reduce((s, o) => s + (o.totalAmount || 0), 0);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runAI = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(api("/api/ai/support"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeName: owner?.restaurantName ?? "",
          bizType: owner?.storeConfig?.industry ?? "general",
          region: (owner?.storeConfig?.address ?? "").trim(), // #7: 주소로 지역 맞춤
          employeeCount: staffCount, // 맞춤화: 직원 수
          monthlyRevenue, // 맞춤화: 최근 월매출(대략)
          lang, // #3: 사장님 언어로 응답
        }),
      });
      const d = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        showToast(d?.error === "AI_NOT_CONFIGURED" ? t("ai.notConfigured", lang) : t("ai.failed", lang), "error");
        return;
      }
      const text = String(d.text || "").trim();
      if (!text) { showToast(t("ai.failed", lang), "error"); return; } // #15: 빈 응답도 실패 처리
      setResult(text);
    } catch {
      showToast(t("ai.failed", lang), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OwnerShell title={t("support.title", lang)}>
      <div className="max-w-[900px] mx-auto space-y-4">
        <p className="text-[13px] text-[var(--color-ink-600)] leading-relaxed px-1">{t("support.desc", lang)}</p>

        {/* AI 맞춤 추천 */}
        <Card padding="md">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-extrabold text-[var(--color-navy-900)] inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[var(--color-mint-600)]" /> {t("support.aiTitle", lang)}
            </p>
            <Button size="sm" onClick={runAI} loading={busy} leftIcon={<Sparkles className="w-4 h-4" />}>
              {t("support.aiRun", lang)}
            </Button>
          </div>
          {result && (
            <>
              <div className="mt-3 pt-3 border-t border-[var(--color-line-soft)] text-[13.5px] text-[var(--color-ink-700)] leading-relaxed space-y-1">
                {renderSupport(result)}
              </div>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-3 leading-relaxed">{t("support.disclaimer", lang)}</p>
            </>
          )}
        </Card>

        {/* 상시 지원제도 큐레이션 */}
        <div>
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-ink-500)] mb-2 px-1">{t("support.evergreen", lang)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROGRAMS.map((p) => (
              <Card key={p.title} padding="md" className="flex flex-col">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center shrink-0">
                    <Landmark className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[var(--color-navy-900)] break-keep">{p.title}</p>
                    <p className="text-[12.5px] text-[var(--color-ink-600)] mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--color-navy-700)] hover:underline self-start"
                >
                  {t("support.official", lang)} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Card>
            ))}
          </div>
        </div>

        <p className="text-[11.5px] text-[var(--color-ink-500)] leading-relaxed px-1 pt-1">{t("support.officialSites", lang)}</p>
      </div>
    </OwnerShell>
  );
}
