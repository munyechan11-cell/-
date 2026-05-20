// Web Bluetooth ESC/POS 영수증 프린터.
// 호환: Goojprt PT-58, EpsTronics, Sumvision 등 일반 58mm BT 영수증 프린터.
// 한글 출력은 CP949(EUC-KR) 인코딩 사용.

const SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';
const MAX_CHUNK = 100;

// ESC/POS 명령어
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: new Uint8Array([ESC, 0x40]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  SIZE_NORMAL: new Uint8Array([GS, 0x21, 0x00]),
  SIZE_DOUBLE: new Uint8Array([GS, 0x21, 0x11]),
  SIZE_DOUBLE_HEIGHT: new Uint8Array([GS, 0x21, 0x01]),
  CUT: new Uint8Array([GS, 0x56, 0x00]),
  NEWLINE: new Uint8Array([0x0a]),
  CODEPAGE_KOREAN: new Uint8Array([ESC, 0x74, 0x12]) // CP949
};

let connectedDevice: any | null = null;
let connectedChar: any | null = null;

// 한글 출력은 프린터에 CP949 코드페이지 명령을 보낸 뒤 UTF-8 바이트를 전송.
// 모던 BT 영수증 프린터 대부분 UTF-8을 처리하지만, 호환 안 되면 CP949 매핑 추가 필요.
const encodeKorean = (text: string): Uint8Array => new TextEncoder().encode(text);

const concat = (arrays: Uint8Array[]): Uint8Array => {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
};

export const isBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
};

export const pairPrinter = async (): Promise<{ name: string }> => {
  if (!isBluetoothSupported()) {
    throw new Error('이 브라우저는 Web Bluetooth를 지원하지 않습니다. (Chrome/Edge 권장, iOS는 미지원)');
  }
  const device = await (navigator as any).bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID]
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const char = await service.getCharacteristic(CHAR_UUID);
  connectedDevice = device;
  connectedChar = char;

  device.addEventListener('gattserverdisconnected', () => {
    connectedDevice = null;
    connectedChar = null;
  });

  // 로컬에 마지막 사용 프린터 ID 저장 (재연결 힌트)
  try { localStorage.setItem('printer.lastName', device.name || ''); } catch {}

  return { name: device.name || '영수증 프린터' };
};

export const isPrinterConnected = (): boolean => {
  return !!connectedChar && !!connectedDevice?.gatt?.connected;
};

export const getConnectedPrinterName = (): string | null => {
  return connectedDevice?.name || null;
};

export const disconnectPrinter = async () => {
  try {
    if (connectedDevice?.gatt?.connected) {
      connectedDevice.gatt.disconnect();
    }
  } finally {
    connectedDevice = null;
    connectedChar = null;
  }
};

const writeBytes = async (data: Uint8Array) => {
  if (!connectedChar) throw new Error('프린터가 연결되지 않았습니다.');
  for (let i = 0; i < data.length; i += MAX_CHUNK) {
    const chunk = data.slice(i, i + MAX_CHUNK);
    await connectedChar.writeValueWithoutResponse(chunk);
  }
};

// ─── 영수증 빌더 ─────────────────────────────────────────
export interface ReceiptLine {
  text: string;
  align?: 'left' | 'center';
  bold?: boolean;
  size?: 'normal' | 'double' | 'doubleHeight';
}

export interface OrderReceipt {
  storeName: string;
  tableNumber: number;
  customerName?: string;
  orderId: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  createdAt: string;
}

const SEP = '─'.repeat(32);

const buildOrderReceipt = (r: OrderReceipt): Uint8Array => {
  const parts: Uint8Array[] = [];
  parts.push(CMD.INIT);
  parts.push(CMD.CODEPAGE_KOREAN);

  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.SIZE_DOUBLE);
  parts.push(CMD.BOLD_ON);
  parts.push(encodeKorean(r.storeName));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.BOLD_OFF);
  parts.push(CMD.SIZE_NORMAL);

  parts.push(encodeKorean('=== 신규 주문 ==='));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);

  parts.push(CMD.ALIGN_LEFT);
  parts.push(CMD.SIZE_DOUBLE_HEIGHT);
  parts.push(CMD.BOLD_ON);
  parts.push(encodeKorean(`테이블: ${r.tableNumber}번`));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.BOLD_OFF);
  parts.push(CMD.SIZE_NORMAL);

  if (r.customerName) {
    parts.push(encodeKorean(`손님: ${r.customerName}`));
    parts.push(CMD.NEWLINE);
  }
  parts.push(encodeKorean(`시간: ${new Date(r.createdAt).toLocaleTimeString('ko-KR')}`));
  parts.push(CMD.NEWLINE);
  parts.push(encodeKorean(SEP));
  parts.push(CMD.NEWLINE);

  for (const it of r.items) {
    parts.push(CMD.BOLD_ON);
    parts.push(encodeKorean(`${it.name}`));
    parts.push(CMD.NEWLINE);
    parts.push(CMD.BOLD_OFF);
    parts.push(encodeKorean(`  ${it.quantity}개 × ${it.price.toLocaleString()}원 = ${(it.quantity * it.price).toLocaleString()}원`));
    parts.push(CMD.NEWLINE);
  }

  parts.push(encodeKorean(SEP));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.SIZE_DOUBLE);
  parts.push(CMD.BOLD_ON);
  parts.push(encodeKorean(`합계 ${r.totalAmount.toLocaleString()}원`));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.SIZE_NORMAL);
  parts.push(CMD.BOLD_OFF);

  parts.push(CMD.NEWLINE);
  parts.push(CMD.ALIGN_LEFT);
  parts.push(encodeKorean(`주문번호 ${r.orderId.slice(-6).toUpperCase()}`));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);
  parts.push(CMD.CUT);

  return concat(parts);
};

export const printOrder = async (r: OrderReceipt): Promise<void> => {
  if (!isPrinterConnected()) throw new Error('프린터가 연결되지 않았습니다.');
  await writeBytes(buildOrderReceipt(r));
};

export const printTestPage = async (storeName: string): Promise<void> => {
  if (!isPrinterConnected()) throw new Error('프린터가 연결되지 않았습니다.');
  const parts: Uint8Array[] = [];
  parts.push(CMD.INIT);
  parts.push(CMD.CODEPAGE_KOREAN);
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.SIZE_DOUBLE);
  parts.push(CMD.BOLD_ON);
  parts.push(encodeKorean(storeName));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.BOLD_OFF);
  parts.push(CMD.SIZE_NORMAL);
  parts.push(encodeKorean('테스트 인쇄 성공!'));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);
  parts.push(encodeKorean(new Date().toLocaleString('ko-KR')));
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);
  parts.push(CMD.NEWLINE);
  parts.push(CMD.CUT);
  await writeBytes(concat(parts));
};
