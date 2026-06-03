import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  CreditCard,
  Receipt as ReceiptIcon,
  DoorOpen,
} from "lucide-react";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { BillModal } from "../../components/ui/BillModal";
import { useStore } from "../../store/store";
import { getEffectiveTier, getNextTier, TIER_BADGE } from "../../lib/tier";
import { cn } from "../../lib/cn";
import { showToast } from "../../lib/toast";

type Tab = "home" | "menu" | "coupons" | "profile";

export default function CustomerDashboard() {
  const { storeId: paramStoreId } = useParams();
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get("table");
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
    payTableSession,
    setActiveStoreId,
    enterTable,
    leaveTable,
  } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [billOpen, setBillOpen] = useState(false);

  // 이 페이지에 있는 동안 해당 매장의 tables/menus/orders/photos 구독
  // 페이지 떠나도 테이블 점유는 유지 — 명시적 '가게 퇴장' 또는 사장님 강제 퇴장만 점유 해제.
  useEffect(() => {
    setActiveStoreId(paramStoreId ?? null);
    // 매장이 바뀌면 카트도 비움 (이전 매장 메뉴 ID는 새 매장에서 무효)
    setCart({});
    return () => setActiveStoreId(null);
  }, [paramStoreId, setActiveStoreId]);

  // QR 로 ?table=N 받아 진입한 경우 — 자리 점유 자동 등록(합석 가능)
  useEffect(() => {
    if (!currentUser || !paramStoreId) return;
    const n = Number(tableParam);
    if (!Number.isFinite(n) || n <= 0) return;
    enterTable({
      tableNumber: n,
      storeId: paramStoreId,
      customerId: currentUser.id,
      customerName: currentUser.name,
    }).catch((e) => console.warn("[enterTable]", e?.message));
    // tableParam 이 같은 한 다시 호출되어도 합석 occupantIds 만 갱신 → 안전
  }, [tableParam, paramStoreId, currentUser?.id]);

  const handleExitStore = async () => {
    if (!currentUser) return;
    const tableNum = myTable?.number;
    if (!tableNum) {
      // 점유한 테이블이 없으면 그냥 홈으로
      nav("/customer", { replace: true });
      return;
    }
    if (!window.confirm("가게에서 나가시겠어요?\n미결제 주문이 있다면 매장에 안내해 주세요.")) return;
    try {
      await leaveTable(tableNum, paramStoreId ?? "");
      showToast("좋은 시간 보내셨길 바라요. 또 만나요!", "success");
      nav("/customer", { replace: true });
    } catch (e: any) {
      showToast(`퇴장 처리 실패: ${e?.message ?? "잠시 후 다시 시도해 주세요."}`, "error");
    }
  };

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
  // 현재 매장에서 본인의 모든 주문 (취소 제외)
  const mySessionOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.customerId === currentUser?.id &&
            o.storeId === storeId &&
            o.status !== "cancelled"
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [orders, currentUser?.id, storeId]
  );
  const myActiveOrder = useMemo(
    () =>
      mySessionOrders.find((o) => o.status !== "served"),
    [mySessionOrders]
  );
  // 미결제 주문 합계
  const unpaidOrders = useMemo(
    () => mySessionOrders.filter((o) => o.paymentStatus !== "paid"),
    [mySessionOrders]
  );
  const unpaidTotal = unpaidOrders.reduce((s, o) => s + o.totalAmount, 0);

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

  const handlePay = async () => {
    if (!currentUser || !myTable) return;
    if (unpaidTotal === 0) return;
    if (!confirm(`총 ₩ ${unpaidTotal.toLocaleString()}을 결제할까요?\n결제는 매장 카운터에서 마무리해 주세요.`)) return;
    await payTableSession(currentUser.id, storeId, myTable.number);
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
            className="w-11 h-11 rounded-full hover:bg-[var(--color-navy-50)] inline-flex items-center justify-center"
            aria-label="내 결"
          >
            <UserIcon className="w-5 h-5 text-[var(--color-navy-800)]" />
          </Link>
        }
      />

      {tab === "home" && (
        <div className="px-5 pt-3 space-y-4">
          {/* Tier card */}
          <Card className="bg-[var(--color-navy-700)] text-white border-transparent shadow-[var(--shadow-navy)] p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold opacity-90">{currentUser.name}님</p>
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
                <p className="text-[13px] font-semibold opacity-90 mt-3">
                  {next.tier}까지 {Math.max(next.min - uniqueDays, 0)}회 더 방문
                </p>
              </>
            ) : (
              <p className="text-[13px] font-semibold opacity-90">최고 등급에 도달하셨습니다.</p>
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
            <>
              <Card padding="md" className="flex items-center gap-3 border-[var(--color-mint-300)]">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-mint-100)] text-[var(--color-mint-700)] inline-flex items-center justify-center font-extrabold">
                  {myTable.number}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-[var(--color-navy-900)]">테이블 {myTable.number}번 이용 중</p>
                  <SessionTimer start={myTable.sessionStartTime ?? null} />
                </div>
              </Card>
              {/* 계산서 · 가게 퇴장 — 손님이 직접 컨트롤 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  block
                  onClick={() => setBillOpen(true)}
                  leftIcon={<ReceiptIcon className="w-4 h-4" />}
                  disabled={mySessionOrders.length === 0}
                >
                  계산서 보기
                </Button>
                <Button
                  variant="ghost"
                  block
                  onClick={handleExitStore}
                  leftIcon={<DoorOpen className="w-4 h-4" />}
                >
                  가게 퇴장
                </Button>
              </div>
            </>
          )}

          {/* Session orders & 결제 */}
          {mySessionOrders.length > 0 && (
            <Card padding="md">
              <div className="flex items-center gap-2 mb-3">
                <ReceiptIcon className="w-4 h-4 text-[var(--color-navy-700)]" />
                <p className="text-[13px] font-bold text-[var(--color-navy-900)]">
                  현재 주문 ({mySessionOrders.length}건)
                </p>
              </div>

              {myActiveOrder && myActiveOrder.status !== "cancelled" && (
                <OrderProgress status={myActiveOrder.status} />
              )}
              {myActiveOrder && myActiveOrder.status === "cancelled" && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-[#fef2f2] text-[var(--color-danger)] text-[13px] font-bold text-center">
                  주문이 취소되었습니다.
                </div>
              )}

              <ul className="divide-y divide-[var(--color-line-soft)] -mx-1">
                {mySessionOrders.map((o) => (
                  <li key={o.id} className="py-2 px-1 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[12px] text-[var(--color-ink-600)] font-semibold tabular-nums">
                          {new Date(o.createdAt).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {o.paymentStatus === "paid" ? (
                          <span className="text-[11px] font-bold text-[var(--color-mint-700)] bg-[var(--color-mint-100)] px-1.5 py-0.5 rounded">
                            결제 완료
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[var(--color-warn)] bg-[#fff1e0] px-1.5 py-0.5 rounded">
                            미결제
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--color-ink-700)] break-keep line-clamp-2">
                        {o.items.map((it) => `${it.name}×${it.quantity}`).join(", ")}
                      </p>
                    </div>
                    <span className="text-[13px] font-bold text-[var(--color-navy-900)] tabular-nums shrink-0">
                      ₩ {o.totalAmount.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[var(--color-ink-600)]">미결제 합계</span>
                <span className="text-[18px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                  ₩ {unpaidTotal.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setBillOpen(true)}
                  leftIcon={<ReceiptIcon className="w-4 h-4" />}
                >
                  계산서 보기
                </Button>
                {unpaidTotal > 0 && myTable ? (
                  <Button
                    size="md"
                    onClick={handlePay}
                    leftIcon={<CreditCard className="w-4 h-4" />}
                  >
                    결제하기
                  </Button>
                ) : (
                  <Button size="md" disabled leftIcon={<CreditCard className="w-4 h-4" />}>
                    결제 완료
                  </Button>
                )}
              </div>
              {unpaidTotal === 0 && mySessionOrders.length > 0 && (
                <div className="mt-3 py-2.5 px-3 rounded-xl bg-[var(--color-mint-100)] text-[var(--color-mint-700)] text-[13px] font-bold text-center">
                  모든 주문이 결제되었습니다. 매장 카운터에서 마무리해 주세요.
                </div>
              )}
            </Card>
          )}

          {/* Recent visits */}
          <div>
            <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] mb-2 px-1">최근 방문</h2>
            {myVisits.length === 0 ? (
              <Card padding="lg" className="text-center">
                <Sparkles className="w-7 h-7 text-[var(--color-ink-300)] mx-auto mb-2" />
                <p className="text-[14px] text-[var(--color-ink-600)] font-medium">
                  이 매장의 첫 방문이에요.
                </p>
                <p className="text-[12px] text-[var(--color-ink-500)] mt-1">
                  주문하시면 방문 기록과 등급이 쌓입니다.
                </p>
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
                      <p className="text-[12px] text-[var(--color-ink-600)]">
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
        <div className="px-5 pt-3" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 88px)" }}>
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
                <h3 className="text-[13px] font-bold text-[var(--color-ink-600)] uppercase tracking-wide px-1 mb-2 mt-3">
                  {cat}
                </h3>
                <div className="space-y-2">
                  {items.map((m) => (
                    <Card key={m.id} padding="md" className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-[var(--color-navy-900)]">{m.name}</p>
                        {m.description && (
                          <p className="text-[13px] text-[var(--color-ink-600)] line-clamp-2 break-keep">{m.description}</p>
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
            <div
              className="fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 z-30"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom) + 8px)" }}
            >
              <button
                onClick={submitOrder}
                disabled={!myTable}
                className="w-full h-14 rounded-[18px] bg-[var(--color-navy-700)] text-white font-bold shadow-[var(--shadow-navy)] flex items-center justify-between px-5 disabled:opacity-50 active:scale-[0.98] transition-transform"
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

      {/* 계산서 모달 */}
      {billOpen && currentUser && (
        <BillModal
          storeName={owner?.restaurantName ?? "매장"}
          tableNumber={myTable?.number}
          customerName={currentUser.name}
          orders={mySessionOrders}
          unpaidTotal={unpaidTotal}
          paidTotal={mySessionOrders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.totalAmount, 0)}
          canPay={!!myTable}
          onClose={() => setBillOpen(false)}
          onPay={async () => {
            setBillOpen(false);
            await handlePay();
          }}
        />
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
  useEffect(() => {
    if (!start) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - new Date(start).getTime());
    const id = window.setInterval(
      () => setElapsed(Date.now() - new Date(start).getTime()),
      1000
    );
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
      <p className="text-[12px] text-[var(--color-ink-600)] font-semibold mb-0.5">{label}</p>
      <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] tabular-nums">{value}</p>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg)] rounded-xl px-3 py-2.5">
      <p className="text-[11px] text-[var(--color-ink-600)] font-semibold uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-[14px] font-bold text-[var(--color-navy-900)]">{value}</p>
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
        className="w-10 h-10 rounded-full bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center active:scale-95"
        aria-label="수량 감소"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="text-[15px] font-extrabold text-[var(--color-navy-900)] w-6 text-center">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center active:scale-95"
        aria-label="수량 증가"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function OrderProgress({ status }: { status: "pending" | "accepted" | "cooking" | "served" }) {
  const steps = [
    { key: "pending", label: "접수 대기" },
    { key: "accepted", label: "접수됨" },
    { key: "cooking", label: "조리 중" },
    { key: "served", label: "서빙 완료" },
  ] as const;
  const currentIdx = steps.findIndex((s) => s.key === status);
  return (
    <div className="mb-3 px-1">
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex-1 flex items-center first:flex-none">
              {i > 0 && (
                <div
                  className={cn(
                    "h-[3px] flex-1 rounded-full mx-1 transition-colors",
                    done ? "bg-[var(--color-mint-500)]" : "bg-[var(--color-ink-100)]"
                  )}
                />
              )}
              <div
                className={cn(
                  "w-7 h-7 rounded-full inline-flex items-center justify-center text-[12px] font-extrabold transition-colors shrink-0",
                  done
                    ? "bg-[var(--color-mint-500)] text-white shadow-[0_2px_6px_rgba(0,163,158,0.35)]"
                    : "bg-[var(--color-ink-100)] text-[var(--color-ink-500)]",
                  active && "ring-4 ring-[var(--color-mint-500)]/20"
                )}
              >
                {done ? "✓" : i + 1}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 px-0.5">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "text-[11px] font-bold tracking-tight",
              i === currentIdx
                ? "text-[var(--color-mint-700)]"
                : i < currentIdx
                ? "text-[var(--color-ink-600)]"
                : "text-[var(--color-ink-400)]"
            )}
          >
            {s.label}
          </span>
        ))}
      </div>
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
  return <span className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${s.cls}`}>{s.label}</span>;
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
            tab === it.id ? "text-[var(--color-navy-700)]" : "text-[var(--color-ink-500)]"
          )}
        >
          {it.icon}
          <span className="text-[12px] font-bold tracking-tight">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
