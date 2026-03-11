import { initializeApp } from 'firebase/app';
import { getFirestore, onSnapshot, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase only if config is provided
export const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key';

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;

// Global sync state to prevent infinite loops
let isSyncingFromFirebase = false;

export const initFirebaseSync = () => {
  if (!db) return;

  const collections = ['users', 'visits', 'coupons', 'tables', 'communications', 'tierOverrides'];

  collections.forEach(colName => {
    onSnapshot(doc(db, 'appData', colName), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data().items || [];
        
        isSyncingFromFirebase = true;
        localStorage.setItem(colName, JSON.stringify(data));
        window.dispatchEvent(new Event('storage-update'));
        isSyncingFromFirebase = false;
      }
    });
  });
};

export const syncToFirebase = async (key: string, value: any[]) => {
  if (!db || isSyncingFromFirebase) return;
  
  if (!Array.isArray(value)) return;

  try {
    await setDoc(doc(db, 'appData', key), { items: value });
  } catch (error) {
    console.error('Error syncing to Firebase:', error);
  }
};
