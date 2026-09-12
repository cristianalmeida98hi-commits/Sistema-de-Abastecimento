import { User, UserRole, PushNotificationPayload } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

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

    // 3. Fetch server's VAPID public key
    const vapidRes = await fetch('/api/notifications/vapid-public-key');
    if (!vapidRes.ok) {
      throw new Error('Falha ao obter chave pública de notificação do servidor.');
    }
    const { publicKey } = await vapidRes.json();
    if (!publicKey) {
      throw new Error('Chave VAPID pública não disponível.');
    }

    // 4. Subscribe to PushManager
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const appServerKey = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey
      });
    }

    const subJson = sub.toJSON();
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

    // 5. Save device record to Firestore user_devices collection
    try {
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
}> {
  try {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });

    const data = await res.json();
    if (data.success && data.sentCount > 0) {
      return {
        success: true,
        message: 'Notificação de teste enviada com sucesso! Verifique a barra de notificações do seu dispositivo.'
      };
    } else if (data.duplicate) {
      return {
        success: true,
        message: 'Notificação recente já enviada para este dispositivo.'
      };
    } else {
      return {
        success: false,
        message: 'Nenhum dispositivo ativo encontrado para este usuário ou envio não entregue.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao testar notificação: ${err?.message || 'Falha no servidor'}`
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
      let sub = await reg.pushManager.getSubscription();

      if (!sub && perm === 'granted') {
        const vapidRes = await fetch('/api/notifications/vapid-public-key');
        if (vapidRes.ok) {
          const { publicKey } = await vapidRes.json();
          if (publicKey) {
            const appServerKey = urlBase64ToUint8Array(publicKey);
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: appServerKey
            });
          }
        }
      }

      if (sub) {
        const subJson = sub.toJSON();
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

        // Sync with Firestore user_devices
        try {
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
          // Firestore fallback handled
        }

        localStorage.setItem(`andradeagro_push_active_${currentUser.id}`, 'true');
        console.log(`[Push Notification] Device verified and active for ${currentUser.name} (${currentUser.role}).`);
      }
    } catch (syncErr) {
      console.warn('[Push Notification] Non-blocking auto-sync notice:', syncErr);
    }
  }

  // Also check if there are pending events to flush
  flushPendingPushEvents().catch(() => {});
}

/**
 * Logout cleanup: ensure device is unlinked when an authorized user logs out
 */
export async function cleanupPushOnLogout(currentUser: User): Promise<void> {
  try {
    if (currentUser.role === 'ADMIN' || currentUser.role === 'MANUTENCAO') {
      await disablePushNotifications(currentUser);
    }
  } catch {
    // Ignore cleanup error on logout
  }
}
