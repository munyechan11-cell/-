import { useMemo } from "react";
import { ChefHat, Check, XCircle, Ticket, Sparkles } from "lucide-react";
import { OwnerShell } from "../../components/layout/OwnerShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useStore } from "../../store/store";
import type { Order, OrderStatus } from "../../lib/types";
import { TIER_BADGE } from "../../lib/tier";
import { cn } from "../../lib/cn";

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
  cooking: "bg-[#fff1e0] text-[#b45309]",
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

export default function OwnerOrders() {
  const { currentUser, orders, coupons, users, approveCouponUse, rejectCouponUse, updateOrderStatus } = useStore();
  const storeId = currentUser?.id ?? "";

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

  return (
    <OwnerShell title="주문·쿠폰 처리">
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
                      <Button size="md" variant="outline" onClick={() => rejectCouponUse(c.id)} leftIcon={<XCircle className="w-4 h-4" />}>
                        반려
                      </Button>
                      <Button size="md" variant="mint" onClick={() => approveCouponUse(c.id)} leftIcon={<Check className="w-4 h-4" />}>
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
}: {
  order: Order;
  customerName?: string;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const nxt = NEXT_STATUS[order.status];
  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STATUS_COLORS[order.status])}>
          {STATUS_LABELS[order.status]}
        </span>
        <span className="text-[12px] text-[var(--color-ink-500)] font-semibold">
          테이블 {order.tableNumber} · {customerName ?? "—"}
        </span>
        <span className="ml-auto text-[11px] text-[var(--color-ink-500)]">
          {new Date(order.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <ul className="text-[14px] font-semibold text-[var(--color-navy-900)] space-y-0.5">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span>
              {it.name} <span className="text-[var(--color-ink-500)] font-medium">×{it.quantity}</span>
            </span>
            <span>₩ {(it.price * it.quantity).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-line)] mt-2.5 pt-2.5 flex justify-between text-[14px] font-bold">
        <span className="text-[var(--color-ink-500)]">합계</span>
        <span className="text-[var(--color-navy-900)]">₩ {order.totalAmount.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Button size="md" variant="outline" onClick={onCancel} className="text-[var(--color-danger)] border-[var(--color-danger)]/30">
          취소
        </Button>
        {nxt && (
          <Button size="md" className="col-span-2" onClick={onAdvance}>
            {STATUS_LABELS[nxt]}(으)로
          </Button>
        )}
      </div>
    </Card>
  );
}
