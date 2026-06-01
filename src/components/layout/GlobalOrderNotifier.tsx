import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "../../store/store";
import { notifyNewOrder } from "../../lib/notify";

const LS_SOUND = "gyeol:order-sound";

/**
 * 사장 로그인 상태일 때, 어느 페이지에 있든 새 주문이 도착하면 알림.
 * (OwnerShell 페이지뿐 아니라 대시보드·통계·고객관리 등 어디서든)
 */
export function GlobalOrderNotifier() {
  const { currentUser, orders } = useStore();
  const loc = useLocation();
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // 사장 로그인 상태에서만 동작
    if (!currentUser || currentUser.role !== "owner") {
      knownIdsRef.current = null;
      return;
    }

    const allMine = orders.filter((o) => o.storeId === currentUser.id);
    const currentIds = new Set(allMine.map((o) => o.id));

    // 첫 마운트: 기준선만 저장
    if (knownIdsRef.current === null) {
      knownIdsRef.current = currentIds;
      return;
    }

    // OwnerOrders 페이지에 있으면 그쪽이 알림 처리하므로 여기선 건너뜀
    // (중복 알림 방지)
    if (loc.pathname === "/biz/owner/orders") {
      knownIdsRef.current = currentIds;
      return;
    }

    const previous = knownIdsRef.current;
    const newPending = allMine.filter(
      (o) => !previous.has(o.id) && o.status === "pending"
    );
    const soundOn = localStorage.getItem(LS_SOUND) !== "0";

    if (newPending.length > 0 && soundOn) {
      const summary = newPending
        .slice(0, 3)
        .map((o) => `테이블 ${o.tableNumber}`)
        .join(", ");
      notifyNewOrder(`${summary} 외 ${newPending.length}건`);
    }

    knownIdsRef.current = currentIds;
  }, [orders, currentUser, loc.pathname]);

  return null;
}
