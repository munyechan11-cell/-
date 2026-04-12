// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfigFromJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  ...firebaseConfigFromJson,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFromJson.apiKey,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFromJson.projectId,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFromJson.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigFromJson.firestoreDatabaseId || '(default)'
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "undefined";

export const app = isFirebaseConfigured 
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)) 
  : null;

// Dynamic DB helper to allow fallback at runtime
export const getDb = (databaseId?: string): Firestore | null => {
  if (!app) return null;
  const id = databaseId || firebaseConfig.firestoreDatabaseId;
  const database = getFirestore(app, id);
  
  if (typeof window !== 'undefined' && database) {
    enableIndexedDbPersistence(database).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
      }
    });
  }
  return database;
};

export const db = getDb();
export const auth = isFirebaseConfigured ? getAuth(app!) : null;

// Collection Helpers
import { collection, CollectionReference, DocumentData } from 'firebase/firestore';

export const getCollections = (database: Firestore | null) => {
  if (!database) return null;
  return {
    users: collection(database, 'users'),
    visits: collection(database, 'visits'),
    coupons: collection(database, 'coupons'),
    tables: collection(database, 'tables'),
    Communications: collection(database, 'Communications'),
    tierOverrides: collection(database, 'tierOverrides'),
    sections: collection(database, 'sections'),
    menus: collection(database, 'menus'),
    orders: collection(database, 'orders'),
    appState: collection(database, 'appState')
  };
};

export const collections = getCollections(db);