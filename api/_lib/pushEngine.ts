import webpushLib from 'web-push';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
type Firestore = any;
type App = any;

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

/**
 * Chave pública VAPID oficial do Firebase Console (Cloud Messaging -> Certificados de push da Web)
 */
export const OFFICIAL_VAPID_PUBLIC_KEY = 'BGk3AhmnXVavteh2WDsz5PLh4flo97VKKiLbTByKGeT7nSCgGrhm2LVdMgIpcYAt7Kih5zfOWJeJrev6h5mW6ig';

function cleanKey(k?: string): string {
  if (!k) return '';
  return k.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '').replace(/\r?\n/g, '').trim();
}

function normalizeBase64Url(str: string): string {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parsePrivKeyBuf(priv: string): Buffer {
  const clean = cleanKey(priv);
  try {
    const b = Buffer.from(clean.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (b.length === 32) return b;
  } catch {}
  return Buffer.from(clean, 'base64url');
}

export interface VapidKeyValidationResult {
  matches: boolean;
  publicKeyPrefix: string;
  privateKeyConfigured: boolean;
  derivedPublicKeyPrefix?: string;
  error?: string;
}

/**
 * Validação estrita do par criptográfico VAPID (RFC 8292) na curva P-256 (prime256v1).
 * Garante que a chave privada realmente pertence à chave pública ativa sem derrubar a aplicação.
 */
export function verifyVapidKeyPair(pubKey: string, privKey: string): VapidKeyValidationResult {
  const cleanPub = cleanKey(pubKey);
  const cleanPriv = cleanKey(privKey);
  const pubPrefix = cleanPub ? `${cleanPub.slice(0, 8)}...${cleanPub.slice(-6)}` : 'AUSENTE';

  if (!cleanPub) {
    return { matches: false, publicKeyPrefix: pubPrefix, privateKeyConfigured: false, error: 'Chave pública VAPID não informada.' };
  }
  if (!cleanPriv) {
    return { matches: false, publicKeyPrefix: pubPrefix, privateKeyConfigured: false, error: 'Chave privada VAPID ausente (variável VAPID_PRIVATE_KEY não configurada no ambiente).' };
  }
  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(parsePrivKeyBuf(cleanPriv));
    const derivedPub = ecdh.getPublicKey('base64url');
    const derivedPrefix = `${derivedPub.slice(0, 8)}...${derivedPub.slice(-6)}`;
    
    if (normalizeBase64Url(derivedPub) === normalizeBase64Url(cleanPub)) {
      return {
        matches: true,
        publicKeyPrefix: pubPrefix,
        privateKeyConfigured: true,
        derivedPublicKeyPrefix: derivedPrefix
      };
    } else {
      return {
        matches: false,
        publicKeyPrefix: pubPrefix,
        privateKeyConfigured: true,
        derivedPublicKeyPrefix: derivedPrefix,
        error: `Inconsistência de par VAPID: A chave pública configurada é a do Firebase (${pubPrefix}), porém a chave privada em execução no backend (VAPID_PRIVATE_KEY) deriva para (${derivedPrefix}). Se a variável VAPID_PRIVATE_KEY já foi salva no painel da Vercel, realize um 'Redeploy' no painel da Vercel para que as Serverless Functions recarreguem a nova chave.`
      };
    }
  } catch (err: any) {
    return {
      matches: false,
      publicKeyPrefix: pubPrefix,
      privateKeyConfigured: true,
      error: `Formato inválido na chave privada VAPID: ${err?.message || err}`
    };
  }
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
  return {
    publicKey: OFFICIAL_VAPID_PUBLIC_KEY,
    privateKey: '',
    subject: 'mailto:suporte@andradeagro.com.br'
  };
}

const fallbackDbKeys = loadFallbackDbKeys();

// 1. Prioridade: Variáveis de ambiente (Vercel)
// 2. Fallback: data/db.json (Google AI Studio)
export function getVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const fallback = loadFallbackDbKeys();
  const subject = cleanKey(process.env.VAPID_SUBJECT) || cleanKey(fallback.subject) || 'mailto:suporte@andradeagro.com.br';
  const publicKey = cleanKey(process.env.VAPID_PUBLIC_KEY) || 
                    cleanKey(process.env.VITE_VAPID_PUBLIC_KEY) || 
                    cleanKey(fallback.publicKey) || 
                    OFFICIAL_VAPID_PUBLIC_KEY;

  const envPrivate = cleanKey(process.env.VAPID_PRIVATE_KEY) || cleanKey(process.env.PRIVATE_VAPID_KEY);
  const dbPrivate = cleanKey(fallback.privateKey);

  let chosenPrivate = envPrivate || dbPrivate || '';

  // Se a chave privada do ambiente não confere com a pública do Firebase, mas a do db.json confere, utiliza a do db.json
  if (envPrivate && dbPrivate) {
    const envCheck = verifyVapidKeyPair(publicKey, envPrivate);
    if (!envCheck.matches) {
      const dbCheck = verifyVapidKeyPair(publicKey, dbPrivate);
      if (dbCheck.matches) {
        chosenPrivate = dbPrivate;
      }
    }
  }

  return { publicKey, privateKey: chosenPrivate, subject };
}

let vapidConfiguredSuccessfully = false;
let vapidConfigError: string | null = null;

export function ensureVapidConfigured(): {
  configured: boolean;
  error?: string;
  publicKeyPrefix: string;
  privateKeyConfigured: boolean;
} {
  const { publicKey, privateKey, subject } = getVapidKeys();
  const check = verifyVapidKeyPair(publicKey, privateKey);
  if (check.matches) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfiguredSuccessfully = true;
      vapidConfigError = null;
      return { configured: true, publicKeyPrefix: check.publicKeyPrefix, privateKeyConfigured: true };
    } catch (e: any) {
      vapidConfiguredSuccessfully = false;
      vapidConfigError = e?.message || String(e);
      return { configured: false, error: vapidConfigError, publicKeyPrefix: check.publicKeyPrefix, privateKeyConfigured: true };
    }
  } else {
    vapidConfiguredSuccessfully = false;
    vapidConfigError = check.error || 'Par de chaves VAPID inválido';
    return { configured: false, error: vapidConfigError, publicKeyPrefix: check.publicKeyPrefix, privateKeyConfigured: check.privateKeyConfigured };
  }
}

// Inicialização imediata com verificação defensiva
ensureVapidConfigured();

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

export interface FirebaseAdminDiagnostics {
  configured: boolean;
  source: 'SERVICE_ACCOUNT_JSON' | 'CLIENT_KEYS' | 'EXISTING_APP' | 'NONE';
  projectId: boolean;
  clientEmail: boolean;
  privateKey: boolean;
}

export function getFirebaseAdminDiagnostics(): FirebaseAdminDiagnostics {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_CREDENTIALS;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

  if (adminDbInstance) {
    return {
      configured: true,
      source: saEnv ? 'SERVICE_ACCOUNT_JSON' : (clientEmail && rawPrivateKey ? 'CLIENT_KEYS' : 'EXISTING_APP'),
      projectId: Boolean(projectId),
      clientEmail: Boolean(clientEmail || saEnv),
      privateKey: Boolean(rawPrivateKey || saEnv)
    };
  }

  return {
    configured: false,
    source: 'NONE',
    projectId: Boolean(projectId),
    clientEmail: Boolean(clientEmail || saEnv),
    privateKey: Boolean(rawPrivateKey || saEnv)
  };
}

/**
 * Inicialização segura e resiliente do Firebase Admin SDK.
 * Roda no ambiente Node.js / Serverless sem usar o SDK Web de cliente.
 * NUNCA recorre a Application Default Credentials (ADC) cego sem Service Account,
 * prevenindo o timeout de 10 segundos da Vercel/AWS Lambda.
 */
export function getFirebaseAdminDb(): Firestore | null {
  if (adminDbInstance) return adminDbInstance;
  if (adminInitAttempted) return null;
  adminInitAttempted = true;

  try {
    const projectId = (process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || '').trim();
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT || process.env.FIREBASE_CREDENTIALS;
    const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '').trim();
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '';

    // Se NÃO houver credenciais explícitas de conta de serviço, NUNCA tenta carregar firebase-admin (evita crash na Vercel)
    if (!saEnv && (!clientEmail || !rawPrivateKey)) {
      console.log('[AndradeAgro PushEngine] Firebase Admin: Nenhuma credencial explícita de Service Account fornecida. Utilizando fallback direto.');
      return null;
    }

    const { initializeApp, getApps, cert } = nodeRequire('firebase-admin/app');
    const { getFirestore } = nodeRequire('firebase-admin/firestore');

    const existingApps = getApps();
    if (existingApps && existingApps.length > 0 && existingApps[0]) {
      adminDbInstance = getFirestore(existingApps[0]);
      console.log('[AndradeAgro PushEngine] Firebase Admin reutilizado a partir de App existente.');
      return adminDbInstance;
    }

    // 1. Verificar se existe JSON de conta de serviço completo (JSON puro ou Base64)
    if (saEnv && typeof saEnv === 'string' && saEnv.trim().length > 10) {
      try {
        let cleanSa = saEnv.trim();
        if (!cleanSa.startsWith('{')) {
          try {
            cleanSa = Buffer.from(cleanSa, 'base64').toString('utf-8');
          } catch {}
        }
        const sa = JSON.parse(cleanSa);
        const app = initializeApp({
          credential: cert(sa),
          projectId: sa.project_id || projectId
        }, 'andradeagro-admin-sa');
        adminDbInstance = getFirestore(app);
        console.log('[AndradeAgro PushEngine] Firebase Admin inicializado via Service Account JSON.');
        return adminDbInstance;
      } catch (saErr: any) {
        console.warn('[AndradeAgro PushEngine] Falha ao analisar FIREBASE_SERVICE_ACCOUNT:', saErr?.message || saErr);
      }
    }

    // 2. Verificar se existem credenciais individuais explícitas (Client Email + Private Key)
    if (clientEmail && rawPrivateKey && rawPrivateKey.trim().length > 20) {
      try {
        let privateKey = rawPrivateKey.trim();
        // Remove aspas adicionais caso injetadas no painel da Vercel
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
          privateKey = privateKey.slice(1, -1);
        }
        // Converte quebras de linha literais (\n) para quebras reais de certificado PEM
        privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

        const app = initializeApp({
          credential: cert({
            projectId: projectId || 'andrade-agro',
            clientEmail,
            privateKey
          }),
          projectId: projectId || 'andrade-agro'
        }, 'andradeagro-admin-keys');
        adminDbInstance = getFirestore(app);
        console.log('[AndradeAgro PushEngine] Firebase Admin inicializado com sucesso via FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.');
        return adminDbInstance;
      } catch (keyErr: any) {
        console.warn('[AndradeAgro PushEngine] Falha ao inicializar Firebase Admin com chaves individuais:', keyErr?.message || keyErr);
      }
    }

    // 3. NÃO tentar ADC cego (Application Default Credentials) na Vercel/AWS.
    // Na Vercel, ADC busca o servidor de metadados da GCP (169.254.169.254),
    // que é inalcançável e causa o congelamento de 10s e encerramento forçado pela Vercel ("A server error has occurred").
    console.log('[AndradeAgro PushEngine] Firebase Admin: Nenhuma credencial explícita de Service Account fornecida. ADC desabilitado preventivamente para eliminar risco de timeout na Vercel. Utilizando fallback direto.');
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

export interface ActiveAuthorizedDevicesResult {
  activeDevices: PushDeviceRecord[];
  totalDevices: number;
  querySuccess: boolean;
  queryError?: string;
  source: 'FIREBASE_ADMIN' | 'FIRESTORE_REST' | 'LOCAL_STORE';
}

/**
 * FONTE ÚNICA DA REGRA DE NEGÓCIO PARA DISPOSITIVOS ATIVOS E AUTORIZADOS
 * Regra unificada para AI Studio e Vercel:
 *  - Mesmo projeto Firebase (andrade-agro)
 *  - Mesma coleção 'user_devices'
 *  - Mesma estrutura de dados
 *  - Mesmos critérios de dispositivos ativos/autorizados
 *  - Identificação estável e deduplicação estrita por endpoint de subscription
 */
export async function getActiveAuthorizedDevices(options?: {
  targetUserId?: string;
  directSubscription?: any;
  directUserName?: string;
  directUserRole?: string;
}): Promise<ActiveAuthorizedDevicesResult> {
  loadStore();
  const endpointMap = new Map<string, { record: PushDeviceRecord; timestamp: number; active: boolean }>();
  let source: 'FIREBASE_ADMIN' | 'FIRESTORE_REST' | 'LOCAL_STORE' = 'LOCAL_STORE';
  let querySuccess = false;
  let queryError: string | undefined = undefined;

  // 1. Prioridade: Firebase Admin SDK (Produção Vercel / Servidor com credencial de Service Account)
  lastFirestoreQueryError = null;
  const adminDb = getFirebaseAdminDb();
  if (adminDb) {
    try {
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/10] Firestore acessado via Firebase Admin: Projeto "${firebaseConfig.projectId}", Coleção "user_devices"`);
      console.log(`[AndradeAgro PushEngine] [ETAPA 4/10] user_devices consultado via Admin SDK...`);
      const adminPromise = adminDb.collection('user_devices').get();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout Firebase Admin (3500ms)')), 3500)
      );
      const snap = await Promise.race([adminPromise, timeoutPromise]);
      querySuccess = true;
      source = 'FIREBASE_ADMIN';
      console.log(`[AndradeAgro PushEngine] [ETAPA 4/10] Firebase Admin retornou ${snap.size} documento(s) brutos em 'user_devices'.`);

      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data && data.subscription) {
          const endpoint = data.endpoint || data.subscription?.endpoint;
          if (endpoint && isValidPushSubscription(data.subscription)) {
            const docUpdatedAt = data.updatedAt || data.createdAt || '';
            const docTimestamp = docUpdatedAt ? new Date(docUpdatedAt).getTime() : 0;
            const existing = endpointMap.get(endpoint);

            if (!existing || docTimestamp >= existing.timestamp) {
              endpointMap.set(endpoint, {
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
    } catch (adminErr: any) {
      queryError = adminErr?.message || 'Falha ao consultar Firebase Admin';
      lastFirestoreQueryError = queryError;
      console.warn(`[AndradeAgro PushEngine] [ETAPA 4/10] Aviso na consulta do Firebase Admin:`, queryError);
    }
  }

  // 2. Fallback: Consulta via Firestore REST API (caso Admin não esteja credenciado no ambiente)
  if (!querySuccess) {
    console.log(`[AndradeAgro PushEngine] [ETAPA 3/10] Firestore acessado via REST API: Projeto "${firebaseConfig.projectId}", Coleção "user_devices"`);
    console.log(`[AndradeAgro PushEngine] [ETAPA 4/10] user_devices consultado via Firestore REST...`);
    const restResult = await fetchFirestoreDevicesRest();
    if (restResult.devices && restResult.devices.length > 0) {
      querySuccess = true;
      source = 'FIRESTORE_REST';
      for (const d of restResult.devices) {
        const docTimestamp = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
        const existing = endpointMap.get(d.endpoint);
        if (!existing || docTimestamp >= existing.timestamp) {
          endpointMap.set(d.endpoint, {
            record: d,
            timestamp: docTimestamp,
            active: d.active !== false
          });
        }
      }
    } else if (restResult.error) {
      queryError = restResult.error;
      lastFirestoreQueryError = restResult.error;
    }
  }

  // 3. Fallback: Base persistente local em memória/disco
  if (endpointMap.size === 0 && inMemoryStore.devices.length > 0) {
    source = 'LOCAL_STORE';
    for (const d of inMemoryStore.devices) {
      if (d.endpoint && isValidPushSubscription(d.subscription)) {
        const docTimestamp = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
        const existing = endpointMap.get(d.endpoint);
        if (!existing || docTimestamp >= existing.timestamp) {
          endpointMap.set(d.endpoint, {
            record: d,
            timestamp: docTimestamp,
            active: d.active !== false
          });
        }
      }
    }
    if (!querySuccess && inMemoryStore.devices.length > 0) {
      querySuccess = true;
    }
  }

  // 4. Se uma subscrição direta do cliente foi enviada na chamada (ex: botão de teste no painel)
  if (options?.directSubscription && isValidPushSubscription(options.directSubscription)) {
    const directEp = options.directSubscription.endpoint;
    const directId = getStableDeviceId(directEp);
    endpointMap.set(directEp, {
      record: {
        id: directId,
        userId: options.targetUserId || 'direct-user',
        userName: options.directUserName || 'Usuário Atual',
        userRole: options.directUserRole || 'ADMIN',
        endpoint: directEp,
        subscription: options.directSubscription,
        active: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      timestamp: Date.now(),
      active: true
    });
    querySuccess = true;
  }

  const allConsolidated = Array.from(endpointMap.values());
  const totalDevices = allConsolidated.length;

  // Filtragem da Regra de Negócio:
  // - Apenas dispositivos com active !== false
  // - Apenas subscrições válidas com endpoint https://
  // - Filtragem por targetUserId se solicitado
  const activeDevices = allConsolidated
    .filter(item => item.active && item.record.active !== false)
    .map(item => item.record)
    .filter(d => {
      if (!isValidPushSubscription(d.subscription)) return false;
      if (options?.targetUserId && d.userId !== options.targetUserId) return false;
      return true;
    });

  console.log(`[AndradeAgro PushEngine] [ETAPA 5/10] Dispositivos encontrados: ${activeDevices.length} ativo(s) e elegível(eis) de ${totalDevices} total(is) analisados (Fonte: ${source}).`);

  return {
    activeDevices,
    totalDevices,
    querySuccess,
    queryError,
    source
  };
}

/**
 * Consulta de todos os dispositivos ativos mantida para compatibilidade retroativa
 */
export async function fetchAllActiveDevices(): Promise<PushDeviceRecord[]> {
  const result = await getActiveAuthorizedDevices();
  return result.activeDevices;
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
  return getVapidKeys().publicKey;
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
  const result = await getActiveAuthorizedDevices();
  const queryOk = result.querySuccess;
  const vapidState = ensureVapidConfigured();
  const { publicKey } = getVapidKeys();

  return {
    success: queryOk,
    querySuccess: queryOk,
    queryError: !queryOk && result.queryError ? result.queryError : undefined,
    vapidConfigured: vapidState.configured,
    vapidKeyPairMatches: vapidState.configured,
    vapidPublicKeyPrefix: vapidState.publicKeyPrefix,
    vapidPrivateKeyConfigured: vapidState.privateKeyConfigured,
    vapidError: !vapidState.configured ? vapidState.error : undefined,
    vapidPublicKey: publicKey,
    firebaseAdmin: getFirebaseAdminDiagnostics(),
    totalDevices: result.totalDevices,
    activeAuthorizedCount: result.activeDevices.length,
    authorizedDevices: result.activeDevices.map(d => ({
      userName: d.userName,
      userRole: d.userRole,
      platform: d.deviceInfo?.platform || 'desconhecido',
      updatedAt: d.updatedAt
    })),
    source: result.source
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

  // [ETAPA 1/10] Requisição recebida
  console.log(`[AndradeAgro PushEngine] [ETAPA 1/10] Requisição de disparo recebida: EventType=${eventType}, EventId=${eventId}, Alvo=${targetUserId || 'TODOS'}, Operador=${directUserName || 'N/A'}`);

  // [ETAPA 2/10] Firebase Admin inicializado / verificado
  const adminDb = getFirebaseAdminDb();
  const hasFirebaseAdmin = Boolean(adminDb);
  const hasFirebaseCreds = Boolean(hasFirebaseAdmin || (firebaseConfig.apiKey && firebaseConfig.projectId));
  console.log(`[AndradeAgro PushEngine] [ETAPA 2/10] Firebase Admin status: ${hasFirebaseAdmin ? 'INICIALIZADO (Service Account)' : 'NÃO INICIALIZADO (modo fallback)'}`);

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

  // [ETAPA 3, 4, 5] Firestore acessado, user_devices consultado, dispositivos encontrados
  // UNIFICADO: Utiliza a mesma função getActiveAuthorizedDevices()
  const devicesResult = await getActiveAuthorizedDevices({
    targetUserId: eventType !== 'TEST' ? targetUserId : undefined,
    directSubscription,
    directUserName,
    directUserRole
  });

  const targets = devicesResult.activeDevices;
  console.log(`[AndradeAgro PushEngine] [ETAPA 5/10] Dispositivos encontrados: ${targets.length} ativo(s) e elegível(eis) de ${devicesResult.totalDevices} total(is).`);

  if (targets.length === 0) {
    const noDevicesMsg = !devicesResult.querySuccess && devicesResult.queryError
      ? `Falha ao consultar dispositivos no Firestore: ${devicesResult.queryError}`
      : 'Nenhum dispositivo registrado com permissão ativa e credenciais válidas encontrado no servidor.';
    console.warn(`[AndradeAgro PushEngine] [ETAPA 5/10] Aviso: ${noDevicesMsg}`);
    return {
      success: false,
      duplicate: false,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: 0,
      stage: 'busca_dispositivos',
      errors: [noDevicesMsg],
      message: noDevicesMsg
    };
  }

  // [ETAPA 6/10] VAPID carregado e verificado criptograficamente
  const vapidState = ensureVapidConfigured();
  const { publicKey, privateKey, subject } = getVapidKeys();
  console.log(`[AndradeAgro PushEngine] [ETAPA 6/10] VAPID checado: Par confere=${vapidState.configured}, Chave Pública=${vapidState.publicKeyPrefix}, Privada presente=${vapidState.privateKeyConfigured}`);

  if (!vapidState.configured) {
    const keyError = vapidState.error || 'Configuração VAPID incompleta ou divergente';
    console.warn(`[AndradeAgro PushEngine] [ETAPA 6/10] AVISO TÉCNICO VAPID: ${keyError}`);
    return {
      success: false,
      duplicate: false,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: targets.length,
      stage: 'validacao_chaves',
      errors: [keyError],
      message: keyError
    };
  }

  // [ETAPA 7/10] web-push inicializado
  const vapidOptions = {
    vapidDetails: {
      subject,
      publicKey,
      privateKey
    },
    TTL: 86400
  };
  console.log(`[AndradeAgro PushEngine] [ETAPA 7/10] web-push inicializado com opções VAPID prontas.`);

  // [ETAPA 8/10] Envio iniciado
  console.log(`[AndradeAgro PushEngine] [ETAPA 8/10] Envio iniciado para ${targets.length} dispositivo(s). Assunto: "${title}"`);

  let sentCount = 0;
  let failedCount = 0;
  const invalidEndpoints: string[] = [];
  const errors: string[] = [];

  await Promise.all(
    targets.map(async (device) => {
      try {
        const sendPromise = webpush.sendNotification(device.subscription as any, payload, vapidOptions);
        const timeoutSend = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de 3500ms no envio push')), 3500)
        );
        const pushRes = await Promise.race([sendPromise, timeoutSend]);
        sentCount++;
        console.log(`[AndradeAgro PushEngine] [ETAPA 8/10] Sucesso no envio para ${device.userName} (${device.deviceInfo?.platform || 'dispositivo'}) - HTTP ${pushRes?.statusCode || 201}`);
      } catch (err: any) {
        failedCount++;
        const statusCode = err?.statusCode || 'ERR';
        const msg = err?.body || err?.message || 'Falha de comunicação com serviço push';
        const detail = `${device.userName}: Status ${statusCode} - ${msg}`;
        errors.push(detail);
        console.warn(`[AndradeAgro PushEngine] [ETAPA 8/10] Falha no envio para ${device.userName}: ${detail}`);
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

  // [ETAPA 9/10] Envio concluído
  const isSuccess = sentCount > 0;
  console.log(`[AndradeAgro PushEngine] [ETAPA 9/10] Envio concluído: ${sentCount} enviado(s) com sucesso, ${failedCount} falha(s).`);

  return {
    success: isSuccess,
    duplicate: false,
    sentCount,
    failedCount,
    recipientsCount: targets.length,
    stage: isSuccess ? 'sucesso' : 'servico_push',
    errors: errors.length > 0 ? errors : undefined,
    message: isSuccess
      ? `Notificação entregue com sucesso para ${sentCount} de ${targets.length} dispositivo(s).` + (failedCount > 0 ? ` (${failedCount} falha(s))` : '')
      : `Falha ao entregar push para ${failedCount} dispositivo(s): ${errors.join('; ')}`
  };
}
