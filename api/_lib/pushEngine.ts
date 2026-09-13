import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

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

// Resilient file-backed & in-memory database
function getDbFilePath(): string {
  // In Vercel serverless functions, only /tmp is writable
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

// Initial load
loadStore();

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
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function registerDevice(params: {
  userId: string;
  userName?: string;
  userRole?: string;
  subscription: any;
  deviceInfo?: any;
}): PushDeviceRecord {
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
    userRole: userRole || 'ADMIN',
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
  return record;
}

export function unregisterDevice(params: { endpoint?: string; userId?: string }): boolean {
  loadStore();
  const { endpoint, userId } = params;
  inMemoryStore.devices = inMemoryStore.devices.map(d => {
    if ((endpoint && d.subscription && d.subscription.endpoint === endpoint) ||
        (userId && !endpoint && d.userId === userId)) {
      return { ...d, active: false, updatedAt: new Date().toISOString() };
    }
    return d;
  });
  saveStore();
  return true;
}

export function getDevicesList(): any[] {
  loadStore();
  return inMemoryStore.devices.map(d => ({
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

export function getEngineStatus(): any {
  loadStore();
  const activeAuthorized = inMemoryStore.devices.filter(
    d => d.active !== false && (d.userRole === 'ADMIN' || d.userRole === 'MANUTENCAO')
  );

  return {
    vapidConfigured: true,
    vapidPublicKey: VAPID_PUBLIC_KEY,
    totalDevices: inMemoryStore.devices.length,
    activeAuthorizedCount: activeAuthorized.length,
    authorizedDevices: activeAuthorized.map(d => ({
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
  directUserRole?: string;
  directUserName?: string;
}): Promise<{
  success: boolean;
  duplicate?: boolean;
  sentCount: number;
  failedCount: number;
  recipientsCount: number;
  errors?: string[];
  message: string;
}> {
  loadStore();
  const { 
    eventType, 
    eventId, 
    equipmentName, 
    description, 
    equipmentId, 
    targetUserId, 
    customTitle,
    directSubscription,
    directUserRole,
    directUserName
  } = event;

  // Deduplication check
  if (inMemoryStore.processedEvents.includes(eventId)) {
    console.log(`[AndradeAgro PushEngine] Event ${eventId} already processed.`);
    return {
      success: false,
      duplicate: true,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: 0,
      message: 'Notificação duplicada já processada recentemente.'
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

  // If a direct subscription was supplied with the test request, ensure it's registered/included
  if (directSubscription && directSubscription.endpoint) {
    const existing = inMemoryStore.devices.find(
      d => d.subscription && d.subscription.endpoint === directSubscription.endpoint
    );
    if (!existing) {
      registerDevice({
        userId: targetUserId || 'direct-test-user',
        userName: directUserName || 'Usuário Atual',
        userRole: directUserRole || 'ADMIN',
        subscription: directSubscription
      });
    }
  }

  // Find target devices: only ADMIN and MANUTENCAO
  let targets = inMemoryStore.devices.filter(d => {
    if (d.active === false) return false;
    if (!d.subscription || !d.subscription.endpoint) return false;
    if (targetUserId) return d.userId === targetUserId;
    return d.userRole === 'ADMIN' || d.userRole === 'MANUTENCAO';
  });

  // If a direct subscription was passed for a test, ensure it is included even if userId differed
  if (directSubscription && directSubscription.endpoint) {
    const hasDirect = targets.some(t => t.subscription?.endpoint === directSubscription.endpoint);
    if (!hasDirect) {
      const directDev: PushDeviceRecord = {
        id: `dev-direct-${Date.now()}`,
        userId: targetUserId || 'direct-test-user',
        userName: directUserName || 'Usuário Atual',
        userRole: directUserRole || 'ADMIN',
        endpoint: directSubscription.endpoint,
        subscription: directSubscription,
        active: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      targets = [directDev, ...targets];
    }
  }

  console.log(`[AndradeAgro PushEngine] Dispatching ${eventType} (${eventId}) to ${targets.length} targets.`);

  if (targets.length === 0) {
    return {
      success: false,
      duplicate: false,
      sentCount: 0,
      failedCount: 0,
      recipientsCount: 0,
      message: 'Nenhum dispositivo ativo registrado para usuários autorizados (ADMIN/MANUTENÇÃO).'
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

  await Promise.all(
    targets.map(async (device) => {
      try {
        await webpush.sendNotification(device.subscription as any, payload, vapidOptions);
        sentCount++;
        console.log(`[AndradeAgro PushEngine] Successfully sent to ${device.userName} (${device.userRole})`);
      } catch (err: any) {
        failedCount++;
        const statusCode = err?.statusCode || 'ERR';
        const msg = err?.body || err?.message || 'Falha no envio';
        const detail = `Status ${statusCode}: ${msg}`;
        errors.push(detail);
        console.warn(`[AndradeAgro PushEngine] Failed to send to ${device.userName}:`, detail);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          invalidEndpoints.push(device.subscription.endpoint);
        }
      }
    })
  );

  // Clean expired endpoints
  if (invalidEndpoints.length > 0) {
    inMemoryStore.devices = inMemoryStore.devices.map(d => {
      if (d.subscription && invalidEndpoints.includes(d.subscription.endpoint)) {
        return { ...d, active: false, updatedAt: new Date().toISOString() };
      }
      return d;
    });
    saveStore();
  }

  const isSuccess = sentCount > 0;
  return {
    success: isSuccess,
    duplicate: false,
    sentCount,
    failedCount,
    recipientsCount: targets.length,
    errors: errors.length > 0 ? errors : undefined,
    message: isSuccess
      ? `Notificação enviada com sucesso para ${sentCount} dispositivo(s).`
      : `Falha ao entregar push para ${failedCount} dispositivo(s): ${errors.join('; ')}`
  };
}
