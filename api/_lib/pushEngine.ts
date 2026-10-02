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
  userEmail?: string;
  userName: string;
  userRole: string;
  role?: string;
  endpoint: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
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
    isPWA?: boolean;
    isMobile?: boolean;
    timestamp?: string;
  };
  platform?: string;
  userAgent?: string;
  isPWA?: boolean;
  isMobile?: boolean;
  permission?: string;
  authorized?: boolean;
  active: boolean;
  updatedAt: string;
  createdAt: string;
  lastSeenAt?: string;
}

/**
 * Chave pública VAPID oficial pareada com a chave privada VAPID_PRIVATE_KEY do backend (RFC 8292).
 */
export const OFFICIAL_VAPID_PUBLIC_KEY = 'BGidTH8JXdHgg5XYTG-Z3iAJhCOVguQQf0B5iL-GMHJVXdnj_1JLv1bvtCG0GOCSBU-LqYL9dpUcCZaj_nV3H4s';

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

/**
 * Derivação matemática segura da chave pública P-256 a partir da chave privada VAPID.
 */
export function derivePublicKeyFromPrivate(priv: string): string | null {
  const clean = cleanKey(priv);
  if (!clean) return null;
  try {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(parsePrivKeyBuf(clean));
    return ecdh.getPublicKey('base64url');
  } catch {
    return null;
  }
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
    const derivedPub = derivePublicKeyFromPrivate(cleanPriv);
    if (!derivedPub) {
      return { matches: false, publicKeyPrefix: pubPrefix, privateKeyConfigured: true, error: 'Formato inválido na chave privada VAPID.' };
    }
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
        error: `Inconsistência de par VAPID: A chave pública informada (${pubPrefix}) difere da chave pública derivada da chave privada ativa (${derivedPrefix}).`
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

// Variáveis de ambiente oficiais: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
export function getVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const subject = cleanKey(process.env.VAPID_SUBJECT) || 'mailto:suporte@andradeagro.com.br';
  const privateKey = cleanKey(process.env.VAPID_PRIVATE_KEY) || cleanKey(process.env.PRIVATE_VAPID_KEY) || '';

  // 1. Derivação automática da chave pública a partir da chave privada configurada no backend
  const derivedPub = derivePublicKeyFromPrivate(privateKey);
  const envPublicKey = cleanKey(process.env.VAPID_PUBLIC_KEY) || cleanKey(process.env.VITE_VAPID_PUBLIC_KEY);

  // 2. Se a chave privada do backend deriva uma chave pública válida, essa é SEMPRE a chave oficial
  // do par criptográfico (garante que Frontend Public Key == Public Key derivada da Private Key do backend)
  const publicKey = derivedPub || envPublicKey || OFFICIAL_VAPID_PUBLIC_KEY;

  return { publicKey, privateKey, subject };
}

let vapidConfiguredSuccessfully = false;
let vapidConfigError: string | null = null;

export function ensureVapidConfigured(): {
  configured: boolean;
  error?: string;
  publicKeyPrefix: string;
  privateKeyConfigured: boolean;
  derivedPublicKeyPrefix?: string;
} {
  const { publicKey, privateKey, subject } = getVapidKeys();
  const check = verifyVapidKeyPair(publicKey, privateKey);
  
  // Diagnóstico seguro: compara identificadores parciais sem expor a chave privada
  console.log(`[AndradeAgro VAPID Check] hasPrivateKey=${Boolean(privateKey)}, hasSubject=${Boolean(subject)}, publicKeyFromPrivate=${check.derivedPublicKeyPrefix || 'N/A'}, configuredPublicKey=${check.publicKeyPrefix}, matches=${check.matches}`);

  if (check.matches === true) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      vapidConfiguredSuccessfully = true;
      vapidConfigError = null;
      return { 
        configured: true, 
        publicKeyPrefix: check.publicKeyPrefix, 
        privateKeyConfigured: true,
        derivedPublicKeyPrefix: check.derivedPublicKeyPrefix
      };
    } catch (e: any) {
      vapidConfiguredSuccessfully = false;
      vapidConfigError = e?.message || String(e);
      return { 
        configured: false, 
        error: vapidConfigError, 
        publicKeyPrefix: check.publicKeyPrefix, 
        privateKeyConfigured: true,
        derivedPublicKeyPrefix: check.derivedPublicKeyPrefix
      };
    }
  } else {
    vapidConfiguredSuccessfully = false;
    vapidConfigError = check.error || 'Par de chaves VAPID incompatível ou incompleto';
    return { 
      configured: false, 
      error: vapidConfigError, 
      publicKeyPrefix: check.publicKeyPrefix, 
      privateKeyConfigured: check.privateKeyConfigured,
      derivedPublicKeyPrefix: check.derivedPublicKeyPrefix
    };
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

// Deduplicação em memória volátil de eventos no mesmo ciclo de vida (sem persistência em disco)
const processedEventIds = new Set<string>();

function toFirestoreRestValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreRestValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      if (val[key] !== undefined) {
        fields[key] = toFirestoreRestValue(val[key]);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreRestDoc(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      fields[key] = toFirestoreRestValue(obj[key]);
    }
  }
  return { fields };
}

/**
 * Salva ou atualiza um dispositivo diretamente na coleção 'user_devices' do Firestore via REST
 */
async function saveFirestoreDeviceRest(record: PushDeviceRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getFirebaseAuthToken();
    if (!token) {
      const err = 'Não foi possível autenticar token REST para gravar dispositivo.';
      console.warn('[AndradeAgro PushEngine] ' + err);
      return { success: false, error: err };
    }

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/user_devices/${record.id}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toFirestoreRestDoc(record)),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = `HTTP ${res.status} - ${errText.slice(0, 120)}`;
      console.warn(`[AndradeAgro PushEngine] Erro ao gravar dispositivo via REST: ${err}`);
      return { success: false, error: err };
    }

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.warn('[AndradeAgro PushEngine] Exceção ao gravar dispositivo via REST:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Desativa um dispositivo diretamente na coleção 'user_devices' do Firestore via REST
 */
async function deactivateFirestoreDeviceRest(endpoint: string): Promise<boolean> {
  try {
    const token = await getFirebaseAuthToken();
    if (!token) return false;

    const stableId = getStableDeviceId(endpoint);
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/user_devices/${stableId}?updateMask.fieldPaths=active&updateMask.fieldPaths=updatedAt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const nowIso = new Date().toISOString();
    const res = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          active: { booleanValue: false },
          updatedAt: { stringValue: nowIso }
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    return res.ok;
  } catch (err: any) {
    console.warn('[AndradeAgro PushEngine] Exceção ao desativar dispositivo via REST:', err?.message || err);
    return false;
  }
}

export interface ActiveAuthorizedDevicesResult {
  activeDevices: PushDeviceRecord[];
  totalDevices: number;
  querySuccess: boolean;
  queryError?: string;
  source: 'FIREBASE_ADMIN' | 'FIRESTORE_REST';
}

/**
 * FONTE ÚNICA DA REGRA DE NEGÓCIO PARA DISPOSITIVOS ATIVOS E AUTORIZADOS
 * Regra unificada para AI Studio e Vercel:
 *  - O Firestore 'user_devices' é a ÚNICA fonte de verdade.
 *  - Não utiliza data/db.json ou filesystem local da Vercel.
 *  - Identificação estável e deduplicação estrita por endpoint de subscription.
 */
export async function getActiveAuthorizedDevices(options?: {
  targetUserId?: string;
  directSubscription?: any;
  directUserName?: string;
  directUserRole?: string;
}): Promise<ActiveAuthorizedDevicesResult> {
  const endpointMap = new Map<string, { record: PushDeviceRecord; timestamp: number; active: boolean }>();
  let source: 'FIREBASE_ADMIN' | 'FIRESTORE_REST' = 'FIRESTORE_REST';
  let querySuccess = false;
  let queryError: string | undefined = undefined;

  // 1. Prioridade: Firebase Admin SDK se configurado com credenciais válidas
  lastFirestoreQueryError = null;
  const adminDb = getFirebaseAdminDb();
  if (adminDb) {
    try {
      console.log(`[AndradeAgro PushEngine] [ETAPA 3/10] Firestore acessado via Firebase Admin: Projeto "${firebaseConfig.projectId}", Coleção "user_devices"`);
      let adminTimer: any;
      const adminPromise = adminDb.collection('user_devices').get();
      adminPromise.catch(() => {}); // Previne unhandled rejection em caso de timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        adminTimer = setTimeout(() => reject(new Error('Timeout Firebase Admin (3500ms)')), 3500);
      });
      const snap = await Promise.race([adminPromise, timeoutPromise]);
      clearTimeout(adminTimer);
      querySuccess = true;
      source = 'FIREBASE_ADMIN';

      snap.forEach((docSnap: any) => {
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
                  userEmail: data.userEmail || '',
                  userName: data.userName || 'Usuário',
                  userRole: data.role || data.userRole || 'FUNCIONARIO',
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
      console.warn(`[AndradeAgro PushEngine] Aviso na consulta do Firebase Admin:`, queryError);
    }
  }

  // 2. Consulta direta ao Firestore via REST API (ÚNICA FONTE DE VERDADE na Vercel e quando sem Service Account)
  if (!querySuccess) {
    console.log(`[AndradeAgro PushEngine] [ETAPA 3/10] Firestore acessado via REST API: Projeto "${firebaseConfig.projectId}", Coleção "user_devices"`);
    const restResult = await fetchFirestoreDevicesRest();
    if (restResult.devices && !restResult.error) {
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

  // 3. Se uma subscrição direta do cliente foi enviada na chamada (ex: botão de teste no painel)
  if (options?.directSubscription && isValidPushSubscription(options.directSubscription)) {
    const directEp = options.directSubscription.endpoint;
    const directId = getStableDeviceId(directEp);
    endpointMap.set(directEp, {
      record: {
        id: directId,
        userId: options.targetUserId || 'direct-user',
        userEmail: '',
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

  const activeDevices = allConsolidated
    .filter(item => item.active && item.record.active !== false)
    .map(item => item.record)
    .filter(d => {
      if (!isValidPushSubscription(d.subscription)) return false;
      if (options?.targetUserId && d.userId !== options.targetUserId) return false;
      return true;
    });

  console.log(`[AndradeAgro PushEngine] [ETAPA 5/10] Dispositivos no Firestore: ${activeDevices.length} ativo(s) de ${totalDevices} total(is) analisados (Fonte: ${source}).`);

  return {
    activeDevices,
    totalDevices,
    querySuccess,
    queryError,
    source
  };
}

/**
 * Consulta de todos os dispositivos ativos no Firestore
 */
export async function fetchAllActiveDevices(): Promise<PushDeviceRecord[]> {
  const result = await getActiveAuthorizedDevices();
  return result.activeDevices;
}

export async function deactivateEndpointEverywhere(endpoint: string) {
  if (!endpoint) return;
  const stableId = getStableDeviceId(endpoint);
  const nowIso = new Date().toISOString();

  // 1. Firebase Admin se disponível
  try {
    const adminDb = getFirebaseAdminDb();
    if (adminDb) {
      await adminDb.collection('user_devices').doc(stableId).set({
        active: false,
        updatedAt: nowIso
      }, { merge: true });
    }
  } catch (err: any) {
    console.warn('[AndradeAgro PushEngine] Warning deactivating in Firestore Admin:', err?.message || err);
  }

  // 2. Firestore REST API
  try {
    await deactivateFirestoreDeviceRest(endpoint);
  } catch (err: any) {
    console.warn('[AndradeAgro PushEngine] Warning deactivating in Firestore REST:', err?.message || err);
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
  userEmail?: string;
  userName?: string;
  userRole?: string;
  subscription: any;
  deviceInfo?: any;
}): Promise<{ ok: boolean; deviceId: string; message: string; device: PushDeviceRecord; error?: string }> {
  const { userId, userEmail, userName, userRole, subscription, deviceInfo } = params;
  const endpoint = subscription?.endpoint || '';
  if (!endpoint || !isValidPushSubscription(subscription)) {
    throw new Error('Inscrição push inválida (endpoint ou chaves p256dh/auth ausentes)');
  }
  const stableId = getStableDeviceId(endpoint);
  const nowIso = new Date().toISOString();

  const record: PushDeviceRecord = {
    id: stableId,
    endpoint,
    keys: {
      p256dh: subscription.keys?.p256dh || '',
      auth: subscription.keys?.auth || ''
    },
    subscription: {
      endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || ''
      }
    },
    userId: userId || 'anonymous',
    userEmail: userEmail || '',
    userName: userName || 'Usuário',
    role: userRole || 'FUNCIONARIO',
    userRole: userRole || 'FUNCIONARIO',
    platform: deviceInfo?.platform || '',
    userAgent: deviceInfo?.userAgent || '',
    isPWA: Boolean(deviceInfo?.isPWA),
    isMobile: Boolean(deviceInfo?.isMobile),
    permission: 'granted',
    authorized: true,
    active: true,
    updatedAt: nowIso,
    createdAt: nowIso,
    lastSeenAt: nowIso
  } as any;

  // Sync strictly to Firestore (Admin SDK if configured, otherwise Firestore REST)
  let saved = false;
  let adminError: string | undefined = undefined;
  let restError: string | undefined = undefined;

  try {
    const adminDb = getFirebaseAdminDb();
    if (adminDb) {
      await adminDb.collection('user_devices').doc(stableId).set(record, { merge: true });
      console.log(`[AndradeAgro PushEngine] Dispositivo registrado via Firebase Admin: ${stableId}`);
      saved = true;
    }
  } catch (fsErr: any) {
    adminError = fsErr?.message || String(fsErr);
    console.warn('[AndradeAgro PushEngine] Warning syncing to Firestore Admin:', adminError);
  }

  if (!saved) {
    const restRes = await saveFirestoreDeviceRest(record);
    if (restRes.success) {
      console.log(`[AndradeAgro PushEngine] Dispositivo registrado via Firestore REST: ${stableId}`);
      saved = true;
    } else {
      restError = restRes.error || 'Falha ao gravar no Firestore REST';
      console.warn(`[AndradeAgro PushEngine] Falha ao registrar dispositivo via Firestore REST: ${stableId} - ${restError}`);
    }
  }

  if (!saved) {
    const errorDetails = [
      adminError ? `Admin: ${adminError}` : null,
      restError ? `REST: ${restError}` : null
    ].filter(Boolean).join(' | ');

    const errorMsg = `Falha ao persistir dispositivo no Firestore (user_devices): ${errorDetails || 'Gravação rejeitada no Admin e REST'}`;
    console.error(`[AndradeAgro PushEngine] ${errorMsg} (${stableId})`);
    return {
      ok: false,
      deviceId: stableId,
      error: errorMsg,
      message: errorMsg,
      device: record
    };
  }

  return {
    ok: true,
    deviceId: stableId,
    message: 'Dispositivo sincronizado com sucesso',
    device: record
  };
}

export async function unregisterDevice(params: { endpoint?: string; deviceId?: string; userId?: string }): Promise<{ ok: boolean; message: string }> {
  const { endpoint, deviceId } = params;
  if (endpoint) {
    await deactivateEndpointEverywhere(endpoint);
  } else if (deviceId) {
    const adminDb = getFirebaseAdminDb();
    const nowIso = new Date().toISOString();
    if (adminDb) {
      await adminDb.collection('user_devices').doc(deviceId).set({
        active: false,
        authorized: false,
        updatedAt: nowIso
      }, { merge: true }).catch(() => null);
    }
  }
  return { ok: true, message: 'Dispositivo desativado com sucesso' };
}

export async function getDevicesList(): Promise<any[]> {
  const devices = await fetchAllActiveDevices();
  return devices.map(d => ({
    id: d.id,
    endpoint: d.endpoint,
    keys: (d as any).keys || {
      p256dh: d.subscription?.keys?.p256dh || '',
      auth: d.subscription?.keys?.auth || ''
    },
    userId: d.userId,
    userEmail: (d as any).userEmail || '',
    userName: d.userName,
    role: d.userRole || (d as any).role || 'FUNCIONARIO',
    userRole: d.userRole || (d as any).role || 'FUNCIONARIO',
    platform: d.deviceInfo?.platform || (d as any).platform || 'desconhecido',
    userAgent: d.deviceInfo?.userAgent || (d as any).userAgent || '',
    isPWA: Boolean(d.deviceInfo?.isPWA || (d as any).isPWA),
    isMobile: Boolean(d.deviceInfo?.isMobile || (d as any).isMobile),
    permission: (d as any).permission || 'granted',
    authorized: (d as any).authorized !== false,
    active: d.active !== false,
    updatedAt: d.updatedAt,
    createdAt: d.createdAt,
    lastSeenAt: (d as any).lastSeenAt || d.updatedAt,
    endpointPreview: d.endpoint ? `${d.endpoint.slice(0, 35)}...` : 'N/A'
  }));
}

export async function getEngineStatus(): Promise<any> {
  const result = await getActiveAuthorizedDevices();
  const queryOk = result.querySuccess;
  const vapidState = ensureVapidConfigured();
  const { publicKey } = getVapidKeys();

  return {
    ok: queryOk,
    success: queryOk,
    querySuccess: queryOk,
    backendWorking: true,
    vapidConfigured: vapidState.configured,
    vapidKeyPairMatches: vapidState.configured,
    vapidPublicKeyPrefix: vapidState.publicKeyPrefix,
    vapidPrivateKeyConfigured: vapidState.privateKeyConfigured,
    vapidError: !vapidState.configured ? vapidState.error : undefined,
    vapidPublicKey: publicKey,
    vapidDiagnostics: {
      hasPrivateKey: vapidState.privateKeyConfigured,
      hasSubject: Boolean(getVapidKeys().subject),
      publicKeyFromPrivate: vapidState.derivedPublicKeyPrefix || vapidState.publicKeyPrefix,
      configuredPublicKey: vapidState.publicKeyPrefix,
      matches: vapidState.configured
    },
    firebaseAdmin: getFirebaseAdminDiagnostics(),
    firestoreAccessible: queryOk,
    totalDevices: result.totalDevices,
    activeAuthorizedCount: result.activeDevices.length,
    validSubscriptionsCount: result.activeDevices.length,
    authorizedDevices: result.activeDevices.map(d => ({
      id: d.id,
      userName: d.userName,
      userRole: d.userRole || (d as any).role,
      platform: d.deviceInfo?.platform || (d as any).platform || 'desconhecido',
      updatedAt: d.updatedAt
    })),
    source: result.source
  };
}

export function resetEventDeduplication(params: { prefix?: string; eventId?: string }): {
  removedCount: number;
  remainingCount: number;
} {
  const { prefix, eventId } = params;
  const beforeCount = processedEventIds.size;

  if (eventId) {
    processedEventIds.delete(eventId);
  } else if (prefix) {
    for (const id of Array.from(processedEventIds)) {
      if (id.startsWith(prefix)) {
        processedEventIds.delete(id);
      }
    }
  } else {
    processedEventIds.clear();
  }

  return {
    removedCount: beforeCount - processedEventIds.size,
    remainingCount: processedEventIds.size
  };
}

/**
 * Despacho principal de notificações Web Push para dispositivos autorizados.
 * Protegido contra bloqueios de runtime, com timeouts estritos e tratamento de erros.
 */
export async function dispatchPushToAuthorizedUsers(event: {
  eventType: 'NEW_ISSUE' | 'NEW_MAINTENANCE' | 'OIL_CHANGE_DUE' | 'TEST' | string;
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
  ok: boolean;
  success: boolean;
  duplicate?: boolean;
  totalDevices: number;
  sent: number;
  sentCount: number;
  failed: number;
  failedCount: number;
  removed: number;
  removedCount: number;
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
  if (processedEventIds.has(eventId)) {
    console.log(`[AndradeAgro PushEngine] Evento ${eventId} já processado anteriormente. Descartando duplicata.`);
    return {
      ok: false,
      success: false,
      duplicate: true,
      sent: 0,
      sentCount: 0,
      failed: 0,
      failedCount: 0,
      removed: 0,
      removedCount: 0,
      totalDevices: 0,
      stage: 'inicio',
      message: 'Evento duplicado já processado anteriormente.'
    } as any;
  }

  processedEventIds.add(eventId);
  if (processedEventIds.size > 500) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }

  let title = customTitle || '⚠️ Notificação AndradeAgro';
  let url = '/';

  if (eventType === 'NEW_ISSUE' || eventType === 'MACHINE_ISSUE') {
    title = customTitle || '⚠️ Novo problema registrado';
    url = `/?tab=alerts&issueId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'NEW_MAINTENANCE') {
    title = customTitle || 'Nova manutenção registrada';
    url = `/?tab=maintenance&maintenanceId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'MAINTENANCE_DUE' || eventType === 'PREVENTIVE_MAINTENANCE') {
    title = customTitle || '🔧 Manutenção preventiva pendente';
    url = `/?tab=maintenance&maintenanceId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'OIL_CHANGE_DUE') {
    title = customTitle || '⚠️ Troca de óleo pendente';
    url = `/?tab=maintenance&equipmentId=${encodeURIComponent(equipmentId || '')}`;
  } else if (eventType === 'LOW_TANK_LEVEL') {
    title = customTitle || '⚠️ Nível de Combustível Baixo';
    url = '/?tab=alerts';
  } else if (eventType === 'SUSPICIOUS_FUEL') {
    title = customTitle || '⚠️ Consumo Anômalo Detectado';
    url = '/?tab=alerts';
  } else if (eventType === 'TEST') {
    title = customTitle || 'Teste AndradeAgro';
    url = '/?tab=settings';
  } else {
    title = customTitle || '⚠️ Alerta AndradeAgro';
    url = '/?tab=alerts';
  }

  const notificationBody = eventType === 'TEST'
    ? (description || 'Notificações Push funcionando.')
    : eventType === 'OIL_CHANGE_DUE'
      ? (description || `O veículo ${equipmentName} precisa de atenção para troca de óleo.`)
      : eventType === 'NEW_MAINTENANCE'
        ? (description || `${equipmentName} • Manutenção registrada`).trim()
        : (equipmentName && equipmentName !== 'Equipamento Agrícola' && equipmentName !== 'Tanque' && !description.toLowerCase().startsWith(equipmentName.toLowerCase()))
          ? `${equipmentName}\n${description}`.trim()
          : (description || 'Novo alerta registrado no sistema.').trim();

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
      ok: false,
      success: false,
      duplicate: false,
      totalDevices: devicesResult.totalDevices,
      sent: 0,
      sentCount: 0,
      failed: 0,
      failedCount: 0,
      removed: 0,
      removedCount: 0,
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
      ok: false,
      success: false,
      duplicate: false,
      totalDevices: targets.length,
      sent: 0,
      sentCount: 0,
      failed: 0,
      failedCount: 0,
      removed: 0,
      removedCount: 0,
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
      let sendTimer: any;
      try {
        const sendPromise = webpush.sendNotification(device.subscription as any, payload, vapidOptions);
        sendPromise.catch(() => {}); // Previne unhandled rejection caso o timeout dispare antes

        const timeoutSend = new Promise<never>((_, reject) => {
          sendTimer = setTimeout(() => reject(new Error('Timeout de 3500ms no envio push')), 3500);
        });
        const pushRes = await Promise.race([sendPromise, timeoutSend]);
        clearTimeout(sendTimer);
        sentCount++;
        console.log(`[AndradeAgro PushEngine] [ETAPA 8/10] Sucesso no envio para ${device.userName} (${device.deviceInfo?.platform || 'dispositivo'}) - HTTP ${pushRes?.statusCode || 201}`);
      } catch (err: any) {
        clearTimeout(sendTimer);
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
    ok: isSuccess,
    success: isSuccess,
    duplicate: false,
    totalDevices: targets.length,
    sent: sentCount,
    sentCount,
    failed: failedCount,
    failedCount,
    removed: invalidEndpoints.length,
    removedCount: invalidEndpoints.length,
    recipientsCount: targets.length,
    stage: isSuccess ? 'sucesso' : 'servico_push',
    errors: errors.length > 0 ? errors : undefined,
    message: isSuccess
      ? `Notificação entregue com sucesso para ${sentCount} de ${targets.length} dispositivo(s).` + (failedCount > 0 ? ` (${failedCount} falha(s))` : '')
      : `Falha ao entregar push para ${failedCount} dispositivo(s): ${errors.join('; ')}`
  };
}
