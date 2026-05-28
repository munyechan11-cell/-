import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Ticket,
  Home as HomeIcon,
  User as UserIcon,
  LogOut,
  Trash2,
  CheckCircle2,
  Hourglass,
  XCircle,
  Sparkles,
  UtensilsCrossed,
  Plus,
  Minus,
  ShoppingBag,
} from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import { getEffectiveTier, getNextTier, TIER_BADGE } from "../../lib/tier";
import { cn } from "../../lib/cn";
import { showToast } from "../../lib/toast";

type Tab = "home" | "menu" | "coupons" | "profile";

export default function CustomerDashboard() {
  const { storeId: paramStoreId } = useParams();
  const nav = useNavigate();
  const {
    currentUser,
    users,
    visits,
    coupons,
    tables,
    tierOverrides,
    menus,
    orders,
    logout,
    deleteAccount,
    requestCouponUse,
    cancelCouponRequest,
    placeOrder,
    setActiveStoreId,
  } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [cart, setCart] = useState<Record<string, number>>({});

  // 이 페이지에 있는 동안 해당 매장의 tables/menus/orders/photos 구독
  useEffect(() => {
    setActiveStoreId(paramStoreId ?? null);
    // 매장이 바뀌면 카트도 비움 (이전 매장 메뉴 ID는 새 매장에서 무효)
    setCart({});
    return () => setActiveStoreId(null);
  }, [paramStoreId, setActiveStoreId]);

  const storeId = paramStoreId ?? "";
  const owner = users.find((u) => u.id === storeId && u.role === "owner");

  // 잘못된 storeId 진입 가드 (users 로드 후 3회 재시도 후 홈으로)
  const [ownerCheck, setOwnerCheck] = useState(0);
  useEffect(() => {
    if (!storeId || owner) return;
    if (users.length === 0) return; // 아직 로드 중
    if (ownerCheck < 3) {
      const t = setTimeout(() => setOwnerCheck((n) => n + 1), 400);
      return () => clearTimeout(t);
    }
    showToast("매장을 찾을 수 없어 홈으로 이동합니다.", "error");
    nav("/customer", { replace: true });
  }, [storeId, owner, users.length, ownerCheck, nav]);

  const myVisits = useMemo(
    () => visits.filter((v) => v.customerId === currentUser?.id && v.storeId === storeId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [visits, currentUser?.id, storeId]
  );
  const myCoupons = useMemo(
    () => coupons.filter((c) => c.customerId === currentUser?.id && c.storeId === storeId)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()),
    [coupons, currentUser?.id, storeId]
  );
  const myTable = useMemo(
    () => tables.find((t) => t.currentCustomerId === currentUser?.id && t.storeId === storeId),
    [tables, currentUser?.id, storeId]
  );
  const storeMenus = useMemo(
    () => menus.filter((m) => m.storeId === storeId && m.isAvailable !== false),
    [menus, storeId]
  );
  const menuByCat = useMemo(() => {
    const map: Record<string, typeof storeMenus> = {};
    for (const m of storeMenus) (map[m.category] ??= []).push(m);
    return map;
  }, [storeMenus]);
  const myActiveOrder = useMemo(
    () =>
      orders.find(
        (o) =>
          o.customerId === currentUser?.id &&
          o.storeId === storeId &&
          o.status !== "served" &&
          o.status !== "cancelled"
      ),
    [orders, currentUser?.id, storeId]
  );

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const m = storeMenus.find((x) => x.id === id);
      return m ? { menu: m, qty } : null;
    })
    .filter(Boolean) as { menu: (typeof storeMenus)[number]; qty: number }[];
  const cartTotal = cartItems.reduce((s, c) => s + c.menu.price * c.qty, 0);

  const submitOrder = async () => {
    if (!currentUser || !myTable || cartItems.length === 0) return;
    await placeOrder({
      storeId,
      tableNumber: myTable.number,
      customerId: currentUser.id,
      items: cartItems.map((c) => ({
        menuId: c.menu.id,
        name: c.menu.name,
        quantity: c.qty,
        price: c.menu.price,
      })),
    });
    setCart({});
    setTab("home");
  };

  const override = tierOverrides.find(
    (o) => o.customerId === currentUser?.id && o.storeId === storeId
  )?.tier;
  const uniqueDays = new Set(myVisits.map((v) => new Date(v.date).toDateString())).size;
  const tier = getEffectiveTier(uniqueDays, override);
  const tierName = owner?.tierNames?.[tier] ?? tier;
  const next = getNextTier(tier);
  const progress = next ? Math.min(uniqueDays / next.min, 1) : 1;

  if (!currentUser) return null;

  return (
    <MobileShell
      bottomNav={<BottomNav tab={tab} setTab={setTab} />}
    >
      <TopBar
        title={owner?.restaurantName ?? "매장"}
        back={() => nav("/customer")}
        right={
          <Link
            to="/customer"
            className="w-10 h-10 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
            aria-label="내 결"
          >
            <UserIcon className="w-4 h-4 text-[var(--color-navy-800)]" />
          </Link>
        }
      />

      {tab === "home" && (
        <div className="px-5 pt-3 space-y-4">
          {/* Tier card */}
          <Card className="bg-[var(--color-navy-700)] text-white border-transparent shadow-[var(--shadow-navy)] p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[12px] font-semibold opacity-80">{currentUser.name}님</p>
                <p className="text-[24px] font-extrabold tracking-tight mt-0.5">{tierName}</p>
              </div>
              <Sparkles className="w-6 h-6 opacity-80" />
            </div>
            {next ? (
              <>
                <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-mint-400)] rounded-full transition-[width]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p className="text-[12px] font-semibold opacity-80 mt-3">
                  {next.tier}까지 {Math.max(next.min - uniqueDays, 0)}회 더 방문
                </p>
              </>
            ) : (
              <p className="text-[13px] font-semibold opacity-80">최고 등급에 도달하셨습니다.</p>
            )}
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <SmallStat label="방문" value={`${myVisits.length}회`} />
            <SmallStat label="보유 쿠폰" value={`${myCoupons.filter((c) => c.status !== "used").length}장`} />
            <SmallStat label="포인트" value={`${(currentUser.rewardBalance ?? 0).toLocaleString()}`} />
          </div>

          {/* Active table HUD */}
          {myTable && (
            <Card padding="md" className="flex items-center gap-3 border-[var(--color-mint-300)]">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-mint-100)] text-[var(--color-mint-700)] inline-flex items-center justify-center font-extrabold">
                {myTable.number}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[var(--color-navy-900)]">테이블 {myTable.number}번 이용 중</p>
                <SessionTimer start={myTable.sessionStartTime ?? null} />
              </div>
            </Card>
          )}

          {/* Active order */}
          {myActiveOrder && (
            <Card padding="md" className="border-[var(--color-navy-200)]">
              <p className="text-[12px] font-bold text-[var(--color-navy-700)] uppercase tracking-wide">
                진행 중 주문
              </p>
              <div className="flex items-center gap-2 mt-2 text-[14px] font-bold text-[var(--color-navy-900)]">
                <OrderStatusPill status={myActiveOrder.status} />
                <span className="ml-auto">₩ {myActiveOrder.totalAmount.toLocaleString()}</span>
              </div>
            </Card>
          )}

          {/* Recent visits */}
          <div>
            <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] mb-2 px-1">최근 방문</h2>
            {myVisits.length === 0 ? (
              <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
                아직 방문 기록이 없습니다.
              </Card>
            ) : (
              <div className="space-y-2">
                {myVisits.slice(0, 5).map((v) => (
                  <Card key={v.id} padding="md" className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center font-bold text-[12px]">
                      {v.tableNumber}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-[var(--color-navy-900)]">
                        {new Date(v.date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      </p>
                      <p className="text-[11px] text-[var(--color-ink-500)]">
                        {new Date(v.date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {v.totalAmount && (
                      <p className="text-[13px] font-bold text-[var(--color-navy-800)]">
                        ₩ {v.totalAmount.toLocaleString()}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "menu" && (
        <div className="px-5 pt-3 pb-32">
          {storeMenus.length === 0 ? (
            <Card padding="lg" className="text-center mt-2">
              <UtensilsCrossed className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
              <p className="text-[14px] text-[var(--color-ink-500)] font-medium">
                등록된 메뉴가 없습니다.
              </p>
            </Card>
          ) : (
            Object.entries(menuByCat).map(([cat, items]) => (
              <div key={cat} className="mt-2">
                <h3 className="text-[12px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide px-1 mb-2 mt-3">
                  {cat}
                </h3>
                <div className="space-y-2">
                  {items.map((m) => (
                    <Card key={m.id} padding="md" className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-[var(--color-navy-900)]">{m.name}</p>
                        {m.description && (
                          <p className="text-[12px] text-[var(--color-ink-500)] truncate">{m.description}</p>
                        )}
                        <p className="text-[13px] font-bold text-[var(--color-navy-700)] mt-1">
                          ₩ {m.price.toLocaleString()}
                        </p>
                      </div>
                      <QtyStepper
                        value={cart[m.id] ?? 0}
                        onChange={(v) =>
                          setCart((c) => {
                            const next = { ...c };
                            if (v <= 0) delete next[m.id];
                            else next[m.id] = v;
                            return next;
                          })
                        }
                      />
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}

          {cartItems.length > 0 && (
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-3 z-30">
              <button
                onClick={submitOrder}
                disabled={!myTable}
                className="w-full h-14 rounded-[18px] bg-[var(--color-navy-700)] text-white font-bold shadow-[var(--shadow-navy)] flex items-center justify-between px-5 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  {myTable ? `테이블 ${myTable.number}에 주문` : "테이블 이용 후 주문 가능"}
                </span>
                <span>₩ {cartTotal.toLocaleString()}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "coupons" && (
        <div className="px-5 pt-3 space-y-3">
          <h2 className="text-[15px] font-bold text-[var(--color-navy-900)] px-1">보유 쿠폰</h2>
          {myCoupons.length === 0 ? (
            <Card padding="lg" className="text-center">
              <Ticket className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
              <p className="text-[14px] text-[var(--color-ink-500)] font-medium">
                보유한 쿠폰이 없습니다.
              </p>
            </Card>
          ) : (
            myCoupons.map((c) => (
              <CouponRow
                key={c.id}
                coupon={c}
                tableNumber={myTable?.number}
                onUse={() => requestCouponUse(c.id, myTable?.number)}
                onCancel={() => cancelCouponRequest(c.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === "profile" && (
        <div className="px-5 pt-3 space-y-3">
          <Card padding="lg">
            <div className="flex items-center gap-3 mb-4">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} className="w-14 h-14 rounded-full" alt="" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[var(--color-navy-100)] text-[var(--color-navy-700)] inline-flex items-center justify-center font-extrabold text-lg">
                  {currentUser.name?.[0] ?? "결"}
                </div>
              )}
              <div>
                <p className="text-[17px] font-extrabold text-[var(--color-navy-900)]">{currentUser.name}</p>
                <p className="text-[12px] text-[var(--color-ink-500)]">{currentUser.phone || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-[var(--color-ink-700)]">
              <Info label="가입 방식" value={currentUser.authType ?? "phone"} />
              <Info label="연령대" value={currentUser.ageGroup ?? "—"} />
            </div>
          </Card>

          <Button block variant="ghost" onClick={() => { logout(); nav("/", { replace: true }); }} leftIcon={<LogOut className="w-4 h-4" />}>
            로그아웃
          </Button>
          <Button
            block
            variant="outline"
            onClick={async () => {
              if (confirm("정말 계정을 삭제하시겠습니까?\n방문·쿠폰 정보는 익명화되어 보관됩니다.")) {
                await deleteAccount();
                nav("/", { replace: true });
              }
            }}
            leftIcon={<Trash2 className="w-4 h-4" />}
            className="text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:border-[var(--color-danger)]"
          >
            계정 삭제
          </Button>
        </div>
      )}
    </MobileShell>
  );
}

function CouponRow({
  coupon,
  tableNumber,
  onUse,
  onCancel,
}: {
  coupon: { id: string; type: string; description: string; status: "available" | "pending" | "used"; usedAtTable?: number };
  tableNumber?: number;
  onUse: () => void;
  onCancel: () => void;
}) {
  const badge =
    TIER_BADGE[coupon.type as keyof typeof TIER_BADGE] ??
    { label: coupon.type, bg: "bg-[var(--color-navy-50)]", text: "text-[var(--color-navy-700)]" };
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>
          {badge.label}
        </div>
        {coupon.status === "pending" && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[#b45309] font-semibold">
            <Hourglass className="w-3 h-3" /> 승인 대기
          </span>
        )}
        {coupon.status === "used" && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-500)] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> 사용 완료
          </span>
        )}
      </div>
      <p className="text-[15px] font-bold text-[var(--color-navy-900)] mt-2">{coupon.description}</p>
      {coupon.status === "available" && (
        <Button
          size="md"
          variant="mint"
          className="mt-3"
          onClick={onUse}
          disabled={!tableNumber}
        >
          {tableNumber ? `테이블 ${tableNumber}에서 사용` : "테이블 이용 중에만 사용 가능"}
        </Button>
      )}
      {coupon.status === "pending" && (
        <Button size="md" variant="outline" className="mt-3" onClick={onCancel} leftIcon={<XCircle className="w-4 h-4" />}>
          요청 취소
        </Button>
      )}
    </Card>
  );
}

function SessionTimer({ start }: { start: string | null }) {
  const [elapsed, setElapsed] = useState(() => (start ? Date.now() - new Date(start).getTime() : 0));
  useMemo(() => {
    if (!start) return;
    const id = window.setInterval(() => setElapsed(Date.now() - new Date(start).getTime()), 1000);
    return () => clearInterval(id);
  }, [start]);
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  return (
    <p className="text-[12px] text-[var(--color-mint-700)] font-semibold tabular-nums">
      이용 시간 {m}분 {s.toString().padStart(2, "0")}초
    </p>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="sm" className="text-center">
      <p className="text-[11px] text-[var(--color-ink-500)] font-semibold mb-0.5">{label}</p>
      <p className="text-[16px] font-extrabold text-[var(--color-navy-900)]">{value}</p>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg)] rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-[var(--color-ink-500)] font-semibold uppercase mb-0.5">{label}</p>
      <p className="text-[13px] font-bold text-[var(--color-navy-900)]">{value}</p>
    </div>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  if (value === 0) {
    return (
      <button
        onClick={() => onChange(1)}
        className="w-9 h-9 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center shadow-[var(--shadow-navy)] active:scale-95"
        aria-label="담기"
      >
        <Plus className="w-4 h-4" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(value - 1)}
        className="w-8 h-8 rounded-full bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="text-[14px] font-extrabold text-[var(--color-navy-900)] w-5 text-center">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function OrderStatusPill({ status }: { status: "pending" | "accepted" | "cooking" | "served" | "cancelled" }) {
  const map = {
    pending: { label: "접수 대기", cls: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]" },
    accepted: { label: "접수됨", cls: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" },
    cooking: { label: "조리 중", cls: "bg-[#fff1e0] text-[#b45309]" },
    served: { label: "서빙 완료", cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]" },
    cancelled: { label: "취소됨", cls: "bg-[#fef2f2] text-[var(--color-danger)]" },
  } as const;
  const s = map[status];
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${s.cls}`}>{s.label}</span>;
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "홈", icon: <HomeIcon className="w-5 h-5" /> },
    { id: "menu", label: "메뉴", icon: <UtensilsCrossed className="w-5 h-5" /> },
    { id: "coupons", label: "쿠폰", icon: <Ticket className="w-5 h-5" /> },
    { id: "profile", label: "내 정보", icon: <UserIcon className="w-5 h-5" /> },
  ];
  return (
    <div className="grid grid-cols-4">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setTab(it.id)}
          className={cn(
            "h-16 flex flex-col items-center justify-center gap-1 transition-colors",
            tab === it.id ? "text-[var(--color-navy-700)]" : "text-[var(--color-ink-300)]"
          )}
        >
          {it.icon}
          <span className="text-[11px] font-bold tracking-tight">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
