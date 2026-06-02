/**
 * Firebase 초기화 + Custom Token 로그인 + print_jobs 구독.
 */
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  limit,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getAuth, signInWithCustomToken, type Auth } from "firebase/auth";
import { config } from "./config";

// ⚠️ 빌드 시 결 웹앱의 Firebase 설정값을 그대로 박아넣음.
// 모두 공개 가능한 값 (보안은 Firestore Rules 가 책임).
// 사장님이 결-TEST 가 아닌 다른 Firebase 프로젝트를 쓴다면 여기 갈아끼우거나 env 로 분리.
const FIREBASE_CONFIG = {
  apiKey: process.env.GYEOL_FIREBASE_API_KEY || "AIzaSyCa28EjvwF9N6dBIXnpWp94q1KmrdiZgyU",
  authDomain: process.env.GYEOL_FIREBASE_AUTH_DOMAIN || "gyeol-proj.firebaseapp.com",
  projectId: process.env.GYEOL_FIREBASE_PROJECT_ID || "gyeol-proj",
};

let app: FirebaseApp | null = null;
let dbRef: Firestore | null = null;
let authRef: Auth | null = null;

export function getDb(): Firestore {
  if (!dbRef) {
    app = initializeApp(FIREBASE_CONFIG);
    dbRef = getFirestore(app);
    authRef = getAuth(app);
  }
  return dbRef;
}

export async function signInWithStoredToken(): Promise<void> {
  const token = config.get("authToken");
  if (!token) throw new Error("페어링이 필요해요.");
  getDb(); // ensures auth init
  if (!authRef) throw new Error("Auth 초기화 실패");
  await signInWithCustomToken(authRef, token);
}

export interface PrintJob {
  id: string;
  storeId: string;
  type: "receipt" | "kitchen" | "test";
  payload: { storeName: string; order: any; footer?: string };
  printerName?: string | null;
  status: "pending" | "printing" | "printed" | "failed";
  attempts?: number;
  lastError?: string | null;
}

/**
 * 자기 매장의 pending 인쇄 작업만 실시간 구독.
 * 추가된 작업만 콜백 — 같은 작업이 두 번 호출되지 않도록 처리는 호출처가 담당.
 */
export function subscribePendingJobs(
  storeId: string,
  onJob: (job: PrintJob) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const db = getDb();
  const q = query(
    collection(db, "print_jobs"),
    where("storeId", "==", storeId),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc"),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      snap.docChanges().forEach((c) => {
        if (c.type === "added") {
          onJob({ id: c.doc.id, ...c.doc.data() } as PrintJob);
        }
      });
    },
    (err) => {
      console.error("[firebase] subscribe error", err);
      onError?.(err as Error);
    }
  );
}

export async function markJob(
  jobId: string,
  patch: Partial<{ status: PrintJob["status"]; lastError: string | null; attempts: number; printedAt: string }>
) {
  const db = getDb();
  await updateDoc(doc(db, "print_jobs", jobId), { ...patch, updatedAt: serverTimestamp() });
}

/** 60초 주기 하트비트 — users/{storeId}.printBridgeHeartbeatAt 업데이트 */
export async function heartbeat(storeId: string) {
  const db = getDb();
  try {
    await updateDoc(doc(db, "users", storeId), {
      printBridgeHeartbeatAt: new Date().toISOString(),
    });
  } catch (e: any) {
    // 매장이 없거나 권한 문제 — 무시
    console.warn("[firebase] heartbeat skip", e?.message);
  }
}
