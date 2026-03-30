// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "undefined";

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

export const db = isFirebaseConfigured ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null;
export const auth = isFirebaseConfigured ? getAuth(app) : null;