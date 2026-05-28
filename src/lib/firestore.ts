import {
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CollectionName } from "./firebase";
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
      showToast("네트워크가 불안정해요. 잠시 후 자동 재전송됩니다.", "info");
      return;
    }
    if (code === "permission-denied") {
      showToast("권한이 없습니다.", "error");
    } else if (code === "not-found") {
      showToast("대상 데이터를 찾을 수 없어요.", "error");
    } else {
      showToast("저장 중 오류가 발생했어요.", "error");
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

export function flushOfflineQueue() {
  if (!db) return;
  const q = loadQueue();
  if (q.length === 0) return;
  saveQueue([]);
  (async () => {
    for (const op of q) {
      try {
        await updateFirestoreDoc(op.coll, op.id, op.data, op.isDelete);
      } catch {
        saveQueue([...loadQueue(), op]);
      }
    }
  })();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", flushOfflineQueue);
}
