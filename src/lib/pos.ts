import type { Order } from "./types";
import { api } from "./api";

/**
 * 서버의 /api/order/relay-to-pos 가 푸드테크 형식으로 받기 때문에
 * 필드명을 정확히 일치시킴 (foodtechStoreCode, orderId, items[].posCode 등).
 * 다른 POS 벤더의 경우 서버에서 vendor별로 라우팅 가능하도록 vendor 필드도 전송.
 */
interface PosPayload {
  vendor?: string;
  foodtechStoreCode: string;
  orderId: string;
  tableNumber: number;
  totalAmount: number;
  items: { posCode?: string; name: string; quantity: number; price: number }[];
}

export async function relayOrderToPos(
  storeCode: string,
  order: Order,
  menuLookup: (menuId: string) => string | undefined,
  vendor?: string
): Promise<boolean> {
  const payload: PosPayload = {
    vendor,
    foodtechStoreCode: storeCode,
    orderId: order.id,
    tableNumber: order.tableNumber,
    totalAmount: order.totalAmount,
    items: order.items.map((it) => ({
      posCode: menuLookup(it.menuId),
      name: it.name,
      quantity: it.quantity,
      price: it.price,
    })),
  };
  try {
    const res = await fetch(api("/api/order/relay-to-pos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[POS relay] HTTP ${res.status}`);
      return false;
    }
    const result = await res.json().catch(() => ({}));
    return result?.success !== false;
  } catch (e) {
    console.warn("[POS relay] network error", e);
    return false;
  }
}
