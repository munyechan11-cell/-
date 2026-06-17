import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  Check,
  CheckCheck,
  XCircle,
  Ticket,
  Sparkles,
  Printer,
  Bell,
  BellOff,
  Volume2,
  Hourglass,
  Flame,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import type { Order, OrderStatus } from "../../lib/types";
import { TIER_BADGE } from "../../lib/tier";
import { cn } from "../../lib/cn";
import {
  notifyNewOrder,
  requestNotificationPermission,
  playChime,
} from "../../lib/notify";
import { printReceipt } from "../../lib/receipt";
import { printReceiptViaUsb, getAuthorizedPrinters } from "../../lib/thermalPrinter";
import { showToast } from "../../lib/toast";
import { useLanguage, t, fmtKRW, getLocale } from "../../lib/i18n";

const STATUS_KEYS: Record<OrderStatus, string> = {
  pending: "oorders.status.pending",
  accepted: "oorders.status.accepted",
  cooking: "oorders.status.cooking",
  served: "oorders.status.served",
  cancelled: "oorders.status.cancelled",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]",
  accepted: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  cooking: "bg-[#fff1e0] text-[var(--color-warn)]",
  served: "bg-[var(--color-ink-50)] text-[var(--color-ink-600)]",
  cancelled: "bg-[#fef2f2] text-[var(--color-danger)]",
};
const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Hourglass className="w-3 h-3" />,
  accepted: <Check className="w-3 h-3" />,
  cooking: <Flame className="w-3 h-3" />,
  served: <CheckCheck className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};
/**
 * 다음 단계 전이 + 사장님 버튼 라벨 단일 진실원.
 *
 * 정책(2026-06): 사장님 클릭 횟수 단축
 *  - pending 신규접수  → '접수 완료'  → cooking (accepted 건너뛰고 한 번에 조리중)
 *  - accepted 접수완료 → '조리 시작'  → cooking (외부에서 accepted 들어온 경우 호환)
 *  - cooking 조리중    → '서빙 완료'  → served
 *  - served / cancelled → 종결
 *
 *  → 사장님은 신규 주문에서 끝까지 2번만 클릭하면 됨 (접수완료 → 서빙완료)
 */
const ADVANCE_BUTTON: Record<OrderStatus, { labelKey: string; to: OrderStatus } | null> = {
  pending:   { labelKey: "oadvance.pending", to: "cooking" },
  accepted:  { labelKey: "oadvance.accepted", to: "cooking" },
  cooking:   { labelKey: "oadvance.cooking", to: "served" },
  served:    null,
  cancelled: null,
};
// 하위 호환 — 일부 코드가 NEXT_STATUS 참조하면 같은 매핑으로
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "cooking",
  accepted: "cooking",
  cooking: "served",
  served: null,
  cancelled: null,
};

const LS_SOUND = "gyeol:order-sound";

export default function OwnerOrders() {
  const {
    currentUser,
    effectiveStoreId,
    orders,
    coupons,
    users,
    approveCouponUse,
    rejectCouponUse,
    updateOrderStatus,
    approvePayment,
    completeTable,
  } = useStore();
  const storeId = effectiveStoreId;
  const lang = useLanguage();

  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(LS_SOUND) !== "0");
  const knownIdsRef = useRef<Set<string> | null>(null);
  // 주문 상태 전이 중복 클릭 가드 — 연타 시 한 주문이 두 단계 건너뛰던 사고 차단
  const advancingRef = useRef<Set<string>>(new Set());

  const activeOrders = useMemo(
    () =>
      orders
        .filter((o) => o.storeId === storeId && o.status !== "served" && o.status !== "cancelled")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders, storeId]
  );
  const pendingCoupons = useMemo(
    () => coupons.filter((c) => c.storeId === storeId && c.status === "pending"),
    [coupons, storeId]
  );

  // 테이블별 미결제 합계 (서빙 완료 포함, 결제만 안 된 것)
  // requested 도 포함되어 미결제로 잡힘. 따로 표시 위해 hasRequest 플래그 추가.
  const unpaidByTable = useMemo(() => {
    const map = new Map<number, { total: number; count: number; hasRequest: boolean }>();
    orders
      .filter(
        (o) =>
          o.storeId === storeId &&
          o.status !== "cancelled" &&
          o.paymentStatus !== "paid"
      )
      .forEach((o) => {
        const cur = map.get(o.tableNumber) ?? { total: 0, count: 0, hasRequest: false };
        cur.total += o.totalAmount;
        cur.count += 1;
        if (o.paymentStatus === "requested") cur.hasRequest = true;
        map.set(o.tableNumber, cur);
      });
    return Array.from(map.entries())
      .map(([table, v]) => ({ table, ...v }))
      .sort((a, b) => Number(b.hasRequest) - Number(a.hasRequest) || a.table - b.table);
  }, [orders, storeId]);

  // 결제 요청 들어온 테이블 — 사장님이 바로 보고 승인할 수 있게 별도 카드
  const paymentRequests = useMemo(
    () => unpaidByTable.filter((u) => u.hasRequest),
    [unpaidByTable]
  );

  // 새 주문 도착 알림
  // 매장 전환 시 다른 매장의 기존 주문들이 한꺼번에 "신규" 로 잡혀 사운드가
  // 폭주하던 버그 방지: storeId 가 바뀌면 기준선만 리셋하고 알림은 보내지 않음.
  const lastStoreIdRef = useRef<string | null>(null);
  useEffect(() => {
    const allMine = orders.filter((o) => o.storeId === storeId);
    const currentIds = new Set(allMine.map((o) => o.id));

    if (knownIdsRef.current === null || lastStoreIdRef.current !== storeId) {
      // 첫 마운트 또는 매장 전환: 기준선만 저장하고 알림은 안 울림
      knownIdsRef.current = currentIds;
      lastStoreIdRef.current = storeId;
      return;
    }

    const previous = knownIdsRef.current;
    const newOrders = allMine.filter((o) => !previous.has(o.id) && o.status === "pending");

    if (newOrders.length > 0 && soundOn) {
      const summary = newOrders
        .slice(0, 3)
        .map((o) => t("oorders.newSummary", lang, { table: o.tableNumber, count: o.items.length }))
        .join(", ");
      notifyNewOrder(summary);
    }

    knownIdsRef.current = currentIds;
  }, [orders, storeId, soundOn, lang]);

  const toggleSound = async () => {
    const next = !soundOn;
    if (next) {
      // 권한 먼저 확인 — 거부되면 ON 으로 토글하지 않고 안내만.
      // 기존엔 권한 거부 상태에서도 토글이 ON 으로 보여 사장님이 "켰는데
      // 알림 안 와요" 라고 오해하던 사고.
      const perm = await requestNotificationPermission();
      if (perm !== "granted") {
        showToast(t("oorders.alertBlocked", lang), "info");
        return; // 토글 유지
      }
      playChime();
    }
    setSoundOn(next);
    localStorage.setItem(LS_SOUND, next ? "1" : "0");
  };

  const reprintReceipt = async (order: Order) => {
    const payload = {
      storeName: (users.find((u) => u.id === storeId)?.restaurantName) ?? currentUser?.restaurantName ?? "결",
      order,
      footer: t("oorders.reprintFooter", lang),
    };
    try {
      const printers = await getAuthorizedPrinters();
      if (printers.length > 0) {
        await printReceiptViaUsb(payload);
        showToast(t("oorders.reprintDone", lang), "success");
        return;
      }
    } catch (e: any) {
      // USB 실패 — 원인을 구체적으로 안내 (장치 미연결/권한/통신)
      const msg = String(e?.message ?? "");
      const reason = msg.includes("permission") || msg.includes("권한")
        ? t("oorders.printErrPerm", lang)
        : msg.includes("disconnect") || msg.includes("연결")
        ? t("oorders.printErrDisc", lang)
        : t("oorders.printErrUsb", lang);
      showToast(t("oorders.printErrFallback", lang, { reason }), "info");
    }
    // 팝업 인쇄 — 팝업 차단 시 사용자에게 안내
    try {
      printReceipt(payload);
    } catch (e: any) {
      showToast(t("oorders.popupBlocked", lang), "error");
    }
  };

  return (
    <OwnerShell
      title={t("oorders.title", lang)}
      headerRight={
        <button
          onClick={toggleSound}
          className={cn(
            "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-bold transition-colors",
            soundOn
              ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]"
              : "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]"
          )}
          aria-label={t("oorders.newOrderAria", lang)}
        >
          {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          <span className="hidden sm:inline">{soundOn ? t("oorders.alertOn", lang) : t("oorders.alertOff", lang)}</span>
        </button>
      }
    >
      {/* 결제 요청 — 손님이 결제하기 누른 테이블, 가장 위에 강조 */}
      {paymentRequests.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[14px] font-bold text-[var(--color-warn)] px-1 mb-2 flex items-center gap-1.5">
            <ReceiptIcon className="w-4 h-4" />
            {t("oorders.paymentRequest.title", lang, { n: paymentRequests.length })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {paymentRequests.map((u) => (
              <Card key={`req-${u.table}`} padding="md" className="border-2 border-[var(--color-warn)] bg-[#fff8e6]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11.5px] font-extrabold text-[var(--color-warn)] uppercase tracking-wide">
                    {t("oorders.paymentRequest.chip", lang)}
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-700)] font-semibold">{t("oorders.paymentRequest.count", lang, { n: u.count })}</span>
                </div>
                <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">{t("oorders.tableLabel", lang, { n: u.table })}</p>
                <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] tabular-nums mt-1 mb-2">
                  {fmtKRW(u.total, lang)}
                </p>
                <button
                  onClick={async () => {
                    if (!confirm(t("oorders.paymentRequest.confirm", lang, { table: u.table, amount: fmtKRW(u.total, lang) }))) return;
                    try { await approvePayment(storeId, u.table); } catch (e: any) { console.warn(e); }
                  }}
                  className="w-full h-10 rounded-[10px] bg-[var(--color-warn)] text-white font-bold text-[13px]"
                >
                  {t("oorders.paymentRequest.btn", lang)}
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 미결제 테이블 요약 */}
      {unpaidByTable.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] px-1 mb-2 flex items-center gap-1.5">
            <ReceiptIcon className="w-4 h-4" />
            {t("oorders.unpaid.title", lang, { n: unpaidByTable.length })}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {unpaidByTable.map((u) => (
              <Card key={u.table} padding="md" className="border-[#ffd9a8]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold text-[var(--color-warn)] uppercase tracking-wide">{t("oorders.unpaid.label", lang)}</span>
                  <span className="text-[11px] text-[var(--color-ink-600)] font-semibold">{t("oorders.paymentRequest.count", lang, { n: u.count })}</span>
                </div>
                <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">{t("oorders.tableLabel", lang, { n: u.table })}</p>
                <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] tabular-nums mt-1">
                  {fmtKRW(u.total, lang)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
        {/* Coupon approvals */}
        {pendingCoupons.length > 0 && (
          <section>
            <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] px-1 mb-2 flex items-center gap-1.5">
              <Ticket className="w-4 h-4" />
              {t("oorders.pendingCoupons.title", lang, { n: pendingCoupons.length })}
            </h2>
            <div className="space-y-2">
              {pendingCoupons.map((c) => {
                const customer = users.find((u) => u.id === c.customerId);
                const badge =
                  TIER_BADGE[c.type as keyof typeof TIER_BADGE] ?? {
                    label: c.type,
                    bg: "bg-[var(--color-navy-50)]",
                    text: "text-[var(--color-navy-700)]",
                  };
                return (
                  <Card key={c.id} padding="md">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-[13px] text-[var(--color-ink-600)] font-semibold">
                        {customer?.name ?? "—"}
                        {c.usedAtTable ? ` · ${t("oorders.tableLabel", lang, { n: c.usedAtTable })}` : ""}
                      </span>
                    </div>
                    <p className="text-[14px] font-bold text-[var(--color-navy-900)] mb-1">{c.description}</p>
                    {(c.amount ?? 0) > 0 && (
                      <p className="text-[15px] font-extrabold text-[var(--color-mint-700)] mb-3 tabular-nums">
                        {t("coupons.amountOff", lang, { amount: (c.amount as number).toLocaleString(getLocale(lang)) })} · {t("oorders.pendingCoupons.autoApply", lang)}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="md"
                        variant="outline"
                        onClick={() => rejectCouponUse(c.id)}
                        leftIcon={<XCircle className="w-4 h-4" />}
                      >
                        {t("oorders.pendingCoupons.reject", lang)}
                      </Button>
                      <Button
                        size="md"
                        variant="mint"
                        onClick={() => approveCouponUse(c.id)}
                        leftIcon={<Check className="w-4 h-4" />}
                      >
                        {t("oorders.pendingCoupons.approve", lang)}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Active orders */}
        <section>
          <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] px-1 mb-2 flex items-center gap-1.5">
            <ChefHat className="w-4 h-4" />
            {t("oorders.active.title", lang, { n: activeOrders.length })}
          </h2>
          {activeOrders.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-mint-100)] mx-auto mb-2 inline-flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-[var(--color-mint-700)]" />
              </div>
              <p className="text-[14px] text-[var(--color-navy-900)] font-bold">
                {t("oorders.active.empty", lang)}
              </p>
              {soundOn ? (
                <p className="mt-2 text-[12px] text-[var(--color-mint-700)] inline-flex items-center gap-1 font-semibold">
                  <Volume2 className="w-3 h-3" /> {t("oorders.active.alertOn", lang)}
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--color-ink-600)] inline-flex items-center gap-1">
                  <BellOff className="w-3 h-3" /> {t("oorders.active.alertOff", lang)}
                </p>
              )}
            </Card>
          ) : (
            <div className="space-y-2">
              {activeOrders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  customerName={users.find((u) => u.id === o.customerId)?.name}
                  onAdvance={() => {
                    // 빠른 연타 차단 — 800ms 내 같은 주문 재호출 무시
                    if (advancingRef.current.has(o.id)) return;
                    const next = ADVANCE_BUTTON[o.status];
                    if (!next) return;
                    advancingRef.current.add(o.id);
                    updateOrderStatus(o.id, next.to);
                    setTimeout(() => advancingRef.current.delete(o.id), 800);
                  }}
                  onCancel={() => {
                    if (confirm(t("oorders.cancelConfirm", lang, { n: o.tableNumber }))) {
                      updateOrderStatus(o.id, "cancelled");
                    }
                  }}
                  onReprint={() => reprintReceipt(o)}
                />
              ))}
            </div>
          )}
        </section>

        {pendingCoupons.length === 0 && activeOrders.length === 0 && (
          <div className="text-center pt-8 pb-4 lg:col-span-2">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-mint-100)] mx-auto inline-flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-[var(--color-mint-700)]" />
            </div>
            <p className="body-md font-semibold">{t("oorders.allDone", lang)}</p>
          </div>
        )}
      </div>
    </OwnerShell>
  );
}

function OrderCard({
  order,
  customerName,
  onAdvance,
  onCancel,
  onReprint,
}: {
  order: Order;
  customerName?: string;
  onAdvance: () => void;
  onCancel: () => void;
  onReprint: () => void;
}) {
  const lang = useLanguage();
  const advance = ADVANCE_BUTTON[order.status];
  const isNew = order.status === "pending";
  const locale = getLocale(lang);
  return (
    <Card
      padding="md"
      className={cn(
        isNew && "ring-2 ring-[var(--color-navy-700)] shadow-[var(--shadow-lifted)] animate-[gyeol-pop_.25s_ease-out]"
      )}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold", STATUS_COLORS[order.status])}>
          {STATUS_ICONS[order.status]}
          {t(STATUS_KEYS[order.status], lang)}
        </span>
        {order.paymentStatus === "paid" ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-mint-100)] text-[var(--color-mint-700)]">
            {t("oorders.payStatus.paid", lang)}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#fff1e0] text-[var(--color-warn)]">
            {t("oorders.payStatus.unpaid", lang)}
          </span>
        )}
        <span className="text-[14px] text-[var(--color-navy-900)] font-bold">
          {t("oorders.tableLabel", lang, { n: order.tableNumber })}
        </span>
        <span className="text-[12px] text-[var(--color-ink-600)] font-semibold truncate">
          · {customerName ?? "—"}
        </span>
        <span className="ml-auto text-[12px] text-[var(--color-ink-600)] tabular-nums">
          {new Date(order.createdAt).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <ul className="text-[14px] font-semibold text-[var(--color-navy-900)] space-y-0.5">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span className="break-keep min-w-0">
              {it.name} <span className="text-[var(--color-ink-600)] font-medium">×{it.quantity}</span>
              {it.selectedOptions?.length ? (
                <span className="block text-[12px] font-normal text-[var(--color-ink-500)]">
                  {it.selectedOptions.map((o) => o.optionName).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums shrink-0">{fmtKRW(it.price * it.quantity, lang)}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-line)] mt-2.5 pt-2.5 flex justify-between text-[14px] font-bold">
        <span className="text-[var(--color-ink-600)]">{t("oorders.sum", lang)}</span>
        <span className="text-[var(--color-navy-900)] tabular-nums">{fmtKRW(order.totalAmount, lang)}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <Button size="md" variant="outline" onClick={onCancel} className="text-[var(--color-danger)] border-[var(--color-danger)]/30">
          {t("oorders.cancel", lang)}
        </Button>
        <Button
          size="md"
          variant="ghost"
          onClick={onReprint}
          leftIcon={<Printer className="w-4 h-4" />}
          title={t("oorders.reprintTooltip", lang)}
        >
          {t("oorders.reprint", lang)}
        </Button>
        {advance ? (
          <Button size="md" className="col-span-2" onClick={onAdvance}>
            {t(advance.labelKey, lang)}
          </Button>
        ) : (
          <div className="hidden md:block col-span-2" />
        )}
      </div>
    </Card>
  );
}
