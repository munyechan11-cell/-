/**
 * 영수증 인쇄 — node-thermal-printer 로 OS 에 설치된 프린터에 ESC/POS 전송.
 *
 * Windows: "printer:" prefix 로 OS 프린터 큐 사용 (드라이버 설치된 USB·LAN 프린터)
 * Mac/Linux: CUPS 를 통해 동일 패턴
 */
import { ThermalPrinter, PrinterTypes, CharacterSet } from "node-thermal-printer";
import { config } from "./config";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ReceiptPayload {
  storeName: string;
  order: {
    id: string;
    tableNumber: number;
    items: OrderItem[];
    totalAmount: number;
    createdAt?: string;
  };
  footer?: string;
}

function pickType(vendor?: string): PrinterTypes {
  switch ((vendor || "").toUpperCase()) {
    case "STAR":
      return PrinterTypes.STAR;
    case "DAISY":
    case "ESCPOS":
    case "EPSON":
    default:
      return PrinterTypes.EPSON; // 가장 호환 폭넓은 ESC/POS
  }
}

export async function listSystemPrinters(): Promise<string[]> {
  // Electron 의 BrowserWindow.webContents.getPrintersAsync() 가 메인 프로세스에선 못 씀.
  // 대신 OS 명령으로 가져오는 것은 복잡하므로, UI 에서 사용자가 직접 입력하거나
  // electron 의 `getPrinters` 를 main 프로세스에서 호출 (deprecated 되었지만 작동).
  try {
    const { BrowserWindow } = await import("electron");
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      const printers = await win.webContents.getPrintersAsync();
      return printers.map((p) => p.name);
    }
  } catch (e: any) {
    console.warn("[printer] listSystemPrinters failed", e?.message);
  }
  return [];
}

export async function printReceipt(payload: ReceiptPayload): Promise<void> {
  const cfg = config.get("printer");
  if (!cfg) throw new Error("프린터가 선택되지 않았어요.");

  const printer = new ThermalPrinter({
    type: pickType(cfg.vendor),
    interface: `printer:${cfg.name}`,
    characterSet: CharacterSet.KOREA,
    options: { timeout: 5000 },
    width: cfg.width || 42,
  });

  // 연결 점검 — 끊긴 프린터면 빠르게 실패
  try {
    const ok = await printer.isPrinterConnected();
    if (!ok) throw new Error(`프린터 '${cfg.name}' 와 통신할 수 없어요.`);
  } catch (e: any) {
    throw new Error(`프린터 연결 확인 실패: ${e?.message ?? e}`);
  }

  // 영수증 본문 구성
  // node-thermal-printer 의 setter 들은 void 를 반환하므로 체이닝 불가 — 각 줄 분리.
  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(1, 1);
  printer.println(payload.storeName);
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();

  if (payload.order.createdAt) {
    printer.println(new Date(payload.order.createdAt).toLocaleString("ko-KR"));
  }
  printer.println(`주문번호 #${payload.order.id.slice(-6).toUpperCase()}`);
  printer.newLine();

  printer.bold(true);
  printer.setTextSize(1, 1);
  printer.println(`테이블 ${payload.order.tableNumber}`);
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();

  printer.alignLeft();
  for (const it of payload.order.items) {
    printer.tableCustom([
      { text: it.name, width: 0.55 },
      { text: String(it.quantity), width: 0.1, align: "RIGHT" },
      { text: it.price.toLocaleString("ko-KR"), width: 0.35, align: "RIGHT" },
    ]);
  }
  printer.drawLine();

  printer.bold(true);
  printer.tableCustom([
    { text: "합계", width: 0.5, bold: true },
    { text: `₩ ${payload.order.totalAmount.toLocaleString("ko-KR")}`, width: 0.5, align: "RIGHT", bold: true },
  ]);
  printer.bold(false);

  if (payload.footer) {
    printer.newLine();
    printer.alignCenter();
    printer.println(payload.footer);
  }

  printer.newLine();
  printer.alignCenter();
  printer.println("결(Gyeol) 자동 인쇄");
  printer.cut();

  await printer.execute();
}

/** 테스트 인쇄 — 페어링 후 사장님이 한 번 눌러 확인용 */
export async function printTestPage(storeName: string): Promise<void> {
  await printReceipt({
    storeName,
    order: {
      id: "TEST-" + Date.now(),
      tableNumber: 0,
      items: [
        { name: "테스트 항목 A", quantity: 1, price: 1000 },
        { name: "테스트 항목 B", quantity: 2, price: 2500 },
      ],
      totalAmount: 6000,
      createdAt: new Date().toISOString(),
    },
    footer: "이 영수증이 잘 나오면 설정 완료입니다.",
  });
}
