/**
 * WebUSB 기반 ESC/POS 영수증 프린터 직결.
 *
 * 동작:
 *  1. 사장님이 한 번 USB 프린터를 선택(권한 부여) → 브라우저가 기억
 *  2. 이후 자동으로 같은 프린터에 ESC/POS 명령 전송
 *  3. 한글은 래스터 이미지로 변환해서 보내므로 vendor 무관 호환
 *
 * 지원: Chrome / Edge (PC, Android). iOS Safari는 WebUSB 미지원 — 팝업 폴백.
 * 요구: HTTPS (또는 localhost)
 */

import type { Order } from "./types";
import { t, getLanguage } from "./i18n";

const LOCALE_MAP: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
};

declare global {
  interface Navigator {
    usb?: {
      requestDevice(options: { filters: Array<{ vendorId?: number; classCode?: number }> }): Promise<USBDevice>;
      getDevices(): Promise<USBDevice[]>;
    };
  }
  interface USBDevice {
    vendorId: number;
    productId: number;
    productName?: string;
    manufacturerName?: string;
    serialNumber?: string;
    opened: boolean;
    configuration: USBConfiguration | null;
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(n: number): Promise<void>;
    claimInterface(n: number): Promise<void>;
    releaseInterface(n: number): Promise<void>;
    transferOut(endpoint: number, data: BufferSource): Promise<{ status: string; bytesWritten: number }>;
  }
  interface USBConfiguration {
    interfaces: USBInterface[];
  }
  interface USBInterface {
    interfaceNumber: number;
    alternate: { endpoints: USBEndpoint[] };
  }
  interface USBEndpoint {
    endpointNumber: number;
    direction: "in" | "out";
  }
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.usb;
}

/** 브라우저가 권한 부여 받은 USB 프린터 목록 조회 */
export async function getAuthorizedPrinters(): Promise<USBDevice[]> {
  if (!isWebUsbSupported()) return [];
  try {
    return await navigator.usb!.getDevices();
  } catch {
    return [];
  }
}

/** 사용자에게 USB 프린터 선택 다이얼로그 표시 */
export async function requestPrinter(): Promise<USBDevice | null> {
  if (!isWebUsbSupported()) {
    throw new Error("이 브라우저는 USB 프린터 직결을 지원하지 않습니다. (Chrome 또는 Edge 사용)");
  }
  try {
    // class 7 = 프린터, 일반적인 vendor도 같이
    const dev = await navigator.usb!.requestDevice({
      filters: [
        { classCode: 7 }, // USB Printer
        { vendorId: 0x0419 }, // Samsung/Bixolon
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0fe6 }, // ICS Advent (Sewoo)
        { vendorId: 0x0dd4 }, // Custom/Citizen
        { vendorId: 0x1504 }, // Bixolon (alt)
        { vendorId: 0x0416 }, // Citizen / Star
      ],
    });
    return dev;
  } catch (e: any) {
    if (e?.name === "NotFoundError") return null; // 사용자가 취소
    throw e;
  }
}

/** OUT 엔드포인트 번호 찾기 */
function findOutEndpoint(device: USBDevice): number | null {
  if (!device.configuration) return null;
  for (const iface of device.configuration.interfaces) {
    for (const ep of iface.alternate.endpoints) {
      if (ep.direction === "out") return ep.endpointNumber;
    }
  }
  return null;
}

async function ensureOpen(device: USBDevice): Promise<number> {
  if (!device.opened) await device.open();
  if (!device.configuration) await device.selectConfiguration(1);
  // 첫 interface 점유
  const iface = device.configuration!.interfaces[0];
  try {
    await device.claimInterface(iface.interfaceNumber);
  } catch {
    // 이미 점유한 경우 무시
  }
  const ep = findOutEndpoint(device);
  if (!ep) throw new Error("프린터의 OUT 엔드포인트를 찾을 수 없습니다.");
  return ep;
}

/** 프린터로 raw bytes 전송 */
async function sendRaw(device: USBDevice, data: Uint8Array): Promise<void> {
  const endpoint = await ensureOpen(device);
  // USB transfer는 64KB 단위로 분할
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    await device.transferOut(endpoint, data.slice(i, i + CHUNK));
  }
}

/* ============================================================
   ESC/POS 래스터 이미지 인쇄
   ============================================================ */

interface ReceiptInput {
  storeName: string;
  order: Order;
  footer?: string;
}

/** 영수증을 canvas에 렌더링 */
function renderReceiptCanvas({ storeName, order, footer }: ReceiptInput): HTMLCanvasElement {
  // 80mm 영수증 = 약 576px (203dpi 기준) 또는 384px (저해상도)
  // 안전하게 384px (48 column ≒ 표준 thermal printer)
  const width = 384;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // 사장님이 설정한 언어로 라벨/날짜를 렌더 — 4언어 지원.
  const lang = getLanguage();
  const locale = LOCALE_MAP[lang] ?? "en-US";

  // 1차로 height 추정 후 렌더
  const created = new Date(order.createdAt);
  const lineHeight = 28;
  const lines: Array<() => void> = [];

  const addLine = (fn: () => void) => lines.push(fn);

  // ===== 영수증 구성 =====
  addLine(() => {
    ctx.font = "bold 18px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("[ QR 주문 접수 ]", width / 2, 0);
  });
  addLine(() => {
    ctx.font = "bold 28px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(storeName, width / 2, 0);
  });
  addLine(() => {
    ctx.font = "16px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(created.toLocaleString(locale), width / 2, 0);
  });
  addLine(() => {
    ctx.font = "16px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${t("receipt.orderNo", lang)} #${order.id.slice(-6).toUpperCase()}`, width / 2, 0);
  });

  // separator
  addLine(() => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // table banner
  addLine(() => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, -22, width, 44);
    ctx.fillStyle = "white";
    ctx.font = "bold 32px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${t("receipt.table", lang)} ${order.tableNumber}`, width / 2, 8);
    ctx.fillStyle = "black";
  });

  // items header
  addLine(() => {
    ctx.font = "bold 13px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.fillText(t("receipt.col.item", lang), 0, 0);
    ctx.textAlign = "center";
    ctx.fillText(t("receipt.col.qty", lang), width / 2 + 60, 0);
    ctx.textAlign = "right";
    ctx.fillText(t("receipt.col.amount", lang), width, 0);
  });
  addLine(() => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
  });

  // items
  for (const it of order.items) {
    addLine(() => {
      ctx.font = "bold 18px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(truncate(ctx, it.name, width - 130), 0, 0);
      ctx.textAlign = "center";
      ctx.fillText(`×${it.quantity}`, width / 2 + 60, 0);
      ctx.textAlign = "right";
      ctx.fillText((it.price * it.quantity).toLocaleString(), width, 0);
    });
  }

  // separator
  addLine(() => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
  });

  // total
  const totalQty = order.items.reduce((s, it) => s + it.quantity, 0);
  addLine(() => {
    ctx.font = "13px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#555";
    ctx.fillText(
      t("receipt.summary.items", lang, { kinds: order.items.length, qty: totalQty }),
      0,
      0
    );
    ctx.fillStyle = "black";
  });
  addLine(() => {
    ctx.font = "bold 22px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(t("receipt.total", lang), 0, 0);
    ctx.textAlign = "right";
    ctx.fillText(`₩ ${order.totalAmount.toLocaleString()}`, width, 0);
  });

  // separator
  addLine(() => {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // pos note
  addLine(() => {
    ctx.font = "13px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("결(Gyeol)에서 접수된 QR 주문입니다.", width / 2, 0);
  });
  addLine(() => {
    ctx.font = "13px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POS에 동일하게 입력해 주세요.", width / 2, 0);
  });

  if (footer) {
    addLine(() => {
      ctx.font = "12px 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#555";
      ctx.fillText(footer, width / 2, 0);
      ctx.fillStyle = "black";
    });
  }

  // ===== 캔버스 크기 결정 후 실제 그리기 =====
  const height = lines.length * lineHeight + 80;
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "black";
  ctx.textBaseline = "middle";

  let y = lineHeight;
  for (const fn of lines) {
    ctx.save();
    ctx.translate(0, y);
    fn();
    ctx.restore();
    y += lineHeight;
  }

  return canvas;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const t = text.slice(0, mid) + "…";
    if (ctx.measureText(t).width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  return text.slice(0, Math.max(1, lo - 1)) + "…";
}

/** Canvas → 1bpp 비트맵 (ESC/POS GS v 0) */
function canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const widthBytes = Math.ceil(w / 8);
  const bitmap = new Uint8Array(widthBytes * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      const a = img.data[i + 3];
      // 알파 적용 후 그레이스케일
      const gray = a > 0 ? (r + g + b) / 3 : 255;
      if (gray < 128) {
        bitmap[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  // ESC @ (초기화) + GS v 0 (래스터) + bitmap + LF*3 + GS V B (부분 컷)
  const header = new Uint8Array([
    0x1b, 0x40, // ESC @
    0x1d, 0x76, 0x30, 0x00, // GS v 0 (m=0 normal)
    widthBytes & 0xff, (widthBytes >> 8) & 0xff,
    h & 0xff, (h >> 8) & 0xff,
  ]);
  const footer = new Uint8Array([
    0x0a, 0x0a, 0x0a, // line feeds
    0x1d, 0x56, 0x42, 0x00, // GS V B 0 = partial cut
  ]);

  const out = new Uint8Array(header.length + bitmap.length + footer.length);
  out.set(header, 0);
  out.set(bitmap, header.length);
  out.set(footer, header.length + bitmap.length);
  return out;
}

/** 메인 진입점: WebUSB 프린터에 영수증 전송 */
export async function printReceiptViaUsb(input: ReceiptInput): Promise<void> {
  const devices = await getAuthorizedPrinters();
  if (devices.length === 0) {
    throw new Error("연결된 USB 프린터가 없습니다. 브랜드 설정에서 프린터를 연결해 주세요.");
  }
  const device = devices[0];
  const canvas = renderReceiptCanvas(input);
  const bytes = canvasToEscPos(canvas);
  await sendRaw(device, bytes);
}

/** 테스트 인쇄 */
export async function printTestPage(): Promise<void> {
  const devices = await getAuthorizedPrinters();
  if (devices.length === 0) throw new Error("연결된 USB 프린터가 없습니다.");
  const device = devices[0];
  const canvas = renderReceiptCanvas({
    storeName: "결 (Gyeol)",
    order: {
      id: "TEST-" + Date.now().toString(36),
      storeId: "test",
      tableNumber: 1,
      customerId: "test",
      items: [
        { menuId: "m1", name: "테스트 메뉴", quantity: 1, price: 1000 },
      ],
      totalAmount: 1000,
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString(),
    },
    footer: "테스트 인쇄 — 정상 출력되면 연결 성공",
  });
  const bytes = canvasToEscPos(canvas);
  await sendRaw(device, bytes);
}
