import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

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
    onSnapshot(collection(db, colName), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      
      isSyncingFromFirebase = true;
      localStorage.setItem(colName, JSON.stringify(data));
      window.dispatchEvent(new Event('storage-update'));
      isSyncingFromFirebase = false;
    });
  });
};

export const syncToFirebase = async (key: string, value: any[]) => {
  if (!db || isSyncingFromFirebase) return;
  
  // We only sync arrays of objects with 'id' or 'number' (for tables)
  if (!Array.isArray(value)) return;

  try {
    // Note: In a real production app, you would want to only update changed documents
    // rather than rewriting the whole collection, but this works for the prototype.
    for (const item of value) {
      const docId = item.id || (item.number ? `${item.storeId}_${item.number}` : null);
      if (docId) {
        await setDoc(doc(db, key, docId.toString()), item, { merge: true });
      }
    }
  } catch (error) {
    console.error('Error syncing to Firebase:', error);
  }
};
