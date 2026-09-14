import webpushLib from 'web-push';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const webpush = (webpushLib as any).default || webpushLib;

export interface PushDeviceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
  };
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    timestamp?: string;
  };
  active: boolean;
  updatedAt: string;
  createdAt: string;
}

export const OFFICIAL_VAPID_KEYS = {
  publicKey: 'BGidTH8JXdHgg5XYTG-Z3iAJhCOVguQQf0B5iL-GMHJVXdnj_1JLv1bvtCG0GOCSBU-LqYL9dpUcCZaj_nV3H4s',
  privateKey: 'jIzx37tfbmK5NxYiLQYbcze3XSBg9Il6kBLeDW6zQxA'
};

function cleanKey(k?: string): string {
  if (!k) return '';
  return k.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '').replace(/\r?\n/g, '').trim();
}

const VAPID_SUBJECT = cleanKey(process.env.VAPID_SUBJECT) || 'mailto:suporte@andradeagro.com.br';
const VAPID_PUBLIC_KEY = 
  cleanKey(process.env.VAPID_PUBLIC_KEY) || 
  cleanKey(process.env.VITE_VAPID_PUBLIC_KEY) || 
  OFFICIAL_VAPID_KEYS.publicKey;
const VAPID_PRIVATE_KEY = 
  cleanKey(process.env.VAPID_PRIVATE_KEY) || 
  cleanKey(process.env.PRIVATE_VAPID_KEY) || 
  OFFICIAL_VAPID_KEYS.privateKey;

let vapidConfiguredSuccessfully = false;
let vapidConfigError: string | null = null;

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfiguredSuccessfully = true;
  console.log('[AndradeAgro PushEngine] VAPID configurado com sucesso no servidor.');
} catch (e: any) {
  vapidConfigError = e?.message || String(e);
  console.error('[AndradeAgro PushEngine] Erro ao configurar VAPID:', vapidConfigError);
}

// Firebase setup
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "andrade-agro.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "andrade-agro",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "andrade-agro.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "271695349839",
  appId: process.env.FIREBASE_APP_ID || "1:271695349839:web:4428ed928e6423b9adc23a"
};

let firebaseAppInstance: any = null;
let firestoreInstance: any = null;
let pendingEngineAuthPromise: Promise<any> | null = null;
let lastFirestoreQueryError: string | null = null;
let cachedAuthToken: { token: string; expiresAt: number } | null = null;

function getFirebase() {
  if (!firestoreInstance) {
    firebaseAppInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    firestoreInstance = getFirestore(firebaseAppInstance);
  }
  return { app: firebaseAppInstance, db: firestoreInstance };
}

export async function ensureEngineFirebaseAuth(): Promise<boolean> {
  try {
    const { app } = getFirebase();
    const auth = getAuth(app);
    if (auth.currentUser) {
      return true;
    }
    if (pendingEngineAuthPromise) {
      await pendingEngineAuthPromise;
      return Boolean(auth.currentUser);
    }
    pendingEngineAuthPromise = signInAnonymously(auth)
      .then((cred) => {
        console.log(`[AndradeAgro PushEngine] Firebase Auth anônimo ativo: UID=${cred.user.uid}`);
        return cred.user;
      })
      .catch((err) => {
        console.warn(`[AndradeAgro PushEngine] Falha ao autenticar anonimamente no Firebase:`, err?.message || err);
        return null;
      })
      .finally(() => {
        pendingEngineAuthPromise = null;
      });
    await pendingEngineAuthPromise;
    return Boolean(auth.currentUser);
  } catch (err: any) {
    console.warn(`[AndradeAgro PushEngine] Exceção em ensureEngineFirebaseAuth:`, err?.message || err);
    return false;
  }
}

function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const k in fields) {
      res[k] = parseFirestoreValue(fields[k]);
    }
    return res;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map(parseFirestoreValue);
  }
  return null;
}

function parseFirestoreDoc(doc: any): any {
  const fields = doc?.fields || {};
  const data: Record<string, any> = {};
  for (const k in fields) {
    data[k] = parseFirestoreValue(fields[k]);
  }
  if (!data.id && doc.name) {
    data.id = doc.name.split('/').pop();
  }
  return data;
}

async function getFirebaseAuthToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedAuthToken && cachedAuthToken.expiresAt > now + 60000) {
    return cachedAuthToken.token;
  }

  try {
    const apiKey = firebaseConfig.apiKey;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[AndradeAgro PushEngine] IdentityToolkit returned status ${res.status}`);
      return null;
    }
    const data = (await res.json()) as any;
    if (data?.idToken) {
      const expiresIn = parseInt(data.expiresIn || '3600', 10);
      cachedAuthToken = {
        token: data.idToken,
        expiresAt: now + expiresIn * 1000
      };
      console.log(`[AndradeAgro PushEngine] Token Firebase Auth REST obtido com sucesso (UID=${data.localId})`);
      return data.idToken;
    }
  } catch (err: any) {
    console.warn(`[AndradeAgro PushEngine] Falha ao obter token Auth REST:`, err?.message || err);
  }
  return null;
}

async function fetchFirestoreDevicesRest(): Promise<{ devices: PushDeviceRecord[]; error?: string }> {
  try {
    console.log(`[AndradeAgro PushEngine] INÍCIO DA CONSULTA`);
    console.log(`[AndradeAgro PushEngine] Firebase inicializado: SIM`);
    console.log(`[AndradeAgro PushEngine] Projeto Firebase identificado: ${firebaseConfig.projectId}`);
    console.log(`[AndradeAgro PushEngine] Consulta Firestore iniciada: coleção 'user_devices'`);

    const token = await getFirebaseAuthToken();
    if (!token) {
      return { devices: [], error: 'Não foi possível autenticar a sessão do Firebase para ler os dispositivos.' };
    }

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/user_devices?pageSize=100`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(firestoreUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[AndradeAgro PushEngine] Erro HTTP na consulta REST do Firestore (status ${res.status}): ${errText.slice(0, 150)}`);
      return { devices: [], error: `Erro HTTP ${res.status} ao consultar Firestore: ${errText.slice(0, 100)}` };
    }

    const data = (await res.json()) as any;
    const docs = data.documents || [];
    console.log(`[AndradeAgro PushEngine] Quantidade de documentos encontrados no Firestore: ${docs.length}`);

    const records: PushDeviceRecord[] = [];
    for (const rawDoc of docs) {
      const parsed = parseFirestoreDoc(rawDoc);
      if (parsed && parsed.active !== false && parsed.subscription) {
        const endpoint = parsed.endpoint || parsed.subscription?.endpoint;
        if (endpoint && isValidPushSubscription(parsed.subscription)) {
          records.push({
            id: parsed.id || rawDoc.name.split('/').pop(),
            userId: parsed.userId || '',
            userName: parsed.userName || 'Usuário',
            userRole: parsed.userRole || 'FUNCIONARIO',
            endpoint,
            subscription: parsed.subscription,
            deviceInfo: parsed.deviceInfo || {},
            active: true,
            updatedAt: parsed.updatedAt || new Date().toISOString(),
            createdAt: parsed.createdAt || new Date().toISOString()
          });
        }
      }
    }

    console.log(`[AndradeAgro PushEngine] Quantidade de dispositivos válidos: ${records.length}`);
    return { devices: records };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Tempo limite esgotado ao consultar Firestore (timeout)' : err?.message || String(err);
    console.warn(`[AndradeAgro PushEngine] Falha na consulta REST do Firestore:`, msg);
    return { devices: [], error: msg };
  }
}

export function isValidPushSubscription(sub: any): boolean {
  if (!sub || typeof sub !== 'object') return false;
  if (typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('http')) return false;
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  if (typeof p256dh !== 'string' || p256dh.trim().length < 40) return false;
  if (typeof auth !== 'string' || auth.trim().length < 10) return false;
  try {
    const pBuf = Buffer.from(p256dh.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const aBuf = Buffer.from(auth.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return pBuf.length === 65 && aBuf.length === 16;
  } catch {
    return false;
  }
}

// Resilient file-backed & in-memory database
function getDbFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
    return path.join('/tmp', 'andradeagro_db.json');
  }
  return path.join(process.cwd(), 'data', 'db.json');
}

let inMemoryStore: {
  devices: PushDeviceRecord[];
  processedEvents: string[];
} = {
  devices: [],
  processedEvents: []
};

function loadStore() {
  try {
    const dbPath = getDbFilePath();
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data['andradeagro_user_devices_v1'])) {
        inMemoryStore.devices = data['andradeagro_user_devices_v1'];
      }
      if (Array.isArray(data['andradeagro_processed_push_events'])) {
        inMemoryStore.processedEvents = data['andradeagro_processed_push_events'];
      }
    }
  } catch (err) {
    console.warn('[AndradeAgro PushEngine] Could not load store from disk:', err);
  }
}

function saveStore() {
  try {
    const dbPath = getDbFilePath();
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let existing: Record<string, any> = {};
    if (fs.existsSync(dbPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      } catch {}
    }

    existing['andradeagro_user_devices_v1'] = inMemoryStore.devices;
    existing['andradeagro_processed_push_events'] = inMemoryStore.processedEvents;
    fs.writeFileSync(dbPath, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[AndradeAgro PushEngine] Could not save store to disk:', err);
  }
}

loadStore();

export async function fetchAllActiveDevices(): Promise<PushDeviceRecord[]> {
  loadStore();
  const deviceMap = new Map<string, PushDeviceRecord>();

  // 1. Local devices
  for (const d of inMemoryStore.devices) {
    if (d.endpoint && d.active !== false && isValidPushSubscription(d.subscription)) {
      deviceMap.set(d.endpoint, d);
    }
  }

  // 2. Consulta via Firestore REST ultrarrápida (não trava serverless)
  lastFirestoreQueryError = null;
  const restResult = await fetchFirestoreDevicesRest();
  if (restResult.devices.length > 0) {
    for (const d of restResult.devices) {
      deviceMap.set(d.endpoint, d);
    }
    const result = Array.from(deviceMap.values());
    console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total consolidado de dispositivos ativos válidos: ${result.length}`);
    return result;
  }

  // Se REST falhou ou retornou 0 mas houve erro
  if (restResult.error) {
    lastFirestoreQueryError = restResult.error;
    // Tenta fallback com a SDK caso a requisição REST direta tenha falhado
    try {
      await ensureEngineFirebaseAuth();
      const { db } = getFirebase();
      const snap = await getDocs(collection(db, 'user_devices'));
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Firestore SDK fallback: ${snap.size} documentos recuperados em 'user_devices'.`);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.active !== false && data.subscription) {
          const endpoint = data.endpoint || data.subscription?.endpoint;
          if (endpoint && isValidPushSubscription(data.subscription)) {
            deviceMap.set(endpoint, {
              id: docSnap.id,
              userId: data.userId || '',
              userName: data.userName || 'Usuário',
              userRole: data.userRole || 'FUNCIONARIO',
              endpoint,
              subscription: data.subscription,
              deviceInfo: data.deviceInfo || {},
              active: true,
              updatedAt: data.updatedAt || new Date().toISOString(),
              createdAt: data.createdAt || new Date().toISOString()
            });
          }
        }
      });
      lastFirestoreQueryError = null; // Resolvido via fallback
    } catch (sdkErr: any) {
      console.warn('[AndradeAgro PushEngine] [ETAPA 3/6] Erro também no fallback da SDK Firestore:', sdkErr?.message || sdkErr);
      lastFirestoreQueryError = sdkErr?.message || restResult.error;
    }
  }

  const result = Array.from(deviceMap.values());
  console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total consolidado de dispositivos ativos válidos: ${result.length}`);
  return result;
}

export async function deactivateEndpointEverywhere(endpoint: string) {
  // 1. Local
  loadStore();
  inMemoryStore.devices = inMemoryStore.devices.map(d => {
    if (d.subscription && d.subscription.endpoint === endpoint) {
      return { ...d, active: false, updatedAt: new Date().toISOString() };
    }
    return d;
  });
  saveStore();

  // 2. Firestore
  try {
    const { app, db } = getFirebase();
    const auth = getAuth(app);
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => null);
    }
    const snap = await getDocs(collection(db, 'user_devices'));
    snap.forEach(async (docSnap) => {
      const data = docSnap.data();
      if (data.endpoint === endpoint || data.subscription?.endpoint === endpoint) {
        await updateDoc(doc(db, 'user_devices', docSnap.id), {
          active: false,
          updatedAt: new Date().toISOString()
        }).catch(() => null);
      }
    });
  } catch (err) {
    console.warn('[AndradeAgro PushEngine] Warning deactivating in Firestore:', err);
  }
}

export async function parseRequestBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  if (req.readableEnded || req.complete) {
    return {};
  }

  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    }, 1500);

    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      clearTimeout(timer);
      resolve({});
    });
  });
}

export function handleCors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJson(res: any, statusCode: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function registerDevice(params: {
  userId: string;
  userName?: string;
  userRole?: string;
  subscription: any;
  deviceInfo?: any;
}): Promise<PushDeviceRecord> {
  loadStore();
  const { userId, userName, userRole, subscription, deviceInfo } = params;
  const endpoint = subscription?.endpoint || '';
  const cleanHash = endpoint.slice(-16).replace(/[^a-zA-Z0-9]/g, '');
  const id = `dev-${userId}-${cleanHash || Date.now()}`;

  const existingIdx = inMemoryStore.devices.findIndex(
    d => d.subscription && d.subscription.endpoint === endpoint
  );

  const record: PushDeviceRecord = {
    id: existingIdx >= 0 ? inMemoryStore.devices[existingIdx].id : id,
    userId,
    userName: userName || 'Usuário',
    userRole: userRole || 'FUNCIONARIO',
    endpoint,
    subscription,
    deviceInfo: deviceInfo || {},
    active: true,
    updatedAt: new Date().toISOString(),
    createdAt: existingIdx >= 0 ? inMemoryStore.devices[existingIdx].createdAt : new Date().toISOString()
  };

  if (existingIdx >= 0) {
    inMemoryStore.devices[existingIdx] = record;
  } else {
    inMemoryStore.devices.unshift(record);
  }
  saveStore();

  // Sync to Firestore
  try {
    const { app, db } = getFirebase();
    const auth = getAuth(app);
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => null);
    }
    await setDoc(doc(db, 'user_devices', record.id), record, { merge: true });
  } catch (fsErr) {
    console.warn('[AndradeAgro PushEngine] Warning syncing to Firestore:', fsErr);
  }

  return record;
}

export async function unregisterDevice(params: { endpoint?: string; userId?: string }): Promise<boolean> {
  const { endpoint, userId } = params;
  if (endpoint) {
    await deactivateEndpointEverywhere(endpoint);
  } else if (userId) {
    loadStore();
    for (const d of inMemoryStore.devices) {
      if (d.userId === userId && d.endpoint) {
        await deactivateEndpointEverywhere(d.endpoint);
      }
    }
  }
  return true;
}

export async function getDevicesList(): Promise<any[]> {
  const devices = await fetchAllActiveDevices();
  return devices.map(d => ({
    id: d.id,
    userId: d.userId,
    userName: d.userName,
    userRole: d.userRole,
    active: d.active !== false,
    deviceInfo: d.deviceInfo || {},
    updatedAt: d.updatedAt,
    createdAt: d.createdAt,
    endpointPreview: d.endpoint ? `${d.endpoint.slice(0, 35)}...` : 'N/A'
  }));
}

export async function getEngineStatus(): Promise<any> {
  const devices = await fetchAllActiveDevices();
  const activeValid = devices.filter(
    d => d.active !== false && d.subscription && isValidPushSubscription(d.subscription)
  );

  return {
    success: !lastFirestoreQueryError || devices.length > 0,
    querySuccess: !lastFirestoreQueryError,
    queryError: lastFirestoreQueryError || undefined,
    vapidConfigured: true,
    vapidPublicKey: VAPID_PUBLIC_KEY,
    totalDevices: devices.length,
    activeAuthorizedCount: activeValid.length,
    authorizedDevices: activeValid.map(d => ({
      userName: d.userName,
      userRole: d.userRole,
      platform: d.deviceInfo?.platform || 'desconhecido',
      updatedAt: d.updatedAt
    }))
  };
}

export function resetEventDeduplication(params: { prefix?: string; eventId?: string }): {
  removedCount: number;
  remainingCount: number;
} {
  loadStore();
  const { prefix, eventId } = params;
  const beforeCount = inMemoryStore.processedEvents.length;

  if (eventId) {
    inMemoryStore.processedEvents = inMemoryStore.processedEvents.filter(id => id !== eventId);
  } else if (prefix) {
    inMemoryStore.processedEvents = inMemoryStore.processedEvents.filter(id => !id.startsWith(prefix));
  } else {
    inMemoryStore.processedEvents = [];
  }

  saveStore();
  return {
    removedCount: beforeCount - inMemoryStore.processedEvents.length,
    remainingCount: inMemoryStore.processedEvents.length
  };
}

export async function dispatchPushToAuthorizedUsers(event: {
  eventType: 'NEW_ISSUE' | 'NEW_MAINTENANCE' | 'OIL_CHANGE_DUE' | 'TEST';
  eventId: string;
  equipmentName: string;
  description: string;
  equipmentId?: string;
  targetUserId?: string;
  customTitle?: string;
  directSubscription?: any;
  directUserName?: string;
  directUserRole?: string;
}): Promise<{
  success: boolean;
  duplicate?: boolean;
  sentCount: number;
  failedCount?: number;
  recipientsCount?: number;
  errors?: string[];
  stage?: string;
  diagnostics?: any;
  message: string;
}> {
  const {
    eventType,
    eventId,
    equipmentName,
    description,
    equipmentId,
    targetUserId,
    customTitle,
    directSubscription,
    directUserName,
    directUserRole
  } = event;

  // ETAPA 1: Request chegou à Function?
  console.log(`[AndradeAgro PushEngine] [ETAPA 1/6] Requisição de disparo recebida: EventType=${eventType}, EventId=${eventId}, Alvo=${targetUserId || 'TODOS'}, Operador=${directUserName || 'N/A'}`);

  // ETAPA 2: Variáveis necessárias estão disponíveis? (Sem imprimir segredos)
  const hasVapidPublic = Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 20);
  const hasVapidPrivate = Boolean(VAPID_PRIVATE_KEY && VAPID_PRIVATE_KEY.length > 20);
  const hasVapidSubject = Boolean(VAPID_SUBJECT && VAPID_SUBJECT.length > 5);
  const hasFirebaseCreds = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

  console.log('[AndradeAgro PushEngine] [ETAPA 2/6] Auditoria de variáveis de ambiente:');
  console.log(`  - VAPID_PUBLIC_KEY: ${hasVapidPublic ? 'PRESENTE' : 'AUSENTE'}`);
  console.log(`  - VAPID_PRIVATE_KEY: ${hasVapidPrivate ? 'PRESENTE' : 'AUSENTE'}`);
  console.log(`  - VAPID_SUBJECT: ${hasVapidSubject ? 'PRESENTE' : 'AUSENTE'}`);
  console.log(`  - Firebase credentials: ${hasFirebaseCreds ? 'PRESENTE' : 'AUSENTE'}`);

  if (!hasVapidPrivate || !hasVapidPublic) {
    const varError = `Configuração VAPID incompleta (VAPID_PUBLIC_KEY: ${hasVapidPublic ? 'PRESENTE' : 'AUSENTE'}, VAPID_PRIVATE_KEY: ${hasVapidPrivate ? 'PRESENTE' : 'AUSENTE'})`;
    console.error(`[AndradeAgro PushEngine] [ETAPA 6/6] ERRO TÉCNICO: ${varError}`);
    return {
      success: false,
      duplicate: false,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: 0,
      stage: 'variaveis_ambiente',
      errors: [varError],
      diagnostics: {
        etapa1_requestReceived: true,
        etapa2_envVars: {
          vapidPublicKey: hasVapidPublic ? 'PRESENTE' : 'AUSENTE',
          vapidPrivateKey: hasVapidPrivate ? 'PRESENTE' : 'AUSENTE',
          vapidSubject: hasVapidSubject ? 'PRESENTE' : 'AUSENTE',
          firebaseCredentials: hasFirebaseCreds ? 'PRESENTE' : 'AUSENTE'
        },
        etapa6_technicalError: varError
      },
      message: `Erro na ETAPA 2: ${varError}`
    };
  }

  // Deduplication check
  loadStore();
  if (inMemoryStore.processedEvents.includes(eventId)) {
    console.log(`[AndradeAgro PushEngine] Evento ${eventId} já processado anteriormente. Descartando duplicata.`);
    return {
      success: false,
      duplicate: true,
      sentCount: 0,
      stage: 'inicio',
      message: 'Evento duplicado já processado anteriormente.'
    };
  }

  inMemoryStore.processedEvents.push(eventId);
  if (inMemoryStore.processedEvents.length > 500) {
    inMemoryStore.processedEvents = inMemoryStore.processedEvents.slice(-500);
  }
  saveStore();

  let title = customTitle || '⚠️ Notificação AndradeAgro';
  let url = '/';

  if (eventType === 'NEW_ISSUE') {
    title = customTitle || '⚠️ Novo problema registrado';
    url = `/?tab=alerts&issueId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'NEW_MAINTENANCE') {
    title = customTitle || '🔧 Nova manutenção registrada';
    url = `/?tab=maintenance&maintenanceId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'OIL_CHANGE_DUE') {
    title = customTitle || '⚠️ Troca de óleo pendente';
    url = `/?tab=maintenance&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'TEST') {
    title = customTitle || 'Teste AndradeAgro';
    url = '/?tab=settings';
  }

  const notificationBody = eventType === 'TEST'
    ? (description || 'Notificações Push funcionando.')
    : eventType === 'OIL_CHANGE_DUE'
      ? (description || `O veículo ${equipmentName} precisa de atenção para troca de óleo.`)
      : `${equipmentName}\n${description}`.trim();

  const payload = JSON.stringify({
    title,
    body: notificationBody,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `andradeagro-${eventType.toLowerCase()}-${eventId}`,
    data: {
      url,
      eventId,
      eventType,
      equipmentId: equipmentId || '',
      timestamp: new Date().toISOString()
    }
  });

  // ETAPA 3: Firestore/dispositivos foram encontrados? Quantidade encontrada.
  const allDevices = await fetchAllActiveDevices();
  console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total bruto de dispositivos ativos no repositório: ${allDevices.length}`);

  // Se uma subscrição direta do cliente foi enviada junto com o teste, assegurar presença
  if (directSubscription && isValidPushSubscription(directSubscription)) {
    const existing = allDevices.find(d => d.subscription && d.subscription.endpoint === directSubscription.endpoint);
    if (!existing) {
      allDevices.unshift({
        id: `dev-${targetUserId || 'direct'}-${Date.now()}`,
        userId: targetUserId || 'direct-test-user',
        userName: directUserName || 'Usuário Atual',
        userRole: directUserRole || 'USUARIO',
        endpoint: directSubscription.endpoint,
        subscription: directSubscription,
        active: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Dispositivo do navegador atual incluído diretamente via payload: ${directUserName || 'Operador'}`);
    }
  }

  // Filtragem e validação dos destinatários
  const targets = allDevices.filter(d => {
    if (d.active === false) return false;
    if (!d.subscription || !d.subscription.endpoint) return false;
    if (!isValidPushSubscription(d.subscription)) {
      console.warn(`[AndradeAgro PushEngine] [ETAPA 3/6] Token inválido/expirado para ${d.userName}. Desativando.`);
      deactivateEndpointEverywhere(d.endpoint).catch(() => null);
      return false;
    }
    if (eventType !== 'TEST' && targetUserId) return d.userId === targetUserId;
    return true;
  });

  console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Destinatários elegíveis e validados para envio: ${targets.length} dispositivo(s).`);

  if (targets.length === 0) {
    const isQueryFailure = Boolean(lastFirestoreQueryError && allDevices.length === 0);
    const noDevicesMsg = isQueryFailure
      ? `Falha ao consultar dispositivos no Firestore: ${lastFirestoreQueryError}`
      : 'Nenhum dispositivo registrado com permissão ativa e credenciais válidas encontrado no servidor.';
    console.warn(`[AndradeAgro PushEngine] [ETAPA 6/6] ${isQueryFailure ? 'ERRO NA CONSULTA' : 'NENHUM DISPOSITIVO'}: ${noDevicesMsg}`);
    return {
      success: false,
      duplicate: false,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: 0,
      stage: isQueryFailure ? 'consulta_firestore' : 'busca_dispositivos',
      errors: [noDevicesMsg],
      diagnostics: {
        etapa1_requestReceived: true,
        etapa2_envVars: {
          vapidPublicKey: 'PRESENTE',
          vapidPrivateKey: 'PRESENTE',
          vapidSubject: 'PRESENTE',
          firebaseCredentials: hasFirebaseCreds ? 'PRESENTE' : 'AUSENTE'
        },
        etapa3_devicesFound: allDevices.length,
        etapa3_validTargets: 0,
        etapa6_technicalError: noDevicesMsg
      },
      message: noDevicesMsg
    };
  }

  // ETAPA 4: Tentativa de envio iniciada?
  console.log(`[AndradeAgro PushEngine] [ETAPA 4/6] Tentativa de envio iniciada para ${targets.length} dispositivo(s). Assunto: "${title}"`);

  let sentCount = 0;
  let failedCount = 0;
  const invalidEndpoints: string[] = [];
  const errors: string[] = [];

  const vapidOptions = {
    vapidDetails: {
      subject: VAPID_SUBJECT,
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY
    },
    TTL: 86400
  };

  // Disparo para os serviços Push (ETAPA 5)
  await Promise.all(
    targets.map(async (device) => {
      try {
        const pushRes = await webpush.sendNotification(device.subscription as any, payload, vapidOptions);
        sentCount++;
        console.log(`[AndradeAgro PushEngine] [ETAPA 5/6] Sucesso no envio para ${device.userName} (${device.deviceInfo?.platform || 'dispositivo'}) - Código HTTP ${pushRes?.statusCode || 201}`);
      } catch (err: any) {
        failedCount++;
        const statusCode = err?.statusCode || 'ERR';
        const msg = err?.body || err?.message || 'Falha de comunicação com serviço push';
        const detail = `${device.userName}: Status ${statusCode} - ${msg}`;
        errors.push(detail);
        console.warn(`[AndradeAgro PushEngine] [ETAPA 5/6] Falha no envio para ${device.userName}: ${detail}`);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          invalidEndpoints.push(device.subscription.endpoint);
        }
      }
    })
  );

  // Limpeza de subscrições expiradas reportadas pelos serviços Push
  if (invalidEndpoints.length > 0) {
    for (const ep of invalidEndpoints) {
      await deactivateEndpointEverywhere(ep).catch(() => null);
    }
  }

  // ETAPA 6: Erro técnico real ou Sucesso registrado
  const isSuccess = sentCount > 0;
  if (!isSuccess) {
    console.error(`[AndradeAgro PushEngine] [ETAPA 6/6] ERRO TÉCNICO REAL: Nenhuma notificação entregue. Falhas: ${errors.join('; ')}`);
  } else {
    console.log(`[AndradeAgro PushEngine] [ETAPA 6/6] Concluído com êxito: ${sentCount} entregue(s) com sucesso.`);
  }

  return {
    success: isSuccess,
    duplicate: false,
    sentCount,
    failedCount,
    recipientsCount: targets.length,
    stage: isSuccess ? 'sucesso' : 'servico_push',
    errors: errors.length > 0 ? errors : undefined,
    diagnostics: {
      etapa1_requestReceived: true,
      etapa2_envVars: {
        vapidPublicKey: 'PRESENTE',
        vapidPrivateKey: 'PRESENTE',
        vapidSubject: 'PRESENTE',
        firebaseCredentials: hasFirebaseCreds ? 'PRESENTE' : 'AUSENTE'
      },
      etapa3_devicesFound: allDevices.length,
      etapa3_validTargets: targets.length,
      etapa4_dispatchAttempted: true,
      etapa5_pushResponded: true,
      etapa6_technicalStatus: isSuccess ? 'OK' : 'FALHA',
      etapa6_errors: errors
    },
    message: isSuccess
      ? `Notificação entregue com sucesso para ${sentCount} de ${targets.length} dispositivo(s).` + (failedCount > 0 ? ` (${failedCount} falha(s))` : '')
      : `Falha ao entregar push para ${failedCount} dispositivo(s): ${errors.join('; ')}`
  };
}
