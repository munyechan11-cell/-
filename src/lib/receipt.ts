import type { Order } from "./types";
import { t, getLanguage } from "./i18n";

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
};

interface PrintReceiptInput {
  storeName: string;
  order: Order;
  footer?: string;
}

/**
 * POS API가 없을 때 영수증을 자동으로 인쇄.
 * 새 창을 띄워 80mm 영수증 레이아웃으로 즉시 print() 호출.
 */
export function printReceipt({ storeName, order, footer }: PrintReceiptInput) {
  const win = window.open("", "_blank", "width=420,height=720");
  if (!win) {
    // 팝업 차단 시 토스트로 안내 (alert은 모바일 키오스크에서 흐름 끊김)
    window.dispatchEvent(
      new CustomEvent("gyeol:toast", {
        detail: {
          message: t("receipt.popupBlocked"),
          type: "error",
        },
      })
    );
    return;
  }

  const lang = getLanguage();
  const locale = LOCALE_MAP[lang] ?? "en-US";
  const created = new Date(order.createdAt);
  const rows = order.items
    .map(
      (it) => `
      <tr>
        <td class="name">
          ${escape(it.name)}
          ${it.menuId ? `<span class="code">[${escape(it.menuId.slice(-6).toUpperCase())}]</span>` : ""}
        </td>
        <td class="qty">${it.quantity}</td>
        <td class="price">${(it.price * it.quantity).toLocaleString()}</td>
      </tr>`
    )
    .join("");
  const totalQty = order.items.reduce((s, it) => s + it.quantity, 0);

  win.document.write(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${escape(t("receipt.title"))} - ${escape(storeName)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Pretendard Variable", "Pretendard", -apple-system, system-ui, sans-serif;
    font-size: 13px;
    color: #000;
    width: 76mm;
    margin: 0 auto;
    padding: 8px 6px;
    font-weight: 500;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .store { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
  .meta { font-size: 12px; color: #222; margin-top: 6px; line-height: 1.45; }
  .table-banner {
    font-size: 28px;
    font-weight: 900;
    letter-spacing: -0.04em;
    margin: 10px 0 6px;
    text-align: center;
    border: 2px solid #000;
    padding: 8px 0;
    border-radius: 4px;
  }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 2px; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #000; }
  td.name { word-break: break-all; font-size: 14px; font-weight: 700; }
  td.qty { width: 24px; text-align: right; font-size: 15px; font-weight: 800; }
  td.price { width: 76px; text-align: right; font-feature-settings: "tnum"; font-weight: 700; }
  .code { display: block; font-family: monospace; font-size: 10px; color: #555; font-weight: 500; margin-top: 1px; }
  .summary { display: flex; justify-content: space-between; font-size: 12px; color: #444; margin-top: 6px; }
  .total {
    font-size: 18px;
    font-weight: 900;
    margin-top: 6px;
    display: flex;
    justify-content: space-between;
    border-top: 2px solid #000;
    padding-top: 6px;
  }
  .pos-note {
    margin-top: 10px;
    border: 1px dashed #000;
    padding: 6px;
    font-size: 11px;
    text-align: center;
    line-height: 1.4;
  }
  .footer { font-size: 11px; color: #444; margin-top: 10px; text-align: center; }
  .badge { display: inline-block; border: 1px solid #000; padding: 2px 8px; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; margin-bottom: 6px; }
  .barcode { font-family: monospace; letter-spacing: 1px; font-size: 9px; margin-top: 6px; word-break: break-all; }
</style>
</head>
<body>
  <div class="center">
    <span class="badge">${escape(t("receipt.qrBadge"))}</span>
    <div class="store">${escape(storeName)}</div>
    <div class="meta">
      ${created.toLocaleString(locale)}<br/>
      ${escape(t("receipt.orderNo"))} #${order.id.slice(-6).toUpperCase()}
    </div>
  </div>

  <div class="table-banner">${escape(t("receipt.table"))} ${order.tableNumber}</div>

  <table>
    <thead>
      <tr><th>${escape(t("receipt.col.item"))}</th><th class="qty">${escape(t("receipt.col.qty"))}</th><th class="price">${escape(t("receipt.col.amount"))}</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary">
    <span>${escape(t("receipt.summary.items", undefined, { kinds: order.items.length, qty: totalQty }))}</span>
    <span>${escape(t("receipt.summary.payOnsite"))}</span>
  </div>

  <div class="total">
    <span>${escape(t("receipt.total"))}</span>
    <span>₩ ${order.totalAmount.toLocaleString()}</span>
  </div>

  <div class="pos-note">
    ${t("receipt.qrNote")}
  </div>

  <div class="footer">
    ${footer ?? escape(t("receipt.thanks"))}
    <div class="barcode">${order.id}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 400);
      }, 80);
    };
  </script>
</body>
</html>`);
  win.document.close();
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
