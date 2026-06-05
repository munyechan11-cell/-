import { useEffect, useMemo, useState } from "react";
import { Search, Ticket, MessageSquare, Save, X, Download } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { calculateRFM, getRFMCluster, getEffectiveTier, TIER_BADGE, TIER_ORDER, DEFAULT_INSIGHTS } from "../../lib/tier";
import { sendKakaoMessage, sendPhysicalSms } from "../../lib/messaging";
import { showToast } from "../../lib/toast";
import { useEscapeClose } from "../../lib/useEscapeClose";
import { downloadCsv, todayStamp } from "../../lib/csv";
import { formatPhoneNumber } from "../../lib/ids";
import type { Tier, User } from "../../lib/types";
import { useLanguage, t } from "../../lib/i18n";

type Filter = "all" | "vip" | "new" | "slipping" | "cold";

export default function OwnerCustomers() {
  const {
    currentUser,
    users,
    visits,
    coupons,
    communications,
    tierOverrides,
    issueCoupon,
    bulkIssueCoupon,
    updateUserMemo,
    setCustomerTier,
    recordCommunication,
  } = useStore();
  const storeId = currentUser?.id ?? "";
  const lang = useLanguage();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [selectedMode, setSelectedMode] = useState<Set<string>>(new Set());

  const myCustomers = useMemo(() => {
    // 본인 매장을 방문한 적 있는 활성 고객만 (전역 계정이라 visits 기준)
    const visitedIds = new Set(
      visits.filter((v) => v.storeId === storeId).map((v) => v.customerId)
    );
    return users
      .filter(
        (u) =>
          u.role === "customer" &&
          u.status !== "deleted" &&
          visitedIds.has(u.id)
      )
      .map((u) => {
        const myVisits = visits.filter((v) => v.customerId === u.id);
        const uniqueDays = new Set(myVisits.map((v) => new Date(v.date).toDateString())).size;
        const rfm = calculateRFM(myVisits);
        const cluster = getRFMCluster(rfm);
        const overrideTier = tierOverrides.find((o) => o.customerId === u.id)?.tier;
        const tier = getEffectiveTier(uniqueDays, overrideTier);
        return { user: u, visits: myVisits, uniqueDays, rfm, cluster, tier, overrideTier };
      })
      .filter((c) => {
        if (search) {
          const q = search.toLowerCase();
          if (!c.user.name.toLowerCase().includes(q) && !c.user.phone?.includes(q)) return false;
        }
        if (filter !== "all" && c.cluster.id !== filter) return false;
        return true;
      })
      .sort((a, b) => b.visits.length - a.visits.length);
  }, [users, visits, tierOverrides, storeId, search, filter]);

  const toggleMulti = (id: string) => {
    setSelectedMode((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const sendBulkCoupon = () => {
    const desc = prompt(t("ocust.bulkPrompt", lang));
    if (!desc) return;
    bulkIssueCoupon(Array.from(selectedMode), storeId, t("ocust.bulkType", lang), desc);
    setSelectedMode(new Set());
  };

  // ============================================================
  // 엑셀(CSV) 내보내기 — 한국어 엑셀에서 바로 열리는 UTF-8 BOM 형식
  // 선택된 고객만 / 또는 현재 필터·검색 결과 전체
  // ============================================================
  const exportToExcel = () => {
    const target = selectedMode.size > 0
      ? myCustomers.filter((c) => selectedMode.has(c.user.id))
      : myCustomers;

    if (target.length === 0) {
      showToast(t("ocust.exportEmpty", lang), "info");
      return;
    }

    // 가독성 — 빈 값은 '-' 로, 날짜는 YYYY-MM-DD, 전화는 010-XXXX-XXXX
    const dash = "-";
    const fmtPhone = (p?: string) => (p ? formatPhoneNumber(p) : dash);
    const fmtDate = (iso?: string) => {
      if (!iso) return dash;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return dash;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const fmtGender = (g?: string) => (g === "male" ? t("ocust.csv.male", lang) : g === "female" ? t("ocust.csv.female", lang) : dash);
    const fmtResidence = (v?: boolean) => (v === true ? t("ocust.csv.pohang", lang) : v === false ? t("ocust.csv.otherRegion", lang) : t("ocust.csv.noResp", lang));
    const fmtAuthType = (authType?: string) =>
      authType === "google" ? "Google" : authType === "kakao" ? "Kakao" : authType === "phone" ? t("ocust.csv.phoneAuth", lang) : dash;
    const moneyLocale =
      lang === "en" ? "en-US" : lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "ko-KR";
    const fmtMoney = (n: number) => n.toLocaleString(moneyLocale);
    const ynPrivacy = (iso?: string) => (iso ? t("ocust.csv.agreed", lang) : dash);

    const headers = [
      t("ocust.csv.name", lang),
      t("ocust.csv.phone", lang),
      t("ocust.csv.tier", lang),
      t("ocust.csv.cluster", lang),
      t("ocust.csv.visits", lang),
      t("ocust.csv.uniqueDays", lang),
      t("ocust.csv.firstVisit", lang),
      t("ocust.csv.lastVisit", lang),
      t("ocust.csv.spent", lang),
      t("ocust.csv.gender", lang),
      t("ocust.csv.birthYear", lang),
      t("ocust.csv.birthday", lang),
      t("ocust.csv.residence", lang),
      t("ocust.csv.signupVia", lang),
      t("ocust.csv.marketing", lang),
      t("ocust.csv.memo", lang),
    ];

    const rows = target.map(({ user, visits, uniqueDays, cluster, tier }) => {
      const sortedByDate = [...visits].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const firstVisit = sortedByDate[0]?.date;
      const lastVisit = sortedByDate[sortedByDate.length - 1]?.date;
      const totalSpent = visits.reduce((s, v) => s + (v.totalAmount ?? 0), 0);

      return [
        user.name ?? dash,
        fmtPhone(user.phone),
        tier,
        cluster.label,
        visits.length,
        uniqueDays,
        fmtDate(firstVisit),
        fmtDate(lastVisit),
        fmtMoney(totalSpent),
        fmtGender(user.gender),
        user.birthYear ?? dash,
        user.birthday ?? dash,
        fmtResidence(user.isPohangResident),
        fmtAuthType(user.authType),
        ynPrivacy(user.privacyAgreedAt),
        user.memo ?? dash,
      ];
    });

    const storeName = currentUser?.restaurantName ?? t("common.store", lang);
    const safeStore = storeName.replace(/[\\/:*?"<>|]/g, "_"); // 파일명 안전화
    const scope = selectedMode.size > 0
      ? t("ocust.scopeSel", lang, { n: target.length })
      : t("ocust.scopeAll", lang, { n: target.length });
    const filename = t("ocust.filename", lang, { store: safeStore, scope, date: todayStamp() });

    try {
      downloadCsv(filename, headers, rows);
      showToast(t("ocust.exportOk", lang, { n: target.length }), "success");
    } catch (e: any) {
      showToast(t("ocust.exportFail", lang, { msg: e?.message ?? "" }), "error");
    }
  };

  return (
    <OwnerShell
      title={selectedMode.size > 0 ? t("ocust.selectedTitle", lang, { n: selectedMode.size }) : t("ocust.title", lang)}
      headerRight={
        selectedMode.size > 0 ? (
          <button
            onClick={() => setSelectedMode(new Set())}
            className="text-[13px] font-bold text-[var(--color-ink-600)] px-3 h-10 rounded-full hover:bg-[var(--color-navy-50)]"
          >
            {t("ocust.clearSel", lang)}
          </button>
        ) : (
          <button
            onClick={exportToExcel}
            disabled={myCustomers.length === 0}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-[var(--color-mint-100)] text-[var(--color-mint-700)] text-[12.5px] font-bold hover:bg-[var(--color-mint-50)] active:scale-[0.97] transition-all disabled:opacity-40"
            aria-label={t("ocust.excelAria", lang)}
            title={t("ocust.excelTip", lang)}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t("ocust.excelShort", lang)}</span>
          </button>
        )
      }
    >
      <div>
        <Input
          placeholder={t("ocust.searchPh", lang)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSlot={<Search className="w-4 h-4" />}
        />

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          {(
            [
              ["all", t("ocust.cluster.all", lang)],
              ["vip", t("ocust.cluster.vip", lang)],
              ["new", t("ocust.cluster.new", lang)],
              ["slipping", t("ocust.cluster.slipping", lang)],
              ["cold", t("ocust.cluster.cold", lang)],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`shrink-0 h-9 px-4 rounded-full text-[12px] font-bold border ${
                filter === id
                  ? "bg-[var(--color-navy-700)] text-white border-transparent"
                  : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedMode.size > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="mint" size="md" onClick={sendBulkCoupon} leftIcon={<Ticket className="w-4 h-4" />}>
              {t("ocust.bulk.coupon", lang)}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={exportToExcel}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {t("ocust.bulk.excel", lang)}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setSelectedMode(new Set())}
              leftIcon={<X className="w-4 h-4" />}
            >
              {t("ocust.bulk.clear", lang)}
            </Button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pb-8">
          {myCustomers.length === 0 ? (
            <Card padding="lg" className="text-center body-md md:col-span-2 xl:col-span-3">
              {t("ocust.empty", lang)}
            </Card>
          ) : (
            myCustomers.map(({ user, visits, cluster, tier }) => {
              const badge = TIER_BADGE[tier];
              const checked = selectedMode.has(user.id);
              return (
                <Card
                  key={user.id}
                  padding="md"
                  className="flex items-center gap-3"
                  onClick={() => {
                    if (selectedMode.size > 0) toggleMulti(user.id);
                    else setSelected(user);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleMulti(user.id);
                  }}
                >
                  {selectedMode.size > 0 ? (
                    <div
                      className={`w-10 h-10 rounded-full border-2 inline-flex items-center justify-center ${
                        checked
                          ? "bg-[var(--color-navy-700)] border-[var(--color-navy-700)] text-white"
                          : "border-[var(--color-line)]"
                      }`}
                    >
                      {checked && "✓"}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--color-navy-100)] text-[var(--color-navy-700)] font-extrabold inline-flex items-center justify-center">
                      {user.name?.[0] ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-[var(--color-navy-900)] truncate">{user.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>
                        {tier}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--color-ink-600)] truncate">
                      {t("ocust.visitCount", lang, { n: visits.length, cluster: cluster.label })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMulti(user.id);
                    }}
                    className="text-[12px] font-semibold text-[var(--color-ink-600)] px-2"
                  >
                    {t("ocust.pickBtn", lang)}
                  </button>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {selected && (
        <CustomerDetail
          user={selected}
          storeId={storeId}
          onClose={() => setSelected(null)}
          stats={myCustomers.find((c) => c.user.id === selected.id)}
          coupons={coupons.filter((c) => c.customerId === selected.id)}
          communications={communications.filter((c) => c.customerId === selected.id).slice(0, 5)}
          onIssue={(type, desc) => issueCoupon(selected.id, storeId, type, desc)}
          onMemo={(m) => updateUserMemo(selected.id, m)}
          onSetTier={(tier) => setCustomerTier(selected.id, storeId, tier)}
          onCommunicate={recordCommunication}
        />
      )}
    </OwnerShell>
  );
}

interface DetailProps {
  user: User;
  storeId: string;
  onClose: () => void;
  stats?: { rfm: { r: number; f: number; m: number }; cluster: { id: string; label: string }; tier: Tier; overrideTier?: Tier | "auto" };
  coupons: { id: string; type: string; description: string; status: string }[];
  communications: { id: string; type: string; content: string; date: string }[];
  onIssue: (type: string, desc: string) => void;
  onMemo: (m: string) => Promise<void> | void;
  onSetTier: (tier: Tier | "auto") => void;
  onCommunicate: (cid: string, sid: string, type: "coupon" | "message", content: string) => void;
}

function CustomerDetail({
  user,
  storeId,
  onClose,
  stats,
  coupons,
  communications,
  onIssue,
  onMemo,
  onSetTier,
  onCommunicate,
}: DetailProps) {
  const lang = useLanguage();
  const [memo, setMemo] = useState(user.memo ?? "");
  // 다른 고객을 열거나 user.memo가 외부에서 갱신되면 textarea 동기화
  useEffect(() => {
    setMemo(user.memo ?? "");
  }, [user.id, user.memo]);

  useEscapeClose(true, onClose);

  const insight = stats ? DEFAULT_INSIGHTS[stats.cluster.id as keyof typeof DEFAULT_INSIGHTS] : "";

  const sendMessage = async (channel: "kakao" | "sms") => {
    const content = prompt(t("ocust.msgPrompt", lang));
    if (!content) return;
    let res;
    if (channel === "kakao") {
      res = await sendKakaoMessage(content, t("ocust.msgSrc", lang), storeId);
    } else {
      res = await sendPhysicalSms(user.phone, content, "device");
    }
    if (res.ok) {
      onCommunicate(user.id, storeId, "message", `[${channel}] ${content}`);
      showToast(t("ocust.msgOk", lang), "success");
    } else {
      showToast(res.message ?? t("ocust.msgFail", lang), "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] max-h-[92vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-navy-100)] text-[var(--color-navy-700)] font-extrabold inline-flex items-center justify-center">
            {user.name?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-[18px] font-extrabold text-[var(--color-navy-900)]">{user.name}</p>
            <p className="text-[12px] text-[var(--color-ink-500)]">{user.phone || "—"}</p>
          </div>
        </div>

        {stats && (
          <Card padding="md" className="mb-3 bg-[var(--color-navy-50)] border-transparent">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[var(--color-navy-700)] uppercase">{stats.cluster.label}</span>
              <span className="text-[12px] font-bold text-[var(--color-navy-900)]">
                R{stats.rfm.r} · F{stats.rfm.f} · M{stats.rfm.m}
              </span>
            </div>
            <p className="text-[13px] font-semibold text-[var(--color-navy-900)]">💡 {insight}</p>
          </Card>
        )}

        <Section title={t("ocust.section.tier", lang)}>
          <div className="flex flex-wrap gap-2">
            {(["auto", ...TIER_ORDER] as const).map((tierOpt) => (
              <button
                key={tierOpt}
                onClick={() => onSetTier(tierOpt as Tier | "auto")}
                className={`h-9 px-3 rounded-full text-[12px] font-bold border ${
                  (stats?.overrideTier ?? "auto") === tierOpt
                    ? "bg-[var(--color-navy-700)] text-white border-transparent"
                    : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
                }`}
              >
                {tierOpt === "auto" ? t("ocust.tier.auto", lang) : tierOpt}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("ocust.section.memo", lang)}>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={t("ocust.memoPh", lang)}
            className="input-field min-h-[80px] resize-none"
          />
          <Button
            size="md"
            className="mt-2"
            disabled={memo === (user.memo ?? "")}
            onClick={async () => {
              await onMemo(memo);
              showToast(t("ocust.memoSaved", lang), "success");
            }}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {t("ocust.memoSave", lang)}
          </Button>
        </Section>

        <Section title={t("ocust.section.coupon", lang)}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button
              size="md"
              variant="mint"
              onClick={() => {
                const desc = prompt(t("ocust.couponPrompt", lang));
                if (desc) onIssue(t("ocust.bulkType", lang), desc);
              }}
              leftIcon={<Ticket className="w-4 h-4" />}
            >
              {t("ocust.couponBtn", lang)}
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => sendMessage("kakao")}
              leftIcon={<MessageSquare className="w-4 h-4" />}
            >
              {t("ocust.messageBtn", lang)}
            </Button>
          </div>
          {coupons.length === 0 ? (
            <p className="text-[12px] text-[var(--color-ink-500)]">{t("ocust.noCoupons", lang)}</p>
          ) : (
            <ul className="text-[12px] text-[var(--color-ink-700)] space-y-1">
              {coupons.slice(0, 5).map((c) => (
                <li key={c.id}>
                  · {c.description} <span className="text-[var(--color-ink-500)]">({c.status})</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {communications.length > 0 && (
          <Section title={t("ocust.recentComm", lang)}>
            <ul className="text-[12px] text-[var(--color-ink-700)] space-y-1">
              {communications.map((c) => (
                <li key={c.id}>· {c.content}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-[13px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}
