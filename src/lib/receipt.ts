import type { Order } from "./types";

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
          message: "팝업 차단으로 영수증을 인쇄하지 못했어요. 브라우저 설정에서 팝업을 허용해 주세요.",
          type: "error",
        },
      })
    );
    return;
  }

  const created = new Date(order.createdAt);
  const rows = order.items
    .map(
      (it) => `
      <tr>
        <td class="name">${escape(it.name)}</td>
        <td class="qty">${it.quantity}</td>
        <td class="price">${(it.price * it.quantity).toLocaleString()}</td>
      </tr>`
    )
    .join("");

  win.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>영수증 - ${escape(storeName)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Pretendard Variable", "Pretendard", -apple-system, system-ui, sans-serif;
    font-size: 12px;
    color: #000;
    width: 76mm;
    margin: 0 auto;
    padding: 8px 6px;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .store { font-size: 16px; font-weight: 800; letter-spacing: -0.02em; }
  .meta { font-size: 11px; color: #333; margin-top: 6px; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 3px 2px; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #000; }
  td.name { word-break: break-all; }
  td.qty { width: 20px; text-align: right; }
  td.price { width: 70px; text-align: right; font-feature-settings: "tnum"; }
  .total { font-size: 14px; font-weight: 800; margin-top: 6px; display: flex; justify-content: space-between; }
  .footer { font-size: 11px; color: #444; margin-top: 10px; text-align: center; }
  .badge { display: inline-block; border: 1px solid #000; padding: 2px 8px; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; margin-bottom: 6px; }
  .barcode { font-family: monospace; letter-spacing: 1px; font-size: 9px; margin-top: 6px; word-break: break-all; }
</style>
</head>
<body>
  <div class="center">
    <span class="badge">주문 접수</span>
    <div class="store">${escape(storeName)}</div>
    <div class="meta">
      ${created.toLocaleString("ko-KR")}<br/>
      테이블 ${order.tableNumber} · 주문번호 #${order.id.slice(-6).toUpperCase()}
    </div>
  </div>

  <hr/>

  <table>
    <thead>
      <tr><th>품목</th><th class="qty">수량</th><th class="price">금액</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <hr/>

  <div class="total">
    <span>합계</span>
    <span>₩ ${order.totalAmount.toLocaleString()}</span>
  </div>

  <div class="footer">
    ${footer ?? "감사합니다. 결(Gyeol)을 이용해 주셔서 고맙습니다."}
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
