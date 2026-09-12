import { User, UserRole, PushNotificationPayload } from '../types';
import { db, ensureFirebaseAuth } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Chave pública VAPID oficial do sistema AndradeAgro (RFC 8292).
 * Chave pública padrão para validação e assinatura Web Push no navegador do dispositivo.
 * O par privado correspondente reside com segurança exclusiva no servidor backend.
 */
export const OFFICIAL_VAPID_PUBLIC_KEY = 'BGidTH8JXdHgg5XYTG-Z3iAJhCOVguQQf0B5iL-GMHJVXdnj_1JLv1bvtCG0GOCSBU-LqYL9dpUcCZaj_nV3H4s';

/**
 * Obtém a chave pública VAPID de forma resiliente:
 * 1. Consulta o endpoint /api/notifications/vapid-public-key do servidor;
 * 2. Se houver falha de rede/CORS temporária, verifica import.meta.env.VITE_VAPID_PUBLIC_KEY;
 * 3. Utiliza a chave pública oficial estática pareada com o backend AndradeAgro.
 */
export async function getVapidPublicKey(): Promise<string> {
  // 1. Tentar obter do servidor
  try {
    const res = await fetch('/api/notifications/vapid-public-key', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.publicKey && typeof data.publicKey === 'string' && data.publicKey.trim().length > 10) {
        return data.publicKey.trim();
      }
    } else {
      console.warn(`[Push Notification] /api/notifications/vapid-public-key respondeu status ${res.status}`);
    }
  } catch (err: any) {
    console.warn('[Push Notification] Não foi possível contatar o endpoint VAPID diretamente:', err?.message || err);
  }

  // 2. Verificar variável de ambiente do Vite se presente
  try {
    const envKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 10) {
      return envKey.trim();
    }
  } catch {}

  // 3. Chave pública oficial do sistema AndradeAgro
  if (OFFICIAL_VAPID_PUBLIC_KEY) {
    return OFFICIAL_VAPID_PUBLIC_KEY;
  }

  throw new Error('Falha ao obter chave pública de notificação do servidor.');
}

/**
 * Utility to convert base64 VAPID public key into Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Ensures a push subscription has valid endpoint and base64-encoded p256dh/auth keys
 */
function normalizeSubscription(sub: PushSubscription): any {
  const subJson = sub.toJSON();
  if (!subJson.endpoint && sub.endpoint) {
    subJson.endpoint = sub.endpoint;
  }
  if (!subJson.keys) {
    subJson.keys = {};
  }
  if (!subJson.keys.p256dh && sub.getKey) {
    const p256dhBuffer = sub.getKey('p256dh');
    if (p256dhBuffer) {
      subJson.keys.p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhBuffer))));
    }
  }
  if (!subJson.keys.auth && sub.getKey) {
    const authBuffer = sub.getKey('auth');
    if (authBuffer) {
      subJson.keys.auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authBuffer))));
    }
  }
  return subJson;
}

/**
 * Retrieves existing push subscription, validating key match with server VAPID key.
 * If server key changed or subscription expired, safely renews it.
 */
async function getOrRenewSubscription(
  reg: ServiceWorkerRegistration, 
  serverPublicKey: string
): Promise<PushSubscription> {
  const targetKeyBytes = urlBase64ToUint8Array(serverPublicKey);
  let sub = await reg.pushManager.getSubscription();

  if (sub) {
    let keyMismatch = false;
    try {
      const rawKey = sub.options.applicationServerKey;
      if (rawKey) {
        const subKeyBytes = new Uint8Array(rawKey);
        if (subKeyBytes.length !== targetKeyBytes.length || !subKeyBytes.every((b, i) => b === targetKeyBytes[i])) {
          keyMismatch = true;
        }
      } else {
        keyMismatch = true;
      }
    } catch {
      keyMismatch = true;
    }

    if (keyMismatch) {
      console.log('[Push Notification] Chave VAPID mudou ou expirou. Renovando inscrição no PushManager...');
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: targetKeyBytes
    });
  }

  return sub;
}

/**
 * Detect client platform and device characteristics
 */
function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return { userAgent: '', platform: '', isPWA: false, isMobile: false };
  }

  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                (window.navigator as any).standalone === true;

  let platform = 'Desktop';
  if (/Android/i.test(ua)) platform = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'iOS';
  else if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Mac/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  return {
    userAgent: ua,
    platform,
    isPWA,
    isMobile
  };
}

/**
 * Check if the current browser environment supports Push Notifications & Service Worker
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if notifications are currently marked active for this user on this browser
 */
export function isStoredPushActive(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`andradeagro_push_active_${userId}`) === 'true';
}

/**
 * Check if a real PushSubscription is currently active in the service worker
 */
export async function isSubscriptionActive(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Request permission and subscribe current device to push notifications
 */
export async function enablePushNotifications(currentUser: User): Promise<{
  success: boolean;
  message: string;
  status: 'granted' | 'denied' | 'unsupported' | 'error';
}> {
  // Permission gate: Only ADMIN and MANUTENCAO are authorized
  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANUTENCAO') {
    return {
      success: false,
      message: 'Apenas usuários com perfil de Administrador ou Manutenção podem receber notificações push.',
      status: 'denied'
    };
  }

  if (!isPushSupported()) {
    return {
      success: false,
      message: 'Notificações push não são suportadas neste navegador ou dispositivo. No iOS, adicione o sistema à Tela de Início (PWA) no Safari 16.4+.',
      status: 'unsupported'
    };
  }

  try {
    // 1. Request notification permission only on deliberate user action
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      return {
        success: false,
        message: 'As notificações foram bloqueadas no navegador. Para ativar, permita as notificações nas configurações do seu navegador.',
        status: 'denied'
      };
    }

    if (permission !== 'granted') {
      return {
        success: false,
        message: 'Permissão de notificações não concedida.',
        status: 'denied'
      };
    }

    // 2. Ensure Service Worker is registered & ready
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // 3. Fetch server's VAPID public key with fallback resilience
    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      throw new Error('Chave VAPID pública não disponível.');
    }

    // 4. Subscribe or renew subscription with server VAPID key
    const sub = await getOrRenewSubscription(reg, publicKey);
    const subJson = normalizeSubscription(sub);
    const deviceInfo = getDeviceInfo();
    const cleanEndpoint = sub.endpoint || '';
    const hash = cleanEndpoint.slice(-16).replace(/[^a-zA-Z0-9]/g, '');
    const deviceId = `dev-${currentUser.id}-${hash || Date.now()}`;

    const deviceRecord = {
      id: deviceId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      endpoint: cleanEndpoint,
      token: cleanEndpoint,
      subscription: subJson,
      deviceInfo,
      active: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // 5. Save device record to Firestore user_devices collection with authenticated session
    try {
      await ensureFirebaseAuth();
      await setDoc(doc(db, 'user_devices', deviceId), deviceRecord, { merge: true });
      console.log('[Push Notification] Device registered in Firestore user_devices.');
    } catch (fsErr) {
      console.warn('[Push Notification] Notice: Could not write device to Firestore directly:', fsErr);
    }

    // 6. Register device on backend server
    const serverRes = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        subscription: subJson,
        deviceInfo
      })
    });

    if (!serverRes.ok) {
      console.warn('[Push Notification] Backend subscription returned status:', serverRes.status);
    }

    // 7. Store local state
    localStorage.setItem(`andradeagro_push_active_${currentUser.id}`, 'true');
    window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));

    return {
      success: true,
      message: 'Notificações push ativadas com sucesso! Você receberá alertas em tempo real de novos problemas e manutenções.',
      status: 'granted'
    };
  } catch (err: any) {
    console.error('[Push Notification] Error enabling push notifications:', err);
    return {
      success: false,
      message: `Erro ao ativar notificações: ${err?.message || 'Falha desconhecida.'}`,
      status: 'error'
    };
  }
}

/**
 * Unsubscribe current device from push notifications
 */
export async function disablePushNotifications(currentUser?: User): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (isPushSupported()) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();

          // Inform backend
          await fetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint,
              userId: currentUser?.id
            })
          }).catch(() => {});

          // Inform Firestore
          if (currentUser?.id) {
            const hash = endpoint.slice(-16).replace(/[^a-zA-Z0-9]/g, '');
            const deviceId = `dev-${currentUser.id}-${hash}`;
            try {
              await updateDoc(doc(db, 'user_devices', deviceId), {
                active: false,
                updatedAt: new Date().toISOString()
              });
            } catch {
              // Non-blocking
            }
          }
        }
      }
    }

    if (currentUser?.id) {
      localStorage.removeItem(`andradeagro_push_active_${currentUser.id}`);
    }
    window.dispatchEvent(new CustomEvent('andradeagro_push_status_changed'));

    return {
      success: true,
      message: 'Notificações push desativadas neste dispositivo.'
    };
  } catch (err: any) {
    console.error('[Push Notification] Error disabling notifications:', err);
    return {
      success: false,
      message: `Erro ao desativar notificações: ${err?.message || 'Falha desconhecida.'}`
    };
  }
}

/**
 * Send a real test push notification to this device
 */
export async function sendTestPushNotification(currentUser: User): Promise<{
  success: boolean;
  message: string;
  sentCount?: number;
  failedCount?: number;
  recipientsCount?: number;
  errors?: string[];
}> {
  try {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: currentUser.id,
        title: 'Teste AndradeAgro',
        description: 'Notificações Push funcionando.'
      })
    });

    const data = await res.json();
    if (data.success && data.sentCount > 0) {
      return {
        success: true,
        sentCount: data.sentCount,
        recipientsCount: data.recipientsCount,
        message: `Notificação de teste enviada com sucesso para ${data.sentCount} dispositivo(s)! Verifique a barra de notificações do seu celular.`
      };
    } else if (data.duplicate) {
      return {
        success: true,
        message: 'Notificação recente já enviada para este dispositivo.'
      };
    } else {
      const errDetails = (data.errors && data.errors.length > 0) ? `\nDetalhe técnico: ${data.errors.join('; ')}` : '';
      return {
        success: false,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || 0,
        recipientsCount: data.recipientsCount || 0,
        errors: data.errors,
        message: (data.message || 'Nenhum dispositivo ativo encontrado para este usuário ou falha ao entregar no celular.') + errDetails
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro de conexão ao testar notificação: ${err?.message || 'Falha no servidor'}`
    };
  }
}

// In-memory client deduplication set to avoid duplicate network dispatches
const clientDispatchedEventIds = new Set<string>();

/**
 * Clear client-side and server-side deduplication for a specific equipment or cycle prefix
 * Call this when a maintenance/oil change is resolved to ensure the next cycle can trigger cleanly!
 */
export async function clearPushEventDeduplication(prefix?: string): Promise<void> {
  if (!prefix) {
    clientDispatchedEventIds.clear();
  } else {
    for (const key of Array.from(clientDispatchedEventIds)) {
      if (key.startsWith(prefix)) {
        clientDispatchedEventIds.delete(key);
      }
    }
  }

  try {
    await fetch('/api/notifications/reset-event-dedup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix })
    });
  } catch {
    // Non-blocking network catch
  }
}

/**
 * Offline queue management for push events during network instability
 */
const PENDING_QUEUE_KEY = 'andradeagro_pending_push_queue';

function getPendingPushQueue(): PushNotificationPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingPushQueue(queue: PushNotificationPayload[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
  } catch {
    // Ignore storage quota errors
  }
}

function queuePendingPushEvent(payload: PushNotificationPayload): void {
  const queue = getPendingPushQueue();
  if (!queue.some(p => p.eventId === payload.eventId)) {
    queue.push(payload);
    savePendingPushQueue(queue);
    console.log(`[Push Notification Queue] Queued event for offline retry: ${payload.eventId}`);
  }
}

/**
 * Flush pending push events when internet connection is restored
 */
export async function flushPendingPushEvents(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const queue = getPendingPushQueue();
  if (queue.length === 0) return;

  console.log(`[Push Notification Queue] Flusing ${queue.length} pending push events...`);
  const remaining: PushNotificationPayload[] = [];

  for (const item of queue) {
    try {
      const res = await fetch('/api/notifications/dispatch-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: item.eventType,
          eventId: item.eventId,
          equipmentName: item.equipmentName,
          description: item.description,
          equipmentId: item.equipmentId
        })
      });
      if (!res.ok) {
        remaining.push(item);
      } else {
        clientDispatchedEventIds.add(item.eventId);
        console.log(`[Push Notification Queue] Successfully flushed event: ${item.eventId}`);
      }
    } catch {
      remaining.push(item);
    }
  }

  savePendingPushQueue(remaining);
}

// Automatically bind online listener once on client
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Connection restored. Flushing pending push events...');
    flushPendingPushEvents();
  });
}

/**
 * Dispatch an event to push notification subscribers (New Problem, New Maintenance or Oil Change Due)
 * Protected with deduplication at both client and server layers.
 * Queued automatically if offline or connection drops.
 */
export async function dispatchPushNotificationEvent(payload: PushNotificationPayload): Promise<{
  success: boolean;
  duplicate?: boolean;
  sentCount?: number;
  recipientsCount?: number;
  message?: string;
}> {
  // Only trigger for authorized system events
  if (payload.eventType !== 'NEW_ISSUE' && payload.eventType !== 'NEW_MAINTENANCE' && payload.eventType !== 'OIL_CHANGE_DUE') {
    return { success: false, message: 'Tipo de evento não suportado.' };
  }

  // Client-side session deduplication
  if (clientDispatchedEventIds.has(payload.eventId)) {
    return { success: true, duplicate: true, sentCount: 0, recipientsCount: 0, message: 'Evento já despachado nesta sessão.' };
  }

  // If offline, queue event immediately for retry on reconnect
  if (typeof window !== 'undefined' && !navigator.onLine) {
    queuePendingPushEvent(payload);
    return { success: true, duplicate: false, sentCount: 0, recipientsCount: 0, message: 'Sem conexão. Evento enfileirado para envio automático assim que a rede retornar.' };
  }

  try {
    const res = await fetch('/api/notifications/dispatch-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: payload.eventType,
        eventId: payload.eventId,
        equipmentName: payload.equipmentName,
        description: payload.description,
        equipmentId: payload.equipmentId
      })
    });

    if (!res.ok) {
      queuePendingPushEvent(payload);
      return { success: false, message: `Falha na requisição: ${res.status}` };
    }

    const data = await res.json();
    clientDispatchedEventIds.add(payload.eventId);
    return data;
  } catch (err: any) {
    // Queue for retry
    queuePendingPushEvent(payload);
    console.warn('[Push Notification] Error triggering push notification event, queued for retry:', err?.message || err);
    return { success: false, message: 'Oscilação de rede. Evento enfileirado com segurança para envio posterior.' };
  }
}

/**
 * Automatically synchronize and restore push registration for authorized users (ADMIN / MANUTENCAO)
 * Prevents token loss on reload, browser restart, or re-login.
 */
export async function autoSyncPushDevice(currentUser?: User | null): Promise<void> {
  if (!currentUser) return;
  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANUTENCAO') return;
  if (!isPushSupported()) return;

  const perm = getNotificationPermission();
  const wasStoredActive = isStoredPushActive(currentUser.id);

  // If user previously activated or permission is already granted, ensure active registration
  if (perm === 'granted' || wasStoredActive) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const publicKey = await getVapidPublicKey().catch(() => null);
      if (!publicKey) return;

      const sub = await getOrRenewSubscription(reg, publicKey);
      if (sub) {
        const subJson = normalizeSubscription(sub);
        const deviceInfo = getDeviceInfo();
        const cleanEndpoint = sub.endpoint || '';
        const hash = cleanEndpoint.slice(-16).replace(/[^a-zA-Z0-9]/g, '');
        const deviceId = `dev-${currentUser.id}-${hash || Date.now()}`;

        // Sync with backend server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            subscription: subJson,
            deviceInfo
          })
        }).catch(() => {});

        // Sync with Firestore user_devices with authenticated session
        try {
          await ensureFirebaseAuth();
          await setDoc(doc(db, 'user_devices', deviceId), {
            id: deviceId,
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            endpoint: cleanEndpoint,
            token: cleanEndpoint,
            subscription: subJson,
            deviceInfo,
            active: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch {
          // Firestore non-blocking
        }

        localStorage.setItem(`andradeagro_push_active_${currentUser.id}`, 'true');
        console.log(`[Push Notification] Device verified and synchronized for ${currentUser.name} (${currentUser.role}).`);
      }
    } catch (syncErr) {
      console.warn('[Push Notification] Non-blocking auto-sync notice:', syncErr);
    }
  }

  // Also check if there are pending events to flush
  flushPendingPushEvents().catch(() => {});
}

/**
 * Fetch server-side notification status and active device diagnostics
 */
export async function fetchServerNotificationStatus(): Promise<{
  vapidConfigured: boolean;
  vapidPublicKey?: string;
  totalDevices: number;
  activeAuthorizedCount: number;
  authorizedDevices: Array<{
    userName: string;
    userRole: string;
    platform: string;
    updatedAt: string;
  }>;
} | null> {
  try {
    const res = await fetch('/api/notifications/status');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Logout cleanup: keeps push token valid on mobile device so alerts continue to arrive
 */
export async function cleanupPushOnLogout(currentUser: User): Promise<void> {
  // Device subscription is intentionally retained so mobile devices continue to receive critical fleet alerts
  console.log(`[Push Notification] User ${currentUser.name} logged out; push notification subscription preserved.`);
}
