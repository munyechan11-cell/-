import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  Check,
  XCircle,
  Ticket,
  Sparkles,
  Printer,
  Bell,
  BellOff,
  Volume2,
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
import { showToast } from "../../lib/toast";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "신규 접수",
  accepted: "접수 완료",
  cooking: "조리 중",
  served: "서빙 완료",
  cancelled: "취소됨",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]",
  accepted: "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]",
  cooking: "bg-[#fff1e0] text-[var(--color-warn)]",
  served: "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]",
  cancelled: "bg-[#fef2f2] text-[var(--color-danger)]",
};
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "accepted",
  accepted: "cooking",
  cooking: "served",
  served: null,
  cancelled: null,
};

const LS_SOUND = "gyeol:order-sound";

export default function OwnerOrders() {
  const {
    currentUser,
    orders,
    coupons,
    users,
    approveCouponUse,
    rejectCouponUse,
    updateOrderStatus,
  } = useStore();
  const storeId = currentUser?.id ?? "";

  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(LS_SOUND) !== "0");
  const knownIdsRef = useRef<Set<string> | null>(null);

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
  const unpaidByTable = useMemo(() => {
    const map = new Map<number, { total: number; count: number }>();
    orders
      .filter(
        (o) =>
          o.storeId === storeId &&
          o.status !== "cancelled" &&
          o.paymentStatus !== "paid"
      )
      .forEach((o) => {
        const cur = map.get(o.tableNumber) ?? { total: 0, count: 0 };
        cur.total += o.totalAmount;
        cur.count += 1;
        map.set(o.tableNumber, cur);
      });
    return Array.from(map.entries())
      .map(([table, v]) => ({ table, ...v }))
      .sort((a, b) => a.table - b.table);
  }, [orders, storeId]);

  // 새 주문 도착 알림
  useEffect(() => {
    const allMine = orders.filter((o) => o.storeId === storeId);
    const currentIds = new Set(allMine.map((o) => o.id));

    if (knownIdsRef.current === null) {
      // 첫 마운트: 기준선만 저장하고 알림은 안 울림
      knownIdsRef.current = currentIds;
      return;
    }

    const previous = knownIdsRef.current;
    const newOrders = allMine.filter((o) => !previous.has(o.id) && o.status === "pending");

    if (newOrders.length > 0 && soundOn) {
      const summary = newOrders
        .slice(0, 3)
        .map((o) => `테이블 ${o.tableNumber} · ${o.items.length}개`)
        .join(", ");
      notifyNewOrder(summary);
    }

    knownIdsRef.current = currentIds;
  }, [orders, storeId, soundOn]);

  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(LS_SOUND, next ? "1" : "0");
    if (next) {
      const perm = await requestNotificationPermission();
      if (perm !== "granted") {
        showToast("브라우저 알림은 차단되어 있어요. 사이트 권한에서 허용해 주세요.", "info");
      }
      playChime();
    }
  };

  const reprintReceipt = (order: Order) => {
    printReceipt({
      storeName: currentUser?.restaurantName ?? "결",
      order,
      footer: "재인쇄 — Reprinted",
    });
  };

  return (
    <OwnerShell
      title="주문·쿠폰 처리"
      headerRight={
        <button
          onClick={toggleSound}
          className={cn(
            "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-bold transition-colors",
            soundOn
              ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]"
              : "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]"
          )}
          aria-label="새 주문 알림"
        >
          {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          <span className="hidden sm:inline">{soundOn ? "알림 켜짐" : "알림 꺼짐"}</span>
        </button>
      }
    >
      {/* 미결제 테이블 요약 */}
      {unpaidByTable.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[14px] font-bold text-[var(--color-navy-900)] px-1 mb-2 flex items-center gap-1.5">
            <ReceiptIcon className="w-4 h-4" />
            미결제 테이블 ({unpaidByTable.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {unpaidByTable.map((u) => (
              <Card key={u.table} padding="md" className="border-[#ffd9a8]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-[var(--color-warn)] uppercase tracking-wide">미결제</span>
                  <span className="text-[10px] text-[var(--color-ink-500)] font-semibold">{u.count}건</span>
                </div>
                <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">테이블 {u.table}</p>
                <p className="text-[16px] font-extrabold text-[var(--color-navy-900)] tabular-nums mt-1">
                  ₩ {u.total.toLocaleString()}
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
              쿠폰 사용 요청 ({pendingCoupons.length})
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-[12px] text-[var(--color-ink-500)] font-semibold">
                        {customer?.name ?? "—"}
                        {c.usedAtTable ? ` · 테이블 ${c.usedAtTable}` : ""}
                      </span>
                    </div>
                    <p className="text-[14px] font-bold text-[var(--color-navy-900)] mb-3">{c.description}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="md"
                        variant="outline"
                        onClick={() => rejectCouponUse(c.id)}
                        leftIcon={<XCircle className="w-4 h-4" />}
                      >
                        반려
                      </Button>
                      <Button
                        size="md"
                        variant="mint"
                        onClick={() => approveCouponUse(c.id)}
                        leftIcon={<Check className="w-4 h-4" />}
                      >
                        승인
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
            진행 주문 ({activeOrders.length})
          </h2>
          {activeOrders.length === 0 ? (
            <Card padding="lg" className="text-center text-[14px] text-[var(--color-ink-500)]">
              현재 진행 중인 주문이 없습니다.
              {soundOn && (
                <p className="mt-2 text-[12px] text-[var(--color-mint-700)] inline-flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> 새 주문이 들어오면 알려드릴게요
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
                    const nxt = NEXT_STATUS[o.status];
                    if (nxt) updateOrderStatus(o.id, nxt);
                  }}
                  onCancel={() => updateOrderStatus(o.id, "cancelled")}
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
            <p className="body-md font-semibold">모든 처리가 완료되었습니다.</p>
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
  const nxt = NEXT_STATUS[order.status];
  const isNew = order.status === "pending";
  return (
    <Card
      padding="md"
      className={cn(
        isNew && "ring-2 ring-[var(--color-navy-700)] shadow-[var(--shadow-lifted)] animate-[gyeol-pop_.25s_ease-out]"
      )}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STATUS_COLORS[order.status])}>
          {STATUS_LABELS[order.status]}
        </span>
        {order.paymentStatus === "paid" ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-mint-100)] text-[var(--color-mint-700)]">
            결제 완료
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff1e0] text-[var(--color-warn)]">
            미결제
          </span>
        )}
        <span className="text-[13px] text-[var(--color-navy-900)] font-bold">
          테이블 {order.tableNumber}
        </span>
        <span className="text-[11px] text-[var(--color-ink-500)] font-semibold truncate">
          · {customerName ?? "—"}
        </span>
        <span className="ml-auto text-[11px] text-[var(--color-ink-500)] tabular-nums">
          {new Date(order.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <ul className="text-[14px] font-semibold text-[var(--color-navy-900)] space-y-0.5">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {it.name} <span className="text-[var(--color-ink-500)] font-medium">×{it.quantity}</span>
            </span>
            <span className="tabular-nums">₩ {(it.price * it.quantity).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-line)] mt-2.5 pt-2.5 flex justify-between text-[14px] font-bold">
        <span className="text-[var(--color-ink-500)]">합계</span>
        <span className="text-[var(--color-navy-900)] tabular-nums">₩ {order.totalAmount.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3">
        <Button size="md" variant="outline" onClick={onCancel} className="text-[var(--color-danger)] border-[var(--color-danger)]/30">
          취소
        </Button>
        <Button
          size="md"
          variant="ghost"
          onClick={onReprint}
          leftIcon={<Printer className="w-4 h-4" />}
          title="영수증 재인쇄"
        >
          재인쇄
        </Button>
        {nxt ? (
          <Button size="md" className="col-span-2" onClick={onAdvance}>
            {STATUS_LABELS[nxt]}
          </Button>
        ) : (
          <div className="col-span-2" />
        )}
      </div>
    </Card>
  );
}
