/**
 * 영수증 인쇄 브릿지 — 클라이언트 헬퍼.
 *
 * 흐름:
 *   주문 발생 → enqueuePrintJob() → Firestore print_jobs 에 pending 문서 생성
 *   매장 PC 트레이 앱(에이전트)이 onSnapshot 으로 구독 → 로컬 프린터에 ESC/POS 전송
 *   완료 시 status: "printed" 로 업데이트
 *
 * 페어링:
 *   1) 사장님이 issuePairingCode() 호출 → 서버가 6자리 코드 발급 (5분 유효)
 *   2) 사장님이 에이전트에 코드 입력
 *   3) 에이전트가 /api/print-bridge/exchange 로 코드 → Firebase Custom Token 교환
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { api } from "./api";
import type { Order } from "./types";

// ============================================================
// 인쇄 큐 발행
// ============================================================
export type PrintJobType = "receipt" | "kitchen" | "test";

export interface PrintPayload {
  storeName: string;
  order: Order;
  footer?: string;
}

/**
 * Firestore 의 print_jobs 컬렉션에 pending 문서를 추가.
 * 에이전트가 같은 storeId·status=pending 만 구독하므로 즉시 출력 큐에 들어감.
 *
 * 실패는 silent — 인쇄 브릿지가 본 주문 흐름을 막아선 안 됨.
 * 호출처는 이미 USB 직결·팝업 폴백을 갖추고 있으므로, 큐 발행 실패는 그저
 * "이 매장은 브릿지로 인쇄가 안 됐을 뿐" 으로 처리.
 */
export async function enqueuePrintJob(input: {
  storeId: string;
  type: PrintJobType;
  payload: PrintPayload;
  printerName?: string;
}): Promise<string | null> {
  if (!db) return null;
  if (!input.storeId) return null;
  try {
    const ref = await addDoc(collection(db, "print_jobs"), {
      storeId: input.storeId,
      type: input.type,
      payload: input.payload,
      printerName: input.printerName ?? null,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e: any) {
    console.warn("[printBridge] enqueue 실패", e?.message);
    return null;
  }
}

// ============================================================
// 페어링 코드 발급 — 사장님 화면에서 호출
// ============================================================
export interface IssuedCode {
  code: string;       // 6자리 숫자 문자열
  expiresAt: string;  // ISO 시각
}

export async function issuePairingCode(storeId: string, ownerName?: string): Promise<IssuedCode> {
  const res = await fetch(api("/api/print-bridge/issue-code"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storeId, ownerName }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `페어링 코드 발급 실패 (HTTP ${res.status})`);
  }
  return (await res.json()) as IssuedCode;
}
