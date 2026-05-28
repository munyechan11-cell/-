import { useMemo, useState } from "react";
import { Search, Ticket, MessageSquare, Save, X } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useStore } from "../../store/store";
import { calculateRFM, getRFMCluster, getEffectiveTier, TIER_BADGE, TIER_ORDER, DEFAULT_INSIGHTS } from "../../lib/tier";
import { sendKakaoMessage, sendPhysicalSms } from "../../lib/messaging";
import { showToast } from "../../lib/toast";
import type { Tier, User } from "../../lib/types";

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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<User | null>(null);
  const [selectedMode, setSelectedMode] = useState<Set<string>>(new Set());

  const myCustomers = useMemo(() => {
    return users
      .filter((u) => u.role === "customer" && u.storeId === storeId)
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
    const desc = prompt("발급할 쿠폰 설명을 입력하세요 (예: '재방문 감사 할인')");
    if (!desc) return;
    bulkIssueCoupon(Array.from(selectedMode), storeId, "이벤트", desc);
    setSelectedMode(new Set());
  };

  return (
    <OwnerShell
      title={selectedMode.size > 0 ? `${selectedMode.size}명 선택` : "고객 관리"}
      headerRight={
        selectedMode.size > 0 ? (
          <button
            onClick={() => setSelectedMode(new Set())}
            className="text-[13px] font-bold text-[var(--color-ink-600)] px-3 h-10 rounded-full hover:bg-[var(--color-navy-50)]"
          >
            선택 해제
          </button>
        ) : null
      }
    >
      <div>
        <Input
          placeholder="이름·전화번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSlot={<Search className="w-4 h-4" />}
        />

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          {(
            [
              ["all", "전체"],
              ["vip", "VIP 레전드"],
              ["new", "유망 신규"],
              ["slipping", "이탈 위험"],
              ["cold", "장기 휴면"],
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="mint" size="md" onClick={sendBulkCoupon} leftIcon={<Ticket className="w-4 h-4" />}>
              일괄 쿠폰 발급
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setSelectedMode(new Set())}
              leftIcon={<X className="w-4 h-4" />}
            >
              해제
            </Button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pb-8">
          {myCustomers.length === 0 ? (
            <Card padding="lg" className="text-center body-md md:col-span-2 xl:col-span-3">
              조건에 맞는 고객이 없습니다.
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {tier}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-ink-500)] truncate">
                      방문 {visits.length}회 · {cluster.label}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMulti(user.id);
                    }}
                    className="text-[11px] font-semibold text-[var(--color-ink-500)] px-2"
                  >
                    선택
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
          onSetTier={(t) => setCustomerTier(selected.id, storeId, t)}
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
  onMemo: (m: string) => void;
  onSetTier: (t: Tier | "auto") => void;
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
  const [memo, setMemo] = useState(user.memo ?? "");
  const insight = stats ? DEFAULT_INSIGHTS[stats.cluster.id as keyof typeof DEFAULT_INSIGHTS] : "";

  const sendMessage = async (channel: "kakao" | "sms") => {
    const content = prompt("보낼 메시지를 입력하세요");
    if (!content) return;
    let res;
    if (channel === "kakao") {
      res = await sendKakaoMessage(content, "결 매장", storeId);
    } else {
      res = await sendPhysicalSms(user.phone, content, "device");
    }
    if (res.ok) {
      onCommunicate(user.id, storeId, "message", `[${channel}] ${content}`);
      showToast("메시지를 전송했습니다.", "success");
    } else {
      showToast(res.message ?? "전송 실패", "error");
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

        <Section title="등급 수동 지정">
          <div className="flex flex-wrap gap-2">
            {["auto", ...TIER_ORDER].map((t) => (
              <button
                key={t}
                onClick={() => onSetTier(t as Tier | "auto")}
                className={`h-9 px-3 rounded-full text-[12px] font-bold border ${
                  (stats?.overrideTier ?? "auto") === t
                    ? "bg-[var(--color-navy-700)] text-white border-transparent"
                    : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
                }`}
              >
                {t === "auto" ? "자동" : t}
              </button>
            ))}
          </div>
        </Section>

        <Section title="메모">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="고객 특이사항"
            className="input-field min-h-[80px] resize-none"
          />
          <Button
            size="md"
            className="mt-2"
            disabled={memo === (user.memo ?? "")}
            onClick={() => onMemo(memo)}
            leftIcon={<Save className="w-4 h-4" />}
          >
            메모 저장
          </Button>
        </Section>

        <Section title="쿠폰">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button
              size="md"
              variant="mint"
              onClick={() => {
                const desc = prompt("쿠폰 설명");
                if (desc) onIssue("이벤트", desc);
              }}
              leftIcon={<Ticket className="w-4 h-4" />}
            >
              쿠폰 발급
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => sendMessage("kakao")}
              leftIcon={<MessageSquare className="w-4 h-4" />}
            >
              메시지
            </Button>
          </div>
          {coupons.length === 0 ? (
            <p className="text-[12px] text-[var(--color-ink-500)]">발급 쿠폰 없음.</p>
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
          <Section title="최근 통신">
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
