import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
  collection,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInAnonymously, type Auth } from "firebase/auth";
import firebaseConfigFromJson from "../../firebase-applet-config.json";

const env = (import.meta as any).env ?? {};

const firebaseConfig = {
  ...firebaseConfigFromJson,
  apiKey: env.VITE_FIREBASE_API_KEY || (firebaseConfigFromJson as any).apiKey,
  projectId: env.VITE_FIREBASE_PROJECT_ID || (firebaseConfigFromJson as any).projectId,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (firebaseConfigFromJson as any).authDomain,
  firestoreDatabaseId:
    env.VITE_FIREBASE_DATABASE_ID ||
    (firebaseConfigFromJson as any).firestoreDatabaseId ||
    "(default)",
};

export const isFirebaseConfigured =
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.apiKey !== "undefined";

export const app: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

let persistenceOn = false;
export function getDb(databaseId?: string): Firestore | null {
  if (!app) return null;
  const id = databaseId || firebaseConfig.firestoreDatabaseId;
  const database = getFirestore(app, id);
  if (typeof window !== "undefined" && database && !persistenceOn) {
    persistenceOn = true;
    enableIndexedDbPersistence(database).catch(() => {
      /* multi-tab or unsupported - silent */
    });
  }
  return database;
}

export const db = getDb();
export const auth: Auth | null = isFirebaseConfigured ? getAuth(app!) : null;
export const googleProvider = new GoogleAuthProvider();

/**
 * 부팅 시 익명 로그인을 보장.
 * - 이미 로그인된 사용자(소셜·익명 누구든) 있으면 그대로 사용
 * - 없으면 signInAnonymously() 호출 → Firestore 보안 규칙의 `request.auth != null` 게이트 통과
 * - 카카오 같이 Firebase Auth 를 안 거치는 소셜은 익명 토큰 위에 자체 매칭으로 운영
 *
 * Firestore listener 등록 *전에* 반드시 await 할 것.
 */
// 진행 중인 익명 로그인 promise — 동시 호출 시 같은 promise 공유로 중복 호출 차단.
// rejected promise 가 캐시되어 후속 호출이 같은 실패를 받는 사고를 막기 위해,
// catch 안에서 reset 한 뒤에도 다음 호출이 새 로그인을 시도하도록 promise 를
// 즉시 null 로 복귀시킨다 (반환된 promise 자체는 사용자에게 resolve 로 보임).
let anonAuthPromise: Promise<void> | null = null;
export function ensureAnonymousAuth(): Promise<void> {
  if (!auth) return Promise.resolve();
  if (auth.currentUser) return Promise.resolve();
  if (anonAuthPromise) return anonAuthPromise;
  const a = auth;
  const p: Promise<void> = signInAnonymously(a)
    .then(() => undefined)
    .catch((e) => {
      console.error("[ensureAnonymousAuth] failed", e?.code ?? e?.message);
      // 다음 호출이 새 로그인을 시도하도록 캐시 초기화
      if (anonAuthPromise === p) anonAuthPromise = null;
      // 사용자에겐 silent — 호출처는 항상 await 만 함
    });
  anonAuthPromise = p;
  return p;
}

export const COLLECTIONS = [
  "users",
  "visits",
  "coupons",
  "tables",
  "Communications",
  "tierOverrides",
  "sections",
  "menus",
  "orders",
  "reservations",
  "photos",
  "shifts",
  "appState",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export function col(name: CollectionName) {
  if (!db) return null;
  return collection(db, name);
}
