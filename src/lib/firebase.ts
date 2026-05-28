import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
  collection,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
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
