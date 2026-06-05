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
function stripUndefined<T>(input: T): T {
  if (input === null || input === undefined) return input;
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
    if (isDelete) await deleteDoc(ref);
    else await setDoc(ref, stripUndefined(data), { merge: true });
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
