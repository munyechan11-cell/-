import {
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CollectionName } from "./firebase";
import { t } from "./i18n";
import { showToast } from "./toast";

const OFFLINE_QUEUE_KEY = "gyeol:offline_queue";

interface QueueOp {
  coll: CollectionName;
  id: string;
  data?: any;
  isDelete?: boolean;
}

function loadQueue(): QueueOp[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveQueue(q: QueueOp[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

/**
 * Firestore는 undefined 값을 거부합니다.
 * 객체에서 undefined를 재귀적으로 제거합니다 (null은 유지).
 */
/**
 * Firestore FieldValue 인스턴스인지 검사.
 * increment() / deleteField() / arrayUnion() / arrayRemove() / serverTimestamp()
 * 같은 sentinel 들은 plain object 처럼 보이지만 SDK 가 인스턴스 identity 로
 * 인식하므로 절대 분해되면 안 됨. constructor.name 또는 내부 _methodName
 * 필드로 식별 (Firestore SDK 가 두 가지 모두 노출).
 */
function isFieldValue(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const obj = v as any;
  // Firebase v9+ FieldValue 는 _methodName 필드를 가짐
  if (typeof obj._methodName === "string") return true;
  // 또는 prototype constructor.name 으로 식별 (minify 후에도 안전한 fallback 으로
  // _methodName 이 우선)
  const ctor = obj.constructor?.name;
  return ctor === "FieldValueImpl" || ctor === "NumericIncrementFieldValueImpl" ||
    ctor === "DeleteFieldValueImpl" || ctor === "ArrayUnionFieldValueImpl" ||
    ctor === "ArrayRemoveFieldValueImpl" || ctor === "ServerTimestampFieldValueImpl";
}

function stripUndefined<T>(input: T): T {
  if (input === null || input === undefined) return input;
  // FieldValue sentinel 은 절대 분해하지 말고 그대로 통과시킨다.
  // (이걸 분해하면 atomic increment / deleteField 가 그냥 plain object 저장으로 바뀜)
  if (isFieldValue(input)) return input;
  if (Array.isArray(input)) {
    return input
      .map((v) => stripUndefined(v))
      .filter((v) => v !== undefined) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return input;
}

/**
 * 서버 ack 대기 상한(ms).
 *
 * Firestore 는 오프라인 지속성이 켜져 있으면 setDoc/deleteDoc 의 promise 를
 * "서버가 커밋을 확인할 때까지" 미해결로 둔다. 오프라인이거나 firestore.googleapis.com
 * 이 차단된 환경(지하철·사내망·일부 통신사 프록시)에서는 reject 도 resolve 도 하지 않고
 * 무기한 pending 이다. 그러면:
 *   - 이 write 를 await 하는 login()/가입 흐름이 끝나지 않아 finally 의 setLoading(false)
 *     조차 실행되지 않고, 버튼이 스피너인 채로 굳는다 → 사용자는 "로그인이 안 된다"고 본다.
 *   - 아래 catch 의 unavailable/deadline-exceeded 오프라인 큐 분기가 영영 도달하지 않아,
 *     큐 자체가 죽은 코드가 된다.
 * → 상한을 두고, 넘으면 큐에 넣고 진행시킨다(재연결 시 flushOfflineQueue 가 재전송).
 */
const WRITE_ACK_TIMEOUT_MS = 10_000;

const TIMED_OUT = Symbol("write-ack-timeout");

/** p 가 제한 시간 안에 끝나면 그 결과를, 아니면 TIMED_OUT 을 돌려준다. */
async function withAckTimeout<T>(p: Promise<T>): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), WRITE_ACK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function updateFirestoreDoc(
  coll: CollectionName,
  id: string,
  data?: any,
  isDelete = false
): Promise<void> {
  if (!db) {
    saveQueue([...loadQueue(), { coll, id, data, isDelete }]);
    return;
  }
  try {
    const ref = doc(db, coll, id);
    const op = isDelete
      ? deleteDoc(ref)
      : setDoc(ref, stripUndefined(data), { merge: true });

    // 로컬 캐시 반영은 이미 끝난 상태다. 남은 건 서버 ack 뿐이므로,
    // 여기서 무한정 기다리지 않고 상한을 둔다.
    const settled = await withAckTimeout(op);
    if (settled === TIMED_OUT) {
      // 아직 살아 있는 promise 가 나중에 reject 하더라도 unhandled rejection 이
      // 되지 않도록 흡수한다. 원인 파악이 가능하게 로그는 남긴다.
      op.catch((late: any) =>
        console.warn("[updateFirestoreDoc] 지연 실패", coll, id, late?.code ?? late?.message)
      );
      saveQueue([...loadQueue(), { coll, id, data, isDelete }]);
      showToast(t("fs.networkUnstable"), "info");
      return;
    }
  } catch (e: any) {
    const code = e?.code as string | undefined;
    if (code === "unavailable" || code === "deadline-exceeded") {
      saveQueue([...loadQueue(), { coll, id, data, isDelete }]);
      showToast(t("fs.networkUnstable"), "info");
      return;
    }
    if (code === "permission-denied") {
      showToast(t("fs.permissionDenied"), "error");
    } else if (code === "not-found") {
      showToast(t("fs.notFound"), "error");
    } else {
      showToast(t("fs.saveError"), "error");
    }
    throw e;
  }
}

export async function batchWrite(
  build: (batch: WriteBatch) => void
): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  build(batch);
  await batch.commit();
}

// 동시 flush 차단 — 'online' 이벤트 + 코드의 다른 트리거가 겹쳐 두 번 돌면
// 같은 op 가 두 번 write 되거나(setDoc merge 라 대부분 멱등이지만), deleteDoc 이
// not-found 로 throw → 큐에 다시 들어가 재시도 무한 루프 가능. 락으로 1회만 진행.
let flushing = false;
export function flushOfflineQueue() {
  if (!db || flushing) return;
  const q = loadQueue();
  if (q.length === 0) return;
  flushing = true;
  saveQueue([]);
  (async () => {
    for (const op of q) {
      try {
        await updateFirestoreDoc(op.coll, op.id, op.data, op.isDelete);
      } catch {
        saveQueue([...loadQueue(), op]);
      }
    }
  })().finally(() => {
    flushing = false;
  });
}

// online 리스너 1회 등록 보장 — HMR / 동적 import 반복 시 중복 방지
if (typeof window !== "undefined" && !(window as any).__gyeolOnlineListenerSetup) {
  (window as any).__gyeolOnlineListenerSetup = true;
  window.addEventListener("online", flushOfflineQueue);
}
