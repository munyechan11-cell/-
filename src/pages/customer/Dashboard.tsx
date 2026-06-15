import { useEffect, useMemo, useRef, useState } from "react";
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
  Star,
  Camera,
  X as XIcon,
  ClipboardCheck,
  ChefHat,
  PartyPopper,
} from "lucide-react";
import { resizeImage } from "../owner/PhotoVault";
import { LANGS, useLanguage, setLanguage, t, fmtKRW, getLocale } from "../../lib/i18n";
import { MobileShell } from "../../components/layout/MobileShell";
import { TopBar } from "../../components/ui/TopBar";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { BillModal } from "../../components/ui/BillModal";
import { useStore } from "../../store/store";
import { getEffectiveTier, getNextTier, TIER_BADGE } from "../../lib/tier";
import { cn } from "../../lib/cn";
import { showToast } from "../../lib/toast";
import { startCardPayment } from "../../lib/tossPayments";
import type { Order, Industry } from "../../lib/types";
import { cookingNowLabel } from "../../lib/cookingLabels";
import { getStoreOpenStatus, summarizeStatus } from "../../lib/businessHours";

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
    issueCoupon,
    placeOrder,
    payTableSession,
    addPhoto,
    setActiveStoreId,
    enterTable,
    leaveTable,
  } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [billOpen, setBillOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // 언어 변경 시 상위 리렌더 — 프로필 탭의 언어 선택 버튼에서 사용
  const lang = useLanguage();

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
    if (!window.confirm(t("home.leaveConfirm"))) return;
    try {
      await leaveTable(tableNum, paramStoreId ?? "");
      showToast(t("home.leaveToast"), "success");
      nav("/customer", { replace: true });
    } catch (e: any) {
      showToast(t("home.leaveFail", undefined, { msg: e?.message ?? "" }), "error");
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
    showToast(t("home.storeNotFound"), "error");
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

  // 8-6: 새 쿠폰 도착 알림 — 고객 FCM 푸시가 없어 인앱 실시간 알림(토스트 + 탭 뱃지)으로.
  //  · localStorage 의 '본 쿠폰' 집합과 비교해, 지난 세션 후/실시간으로 새로 온 쿠폰만 알림.
  //  · 24h 이내 발급분만 알려 옛 쿠폰·첫 로드 오탐을 방지.
  const [unseenCoupons, setUnseenCoupons] = useState(0);
  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid || !storeId) return;
    const key = `gyeol:coupons-seen:${storeId}:${uid}`;
    let stored: Set<string>;
    try { stored = new Set<string>(JSON.parse(localStorage.getItem(key) || "[]")); } catch { stored = new Set(); }
    const avail = myCoupons.filter((c) => c.status !== "used");
    const recentFresh = avail.filter(
      (c) => !stored.has(c.id) && Date.now() - new Date(c.issuedAt).getTime() < 24 * 60 * 60_000
    );
    if (recentFresh.length) {
      showToast(t("coupons.arrived", lang), "success");
      setUnseenCoupons((n) => n + recentFresh.length);
    }
    if (avail.length) {
      avail.forEach((c) => stored.add(c.id)); // 현재 사용가능 쿠폰을 '본 것'으로 기록(빈 배열로는 덮어쓰지 않음)
      localStorage.setItem(key, JSON.stringify([...stored]));
    }
  }, [myCoupons, currentUser?.id, storeId, lang]);
  useEffect(() => { if (tab === "coupons") setUnseenCoupons(0); }, [tab]);
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
  // 본 매장 본인의 모든 주문 (취소 제외)
  const allMyOrders = useMemo(
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

  /**
   * 세션 분리 — 손님이 한 매장에 여러 번 방문 시 '이번 방문' / '지난 방문' 명확 구분.
   *
   * 기준: myTable.sessionStartTime 이 있으면 그 시각 이후 주문만 '현재 세션'.
   *       없으면 미결제(unpaid/requested) 가 있는 시점부터 현재 세션으로 폴백.
   *       그 외 결제 완료된 과거 주문은 '지난 방문 영수증'.
   */
  const sessionStartIso = myTable?.sessionStartTime ?? null;
  const mySessionOrders = useMemo(() => {
    if (sessionStartIso) {
      return allMyOrders.filter((o) => o.createdAt >= sessionStartIso);
    }
    // 점유 정보 없으면 — 미결제 주문만 현재 세션으로
    const hasUnpaid = allMyOrders.some((o) => o.paymentStatus !== "paid");
    if (!hasUnpaid) return [];
    // 가장 오래된 미결제 이후 모든 주문
    const oldest = allMyOrders.find((o) => o.paymentStatus !== "paid");
    return oldest ? allMyOrders.filter((o) => o.createdAt >= oldest.createdAt) : [];
  }, [allMyOrders, sessionStartIso]);

  /** 지난 방문 = 현재 세션에 포함 안 된 결제 완료 주문 — 날짜별 그룹 */
  const pastVisits = useMemo(() => {
    const sessionIds = new Set(mySessionOrders.map((o) => o.id));
    const past = allMyOrders.filter((o) => !sessionIds.has(o.id) && o.paymentStatus === "paid");
    // 날짜(YYYY-MM-DD) 별로 그룹 + 같은 날 합산
    const map = new Map<string, { date: string; orders: typeof past; total: number; itemsCount: number }>();
    past.forEach((o) => {
      const d = o.createdAt.slice(0, 10);
      const g = map.get(d) ?? { date: d, orders: [], total: 0, itemsCount: 0 };
      g.orders.push(o);
      g.total += o.totalAmount;
      g.itemsCount += o.items.reduce((s, it) => s + it.quantity, 0);
      map.set(d, g);
    });
    // 최신순
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [allMyOrders, mySessionOrders]);

  const myActiveOrder = useMemo(
    () => mySessionOrders.find((o) => o.status !== "served"),
    [mySessionOrders]
  );
  const unpaidOrders = useMemo(
    () => mySessionOrders.filter((o) => o.paymentStatus !== "paid"),
    [mySessionOrders]
  );
  const unpaidTotal = unpaidOrders.reduce((s, o) => s + o.totalAmount, 0);

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => {
      const m = storeMenus.find((x) => x.id === id);
      // 메뉴가 사라졌거나(삭제) isAvailable=false 면 카트에서 제외
      if (!m || m.isAvailable === false) return null;
      return { menu: m, qty };
    })
    .filter(Boolean) as { menu: (typeof storeMenus)[number]; qty: number }[];
  const cartTotal = cartItems.reduce((s, c) => s + c.menu.price * c.qty, 0);

  // 사장님이 메뉴를 품절/삭제한 항목이 있으면 알림 후 cart 정리.
  // useRef 로 1회만 알림 — 매 렌더 토스트 폭주 방지.
  const removedCartIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cartIds = Object.keys(cart);
    const aliveIds = new Set(cartItems.map((c) => c.menu.id));
    const removed = cartIds.filter((id) => !aliveIds.has(id) && !removedCartIdsRef.current.has(id));
    if (removed.length > 0) {
      removed.forEach((id) => removedCartIdsRef.current.add(id));
      showToast(t("home.cart.soldOut", lang), "info");
      // cart 에서도 제거 — 다음 submitOrder 시 0건이 되지 않게
      setCart((c) => {
        const next = { ...c };
        for (const id of removed) delete next[id];
        return next;
      });
    }
  // cartItems 는 매 렌더 새 array — id 의 set 만 비교
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(cart).join(","), cartItems.map((c) => c.menu.id).join(",")]);

  const submitOrder = async () => {
    if (!currentUser || !myTable || cartItems.length === 0) return;
    // 영업 외 시간 사전 차단 — store.placeOrder 도 검증하지만 사용자 경험 위해 UI 에서도 한 번
    const s = getStoreOpenStatus(owner);
    if (s.open === false) {
      showToast(t("menu.orderFailReason", undefined, { reason: s.reason }), "error");
      return;
    }
    try {
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
    } catch (e: any) {
      // store 에서 영업 외·강제 퇴장·금액 검증 실패 throw 한 경우 toast 는 store 에서 표시됨
      // 강제 퇴장 케이스는 추가로 매장 홈으로 이동
      if (String(e?.message ?? "").includes("table not occupied")) {
        nav("/customer", { replace: true });
      }
      return;
    }
    setCart({});
    setTab("home");
  };

  const handlePay = () => {
    if (!currentUser || !myTable) return;
    if (unpaidTotal === 0) return;
    // 결제 요청 전에 리뷰(사진+별점+글) 모달을 띄움 — 건너뛰기 가능
    setReviewOpen(true);
  };

  const submitPaymentWithReview = async (
    review?: { rating?: number; reviewText?: string; imageData?: string }
  ) => {
    if (!currentUser || !myTable) return;
    setReviewOpen(false);
    try {
      // 리뷰 내용이 하나라도 있으면 photos 컬렉션에 type="review"로 저장
      const hasReview = !!(review && (review.rating || review.reviewText?.trim() || review.imageData));
      if (hasReview) {
        await addPhoto({
          storeId,
          type: "review",
          ...(review!.imageData ? { imageData: review!.imageData } : {}),
          ...(review!.rating ? { rating: review!.rating } : {}),
          ...(review!.reviewText?.trim() ? { reviewText: review!.reviewText.trim() } : {}),
          customerId: currentUser.id,
          customerName: currentUser.name,
          tableNumber: myTable.number,
        });
        // 8-5: 리뷰 작성 보상 쿠폰 — 매장이 켰고 실제 리뷰(별점/글)면 자동 지급.
        //  · 미사용 'review' 쿠폰이 이미 있으면 중복 지급 안 함(누적 방지). 도착 알림은 8-6이 처리.
        const rc = owner?.storeConfig?.reviewCoupon;
        const realReview = !!(review!.rating || review!.reviewText?.trim());
        const alreadyHas = coupons.some(
          (c) => c.customerId === currentUser.id && c.storeId === storeId && c.type === "review" && c.status === "available"
        );
        if (rc?.enabled && realReview && !alreadyHas) {
          await issueCoupon(
            currentUser.id, storeId, "review",
            rc.description?.trim() || t("review.rewardDefault", lang),
            Math.max(0, Number(rc.amount) || 0)
          );
        }
      }
      await payTableSession(currentUser.id, storeId, myTable.number);
    } catch {
      // store 에서 토스트 처리됨
    }
  };

  const override = tierOverrides.find(
    (o) => o.customerId === currentUser?.id && o.storeId === storeId
  )?.tier;
  const uniqueDays = new Set(myVisits.map((v) => new Date(v.date).toDateString())).size;
  const tier = getEffectiveTier(uniqueDays, override);
  const tierName = owner?.tierNames?.[tier] ?? tier;
  const next = getNextTier(tier);
  const progress = next ? Math.min(uniqueDays / next.min, 1) : 1;

  // 로그인 상태 로딩 중 — 흰 화면 깜빡임 대신 안내 화면
  if (!currentUser) {
    return (
      <MobileShell>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-navy-50)] inline-flex items-center justify-center mb-3">
            <UserIcon className="w-6 h-6 text-[var(--color-navy-700)]" />
          </div>
          <p className="text-[14px] font-bold text-[var(--color-navy-900)]">{t("home.loginLoading", lang)}</p>
          <p className="text-[12px] text-[var(--color-ink-500)] mt-1.5 font-medium">
            {t("home.loginLoadingDesc", lang)}
          </p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      bottomNav={<BottomNav tab={tab} setTab={setTab} couponBadge={unseenCoupons} />}
    >
      <TopBar
        title={owner?.restaurantName ?? t("common.store", lang)}
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
          {/* 영업 외 시간 안내 배너 — 영업 중이 아니면 상단에 빨간 카드 */}
          <StoreStatusBanner owner={owner} />

          {/* Tier card */}
          <Card className="bg-[var(--color-navy-700)] text-white border-transparent shadow-[var(--shadow-navy)] p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold opacity-90">{t("home.greeting", lang, { name: currentUser.name })}</p>
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
                  {t("home.nextTier", lang, { tier: next.tier, n: Math.max(next.min - uniqueDays, 0) })}
                </p>
              </>
            ) : (
              <p className="text-[13px] font-semibold opacity-90">{t("home.topTier", lang)}</p>
            )}
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <SmallStat label={t("home.stat.visits", lang)} value={`${myVisits.length}${t("home.unit.visit", lang)}`} />
            <SmallStat label={t("home.stat.coupons", lang)} value={`${myCoupons.filter((c) => c.status !== "used").length}${t("home.unit.coupon", lang)}`} />
            <SmallStat label={t("home.stat.points", lang)} value={`${(currentUser.rewardBalance ?? 0).toLocaleString()}`} />
          </div>

          {/* Active table HUD */}
          {myTable && (
            <>
              <Card padding="md" className="flex items-center gap-3 border-[var(--color-mint-300)]">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-mint-100)] text-[var(--color-mint-700)] inline-flex items-center justify-center font-extrabold">
                  {myTable.number}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-[var(--color-navy-900)]">{t("home.tableInUse", lang, { n: myTable.number })}</p>
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
                  {t("home.viewBill", lang)}
                </Button>
                <Button
                  variant="ghost"
                  block
                  onClick={handleExitStore}
                  leftIcon={<DoorOpen className="w-4 h-4" />}
                >
                  {t("home.leaveStore", lang)}
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
                  {t("home.currentOrders", lang, { n: mySessionOrders.length })}
                </p>
              </div>

              {myActiveOrder && myActiveOrder.status !== "cancelled" && (
                <OrderProgress status={myActiveOrder.status} industry={owner?.storeConfig?.industry} />
              )}
              {myActiveOrder && myActiveOrder.status === "cancelled" && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-[#fef2f2] text-[var(--color-danger)] text-[13px] font-bold text-center">
                  {t("home.orderCancelled", lang)}
                </div>
              )}

              <ul className="divide-y divide-[var(--color-line-soft)] -mx-1">
                {mySessionOrders.map((o) => (
                  <li key={o.id} className="py-2 px-1 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[12px] text-[var(--color-ink-600)] font-semibold tabular-nums">
                          {new Date(o.createdAt).toLocaleTimeString(lang === "ko" ? "ko-KR" : lang === "zh" ? "zh-CN" : lang === "vi" ? "vi-VN" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {o.paymentStatus === "paid" ? (
                          <span className="text-[11px] font-bold text-[var(--color-mint-700)] bg-[var(--color-mint-100)] px-1.5 py-0.5 rounded">
                            {t("pay.paid", lang)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-[var(--color-warn)] bg-[#fff1e0] px-1.5 py-0.5 rounded">
                            {t("pay.unpaid", lang)}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--color-ink-700)] break-keep line-clamp-2">
                        {o.items.map((it) => `${it.name}×${it.quantity}`).join(", ")}
                      </p>
                    </div>
                    <span className="text-[13px] font-bold text-[var(--color-navy-900)] tabular-nums shrink-0">
                      {fmtKRW(o.totalAmount, lang)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-3 border-t border-[var(--color-line)] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[var(--color-ink-600)]">{t("home.unpaidSum", lang)}</span>
                <span className="text-[18px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                  {fmtKRW(unpaidTotal, lang)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setBillOpen(true)}
                  leftIcon={<ReceiptIcon className="w-4 h-4" />}
                >
                  {t("home.viewBill", lang)}
                </Button>
                {(() => {
                  const hasRequested = mySessionOrders.some((o) => o.paymentStatus === "requested");
                  if (hasRequested) {
                    return (
                      <Button size="md" disabled leftIcon={<CreditCard className="w-4 h-4" />}>
                        {t("home.paying", lang)}
                      </Button>
                    );
                  }
                  if (unpaidTotal > 0 && myTable) {
                    return (
                      <Button
                        size="md"
                        onClick={handlePay}
                        leftIcon={<CreditCard className="w-4 h-4" />}
                      >
                        {t("home.payButton", lang)}
                      </Button>
                    );
                  }
                  return (
                    <Button size="md" disabled leftIcon={<CreditCard className="w-4 h-4" />}>
                      {t("home.payDone", lang)}
                    </Button>
                  );
                })()}
              </div>
              {mySessionOrders.some((o) => o.paymentStatus === "requested") && (
                <div className="mt-3 py-2.5 px-3 rounded-xl bg-[#fff8e6] text-[var(--color-warn)] text-[12.5px] font-bold text-center border border-[var(--color-warn)]/30">
                  {t("home.payRequestedNote", lang)}
                </div>
              )}
              {unpaidTotal === 0 && mySessionOrders.length > 0 && (
                <div className="mt-3 py-2.5 px-3 rounded-xl bg-[var(--color-mint-100)] text-[var(--color-mint-700)] text-[13px] font-bold text-center">
                  {t("home.allPaid", lang)}
                </div>
              )}
            </Card>
          )}

          {/* 지난 방문 영수증 — 같은 매장 재방문 시 명확히 분리 */}
          {pastVisits.length > 0 && <PastVisitsCard visits={pastVisits} storeName={owner?.restaurantName ?? t("common.store", lang)} />}

          {/* Recent visits */}
          <div>
            <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] mb-2 px-1">{t("home.recentVisits", lang)}</h2>
            {myVisits.length === 0 ? (
              <Card padding="lg" className="text-center">
                <Sparkles className="w-7 h-7 text-[var(--color-ink-300)] mx-auto mb-2" />
                <p className="text-[14px] text-[var(--color-ink-600)] font-medium">
                  {t("home.firstVisit", lang)}
                </p>
                <p className="text-[12px] text-[var(--color-ink-500)] mt-1">
                  {t("home.firstVisitDesc", lang)}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {myVisits.slice(0, 5).map((v) => {
                  const locale = getLocale(lang);
                  return (
                    <Card key={v.id} padding="md" className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center font-bold text-[12px]">
                        {v.tableNumber}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[var(--color-navy-900)]">
                          {new Date(v.date).toLocaleDateString(locale, { month: "long", day: "numeric" })}
                        </p>
                        <p className="text-[12px] text-[var(--color-ink-600)]">
                          {new Date(v.date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {v.totalAmount && (
                        <p className="text-[13px] font-bold text-[var(--color-navy-800)]">
                          {fmtKRW(v.totalAmount, lang)}
                        </p>
                      )}
                    </Card>
                  );
                })}
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
                {t("menu.empty", lang)}
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
                          {fmtKRW(m.price, lang)}
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
              className="fixed lg:absolute left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 z-30"
              style={{ bottom: "calc(64px + env(safe-area-inset-bottom) + 8px)" }}
            >
              <button
                onClick={submitOrder}
                disabled={!myTable}
                className="w-full h-14 rounded-[18px] bg-[var(--color-navy-700)] text-white font-bold shadow-[var(--shadow-navy)] flex items-center justify-between px-5 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  {myTable ? t("menu.orderToTable", lang, { n: myTable.number }) : t("menu.needTable", lang)}
                </span>
                <span>{fmtKRW(cartTotal, lang)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "coupons" && (
        <div className="px-5 pt-3 space-y-3">
          <h2 className="text-[15px] font-bold text-[var(--color-navy-900)] px-1">{t("coupons.title", lang)}</h2>
          {myCoupons.length === 0 ? (
            <Card padding="lg" className="text-center">
              <Ticket className="w-8 h-8 text-[var(--color-ink-300)] mx-auto mb-2" />
              <p className="text-[14px] text-[var(--color-ink-500)] font-medium">
                {t("coupons.empty", lang)}
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
              <Info label={t("profile.joinType", lang)} value={currentUser.authType ?? "phone"} />
              <Info label={t("profile.ageGroup", lang)} value={currentUser.ageGroup ?? "—"} />
            </div>
          </Card>

          {/* 언어 선택 — 설정의 언어 탭 (손님 측 진입 위치) */}
          <Card padding="md">
            <p className="text-[13px] font-bold text-[var(--color-navy-900)] mb-1">{t("profile.languageTitle", lang)}</p>
            <p className="text-[11.5px] text-[var(--color-ink-500)] font-medium mb-2.5">
              {t("profile.languageDesc", lang)}
            </p>
            <div className="flex gap-2 flex-wrap">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLanguage(l.code)}
                  className={cn(
                    "h-9 px-3.5 rounded-full border text-[12.5px] font-bold",
                    lang === l.code
                      ? "bg-[var(--color-navy-700)] text-white border-transparent"
                      : "bg-white text-[var(--color-ink-700)] border-[var(--color-line)]"
                  )}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </Card>

          <Button block variant="ghost" onClick={() => { logout(); nav("/", { replace: true }); }} leftIcon={<LogOut className="w-4 h-4" />}>
            {t("profile.logout", lang)}
          </Button>
          <Button
            block
            variant="outline"
            onClick={async () => {
              if (confirm(t("profile.deleteConfirm", lang))) {
                await deleteAccount();
                nav("/", { replace: true });
              }
            }}
            leftIcon={<Trash2 className="w-4 h-4" />}
            className="text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:border-[var(--color-danger)]"
          >
            {t("profile.deleteAccount", lang)}
          </Button>
        </div>
      )}

      {/* 계산서 모달 */}
      {billOpen && currentUser && (
        <BillModal
          storeName={owner?.restaurantName ?? t("common.store", lang)}
          tableNumber={myTable?.number}
          customerName={currentUser.name}
          orders={mySessionOrders}
          unpaidTotal={unpaidTotal}
          paidTotal={mySessionOrders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.totalAmount, 0)}
          canPay={!!myTable}
          onClose={() => setBillOpen(false)}
          onPay={() => {
            setBillOpen(false);
            handlePay();
          }}
          onPayCard={() => {
            if (!myTable || unpaidTotal <= 0) return;
            setBillOpen(false);
            const orderIds = mySessionOrders
              .filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled")
              .map((o) => o.id);
            startCardPayment({
              clientKey: owner?.storeConfig?.tossClientKey,
              storeId,
              tableNumber: myTable.number,
              customerId: currentUser.id,
              amount: unpaidTotal,
              orderName: owner?.restaurantName ?? t("common.store", lang),
              orderIds,
            }).catch(() => showToast(t("pay.failDesc", lang), "error"));
          }}
        />
      )}

      {/* 리뷰 입력 모달 — 결제 요청 전에 사진+별점+글 받기 (선택). 건너뛰기 가능. */}
      {reviewOpen && (
        <ReviewModal
          unpaidTotal={unpaidTotal}
          onCancel={() => setReviewOpen(false)}
          onSubmit={(review) => {
            submitPaymentWithReview(review);
          }}
        />
      )}
    </MobileShell>
  );
}

// ============================================================
// 매장 영업 상태 배너 — 영업 외 시간이면 빨간 카드, 영업 중이면 작은 칩
// ============================================================
function StoreStatusBanner({ owner }: { owner: any }) {
  const lang = useLanguage();
  const [status, setStatus] = useState(() => getStoreOpenStatus(owner));
  useEffect(() => {
    setStatus(getStoreOpenStatus(owner));
    const id = setInterval(() => setStatus(getStoreOpenStatus(owner)), 60_000);
    return () => clearInterval(id);
  }, [owner?.temporarilyClosed, owner?.businessHours]);

  if (status.open) {
    // 영업 중 — 작은 칩 (시각 차이로 안심 신호)
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-mint-50)] text-[var(--color-mint-700)] text-[11.5px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint-500)] animate-pulse" />
        {summarizeStatus(status)}
      </div>
    );
  }

  // 영업 외 — 큰 카드로 강조 (TypeScript narrowing 보장)
  const closed = status; // narrowing 확정: open === false
  return (
    <Card padding="md" className="border-2 border-[var(--color-danger)] bg-[#fef2f2]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-danger)] text-white inline-flex items-center justify-center font-extrabold text-[16px]">
          ⛔
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-[var(--color-danger)]">
            {t("store.closedTitle", lang)}
          </p>
          <p className="text-[12.5px] text-[var(--color-ink-700)] mt-0.5 font-semibold leading-relaxed">
            {closed.open === false ? closed.reason : ""}
            {closed.open === false && closed.from ? t("store.closedFrom", lang, { time: closed.from }) : ""}
          </p>
          <p className="text-[11px] text-[var(--color-ink-500)] mt-1 font-medium">
            {t("store.closedDesc", lang)}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// 지난 방문 영수증 — 같은 매장 재방문 시 과거 결제 완료된 주문을 명확히 분리
// ============================================================
type PastVisitGroup = {
  date: string;          // YYYY-MM-DD
  orders: Order[];
  total: number;
  itemsCount: number;
};
function PastVisitsCard({ visits, storeName }: { visits: PastVisitGroup[]; storeName: string }) {
  const lang = useLanguage();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const locale = getLocale(lang);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(today.getTime() - 86_400_000);
    const isToday = iso === today.toISOString().slice(0, 10);
    const isYest = iso === yest.toISOString().slice(0, 10);
    if (isToday) return t("past.today", lang);
    if (isYest) return t("past.yesterday", lang);
    return d.toLocaleDateString(locale, { month: "long", day: "numeric", weekday: "short" });
  };

  const top = visits.slice(0, 5); // 최근 5회만 카드에 노출
  const allTotal = visits.reduce((s, v) => s + v.total, 0);

  return (
    <Card padding="md" className="border-[var(--color-line)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--color-navy-50)] text-[var(--color-navy-700)] inline-flex items-center justify-center">
          <ReceiptIcon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-extrabold text-[var(--color-navy-900)]">
            {t("past.title", lang, { store: storeName })}
          </p>
          <p className="text-[11.5px] text-[var(--color-ink-500)] font-medium">
            {t("past.summary", lang, { n: visits.length, amount: fmtKRW(allTotal, lang) })}
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-line)]">
        {top.map((v) => {
          const open = expandedDate === v.date;
          return (
            <div key={v.date} className="py-2.5 first:pt-0 last:pb-0">
              <button
                onClick={() => setExpandedDate(open ? null : v.date)}
                className="w-full flex items-center gap-3 text-left active:opacity-70"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold text-[var(--color-navy-900)]">{formatDate(v.date)}</p>
                  <p className="text-[11.5px] text-[var(--color-ink-500)] font-medium">
                    {t("past.orderCount", lang, { orders: v.orders.length, items: v.itemsCount })}
                  </p>
                </div>
                <span className="text-[14px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                  {fmtKRW(v.total, lang)}
                </span>
                <span className={cn(
                  "text-[10px] font-bold text-[var(--color-ink-500)] transition-transform",
                  open && "rotate-90"
                )}>
                  ▸
                </span>
              </button>

              {open && (
                <div className="mt-2 pl-2 border-l-2 border-[var(--color-navy-200)] space-y-2">
                  {v.orders.map((o) => (
                    <div key={o.id} className="text-[12.5px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10.5px] font-bold text-[var(--color-ink-500)] uppercase">
                          {new Date(o.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--color-mint-700)]">{t("pay.paid", lang)}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {o.items.map((it, i) => (
                          <li key={i} className="flex justify-between text-[var(--color-navy-900)]">
                            <span className="truncate mr-2">{it.name} × {it.quantity}</span>
                            <span className="font-semibold tabular-nums text-[var(--color-ink-600)]">
                              {fmtKRW(it.price * it.quantity, lang)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-[var(--color-line)]">
                        <span className="text-[11px] font-bold text-[var(--color-ink-500)]">{t("past.subtotal", lang)}</span>
                        <span className="text-[12px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                          {fmtKRW(o.totalAmount, lang)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visits.length > top.length && (
        <p className="text-[11px] text-[var(--color-ink-500)] text-center mt-2 font-semibold">
          {t("past.more", lang, { n: visits.length - top.length })}
        </p>
      )}
    </Card>
  );
}

function CouponRow({
  coupon,
  tableNumber,
  onUse,
  onCancel,
}: {
  coupon: { id: string; type: string; description: string; descKey?: string; amount?: number; status: "available" | "pending" | "used"; usedAtTable?: number };
  tableNumber?: number;
  onUse: () => void;
  onCancel: () => void;
}) {
  const lang = useLanguage();
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
            <Hourglass className="w-3 h-3" /> {t("coupons.pending", lang)}
          </span>
        )}
        {coupon.status === "used" && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-500)] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> {t("coupons.used", lang)}
          </span>
        )}
      </div>
      <p className="text-[15px] font-bold text-[var(--color-navy-900)] mt-2">{coupon.descKey ? t(coupon.descKey, lang) : coupon.description}</p>
      {(coupon.amount ?? 0) > 0 && (
        <p className="text-[18px] font-extrabold text-[var(--color-mint-700)] mt-0.5 tabular-nums">
          {t("coupons.amountOff", lang, { amount: (coupon.amount as number).toLocaleString("ko-KR") })}
        </p>
      )}
      {coupon.status === "available" && (
        <Button
          size="md"
          variant="mint"
          className="mt-3"
          onClick={onUse}
          disabled={!tableNumber}
        >
          {tableNumber ? t("coupons.useAtTable", lang, { n: tableNumber }) : t("coupons.needTable", lang)}
        </Button>
      )}
      {coupon.status === "pending" && (
        <Button size="md" variant="outline" className="mt-3" onClick={onCancel} leftIcon={<XCircle className="w-4 h-4" />}>
          {t("coupons.cancelRequest", lang)}
        </Button>
      )}
    </Card>
  );
}

function SessionTimer({ start }: { start: string | null }) {
  const lang = useLanguage();
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
      {t("home.useTime", lang, { m, s: s.toString().padStart(2, "0") })}
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
  const lang = useLanguage();
  if (value === 0) {
    return (
      <button
        onClick={() => onChange(1)}
        className="w-9 h-9 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center shadow-[var(--shadow-navy)] active:scale-95"
        aria-label={t("menu.add", lang)}
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
        aria-label={t("menu.decrease", lang)}
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="text-[15px] font-extrabold text-[var(--color-navy-900)] w-6 text-center">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 rounded-full bg-[var(--color-navy-700)] text-white inline-flex items-center justify-center active:scale-95"
        aria-label={t("menu.increase", lang)}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function OrderProgress({ status, industry }: { status: "pending" | "accepted" | "cooking" | "served"; industry?: Industry }) {
  const lang = useLanguage();
  const steps = [
    { key: "pending", label: t("order.status.pending", lang), Icon: Hourglass, eta: 5 },
    { key: "accepted", label: t("order.status.accepted", lang), Icon: ClipboardCheck, eta: 5 },
    { key: "cooking", label: cookingNowLabel(industry, lang), Icon: ChefHat, eta: 10 }, // 8-9: 업종별
    { key: "served", label: t("order.status.served", lang), Icon: PartyPopper, eta: 0 },
  ] as const;
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === status));
  const current = steps[currentIdx];
  const CurrentIcon = current.Icon;
  const done = status === "served";
  // 남은 예상 시간 — 현재 단계 이후 단계들의 eta 합
  const remainEta = steps.slice(currentIdx).reduce((s, st) => s + st.eta, 0);

  return (
    <div className="mb-3">
      {/* 현재 단계 — 큰 히어로 카드 (배민 스타일) */}
      <div
        className={cn(
          "flex items-center gap-3 p-3.5 rounded-[16px] mb-3 border",
          done
            ? "bg-[var(--color-mint-50)] border-[var(--color-mint-200)]"
            : "bg-[var(--color-navy-50)] border-[var(--color-navy-200)]"
        )}
      >
        <div
          className={cn(
            "w-12 h-12 rounded-full inline-flex items-center justify-center shrink-0 text-white",
            done ? "bg-[var(--color-mint-500)]" : "bg-[var(--color-navy-700)]",
            !done && "animate-bounce"
          )}
          style={!done ? { animationDuration: "1.6s" } : undefined}
        >
          <CurrentIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[15px] font-extrabold",
              done ? "text-[var(--color-mint-700)]" : "text-[var(--color-navy-900)]"
            )}
          >
            {t(`order.flow.headline.${current.key}`, lang)}
          </p>
          <p className="text-[12px] font-semibold text-[var(--color-ink-500)] mt-0.5">
            {done
              ? t("order.flow.thanks", lang)
              : t("order.flow.eta", lang, { min: remainEta })}
          </p>
        </div>
      </div>

      {/* 4단계 아이콘 트랙 */}
      <div className="flex items-center px-1">
        {steps.map((s, i) => {
          const reached = i <= currentIdx;
          const active = i === currentIdx && !done;
          const StepIcon = s.Icon;
          return (
            <div key={s.key} className="flex-1 flex items-center first:flex-none">
              {i > 0 && (
                <div
                  className={cn(
                    "h-[3px] flex-1 rounded-full mx-1 transition-colors duration-500",
                    reached ? "bg-[var(--color-mint-500)]" : "bg-[var(--color-ink-100)]"
                  )}
                />
              )}
              <div
                className={cn(
                  "w-9 h-9 rounded-full inline-flex items-center justify-center transition-colors shrink-0",
                  reached
                    ? "bg-[var(--color-mint-500)] text-white shadow-[0_2px_6px_rgba(0,163,158,0.35)]"
                    : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]",
                  active && "ring-4 ring-[var(--color-mint-500)]/25 animate-pulse"
                )}
              >
                <StepIcon className="w-[18px] h-[18px]" />
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
  const lang = useLanguage();
  const map = {
    pending: { key: "order.status.pending", cls: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]" },
    accepted: { key: "order.status.accepted", cls: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]" },
    cooking: { key: "order.status.cooking", cls: "bg-[#fff1e0] text-[#b45309]" },
    served: { key: "order.status.served", cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]" },
    cancelled: { key: "order.status.cancelled", cls: "bg-[#fef2f2] text-[var(--color-danger)]" },
  } as const;
  const s = map[status];
  return <span className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${s.cls}`}>{t(s.key, lang)}</span>;
}

function ReviewModal({
  unpaidTotal,
  onCancel,
  onSubmit,
}: {
  unpaidTotal: number;
  onCancel: () => void;
  onSubmit: (review?: { rating?: number; reviewText?: string; imageData?: string }) => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const lang = useLanguage();

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("review.invalidImage", lang), "error");
      return;
    }
    setBusy(true);
    try {
      const data = await resizeImage(file);
      setImage(data);
    } catch {
      showToast(t("review.imageFail", lang), "error");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    onSubmit({
      rating: rating > 0 ? rating : undefined,
      reviewText: text.trim() || undefined,
      imageData: image || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] mx-auto bg-white rounded-t-[28px] sm:rounded-[28px] p-6 pb-[max(env(safe-area-inset-bottom),24px)] sm:pb-6 max-h-[88vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 rounded-full bg-[var(--color-ink-100)] mx-auto mb-5" />
        <h2 className="text-[18px] font-extrabold text-[var(--color-navy-900)] mb-1">
          {t("review.title", lang)}
        </h2>
        <p className="text-[12.5px] text-[var(--color-ink-500)] font-medium mb-5">
          {t("review.desc", lang)}
        </p>

        {/* 별점 */}
        <div className="mb-4">
          <p className="text-[12px] font-bold text-[var(--color-navy-800)] mb-2">{t("review.rating", lang)}</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? 0 : n)}
                className="w-11 h-11 inline-flex items-center justify-center"
                aria-label={t("review.ratingValue", lang, { n })}
              >
                <Star
                  className={cn(
                    "w-8 h-8 transition-colors",
                    n <= rating
                      ? "fill-[#f59e0b] text-[#f59e0b]"
                      : "text-[var(--color-ink-300)]"
                  )}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-[13px] font-bold text-[var(--color-navy-700)]">
                {t("review.ratingValue", lang, { n: rating })}
              </span>
            )}
          </div>
        </div>

        {/* 글 */}
        <div className="mb-4">
          <p className="text-[12px] font-bold text-[var(--color-navy-800)] mb-2">{t("review.text", lang)}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder={t("review.textPlaceholder", lang)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-[12px] border-[1.5px] border-[var(--color-line)] text-[14px] focus:border-[var(--color-navy-700)] focus:outline-none resize-none"
          />
          <p className="text-[10.5px] text-[var(--color-ink-400)] text-right mt-1">{text.length}/300</p>
        </div>

        {/* 사진 */}
        <div className="mb-5">
          <p className="text-[12px] font-bold text-[var(--color-navy-800)] mb-2">{t("review.photo", lang)}</p>
          <div className="flex items-center gap-3">
            {image ? (
              <div className="relative">
                <img src={image} alt="" className="w-20 h-20 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => setImage("")}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-[var(--color-ink-200)] inline-flex items-center justify-center shadow-sm"
                  aria-label={t("review.removePhoto", lang)}
                >
                  <XIcon className="w-3.5 h-3.5 text-[var(--color-ink-700)]" />
                </button>
              </div>
            ) : (
              <label className="w-20 h-20 rounded-xl bg-[var(--color-ink-50)] inline-flex items-center justify-center text-[var(--color-ink-400)] cursor-pointer">
                <Camera className="w-6 h-6" />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPickImage}
                />
              </label>
            )}
            <p className="text-[12px] text-[var(--color-ink-500)] font-medium flex-1">
              {busy
                ? t("review.photoBusy", lang)
                : image
                ? t("review.photoPicked", lang)
                : t("review.photoOne", lang)}
            </p>
          </div>
        </div>

        {/* 결제 요청 금액 + 세금 breakdown */}
        {(() => {
          const vat = Math.round((unpaidTotal * 0.1) / 1.1);
          const supply = unpaidTotal - vat;
          return (
            <div className="rounded-[12px] bg-[var(--color-bg)] px-3 py-3 mb-4 space-y-1">
              <div className="flex items-center justify-between text-[11.5px] text-[var(--color-ink-500)]">
                <span>{t("bill.supply", lang)}</span>
                <span className="tabular-nums">{fmtKRW(supply)}</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-[var(--color-ink-500)]">
                <span>{t("bill.vat", lang)}</span>
                <span className="tabular-nums">{fmtKRW(vat)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-[var(--color-line)]">
                <span className="text-[12.5px] font-bold text-[var(--color-ink-700)]">{t("review.payAmount", lang)}</span>
                <span className="text-[16px] font-extrabold text-[var(--color-navy-900)] tabular-nums">
                  {fmtKRW(unpaidTotal)}
                </span>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="md" onClick={() => onSubmit(undefined)}>
            {t("review.skip", lang)}
          </Button>
          <Button size="md" onClick={submit} disabled={busy}>
            {t("review.submit", lang)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab, couponBadge = 0 }: { tab: Tab; setTab: (t: Tab) => void; couponBadge?: number }) {
  const lang = useLanguage();
  const items: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t("nav.home", lang), icon: <HomeIcon className="w-5 h-5" /> },
    { id: "menu", label: t("nav.menu", lang), icon: <UtensilsCrossed className="w-5 h-5" /> },
    { id: "coupons", label: t("nav.coupons", lang), icon: <Ticket className="w-5 h-5" /> },
    { id: "profile", label: t("nav.profile", lang), icon: <UserIcon className="w-5 h-5" /> },
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
          <span className="relative">
            {it.icon}
            {it.id === "coupons" && couponBadge > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-danger)] text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                {couponBadge > 9 ? "9+" : couponBadge}
              </span>
            )}
          </span>
          <span className="text-[12px] font-bold tracking-tight">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
