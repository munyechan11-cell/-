import { useMemo, useRef, useState } from "react";
import { Sparkles, Check, X, Send, Pencil, Trash2, ChevronDown, ChevronUp, ShieldCheck, Loader2, BarChart3 } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { useStore } from "../../store/store";
import { useLanguage, t, fmtKRW } from "../../lib/i18n";
import { showToast } from "../../lib/toast";
import { api } from "../../lib/api";
import { buildContext, askInsight } from "../../lib/aiInsight";
import type { MarketingDraft } from "../../lib/types";

/**
 * 마케팅 자율 에이전트 "사장님 비서" — 1단계 골격 (TODO 7-1 + 7-3).
 *  - 7-1 매장 마케팅 프로필(톤·타깃·키워드·금지어) → storeConfig.marketingAgent.
 *  - 7-3 승인 큐 + 감사 로깅: 모든 초안은 '초안' 상태로만 생성되고, 사장 승인 후에만 발행.
 *    자동 발행은 의도적으로 막혀 있다(책임 큼). AI 콘텐츠 생성(7-2)은 다음 단계 — 지금은
 *    수동 초안으로 승인 흐름·로깅을 검증한다.
 */

const CHANNELS: MarketingDraft["channel"][] = ["instagram", "naverPlace", "general"];
const KINDS: MarketingDraft["kind"][] = ["post", "reply"];

export default function OwnerMarketingAgent() {
  const {
    currentUser,
    effectiveStoreId,
    updateStoreConfig,
    marketingDrafts,
    addMarketingDraft,
    reviewMarketingDraft,
    updateMarketingDraftContent,
    deleteMarketingDraft,
    photos,
    updatePhoto,
    orders,
    visits,
    reservations,
    users,
  } = useStore();
  const lang = useLanguage();
  const storeId = effectiveStoreId;
  const cfg = currentUser?.storeConfig?.marketingAgent;

  // ----- 프로필 상태 -----
  const [enabled, setEnabled] = useState(!!cfg?.enabled);
  const [tone, setTone] = useState(cfg?.tone ?? "");
  const [target, setTarget] = useState(cfg?.target ?? "");
  const [keywords, setKeywords] = useState(cfg?.keywords ?? "");
  const [banned, setBanned] = useState(cfg?.bannedWords ?? "");
  const [dailyLimit, setDailyLimit] = useState(String(cfg?.dailyPublishLimit ?? 0));
  const [savingProfile, setSavingProfile] = useState(false);

  // 금지어 목록 (가드레일) — 콘텐츠에 들어가면 안 되는 표현. 승인·발행 전 검사.
  const bannedList = useMemo(
    () => (cfg?.bannedWords ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [cfg?.bannedWords]
  );

  const saveProfile = async () => {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      await updateStoreConfig(storeId, {
        marketingAgent: {
          enabled,
          tone: tone.trim(),
          target: target.trim(),
          keywords: keywords.trim(),
          bannedWords: banned.trim(),
          autoPublish: false, // 골격 단계 — 자동 발행은 항상 막음(승인 필수)
          dailyPublishLimit: Math.max(0, Math.min(100, Number(dailyLimit) || 0)),
        },
      });
      showToast(t("magent.saved", lang), "success");
    } catch (e: any) {
      showToast(e?.message ?? "save failed", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // ----- 수동 초안 추가 (AI 생성 7-2 자리) -----
  const [draftChannel, setDraftChannel] = useState<MarketingDraft["channel"]>("instagram");
  const [draftKind, setDraftKind] = useState<MarketingDraft["kind"]>("post");
  const [draftContent, setDraftContent] = useState("");
  const [addingDraft, setAddingDraft] = useState(false);
  // AI 생성 (7-2) — 주제를 받아 프로필 기반 초안 생성 → 'draft'(source:agent)로 승인 큐에 추가
  const [aiTopic, setAiTopic] = useState("");
  const [generating, setGenerating] = useState(false);

  const generateDraft = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch(api("/api/marketing/generate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId, channel: draftChannel, kind: draftKind, topic: aiTopic.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as any));
        if (res.status === 403 && d?.error === "marketing_disabled") showToast(t("magent.notEnabled", lang), "error");
        else if (res.status === 503) showToast(t("magent.aiNotConfigured", lang), "error");
        else if (res.status === 429) showToast(t("magent.rateLimit", lang), "error");
        else showToast(t("magent.genFail", lang), "error");
        return;
      }
      const d = (await res.json()) as { title?: string; content?: string; bannedHit?: string[] };
      if (!d.content) { showToast(t("magent.genFail", lang), "error"); return; }
      await addMarketingDraft(storeId, { channel: draftChannel, kind: draftKind, content: d.content, title: d.title, source: "agent" });
      setAiTopic("");
      if (Array.isArray(d.bannedHit) && d.bannedHit.length) {
        showToast(t("magent.bannedWarn", lang, { words: d.bannedHit.join(", ") }), "info");
      } else {
        showToast(t("magent.genDone", lang), "success");
      }
    } catch {
      showToast(t("magent.genFail", lang), "error");
    } finally {
      setGenerating(false);
    }
  };

  const addDraft = async () => {
    if (!draftContent.trim() || addingDraft) return;
    setAddingDraft(true);
    try {
      await addMarketingDraft(storeId, {
        channel: draftChannel,
        kind: draftKind,
        content: draftContent.trim(),
        source: "manual",
      });
      setDraftContent("");
      showToast(t("magent.draftAdded", lang), "success");
    } catch (e: any) {
      showToast(e?.message ?? "add failed", "error");
    } finally {
      setAddingDraft(false);
    }
  };

  const myDrafts = useMemo(
    () => marketingDrafts.filter((d) => d.storeId === storeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [marketingDrafts, storeId]
  );
  const pending = myDrafts.filter((d) => d.status === "draft");
  const history = myDrafts.filter((d) => d.status !== "draft");

  // ----- 7-5 리뷰 응대 초안 -----
  const unansweredReviews = useMemo(
    () =>
      photos
        .filter((p) => p.storeId === storeId && p.type === "review" && !!p.reviewText?.trim() && !p.ownerReply)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
    [photos, storeId]
  );
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const generateReply = async (review: (typeof photos)[number]) => {
    if (replyingId) return;
    setReplyingId(review.id);
    try {
      const res = await fetch(api("/api/marketing/generate"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId, channel: "general", kind: "reply", reviewText: review.reviewText, rating: review.rating }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as any));
        if (res.status === 403 && d?.error === "marketing_disabled") showToast(t("magent.notEnabled", lang), "error");
        else if (res.status === 503) showToast(t("magent.aiNotConfigured", lang), "error");
        else if (res.status === 429) showToast(t("magent.rateLimit", lang), "error");
        else showToast(t("magent.genFail", lang), "error");
        return;
      }
      const d = (await res.json()) as { content?: string; bannedHit?: string[] };
      if (!d.content) { showToast(t("magent.genFail", lang), "error"); return; }
      const snippet = `${review.rating ? `★${review.rating} · ` : ""}${(review.reviewText ?? "").slice(0, 80)}`;
      await addMarketingDraft(storeId, {
        channel: "general",
        kind: "reply",
        content: d.content,
        source: "agent",
        targetId: review.id,
        targetSummary: snippet,
      });
      if (Array.isArray(d.bannedHit) && d.bannedHit.length) showToast(t("magent.bannedWarn", lang, { words: d.bannedHit.join(", ") }), "info");
      else showToast(t("magent.replyDrafted", lang), "success");
    } catch {
      showToast(t("magent.genFail", lang), "error");
    } finally {
      setReplyingId(null);
    }
  };

  // 최근 24시간 발행 수 — 하루 발행 한도(가드레일) 판정용
  const publishedLast24h = useMemo(
    () => myDrafts.filter((d) => d.status === "published" && d.publishedAt && Date.now() - new Date(d.publishedAt).getTime() < 86_400_000).length,
    [myDrafts]
  );
  const publishLimit = cfg?.dailyPublishLimit ?? 0; // 0 = 무제한
  const publishingRef = useRef(0); // 진행 중 발행 수 — 연타 시 onSnapshot 왕복 전이라도 한도 정확 판정

  // 발행 — 응대(reply) 초안이 리뷰를 대상으로 하면 그 리뷰의 사장 답글(ownerReply)로 기록까지 한다.
  const handlePublish = async (d: MarketingDraft) => {
    // 가드레일: 하루 발행 한도 초과 차단 (구독 지연 우회 방지로 진행 중 발행 수도 합산)
    if (publishLimit > 0 && publishedLast24h + publishingRef.current >= publishLimit) {
      showToast(t("magent.limitReached", lang, { n: publishLimit }), "error");
      return;
    }
    publishingRef.current += 1;
    try {
      // 초안을 먼저 published 로 전이(단일 진실), 그 다음 리뷰 답글 기록 — 순서상 부분실패가 덜 해롭다.
      await reviewMarketingDraft(d.id, "publish");
      if (d.kind === "reply" && d.targetId) {
        await updatePhoto(d.targetId, { ownerReply: { text: d.content, repliedAt: new Date().toISOString() } });
      }
      showToast(t("magent.publishDone", lang), "success");
    } catch (e: any) {
      showToast(e?.message ?? t("magent.genFail", lang), "error");
    } finally {
      publishingRef.current -= 1;
    }
  };

  // ----- 7-6 주간 성과 요약 -----
  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const inWeek = (iso?: string) => !!iso && new Date(iso).getTime() >= cutoff;
    // 매출 = 결제완료(paid)만 — Settlement 의 정의와 일치. 미결제·환불 주문 과대계상 방지.
    const revenue = orders
      .filter((o) => o.storeId === storeId && o.paymentStatus === "paid" && inWeek(o.createdAt))
      .reduce((s, o) => s + o.totalAmount, 0);
    // 성사된 예약 = confirmed + completed (방문 완료 전이 누락 방지). 취소·노쇼 제외.
    const reservationCount = reservations.filter(
      (r) => r.storeId === storeId && (r.status === "confirmed" || r.status === "completed") && inWeek(r.createdAt)
    ).length;
    const weekReviews = photos.filter((p) => p.storeId === storeId && p.type === "review" && inWeek(p.createdAt));
    const ratings = weekReviews.map((r) => r.rating).filter((n): n is number => typeof n === "number" && n > 0);
    const avgRating = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;
    const published = myDrafts.filter((d) => d.status === "published" && inWeek(d.publishedAt ?? d.createdAt)).length;
    return { revenue, reservationCount, reviewCount: weekReviews.length, avgRating, published };
  }, [orders, reservations, photos, myDrafts, storeId]);

  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  const getWeeklySummary = async () => {
    if (summarizing) return;
    setSummarizing(true);
    setSummary("");
    try {
      const storeName = currentUser?.role === "owner" ? currentUser.restaurantName : users.find((u) => u.id === storeId)?.restaurantName;
      const context = buildContext({ storeId, storeName, orders, visits, users });
      const answer = await askInsight({
        storeId,
        question:
          "이번 주 우리 가게 성과를 사장님이 이해하기 쉽게 3~4줄로 요약하고, 다음 주에 SNS에 올리면 좋을 마케팅 콘텐츠 아이디어 2가지를 제안해줘.",
        context,
      });
      setSummary(answer);
    } catch (e: any) {
      showToast(String(e?.message).includes("AI_NOT_CONFIGURED") ? t("magent.aiNotConfigured", lang) : t("magent.weekly.fail", lang), "error");
    } finally {
      setSummarizing(false);
    }
  };

  const field =
    "w-full px-3 py-2.5 rounded-xl border border-[var(--color-line)] text-[14px] bg-white focus:outline-none focus:border-[var(--color-navy-700)]";

  return (
    <OwnerShell title={t("magent.title", lang)}>
      <div className="max-w-[820px] mx-auto pb-16 space-y-5">
        {/* 안내 — 자동발행 금지 명시 */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[var(--color-navy-50)] text-[var(--color-navy-800)]">
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-navy-700)]" />
          <p className="text-[12.5px] leading-relaxed">{t("magent.autoPublishNote", lang)}</p>
        </div>

        {/* ===== 7-6 주간 성과 요약 ===== */}
        <section className="rounded-2xl bg-white border border-[var(--color-line)] p-5">
          <h2 className="text-[16px] font-extrabold text-[var(--color-navy-900)] mb-3 inline-flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[var(--color-navy-700)]" />
            {t("magent.weekly.title", lang)}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Metric label={t("magent.weekly.revenue", lang)} value={fmtKRW(week.revenue, lang)} />
            <Metric label={t("magent.weekly.reservations", lang)} value={String(week.reservationCount)} />
            <Metric
              label={t("magent.weekly.reviews", lang)}
              value={week.reviewCount ? `${week.reviewCount} · ★${week.avgRating.toFixed(1)}` : "0"}
            />
            <Metric label={t("magent.weekly.published", lang)} value={String(week.published)} />
          </div>
          <button
            onClick={getWeeklySummary}
            disabled={summarizing}
            className="h-10 px-4 rounded-xl bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] font-bold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {summarizing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{t("magent.weekly.summarizing", lang)}</>
            ) : (
              <><Sparkles className="w-4 h-4" />{t("magent.weekly.getSummary", lang)}</>
            )}
          </button>
          {summary && (
            <p className="mt-3 text-[13.5px] text-[var(--color-ink-700)] whitespace-pre-wrap leading-relaxed bg-[var(--color-navy-50)] rounded-xl p-3.5">
              {summary}
            </p>
          )}
        </section>

        {/* ===== 7-1 마케팅 프로필 ===== */}
        <section className="rounded-2xl bg-white border border-[var(--color-line)] p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[16px] font-extrabold text-[var(--color-navy-900)]">{t("magent.profile.title", lang)}</h2>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="text-[12.5px] font-bold text-[var(--color-ink-600)]">{t("magent.enable", lang)}</span>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-5 h-5 accent-[var(--color-navy-700)]" />
            </label>
          </div>
          <p className="text-[12px] text-[var(--color-ink-500)] mb-4 leading-relaxed">{t("magent.profileDesc", lang)}</p>

          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("magent.tone", lang)}</label>
              <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder={t("magent.tonePh", lang)} className={field} />
            </div>
            <div>
              <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("magent.target", lang)}</label>
              <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("magent.targetPh", lang)} className={field} />
            </div>
            <div>
              <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("magent.keywords", lang)}</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("magent.keywordsPh", lang)} className={field} />
            </div>
            <div>
              <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("magent.banned", lang)}</label>
              <input value={banned} onChange={(e) => setBanned(e.target.value)} placeholder={t("magent.bannedPh", lang)} className={field} />
            </div>
            <div>
              <label className="text-[12px] font-bold text-[var(--color-ink-600)] mb-1 block">{t("magent.dailyLimit", lang)}</label>
              <input
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="0"
                className={field}
              />
              <p className="text-[11px] text-[var(--color-ink-500)] mt-1">{t("magent.dailyLimitHint", lang)}</p>
            </div>
          </div>
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="mt-4 h-11 px-5 rounded-xl bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] font-bold disabled:opacity-50"
          >
            {t("magent.save", lang)}
          </button>
        </section>

        {/* ===== 수동 초안 추가 (AI 생성 7-2 자리) ===== */}
        <section className="rounded-2xl bg-white border border-[var(--color-line)] p-5">
          <h2 className="text-[16px] font-extrabold text-[var(--color-navy-900)] mb-1 inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--color-mint-600)]" />
            {t("magent.addDraft", lang)}
          </h2>
          <p className="text-[12px] text-[var(--color-ink-500)] mb-3 leading-relaxed">{t("magent.addDraftHint", lang)}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CHANNELS.map((c) => (
              <button
                key={c}
                onClick={() => setDraftChannel(c)}
                aria-pressed={draftChannel === c}
                className={`h-8 px-3 rounded-full text-[12px] font-bold ${draftChannel === c ? "bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)]" : "bg-[var(--color-bg)] text-[var(--color-ink-600)]"}`}
              >
                {t(`magent.channel.${c}`, lang)}
              </button>
            ))}
            <span className="w-px bg-[var(--color-line)] mx-1" />
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setDraftKind(k)}
                aria-pressed={draftKind === k}
                className={`h-8 px-3 rounded-full text-[12px] font-bold ${draftKind === k ? "bg-[var(--color-mint-600)] text-white" : "bg-[var(--color-bg)] text-[var(--color-ink-600)]"}`}
              >
                {t(`magent.kind.${k}`, lang)}
              </button>
            ))}
          </div>
          {/* AI 생성 (7-2) */}
          <input
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder={t("magent.aiTopicPh", lang)}
            className={`${field} mb-2`}
          />
          <button
            onClick={generateDraft}
            disabled={generating}
            className="w-full h-11 rounded-xl bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{t("magent.generating", lang)}</>
            ) : (
              <><Sparkles className="w-4 h-4" />{t("magent.genBtn", lang)}</>
            )}
          </button>

          {/* 또는 직접 작성 */}
          <div className="flex items-center gap-2 my-3">
            <span className="flex-1 h-px bg-[var(--color-line)]" />
            <span className="text-[11px] text-[var(--color-ink-400)] font-bold">{t("magent.or", lang)}</span>
            <span className="flex-1 h-px bg-[var(--color-line)]" />
          </div>
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            placeholder={t("magent.contentPh", lang)}
            rows={3}
            className={`${field} resize-y`}
          />
          <button
            onClick={addDraft}
            disabled={!draftContent.trim() || addingDraft}
            className="mt-2 h-10 px-4 rounded-xl bg-[var(--color-bg)] text-[var(--color-ink-700)] font-bold disabled:opacity-50"
          >
            {t("magent.addDraftBtn", lang)}
          </button>
        </section>

        {/* ===== 7-5 리뷰 응대 초안 ===== */}
        {unansweredReviews.length > 0 && (
          <section className="rounded-2xl bg-white border border-[var(--color-line)] p-5">
            <h2 className="text-[16px] font-extrabold text-[var(--color-navy-900)] mb-1 inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[var(--color-mint-600)]" />
              {t("magent.reviews.title", lang)}
            </h2>
            <p className="text-[12px] text-[var(--color-ink-500)] mb-3 leading-relaxed">{t("magent.reviews.hint", lang)}</p>
            <div className="space-y-2">
              {unansweredReviews.map((r) => (
                <div key={r.id} className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-bg)]">
                  <div className="flex-1 min-w-0">
                    {!!r.rating && (
                      <span className="text-[12px] text-[var(--color-mint-700)] font-bold" aria-label={t("magent.ratingAria", lang, { n: r.rating })}>
                        <span aria-hidden="true">{"★".repeat(r.rating)}</span>
                      </span>
                    )}
                    <p className="text-[13px] text-[var(--color-ink-700)] leading-relaxed line-clamp-3">{r.reviewText}</p>
                    {r.customerName && <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{r.customerName}</p>}
                  </div>
                  <button
                    onClick={() => generateReply(r)}
                    disabled={!!replyingId}
                    className="shrink-0 h-9 px-3 rounded-lg bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] text-[12px] font-bold inline-flex items-center gap-1 disabled:opacity-60"
                  >
                    {replyingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {t("magent.replyDraftBtn", lang)}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 7-3 승인 대기 큐 ===== */}
        <section>
          <h2 className="text-[15px] font-extrabold text-[var(--color-navy-900)] mb-2">
            {t("magent.queue.title", lang)} {pending.length > 0 && <span className="text-[var(--color-mint-700)]">({pending.length})</span>}
          </h2>
          {pending.length === 0 ? (
            <p className="text-[13px] text-[var(--color-ink-500)] text-center py-8 rounded-2xl bg-white border border-dashed border-[var(--color-line)]">
              {t("magent.queue.empty", lang)}
            </p>
          ) : (
            <div className="space-y-2.5">
              {pending.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  onApprove={(note) => reviewMarketingDraft(d.id, "approve", note)}
                  onReject={(note) => reviewMarketingDraft(d.id, "reject", note)}
                  onPublish={() => handlePublish(d)}
                  onEdit={(content) => updateMarketingDraftContent(d.id, content, d.title)}
                  onDelete={() => deleteMarketingDraft(d.id)}
                  bannedWords={bannedList}
                />
              ))}
            </div>
          )}
        </section>

        {/* ===== 기록 ===== */}
        {history.length > 0 && (
          <section>
            <h2 className="text-[15px] font-extrabold text-[var(--color-navy-900)] mb-2">{t("magent.history", lang)}</h2>
            <div className="space-y-1.5">
              {history.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  onApprove={(note) => reviewMarketingDraft(d.id, "approve", note)}
                  onReject={(note) => reviewMarketingDraft(d.id, "reject", note)}
                  onPublish={() => handlePublish(d)}
                  onEdit={(content) => updateMarketingDraftContent(d.id, content, d.title)}
                  onDelete={() => deleteMarketingDraft(d.id)}
                  bannedWords={bannedList}
                  compact
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </OwnerShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg)] p-3 text-center">
      <p className="text-[11px] text-[var(--color-ink-500)]">{label}</p>
      <p className="text-[14px] font-extrabold tabular-nums mt-0.5 text-[var(--color-navy-900)]">{value}</p>
    </div>
  );
}

const STATUS_STYLE: Record<MarketingDraft["status"], string> = {
  draft: "bg-[var(--color-navy-50)] text-[var(--color-navy-700)]",
  approved: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  published: "bg-[var(--color-mint-500)] text-white",
  rejected: "bg-[#fdecea] text-[#c0392b]",
};

function DraftCard({
  draft,
  onApprove,
  onReject,
  onPublish,
  onEdit,
  onDelete,
  compact,
  bannedWords,
}: {
  draft: MarketingDraft;
  onApprove: (note?: string) => void;
  onReject: (note?: string) => void;
  onPublish: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  compact?: boolean;
  bannedWords: string[];
}) {
  const lang = useLanguage();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(draft.content);
  const [showAudit, setShowAudit] = useState(false);
  const isDraft = draft.status === "draft";
  const isApproved = draft.status === "approved";
  // 가드레일: 콘텐츠에 금지어가 들어가 있으면 경고 + 승인/발행 시 명시적 확인 요구
  const bannedHits = bannedWords.filter((w) => draft.content.includes(w));
  const confirmIfBanned = () =>
    bannedHits.length === 0 || window.confirm(t("magent.bannedConfirm", lang, { words: bannedHits.join(", ") }));

  return (
    <div className="rounded-2xl bg-white border border-[var(--color-line)] p-4">
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[draft.status]}`}>
          {t(`magent.status.${draft.status}`, lang)}
        </span>
        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-ink-600)]">
          {t(`magent.channel.${draft.channel}`, lang)}
        </span>
        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-ink-600)]">
          {t(`magent.kind.${draft.kind}`, lang)}
        </span>
        {draft.source === "agent" && (
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-mint-50)] text-[var(--color-mint-700)] inline-flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" />AI
          </span>
        )}
      </div>

      {draft.targetSummary && (
        <p className="text-[11.5px] text-[var(--color-ink-500)] bg-[var(--color-bg)] rounded-lg px-2.5 py-1.5 mb-2 line-clamp-2">
          <span className="font-bold">{t("magent.replyTo", lang)}:</span> {draft.targetSummary}
        </p>
      )}
      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-line)] text-[14px] bg-white resize-y mb-2"
        />
      ) : (
        <p className={`text-[13.5px] text-[var(--color-ink-700)] whitespace-pre-wrap leading-relaxed ${compact ? "line-clamp-2" : ""}`}>
          {draft.content}
        </p>
      )}

      {bannedHits.length > 0 && (isDraft || isApproved) && (
        <p className="mt-2 text-[11.5px] font-bold text-[#c0392b] bg-[#fdecea] rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          {t("magent.bannedBadge", lang, { words: bannedHits.join(", ") })}
        </p>
      )}

      {/* 액션 — draft: 수정/승인/거절/삭제 · approved: 발행 */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {editing ? (
          <>
            <button onClick={() => { onEdit(editText); setEditing(false); }} className="h-8 px-3 rounded-lg bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] text-[12px] font-bold">
              {t("magent.saveEdit", lang)}
            </button>
            <button onClick={() => { setEditText(draft.content); setEditing(false); }} className="h-8 px-3 rounded-lg bg-[var(--color-bg)] text-[var(--color-ink-600)] text-[12px] font-bold">
              {t("magent.cancel", lang)}
            </button>
          </>
        ) : (
          <>
            {isDraft && (
              <>
                <button onClick={() => { if (confirmIfBanned()) onApprove(); }} className="h-8 px-3 rounded-lg bg-[var(--color-mint-600)] text-white text-[12px] font-bold inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />{t("magent.approve", lang)}
                </button>
                <button onClick={() => { const r = window.prompt(t("magent.rejectReason", lang)); if (r !== null) onReject(r); }} className="h-8 px-3 rounded-lg bg-[#fdecea] text-[#c0392b] text-[12px] font-bold inline-flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />{t("magent.reject", lang)}
                </button>
                <button onClick={() => { setEditText(draft.content); setEditing(true); }} className="h-8 px-3 rounded-lg bg-[var(--color-bg)] text-[var(--color-ink-700)] text-[12px] font-bold inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" />{t("magent.edit", lang)}
                </button>
              </>
            )}
            {isApproved && (
              <button onClick={() => { if (confirmIfBanned()) onPublish(); }} className="h-8 px-3 rounded-lg bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] text-[12px] font-bold inline-flex items-center gap-1">
                <Send className="w-3.5 h-3.5" />{t("magent.publish", lang)}
              </button>
            )}
            <button onClick={onDelete} className="h-8 px-2.5 rounded-lg bg-[var(--color-bg)] text-[var(--color-ink-500)] text-[12px] font-bold inline-flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowAudit((v) => !v)} className="h-8 px-2.5 rounded-lg text-[var(--color-ink-500)] text-[11.5px] font-bold inline-flex items-center gap-0.5 ml-auto">
              {t("magent.audit", lang)} {showAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>

      {/* 감사 로그 */}
      {showAudit && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line-soft)] space-y-1">
          {(draft.audit ?? []).map((a, i) => (
            <div key={i} className="text-[11.5px] text-[var(--color-ink-500)] tabular-nums flex items-center gap-2">
              <span className="font-bold text-[var(--color-ink-700)]">{t(`magent.log.${a.action}`, lang)}</span>
              <span>{new Date(a.at).toLocaleString()}</span>
              {a.note && <span className="text-[var(--color-ink-600)]">· {a.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
