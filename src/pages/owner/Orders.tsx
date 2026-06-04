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
const ADVANCE_BUTTON: Record<OrderStatus, { label: string; to: OrderStatus } | null> = {
  pending:   { label: "접수 완료", to: "cooking" },
  accepted:  { label: "조리 시작", to: "cooking" },
  cooking:   { label: "서빙 완료", to: "served" },
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

  const reprintReceipt = async (order: Order) => {
    const payload = {
      storeName: (users.find((u) => u.id === storeId)?.restaurantName) ?? currentUser?.restaurantName ?? "결",
      order,
      footer: "재인쇄 — Reprinted",
    };
    try {
      const printers = await getAuthorizedPrinters();
      if (printers.length > 0) {
        await printReceiptViaUsb(payload);
        showToast("영수증을 재인쇄했습니다.", "success");
        return;
      }
    } catch (e: any) {
      // USB 실패 — 원인을 구체적으로 안내 (장치 미연결/권한/통신)
      const msg = String(e?.message ?? "");
      const reason = msg.includes("permission") || msg.includes("권한")
        ? "프린터 권한이 거부됐어요"
        : msg.includes("disconnect") || msg.includes("연결")
        ? "프린터 연결이 끊어졌어요"
        : "USB 인쇄에 실패했어요";
      showToast(`${reason}. 팝업 인쇄로 전환합니다.`, "info");
    }
    // 팝업 인쇄 — 팝업 차단 시 사용자에게 안내
    try {
      printReceipt(payload);
    } catch (e: any) {
      showToast("팝업이 차단되어 인쇄할 수 없어요. 브라우저 팝업 차단을 해제해 주세요.", "error");
    }
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
      {/* 결제 요청 — 손님이 결제하기 누른 테이블, 가장 위에 강조 */}
      {paymentRequests.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[14px] font-bold text-[var(--color-warn)] px-1 mb-2 flex items-center gap-1.5">
            <ReceiptIcon className="w-4 h-4" />
            결제 요청 ({paymentRequests.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {paymentRequests.map((u) => (
              <Card key={`req-${u.table}`} padding="md" className="border-2 border-[var(--color-warn)] bg-[#fff8e6]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11.5px] font-extrabold text-[var(--color-warn)] uppercase tracking-wide">
                    💰 결제 요청
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-700)] font-semibold">{u.count}건</span>
                </div>
                <p className="text-[15px] font-extrabold text-[var(--color-navy-900)]">테이블 {u.table}</p>
                <p className="text-[18px] font-extrabold text-[var(--color-navy-900)] tabular-nums mt-1 mb-2">
                  ₩ {u.total.toLocaleString()}
                </p>
                <button
                  onClick={async () => {
                    if (!confirm(`테이블 ${u.table}번 ₩ ${u.total.toLocaleString()} 결제 승인 + 영수증 출력?`)) return;
                    try { await approvePayment(storeId, u.table); } catch (e: any) { console.warn(e); }
                  }}
                  className="w-full h-10 rounded-[10px] bg-[var(--color-warn)] text-white font-bold text-[13px]"
                >
                  결제 승인 + 영수증 출력
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
            미결제 테이블 ({unpaidByTable.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {unpaidByTable.map((u) => (
              <Card key={u.table} padding="md" className="border-[#ffd9a8]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold text-[var(--color-warn)] uppercase tracking-wide">미결제</span>
                  <span className="text-[11px] text-[var(--color-ink-600)] font-semibold">{u.count}건</span>
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
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="text-[13px] text-[var(--color-ink-600)] font-semibold">
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
            <Card padding="lg" className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-mint-100)] mx-auto mb-2 inline-flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-[var(--color-mint-700)]" />
              </div>
              <p className="text-[14px] text-[var(--color-navy-900)] font-bold">
                현재 진행 중인 주문이 없습니다.
              </p>
              {soundOn ? (
                <p className="mt-2 text-[12px] text-[var(--color-mint-700)] inline-flex items-center gap-1 font-semibold">
                  <Volume2 className="w-3 h-3" /> 새 주문이 들어오면 알려드릴게요
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--color-ink-600)] inline-flex items-center gap-1">
                  <BellOff className="w-3 h-3" /> 알림이 꺼져 있어요
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
                    if (confirm(`테이블 ${o.tableNumber}번 주문을 취소하시겠습니까?\n취소된 주문은 되돌릴 수 없습니다.`)) {
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
  const advance = ADVANCE_BUTTON[order.status];
  const isNew = order.status === "pending";
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
          {STATUS_LABELS[order.status]}
        </span>
        {order.paymentStatus === "paid" ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-mint-100)] text-[var(--color-mint-700)]">
            결제 완료
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#fff1e0] text-[var(--color-warn)]">
            미결제
          </span>
        )}
        <span className="text-[14px] text-[var(--color-navy-900)] font-bold">
          테이블 {order.tableNumber}
        </span>
        <span className="text-[12px] text-[var(--color-ink-600)] font-semibold truncate">
          · {customerName ?? "—"}
        </span>
        <span className="ml-auto text-[12px] text-[var(--color-ink-600)] tabular-nums">
          {new Date(order.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <ul className="text-[14px] font-semibold text-[var(--color-navy-900)] space-y-0.5">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span className="break-keep">
              {it.name} <span className="text-[var(--color-ink-600)] font-medium">×{it.quantity}</span>
            </span>
            <span className="tabular-nums">₩ {(it.price * it.quantity).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--color-line)] mt-2.5 pt-2.5 flex justify-between text-[14px] font-bold">
        <span className="text-[var(--color-ink-600)]">합계</span>
        <span className="text-[var(--color-navy-900)] tabular-nums">₩ {order.totalAmount.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
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
        {advance ? (
          <Button size="md" className="col-span-2" onClick={onAdvance}>
            {advance.label}
          </Button>
        ) : (
          <div className="hidden md:block col-span-2" />
        )}
      </div>
    </Card>
  );
}
