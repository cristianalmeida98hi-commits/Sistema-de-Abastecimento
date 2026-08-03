import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, setDoc, updateDoc, DocumentReference } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
  authDomain: "andrade-agro.firebaseapp.com",
  projectId: "andrade-agro",
  storageBucket: "andrade-agro.firebasestorage.app",
  messagingSenderId: "271695349839",
  appId: "1:271695349839:web:4428ed928e6423b9adc23a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Helper to remove any undefined properties before writing to Firestore
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export function safeSetDoc(docRef: DocumentReference, data: any) {
  return setDoc(docRef, sanitizeForFirestore(data));
}

export function safeUpdateDoc(docRef: DocumentReference, data: any) {
  return updateDoc(docRef, sanitizeForFirestore(data));
}

// Test Firestore connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("[Firebase] Client appears offline or checking connection:", error.message);
    }
  }
}

testConnection();
