import type { Order } from "./types";

interface PosPayload {
  storeCode: string;
  orderId: string;
  tableNumber: number;
  items: { code?: string; name: string; qty: number; price: number }[];
  totalAmount: number;
}

export async function relayOrderToPos(
  storeCode: string,
  order: Order,
  menuLookup: (menuId: string) => string | undefined
): Promise<boolean> {
  const payload: PosPayload = {
    storeCode,
    orderId: order.id,
    tableNumber: order.tableNumber,
    items: order.items.map((it) => ({
      code: menuLookup(it.menuId),
      name: it.name,
      qty: it.quantity,
      price: it.price,
    })),
    totalAmount: order.totalAmount,
  };
  try {
    const res = await fetch("/api/order/relay-to-pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
