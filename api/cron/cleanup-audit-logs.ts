import type { Request, Response } from 'express';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "andrade-agro.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "andrade-agro",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "andrade-agro.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "14052443075",
  appId: process.env.FIREBASE_APP_ID || "1:14052443075:web:5ee1aa6a86c656360cf2aa"
};

function getDbInstance() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app);
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const db = getDbInstance();
    const RETENTION_DAYS = 90;
    const cutoffTime = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffISO = new Date(cutoffTime).toISOString();

    const auditRef = collection(db, 'audit_logs');
    const snapshot = await getDocs(auditRef);

    let deletedCount = 0;
    const batchDeletes: Promise<void>[] = [];

    snapshot.forEach(document => {
      const data = document.data();
      const logDateTime = data.dateTime;
      if (logDateTime) {
        const time = new Date(logDateTime).getTime();
        if (!isNaN(time) && time < cutoffTime) {
          batchDeletes.push(deleteDoc(doc(db, 'audit_logs', document.id)));
          deletedCount++;
        }
      }
    });

    if (batchDeletes.length > 0) {
      await Promise.all(batchDeletes);
      
      // Registrar log de auditoria da rotina programada
      const cronLog = {
        id: `aud-${Date.now()}-cron`,
        dateTime: new Date().toISOString(),
        userId: 'cron-system',
        userName: 'Rotina Programada Vercel/Servidor',
        action: 'CONFIGURACAO',
        entity: 'Auditoria',
        details: `Rotina de retenção de 90 dias executada com sucesso. ${deletedCount} logs anteriores a ${new Date(cutoffTime).toLocaleDateString('pt-BR')} foram expurgados.`
      };
      await setDoc(doc(db, 'audit_logs', cronLog.id), cronLog);
    }

    return res.status(200).json({
      success: true,
      message: `Rotina de retenção executada. ${deletedCount} registro(s) expirado(s) removido(s).`,
      deletedCount,
      cutoffDateISO: cutoffISO,
      executedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron Cleanup Audit Logs Error]', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Falha ao executar rotina de limpeza de auditoria.'
    });
  }
}
