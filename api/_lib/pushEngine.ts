import webpushLib from 'web-push';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

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

export const OFFICIAL_VAPID_PUBLIC_KEY = 'BGidTH8JXdHgg5XYTG-Z3iAJhCOVguQQf0B5iL-GMHJVXdnj_1JLv1bvtCG0GOCSBU-LqYL9dpUcCZaj_nV3H4s';

function cleanKey(k?: string): string {
  if (!k) return '';
  return k.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '').replace(/\r?\n/g, '').trim();
}

/**
 * Fallback para o banco persistente data/db.json (ambiente Google AI Studio)
 */
function loadFallbackDbKeys(): { publicKey?: string; privateKey?: string; subject?: string } {
  try {
    const candidates = [
      path.join(process.cwd(), 'data', 'db.json'),
      path.join('/tmp', 'andradeagro_db.json')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed?.andradeagro_vapid_keys) {
          return parsed.andradeagro_vapid_keys;
        }
      }
    }
  } catch {}
  return {};
}

const fallbackDbKeys = loadFallbackDbKeys();

// 1. Prioridade: Variáveis de ambiente (Vercel)
// 2. Fallback: data/db.json (Google AI Studio)
const VAPID_SUBJECT = 
  cleanKey(process.env.VAPID_SUBJECT) || 
  cleanKey(fallbackDbKeys.subject) || 
  'mailto:suporte@andradeagro.com.br';

const VAPID_PUBLIC_KEY = 
  cleanKey(process.env.VAPID_PUBLIC_KEY) || 
  cleanKey(process.env.VITE_VAPID_PUBLIC_KEY) || 
  cleanKey(fallbackDbKeys.publicKey) || 
  OFFICIAL_VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY = 
  cleanKey(process.env.VAPID_PRIVATE_KEY) || 
  cleanKey(process.env.PRIVATE_VAPID_KEY) || 
  cleanKey(fallbackDbKeys.privateKey);

export const OFFICIAL_VAPID_KEYS = {
  publicKey: VAPID_PUBLIC_KEY,
  privateKey: VAPID_PRIVATE_KEY
};

let vapidConfiguredSuccessfully = false;
let vapidConfigError: string | null = null;

try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfiguredSuccessfully = true;
    console.log('[AndradeAgro PushEngine] VAPID configurado com sucesso no servidor.');
  } else {
    vapidConfigError = 'Chaves VAPID incompletas (VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY ausentes)';
    console.warn('[AndradeAgro PushEngine] ' + vapidConfigError);
  }
} catch (e: any) {
  vapidConfigError = e?.message || String(e);
  console.error('[AndradeAgro PushEngine] Erro ao configurar VAPID:', vapidConfigError);
}

// Configurações gerais do Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "andrade-agro.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "andrade-agro",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "andrade-agro.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "271695349839",
  appId: process.env.FIREBASE_APP_ID || "1:271695349839:web:4428ed928e6423b9adc23a"
};

let adminDbInstance: Firestore | null = null;
let adminInitAttempted = false;
let lastFirestoreQueryError: string | null = null;
let cachedAuthToken: { token: string; expiresAt: number } | null = null;

/**
 * Inicialização segura e resiliente do Firebase Admin SDK.
 * Roda no ambiente Node.js / Serverless sem usar o SDK Web de cliente.
 */
export function getFirebaseAdminDb(): Firestore | null {
  if (adminDbInstance) return adminDbInstance;
  if (adminInitAttempted) return null;
  adminInitAttempted = true;

  try {
    const existingApps = getApps();
    if (existingApps && existingApps.length > 0 && existingApps[0]) {
      adminDbInstance = getFirestore(existingApps[0]);
      return adminDbInstance;
    }

    const projectId = firebaseConfig.projectId;

    // 1. Verificar se existe JSON de conta de serviço completo
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT;
    if (saEnv && typeof saEnv === 'string' && saEnv.trim().length > 10) {
      try {
        const sa = JSON.parse(saEnv.trim());
        const app = initializeApp({
          credential: cert(sa),
          projectId: sa.project_id || projectId
        }, 'andradeagro-admin-sa');
        adminDbInstance = getFirestore(app);
        console.log('[AndradeAgro PushEngine] Firebase Admin inicializado via FIREBASE_SERVICE_ACCOUNT.');
        return adminDbInstance;
      } catch (saErr: any) {
        console.warn('[AndradeAgro PushEngine] Falha ao analisar FIREBASE_SERVICE_ACCOUNT:', saErr?.message || saErr);
      }
    }

    // 2. Verificar se existem credenciais individuais (Client Email + Private Key)
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (clientEmail && rawPrivateKey) {
      try {
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n').trim();
        const app = initializeApp({
          credential: cert({
            projectId,
            clientEmail: clientEmail.trim(),
            privateKey
          }),
          projectId
        }, 'andradeagro-admin-keys');
        adminDbInstance = getFirestore(app);
        console.log('[AndradeAgro PushEngine] Firebase Admin inicializado via FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
        return adminDbInstance;
      } catch (keyErr: any) {
        console.warn('[AndradeAgro PushEngine] Falha ao inicializar Firebase Admin com chaves individuais:', keyErr?.message || keyErr);
      }
    }

    // 3. Fallback de credenciais de ambiente (GCP / ADC)
    try {
      const app = initializeApp({
        projectId
      }, 'andradeagro-admin-adc');
      adminDbInstance = getFirestore(app);
      console.log('[AndradeAgro PushEngine] Firebase Admin inicializado via Application Default Credentials.');
      return adminDbInstance;
    } catch {
      // Sem credenciais padrão disponíveis no ambiente atual
    }
  } catch (err: any) {
    console.warn('[AndradeAgro PushEngine] Firebase Admin não pôde ser inicializado:', err?.message || err);
  }

  return null;
}

export async function ensureEngineFirebaseAuth(): Promise<boolean> {
  // Retorna true se Firebase Admin está pronto ou se conseguimos obter token REST
  const adminDb = getFirebaseAdminDb();
  if (adminDb) return true;
  const token = await getFirebaseAuthToken();
  return Boolean(token);
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
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as any;
    if (data?.idToken) {
      const expiresIn = parseInt(data.expiresIn || '3600', 10);
      cachedAuthToken = {
        token: data.idToken,
        expiresAt: now + expiresIn * 1000
      };
      return data.idToken;
    }
  } catch (err: any) {
    // Timeout ou falha de rede ao buscar token de autenticação anônima
  }
  return null;
}

/**
 * Consulta de dispositivos via Firestore REST com timeout estrito
 */
async function fetchFirestoreDevicesRest(): Promise<{ devices: PushDeviceRecord[]; error?: string }> {
  try {
    const token = await getFirebaseAuthToken();
    if (!token) {
      return { devices: [], error: 'Não foi possível autenticar a sessão do Firebase REST para ler os dispositivos.' };
    }

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/user_devices?pageSize=100`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(firestoreUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const errMsg = `HTTP ${res.status}: ${errText.slice(0, 100)}`;
      console.warn(`[AndradeAgro PushEngine] Consulta REST do Firestore retornou ${errMsg}`);
      return { devices: [], error: errMsg };
    }

    const data = (await res.json()) as any;
    const docs = data.documents || [];

    const docMap = new Map<string, { record: PushDeviceRecord; timestamp: number; active: boolean }>();

    for (const rawDoc of docs) {
      const parsed = parseFirestoreDoc(rawDoc);
      if (parsed && parsed.subscription) {
        const endpoint = parsed.endpoint || parsed.subscription?.endpoint;
        if (endpoint && isValidPushSubscription(parsed.subscription)) {
          const docUpdatedAt = parsed.updatedAt || parsed.createdAt || '';
          const docTimestamp = docUpdatedAt ? new Date(docUpdatedAt).getTime() : 0;
          const existing = docMap.get(endpoint);

          if (!existing || docTimestamp >= existing.timestamp) {
            docMap.set(endpoint, {
              record: {
                id: parsed.id || rawDoc.name.split('/').pop(),
                userId: parsed.userId || '',
                userName: parsed.userName || 'Usuário',
                userRole: parsed.userRole || 'FUNCIONARIO',
                endpoint,
                subscription: parsed.subscription,
                deviceInfo: parsed.deviceInfo || {},
                active: parsed.active !== false,
                updatedAt: docUpdatedAt || new Date().toISOString(),
                createdAt: parsed.createdAt || new Date().toISOString()
              },
              timestamp: docTimestamp,
              active: parsed.active !== false
            });
          }
        }
      }
    }

    const records: PushDeviceRecord[] = Array.from(docMap.values())
      .filter(item => item.active)
      .map(item => item.record);

    return { devices: records };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Tempo limite esgotado ao consultar Firestore REST (timeout)' : err?.message || String(err);
    return { devices: [], error: msg };
  }
}

/**
 * Generate a deterministic, collision-resistant device ID based on the push subscription endpoint.
 * This guarantees idempotency: the same browser/endpoint always maps to the EXACT same Firestore document.
 */
export function getStableDeviceId(endpoint: string): string {
  if (!endpoint || typeof endpoint !== 'string') {
    return 'dev-unknown';
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < endpoint.length; i++) {
    h ^= endpoint.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hexHash = (h >>> 0).toString(16).padStart(8, '0');
  const cleanSuffix = endpoint.replace(/[^a-zA-Z0-9]/g, '').slice(-16);
  return `dev_${hexHash}_${cleanSuffix || 'sub'}`;
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

/**
 * Consulta de todos os dispositivos ativos com resiliência:
 * 1. Dispositivos locais em memória/disco
 * 2. Firebase Admin SDK (se credenciado) com timeout de 3.5s
 * 3. Firestore REST API com timeout de 3.5s
 * NUNCA utiliza Firebase Web SDK no servidor, evitando bloqueio do runtime.
 */
export async function fetchAllActiveDevices(): Promise<PushDeviceRecord[]> {
  loadStore();
  const deviceMap = new Map<string, PushDeviceRecord>();

  // 1. Dispositivos locais
  for (const d of inMemoryStore.devices) {
    if (d.endpoint && d.active !== false && isValidPushSubscription(d.subscription)) {
      deviceMap.set(d.endpoint, d);
    }
  }

  // 2. Consulta via Firebase Admin SDK
  lastFirestoreQueryError = null;
  const adminDb = getFirebaseAdminDb();
  if (adminDb) {
    try {
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Consultando Firestore via Firebase Admin SDK...`);
      const adminPromise = adminDb.collection('user_devices').get();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Firebase Admin (3500ms)')), 3500)
      );
      const snap = await Promise.race([adminPromise, timeoutPromise]);
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Firebase Admin retornou ${snap.size} documento(s) em 'user_devices'.`);
      
      const adminDocMap = new Map<string, { record: PushDeviceRecord; timestamp: number; active: boolean }>();

      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data && data.subscription) {
          const endpoint = data.endpoint || data.subscription?.endpoint;
          if (endpoint && isValidPushSubscription(data.subscription)) {
            const docUpdatedAt = data.updatedAt || data.createdAt || '';
            const docTimestamp = docUpdatedAt ? new Date(docUpdatedAt).getTime() : 0;
            const existing = adminDocMap.get(endpoint);

            if (!existing || docTimestamp >= existing.timestamp) {
              adminDocMap.set(endpoint, {
                record: {
                  id: docSnap.id,
                  userId: data.userId || '',
                  userName: data.userName || 'Usuário',
                  userRole: data.userRole || 'FUNCIONARIO',
                  endpoint,
                  subscription: data.subscription,
                  deviceInfo: data.deviceInfo || {},
                  active: data.active !== false,
                  updatedAt: docUpdatedAt || new Date().toISOString(),
                  createdAt: data.createdAt || new Date().toISOString()
                },
                timestamp: docTimestamp,
                active: data.active !== false
              });
            }
          }
        }
      });

      for (const item of adminDocMap.values()) {
        if (item.active) {
          deviceMap.set(item.record.endpoint, item.record);
        } else {
          deviceMap.delete(item.record.endpoint);
        }
      }

      const result = Array.from(deviceMap.values());
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total consolidado via Admin: ${result.length} dispositivo(s).`);
      return result;
    } catch (adminErr: any) {
      console.warn(`[AndradeAgro PushEngine] [ETAPA 3/6] Aviso na consulta do Firebase Admin:`, adminErr?.message || adminErr);
      lastFirestoreQueryError = adminErr?.message || 'Falha ao consultar Firebase Admin';
    }
  }

  // 3. Consulta via Firestore REST
  const restResult = await fetchFirestoreDevicesRest();
  if (restResult.devices && restResult.devices.length > 0) {
    for (const d of restResult.devices) {
      deviceMap.set(d.endpoint, d);
    }
    const result = Array.from(deviceMap.values());
    console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total consolidado via REST: ${result.length} dispositivo(s).`);
    return result;
  }

  if (restResult.error) {
    lastFirestoreQueryError = restResult.error;
    console.warn(`[AndradeAgro PushEngine] [ETAPA 3/6] Aviso na consulta REST do Firestore: ${restResult.error}`);
  }

  const result = Array.from(deviceMap.values());
  console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total consolidado de dispositivos ativos no repositório: ${result.length}`);
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

  // 2. Firebase Admin se disponível
  try {
    const adminDb = getFirebaseAdminDb();
    if (adminDb) {
      const stableId = getStableDeviceId(endpoint);
      const snap = await adminDb.collection('user_devices').where('endpoint', '==', endpoint).get();
      const batch = adminDb.batch();
      let updatedStable = false;
      snap.forEach((docSnap) => {
        if (docSnap.id === stableId) updatedStable = true;
        batch.update(docSnap.ref, { active: false, updatedAt: new Date().toISOString() });
      });
      if (!updatedStable) {
        batch.set(adminDb.collection('user_devices').doc(stableId), {
          active: false,
          endpoint,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit().catch(() => null);
    }
  } catch (err: any) {
    console.warn('[AndradeAgro PushEngine] Warning deactivating in Firestore Admin:', err?.message || err);
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
  const stableId = getStableDeviceId(endpoint);

  const existingIdx = inMemoryStore.devices.findIndex(
    d => (d.subscription && d.subscription.endpoint === endpoint) || d.id === stableId
  );

  const record: PushDeviceRecord = {
    id: stableId,
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

  // Sync to Firestore via Admin SDK se disponível
  try {
    const adminDb = getFirebaseAdminDb();
    if (adminDb) {
      await adminDb.collection('user_devices').doc(record.id).set(record, { merge: true });
      console.log(`[AndradeAgro PushEngine] Dispositivo registrado via Firebase Admin: ${record.id}`);
    }
  } catch (fsErr: any) {
    console.warn('[AndradeAgro PushEngine] Warning syncing to Firestore Admin:', fsErr?.message || fsErr);
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

  const queryOk = devices.length > 0 || !lastFirestoreQueryError;

  return {
    success: queryOk,
    querySuccess: queryOk,
    queryError: devices.length === 0 && lastFirestoreQueryError ? lastFirestoreQueryError : undefined,
    vapidConfigured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
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

/**
 * Despacho principal de notificações Web Push para dispositivos autorizados.
 * Protegido contra bloqueios de runtime, com timeouts estritos e tratamento de erros.
 */
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

  // ETAPA 1: Request recebido no servidor
  console.log(`[AndradeAgro PushEngine] [ETAPA 1/6] Requisição de disparo recebida: EventType=${eventType}, EventId=${eventId}, Alvo=${targetUserId || 'TODOS'}, Operador=${directUserName || 'N/A'}`);

  // ETAPA 2: Auditoria de credenciais VAPID e Firebase
  const hasVapidPublic = Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 20);
  const hasVapidPrivate = Boolean(VAPID_PRIVATE_KEY && VAPID_PRIVATE_KEY.length > 20);
  const hasVapidSubject = Boolean(VAPID_SUBJECT && VAPID_SUBJECT.length > 5);
  const hasFirebaseAdmin = Boolean(getFirebaseAdminDb());
  const hasFirebaseCreds = Boolean(hasFirebaseAdmin || (firebaseConfig.apiKey && firebaseConfig.projectId));

  console.log('[AndradeAgro PushEngine] [ETAPA 2/6] Auditoria de variáveis de ambiente:');
  console.log(`  - VAPID_PUBLIC_KEY: ${hasVapidPublic ? 'PRESENTE' : 'AUSENTE'}`);
  console.log(`  - VAPID_PRIVATE_KEY: ${hasVapidPrivate ? 'PRESENTE' : 'AUSENTE'}`);
  console.log(`  - VAPID_SUBJECT: ${hasVapidSubject ? 'PRESENTE' : 'AUSENTE'}`);
  console.log(`  - Firebase Admin SDK: ${hasFirebaseAdmin ? 'INICIALIZADO' : 'NÃO CONFIGURADO (usando fallback)'}`);

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

  // ETAPA 3: Obter dispositivos elegíveis de forma rápida e segura
  const allDevices: PushDeviceRecord[] = [];

  // Se uma subscrição direta do cliente foi enviada junto com o payload (ex: botão "Testar notificação")
  // Adicionamos ela imediatamente à lista com prioridade máxima
  if (directSubscription && isValidPushSubscription(directSubscription)) {
    const directRecord: PushDeviceRecord = {
      id: getStableDeviceId(directSubscription.endpoint),
      userId: targetUserId || 'direct-test-user',
      userName: directUserName || 'Usuário Atual',
      userRole: directUserRole || 'ADMIN',
      endpoint: directSubscription.endpoint,
      subscription: directSubscription,
      active: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    allDevices.push(directRecord);
    console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Dispositivo direto incluído com prioridade: ${directUserName || 'Operador'}`);
  }

  // Se for TEST e já tivermos a subscrição direta do usuário que acionou o teste,
  // NÃO consultamos os outros dispositivos remotos do Firestore para que a resposta seja instantânea (< 800ms)
  // e totalmente imune ao timeout de 10s da Vercel!
  const isDirectTest = eventType === 'TEST' && allDevices.length > 0;

  if (!isDirectTest) {
    // Consulta do repositório/Firestore com timeout de proteção estrito (máximo 2500ms)
    try {
      const fetchPromise = fetchAllActiveDevices();
      const timeoutPromise = new Promise<PushDeviceRecord[]>((resolve) =>
        setTimeout(() => {
          console.warn('[AndradeAgro PushEngine] Timeout de segurança de 2500ms atingido na busca de dispositivos. Prosseguindo.');
          resolve([]);
        }, 2500)
      );
      const remoteDevices = await Promise.race([fetchPromise, timeoutPromise]);
      for (const d of remoteDevices) {
        if (!allDevices.some(existing => existing.endpoint === d.endpoint)) {
          allDevices.push(d);
        }
      }
    } catch (fetchErr: any) {
      console.warn('[AndradeAgro PushEngine] Aviso ao consultar dispositivos:', fetchErr?.message || fetchErr);
    }
  } else {
    console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Teste direto identificado. Pulando busca de terceiros para resposta instantânea (< 800ms).`);
  }

  console.log(`[AndradeAgro PushEngine] [ETAPA 3/6] Total consolidado de dispositivos elegíveis para este disparo: ${allDevices.length}`);

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

  // ETAPA 4: Tentativa de envio iniciada
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

  // Disparo para os serviços Push com timeout individual por dispositivo (máximo 3500ms)
  await Promise.all(
    targets.map(async (device) => {
      try {
        const sendPromise = webpush.sendNotification(device.subscription as any, payload, vapidOptions);
        const timeoutSend = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de 3500ms no envio push')), 3500)
        );
        const pushRes = await Promise.race([sendPromise, timeoutSend]);
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

  // ETAPA 6: Finalização técnica
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
