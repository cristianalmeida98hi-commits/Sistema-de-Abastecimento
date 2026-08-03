import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

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
