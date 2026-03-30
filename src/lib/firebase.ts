// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfigFromJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  ...firebaseConfigFromJson,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFromJson.apiKey,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFromJson.projectId,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFromJson.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigFromJson.firestoreDatabaseId || '(default)'
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "undefined";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

export const db = isFirebaseConfigured ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null;
export const auth = isFirebaseConfigured ? getAuth(app) : null;