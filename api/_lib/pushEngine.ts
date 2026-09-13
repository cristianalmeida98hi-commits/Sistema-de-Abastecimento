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
  return k.trim().replace(/^["']|["']$/g, '');
}

const VAPID_SUBJECT = cleanKey(process.env.VAPID_SUBJECT) || 'mailto:suporte@andradeagro.com.br';
const VAPID_PUBLIC_KEY = cleanKey(process.env.VAPID_PUBLIC_KEY) || OFFICIAL_VAPID_KEYS.publicKey;
const VAPID_PRIVATE_KEY = cleanKey(process.env.VAPID_PRIVATE_KEY) || OFFICIAL_VAPID_KEYS.privateKey;

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[AndradeAgro PushEngine] VAPID configured successfully.');
} catch (e: any) {
  console.error('[AndradeAgro PushEngine] Error configuring VAPID:', e?.message || e);
}

// Firebase setup
const firebaseConfig = {
  apiKey: "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
  authDomain: "andrade-agro.firebaseapp.com",
  projectId: "andrade-agro",
  storageBucket: "andrade-agro.firebasestorage.app",
  messagingSenderId: "271695349839",
  appId: "1:271695349839:web:4428ed928e6423b9adc23a"
};

let firebaseAppInstance: any = null;
let firestoreInstance: any = null;

function getFirebase() {
  if (!firestoreInstance) {
    firebaseAppInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    firestoreInstance = getFirestore(firebaseAppInstance);
  }
  return { app: firebaseAppInstance, db: firestoreInstance };
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

  // 2. Firestore devices
  try {
    const { app, db } = getFirebase();
    const auth = getAuth(app);
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => null);
    }
    const snap = await getDocs(collection(db, 'user_devices'));
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
  } catch (err: any) {
    console.warn('[AndradeAgro PushEngine] Warning querying Firestore devices:', err?.message || err);
  }

  return Array.from(deviceMap.values());
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

  console.log(`[AndradeAgro PushEngine] [1. Início] Preparando envio ${eventType} (${eventId})`);

  // Deduplication check
  loadStore();
  if (inMemoryStore.processedEvents.includes(eventId)) {
    console.log(`[AndradeAgro PushEngine] Event ${eventId} already processed. Deduplicating.`);
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

  // Step 2: Fetch all devices from Firestore and local store
  const allDevices = await fetchAllActiveDevices();

  // If direct subscription was supplied with test request, ensure it's present
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
    }
  }

  // Step 3: Validate and filter targets
  const targets = allDevices.filter(d => {
    if (d.active === false) return false;
    if (!d.subscription || !d.subscription.endpoint) return false;
    if (!isValidPushSubscription(d.subscription)) {
      console.warn(`[AndradeAgro PushEngine] [3. Validação] Token inválido para ${d.userName}. Desativando.`);
      deactivateEndpointEverywhere(d.endpoint).catch(() => null);
      return false;
    }
    if (eventType !== 'TEST' && targetUserId) return d.userId === targetUserId;
    return true;
  });

  console.log(`[AndradeAgro PushEngine] [2. Dispositivos] ${targets.length} alvos válidos identificados.`);

  if (targets.length === 0) {
    return {
      success: false,
      duplicate: false,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: 0,
      stage: 'busca_dispositivos',
      message: 'Nenhum dispositivo registrado com permissão ativa e chaves válidas para receber notificações push.'
    };
  }

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

  // Step 4: Dispatch push
  await Promise.all(
    targets.map(async (device) => {
      try {
        const pushRes = await webpush.sendNotification(device.subscription as any, payload, vapidOptions);
        sentCount++;
        console.log(`[AndradeAgro PushEngine] [4. Sucesso] Entregue para ${device.userName} - Status ${pushRes?.statusCode || 201}`);
      } catch (err: any) {
        failedCount++;
        const statusCode = err?.statusCode || 'ERR';
        const msg = err?.body || err?.message || 'Falha no envio';
        const detail = `Status ${statusCode}: ${msg}`;
        errors.push(detail);
        console.warn(`[AndradeAgro PushEngine] [4. Falha] Erro ao enviar para ${device.userName}:`, detail);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          invalidEndpoints.push(device.subscription.endpoint);
        }
      }
    })
  );

  // Clean expired endpoints
  if (invalidEndpoints.length > 0) {
    for (const ep of invalidEndpoints) {
      await deactivateEndpointEverywhere(ep).catch(() => null);
    }
  }

  const isSuccess = sentCount > 0;
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
