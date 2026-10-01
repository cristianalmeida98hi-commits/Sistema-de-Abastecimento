import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import webpushLib from 'web-push';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { createServer as createViteServer } from 'vite';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, INITIAL_MACHINE_ISSUES, INITIAL_PREVENTIVE_ITEMS 
} from './src/data/seedData';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware for local development, PWA, mobile devices, and preview iframes
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Central Database Persistence Setup
  const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
  let serverDb: Record<string, any> = {};
  let dbVersion = Date.now();

  function loadDatabase() {
    try {
      const dataDir = path.dirname(DB_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        serverDb = JSON.parse(raw);
        console.log('[AndradeAgro DB] Loaded database from disk.');
      }
    } catch (err) {
      console.error('[AndradeAgro DB] Error loading database:', err);
    }

    // Seed missing collections in central DB
    let seeded = false;
    if (!serverDb['andradeagro_users_v1'] || serverDb['andradeagro_users_v1'].length === 0) {
      serverDb['andradeagro_users_v1'] = INITIAL_USERS;
      seeded = true;
    }
    if (!serverDb['andradeagro_vehicles_v1'] || serverDb['andradeagro_vehicles_v1'].length === 0) {
      serverDb['andradeagro_vehicles_v1'] = INITIAL_VEHICLES;
      seeded = true;
    }
    if (!serverDb['andradeagro_gas_stations_v1'] || serverDb['andradeagro_gas_stations_v1'].length === 0) {
      serverDb['andradeagro_gas_stations_v1'] = INITIAL_GAS_STATIONS;
      seeded = true;
    }
    if (serverDb['andradeagro_fuel_logs_v1'] === undefined) {
      serverDb['andradeagro_fuel_logs_v1'] = INITIAL_FUEL_LOGS;
      seeded = true;
    }
    if (serverDb['andradeagro_maintenance_logs_v1'] === undefined) {
      serverDb['andradeagro_maintenance_logs_v1'] = INITIAL_MAINTENANCE_LOGS;
      seeded = true;
    }
    if (serverDb['andradeagro_machine_issues_v1'] === undefined) {
      serverDb['andradeagro_machine_issues_v1'] = INITIAL_MACHINE_ISSUES;
      seeded = true;
    }
    if (serverDb['andradeagro_preventive_items_v1'] === undefined) {
      serverDb['andradeagro_preventive_items_v1'] = INITIAL_PREVENTIVE_ITEMS;
      seeded = true;
    }
    if (serverDb['andradeagro_alerts_v1'] === undefined) {
      serverDb['andradeagro_alerts_v1'] = INITIAL_ALERTS;
      seeded = true;
    }
    if (serverDb['andradeagro_audit_logs_v1'] === undefined) {
      serverDb['andradeagro_audit_logs_v1'] = INITIAL_AUDIT_LOGS;
      seeded = true;
    }
    if (!serverDb['andradeagro_settings_v1']) {
      serverDb['andradeagro_settings_v1'] = INITIAL_SETTINGS;
      seeded = true;
    }
    if (!serverDb['andradeagro_processed_push_events']) {
      serverDb['andradeagro_processed_push_events'] = [];
      seeded = true;
    }

    if (seeded) {
      saveDatabase();
    }
  }

  function saveDatabase() {
    try {
      const dataDir = path.dirname(DB_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(serverDb, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AndradeAgro DB] Error saving database:', err);
    }
  }

  loadDatabase();

  // Web Push / FCM VAPID Configuration Setup
  const OFFICIAL_VAPID_PUBLIC_KEY = 'BGk3AhmnXVavteh2WDsz5PLh4flo97VKKiLbTByKGeT7nSCgGrhm2LVdMgIpcYAt7Kih5zfOWJeJrev6h5mW6ig';

  const wp = (webpushLib as any).default || webpushLib;

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

  function verifyVapidKeyPair(pubKey: string, privKey: string) {
    const cleanPub = cleanKey(pubKey);
    const cleanPriv = cleanKey(privKey);
    const pubPrefix = cleanPub ? `${cleanPub.slice(0, 8)}...${cleanPub.slice(-6)}` : 'AUSENTE';

    if (!cleanPub) return { matches: false, publicKeyPrefix: pubPrefix, privateKeyConfigured: false, error: 'Chave pública VAPID ausente.' };
    if (!cleanPriv) return { matches: false, publicKeyPrefix: pubPrefix, privateKeyConfigured: false, error: 'Chave privada VAPID ausente no ambiente (VAPID_PRIVATE_KEY não informada).' };
    try {
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.setPrivateKey(parsePrivKeyBuf(cleanPriv));
      const derivedPub = ecdh.getPublicKey('base64url');
      const derivedPrefix = `${derivedPub.slice(0, 8)}...${derivedPub.slice(-6)}`;
      if (normalizeBase64Url(derivedPub) === normalizeBase64Url(cleanPub)) {
        return { matches: true, publicKeyPrefix: pubPrefix, privateKeyConfigured: true, derivedPublicKeyPrefix: derivedPrefix };
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
      return { matches: false, publicKeyPrefix: pubPrefix, privateKeyConfigured: true, error: 'Formato de chave privada VAPID inválido: ' + (err?.message || err) };
    }
  }

  function getCurrentVapidKeys() {
    loadDatabase();
    const envVapidPublic = cleanKey(process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY);
    const envVapidPrivate = cleanKey(process.env.VAPID_PRIVATE_KEY || process.env.PRIVATE_VAPID_KEY);
    const dbVapidKeys = serverDb['andradeagro_vapid_keys'] || {};
    const dbVapidPrivate = cleanKey(dbVapidKeys.privateKey);

    const publicKey = envVapidPublic || cleanKey(dbVapidKeys.publicKey) || OFFICIAL_VAPID_PUBLIC_KEY;
    let chosenPrivate = envVapidPrivate || dbVapidPrivate || '';

    // Se o ambiente possui chave conflitante mas o banco persistente possui a chave correta pareada com o Firebase
    if (envVapidPrivate && dbVapidPrivate) {
      const envCheck = verifyVapidKeyPair(publicKey, envVapidPrivate);
      if (!envCheck.matches) {
        const dbCheck = verifyVapidKeyPair(publicKey, dbVapidPrivate);
        if (dbCheck.matches) {
          chosenPrivate = dbVapidPrivate;
        }
      }
    }

    const subject = cleanKey(process.env.VAPID_SUBJECT || dbVapidKeys.subject || 'mailto:suporte@andradeagro.com.br');
    return { publicKey, privateKey: chosenPrivate, subject };
  }

  try {
    const keys = getCurrentVapidKeys();
    const keyCheck = verifyVapidKeyPair(keys.publicKey, keys.privateKey);
    if (keyCheck.matches) {
      wp.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
      console.log(`[Push Notification] Web Push VAPID setup successfully configured com chave do Firebase (${keyCheck.publicKeyPrefix}).`);
    } else {
      console.warn(`[Push Notification] Configuração VAPID pendente/divergente: ${keyCheck.error}`);
    }
  } catch (err) {
    console.error('[Push Notification] Error configuring VAPID:', err);
  }

  // Firebase Firestore server-side sync setup
  const firebaseServerConfig = {
    apiKey: "AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY",
    authDomain: "andrade-agro.firebaseapp.com",
    projectId: "andrade-agro",
    storageBucket: "andrade-agro.firebasestorage.app",
    messagingSenderId: "271695349839",
    appId: "1:271695349839:web:4428ed928e6423b9adc23a"
  };

  let serverFirebaseApp: any = null;
  let serverFirestore: any = null;

  function getServerFirestoreInstance() {
    if (!serverFirestore) {
      serverFirebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseServerConfig);
      serverFirestore = getFirestore(serverFirebaseApp);
    }
    return { app: serverFirebaseApp, db: serverFirestore };
  }

  function isValidPushSubscription(sub: any): boolean {
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

  function getStableDeviceId(endpoint: string): string {
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

  async function fetchRegisteredDevices(): Promise<any[]> {
    const deviceMap = new Map<string, any>();

    // Fetch real devices directly from Firestore (SOLE SOURCE OF TRUTH) with endpoint deduplication
    try {
      const { app, db } = getServerFirestoreInstance();
      const auth = getAuth(app);
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => null);
      }
      
      const snapPromise = getDocs(collection(db, 'user_devices'));
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de consulta do Firestore (3000ms)')), 3000)
      );
      const snap = await Promise.race([snapPromise, timeoutPromise]);

      const docMap = new Map<string, { record: any; timestamp: number; active: boolean }>();

      snap.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (data && data.subscription) {
          const endpoint = data.endpoint || data.subscription?.endpoint;
          if (endpoint && isValidPushSubscription(data.subscription)) {
            const docUpdatedAt = data.updatedAt || data.createdAt || '';
            const docTimestamp = docUpdatedAt ? new Date(docUpdatedAt).getTime() : 0;
            const existing = docMap.get(endpoint);

            if (!existing || docTimestamp >= existing.timestamp) {
              docMap.set(endpoint, {
                record: {
                  id: docSnap.id,
                  userId: data.userId || '',
                  userEmail: data.userEmail || '',
                  userName: data.userName || 'Usuário',
                  userRole: data.userRole || data.role || 'FUNCIONARIO',
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

      for (const item of docMap.values()) {
        if (item.active) {
          deviceMap.set(item.record.endpoint, item.record);
        } else {
          deviceMap.delete(item.record.endpoint);
        }
      }
    } catch (err: any) {
      console.warn('[Push Notification] Warning fetching devices from Firestore:', err?.message || err);
    }

    return Array.from(deviceMap.values());
  }

  // UNIFIED DEVICE SELECTION: getActiveAuthorizedDevices
  async function getActiveAuthorizedDevices(options?: {
    targetUserId?: string;
    directSubscription?: any;
    directUserName?: string;
    directUserRole?: string;
  }) {
    const devices = await fetchRegisteredDevices();
    const endpointMap = new Map<string, { record: any; timestamp: number; active: boolean }>();

    for (const d of devices) {
      if (d.endpoint && isValidPushSubscription(d.subscription)) {
        const docUpdatedAt = d.updatedAt || d.createdAt || '';
        const docTimestamp = docUpdatedAt ? new Date(docUpdatedAt).getTime() : 0;
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

    if (options?.directSubscription && isValidPushSubscription(options.directSubscription)) {
      const ep = options.directSubscription.endpoint;
      endpointMap.set(ep, {
        record: {
          id: getStableDeviceId(ep),
          userId: options.targetUserId || 'direct-test-user',
          userName: options.directUserName || 'Usuário Atual',
          userRole: options.directUserRole || 'USUARIO',
          endpoint: ep,
          subscription: options.directSubscription,
          deviceInfo: {},
          active: true,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        },
        timestamp: Date.now(),
        active: true
      });
    }

    const allConsolidated = Array.from(endpointMap.values());
    const activeDevices = allConsolidated
      .filter(item => item.active && item.record.active !== false)
      .map(item => item.record)
      .filter(d => {
        if (!isValidPushSubscription(d.subscription)) return false;
        if (options?.targetUserId && d.userId !== options.targetUserId) return false;
        return true;
      });

    return {
      activeDevices,
      totalDevices: allConsolidated.length,
      querySuccess: true,
      source: 'FIRESTORE'
    };
  }

  async function deactivateEndpoint(endpoint: string) {
    if (!endpoint) return;

    // Update Firestore directly
    try {
      const { app, db } = getServerFirestoreInstance();
      const auth = getAuth(app);
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => null);
      }
      const stableId = getStableDeviceId(endpoint);
      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, 'user_devices', stableId), {
        active: false,
        authorized: false,
        updatedAt: nowIso
      }).catch(async () => {
        // Fallback: search by endpoint field if stableId differed
        const snap = await getDocs(collection(db, 'user_devices'));
        snap.forEach(async (docSnap) => {
          const data = docSnap.data();
          if (data.endpoint === endpoint || data.subscription?.endpoint === endpoint) {
            await updateDoc(doc(db, 'user_devices', docSnap.id), {
              active: false,
              authorized: false,
              updatedAt: nowIso
            }).catch(() => null);
          }
        });
      });
    } catch (err: any) {
      console.warn('[Push Notification] Warning deactivating in Firestore:', err?.message || err);
    }
  }

  // Helper function to dispatch push notifications to authorized devices (ADMIN and MANUTENCAO only)
  async function dispatchPushToAuthorizedUsers(event: {
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
  }) {
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

    // Deduplication check
    let processedList: string[] = serverDb['andradeagro_processed_push_events'] || [];
    if (processedList.includes(eventId)) {
      console.log(`[Push Notification] Event ${eventId} already processed. Deduplicating.`);
      return {
        ok: false,
        success: false,
        duplicate: true,
        totalDevices: 0,
        sent: 0,
        sentCount: 0,
        failed: 0,
        failedCount: 0,
        removed: 0,
        removedCount: 0,
        recipientsCount: 0,
        stage: 'inicio',
        message: 'Evento duplicado já processado anteriormente.'
      };
    }

    processedList.push(eventId);
    if (processedList.length > 500) {
      processedList = processedList.slice(-500);
    }
    serverDb['andradeagro_processed_push_events'] = processedList;
    saveDatabase();

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

    console.log(`[Push Notification] [1. Início] Preparando envio de ${eventType} (ID: ${eventId})`);

    // Fetch active authorized devices using the unified function
    const devicesResult = await getActiveAuthorizedDevices({
      targetUserId: eventType !== 'TEST' ? targetUserId : undefined,
      directSubscription,
      directUserName,
      directUserRole
    });

    const targetDevices = devicesResult.activeDevices;
    console.log(`[Push Notification] [2. Dispositivos] Encontrados ${targetDevices.length} dispositivo(s) válido(s) e ativo(s) de ${devicesResult.totalDevices} totais.`);

    if (targetDevices.length === 0) {
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
        message: 'Nenhum dispositivo registrado com permissão ativa e chaves válidas para receber notificações push.'
      };
    }

    // Step 3.5: Validate VAPID key pair dynamically
    const currentKeys = getCurrentVapidKeys();
    const keyCheck = verifyVapidKeyPair(currentKeys.publicKey, currentKeys.privateKey);
    if (!keyCheck.matches && (!currentKeys.publicKey || !currentKeys.privateKey)) {
      const keyError = keyCheck.error || 'Configuração VAPID incompleta ou divergente';
      console.warn(`[Push Notification] [Aviso VAPID] ${keyError}`);
      return {
        ok: false,
        success: false,
        duplicate: false,
        totalDevices: targetDevices.length,
        sent: 0,
        sentCount: 0,
        failed: 0,
        failedCount: 0,
        removed: 0,
        removedCount: 0,
        recipientsCount: targetDevices.length,
        stage: 'validacao_chaves',
        errors: [keyError],
        message: keyError
      };
    }

    let sentCount = 0;
    let failedCount = 0;
    const invalidEndpoints: string[] = [];
    const dispatchErrors: string[] = [];

    const serverVapidOptions = {
      vapidDetails: {
        subject: currentKeys.subject,
        publicKey: currentKeys.publicKey,
        privateKey: currentKeys.privateKey
      },
      TTL: 86400
    };

    // Step 4: Push delivery to each target
    await Promise.all(
      targetDevices.map(async (device) => {
        try {
          const sendPromise = wp.sendNotification(device.subscription, payload, serverVapidOptions);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout de 3500ms no envio push')), 3500)
          );
          const pushRes = await Promise.race([sendPromise, timeoutPromise]);
          sentCount++;
          console.log(`[Push Notification] [4. Sucesso] Entregue para ${device.userName} (${device.endpoint.slice(0, 30)}...) - Status ${pushRes?.statusCode || 201}`);
        } catch (err: any) {
          failedCount++;
          const errStatus = err?.statusCode || 'ERR';
          const errMsg = err?.body || err?.message || 'Falha no envio push';
          const detail = `Status ${errStatus}: ${errMsg}`;
          dispatchErrors.push(detail);
          console.warn(`[Push Notification] [4. Falha] Erro ao enviar para ${device.userName}:`, detail);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            invalidEndpoints.push(device.subscription.endpoint);
          }
        }
      })
    );

    // Clean up expired tokens
    if (invalidEndpoints.length > 0) {
      for (const endpoint of invalidEndpoints) {
        await deactivateEndpoint(endpoint).catch(() => null);
      }
      console.log(`[Push Notification] [5. Limpeza] Desativadas ${invalidEndpoints.length} inscrições expiradas.`);
    }

    const isSuccess = sentCount > 0;
    return {
      ok: isSuccess,
      success: isSuccess,
      duplicate: false,
      totalDevices: targetDevices.length,
      sent: sentCount,
      sentCount,
      failed: failedCount,
      failedCount,
      removed: invalidEndpoints.length,
      removedCount: invalidEndpoints.length,
      recipientsCount: targetDevices.length,
      stage: isSuccess ? 'sucesso' : 'servico_push',
      errors: dispatchErrors.length > 0 ? dispatchErrors : undefined,
      message: isSuccess
        ? `Notificação entregue com sucesso para ${sentCount} de ${targetDevices.length} dispositivo(s).` + (failedCount > 0 ? ` (${failedCount} falha(s))` : '')
        : `Falha ao entregar push para ${failedCount} dispositivo(s): ${dispatchErrors.join('; ')}`
    };
  }

  // PUSH NOTIFICATIONS API
  app.get(['/api/notifications/vapid-public-key', '/api/notificacoes/vapid-public-key'], (req, res) => {
    const key = getCurrentVapidKeys().publicKey || OFFICIAL_VAPID_PUBLIC_KEY;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ publicKey: key });
  });

  app.post('/api/notifications/reset-event-dedup', (req, res) => {
    try {
      const { prefix, eventId } = req.body;
      let processedList: string[] = serverDb['andradeagro_processed_push_events'] || [];
      const beforeCount = processedList.length;
      if (eventId) {
        processedList = processedList.filter((id: string) => id !== eventId);
      } else if (prefix) {
        processedList = processedList.filter((id: string) => !id.startsWith(prefix));
      } else {
        processedList = [];
      }
      serverDb['andradeagro_processed_push_events'] = processedList;
      saveDatabase();
      console.log(`[Push Notification] Reset event dedup (prefix: ${prefix || 'ALL'}, removed: ${beforeCount - processedList.length}).`);
      res.json({ success: true, removedCount: beforeCount - processedList.length, remainingCount: processedList.length });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset event deduplication' });
    }
  });

  app.post('/api/notifications/subscribe', async (req, res) => {
    try {
      const { userId, userEmail, userName, userRole, subscription, deviceInfo } = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ ok: false, error: 'Endpoint da PushSubscription não informado ou inválido' });
      }

      if (!isValidPushSubscription(subscription)) {
        return res.status(400).json({ ok: false, error: 'Chaves de inscrição push inválidas (p256dh/auth malformatadas).' });
      }

      const stableId = getStableDeviceId(subscription.endpoint);
      const nowIso = new Date().toISOString();

      const deviceRecord = {
        id: stableId,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys?.p256dh || '',
          auth: subscription.keys?.auth || ''
        },
        subscription,
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
      };

      // Save directly to Firestore (SOLE SOURCE OF TRUTH)
      const { app: fbApp, db } = getServerFirestoreInstance();
      const auth = getAuth(fbApp);
      if (!auth.currentUser) {
        await signInAnonymously(auth).catch(() => null);
      }
      await setDoc(doc(db, 'user_devices', stableId), deviceRecord, { merge: true });

      console.log(`[Push Notification] Registered device subscription in Firestore for ${userName} (${userRole}): ${stableId}`);
      res.json({
        ok: true,
        deviceId: stableId,
        message: 'Dispositivo sincronizado com sucesso',
        device: deviceRecord
      });
    } catch (err: any) {
      console.error('[Push Notification] Error saving subscription:', err);
      res.status(500).json({ ok: false, error: 'Falha ao sincronizar dispositivo no Firestore: ' + (err?.message || err), stage: 'firestore' });
    }
  });

  app.post('/api/notifications/unsubscribe', async (req, res) => {
    try {
      const { endpoint, deviceId } = req.body;
      if (endpoint) {
        await deactivateEndpoint(endpoint);
      } else if (deviceId) {
        const { app: fbApp, db } = getServerFirestoreInstance();
        const auth = getAuth(fbApp);
        if (!auth.currentUser) {
          await signInAnonymously(auth).catch(() => null);
        }
        await updateDoc(doc(db, 'user_devices', deviceId), {
          active: false,
          authorized: false,
          updatedAt: new Date().toISOString()
        }).catch(() => null);
      }
      res.json({ ok: true, message: 'Dispositivo desativado com sucesso' });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: 'Falha ao desinscrever dispositivo: ' + (err?.message || err), stage: 'firestore' });
    }
  });

  app.post('/api/notifications/dispatch-event', async (req, res) => {
    try {
      const { eventType, eventId, equipmentName, description, equipmentId, targetUserId, customTitle } = req.body;
      if (!eventType || !eventId) {
        return res.status(400).json({ ok: false, error: 'eventType e eventId são obrigatórios' });
      }

      const result = await dispatchPushToAuthorizedUsers({
        eventType,
        eventId,
        equipmentName: equipmentName || 'Equipamento Agrícola',
        description: description || 'Evento registrado no sistema.',
        equipmentId,
        targetUserId,
        customTitle
      });

      res.json(result);
    } catch (err: any) {
      console.error('[Push Notification] Error dispatching event:', err);
      res.status(500).json({ 
        ok: false,
        success: false, 
        error: 'Falha ao despachar notificação: ' + (err?.message || err),
        sentCount: 0 
      });
    }
  });

  app.post('/api/notifications/test', async (req, res) => {
    try {
      const { userId, userName, userRole, title, description, subscription } = req.body;
      const result = await dispatchPushToAuthorizedUsers({
        eventType: 'TEST',
        eventId: `test-${Date.now()}`,
        equipmentName: 'AndradeAgro',
        description: description || 'Notificações Push funcionando.',
        customTitle: title || 'Teste AndradeAgro',
        targetUserId: userId,
        directSubscription: subscription,
        directUserName: userName,
        directUserRole: userRole
      });
      res.json({
        ok: result.ok || result.success,
        success: result.ok || result.success,
        totalDevices: result.totalDevices,
        sent: result.sent !== undefined ? result.sent : result.sentCount,
        sentCount: result.sentCount,
        failed: result.failed !== undefined ? result.failed : result.failedCount,
        failedCount: result.failedCount,
        removed: result.removed !== undefined ? result.removed : (result.removedCount || 0),
        removedCount: result.removedCount || 0,
        recipientsCount: result.recipientsCount,
        stage: result.stage,
        errors: result.errors,
        message: result.message
      });
    } catch (err: any) {
      console.error('[Push Notification] Error in test endpoint:', err);
      res.status(500).json({ 
        ok: false,
        success: false, 
        error: 'Falha ao processar teste de push: ' + (err?.message || err),
        totalDevices: 0,
        sent: 0,
        sentCount: 0,
        failed: 1,
        failedCount: 1,
        removed: 0,
        removedCount: 0
      });
    }
  });

  app.get('/api/notifications/devices', async (req, res) => {
    try {
      const devices = await fetchRegisteredDevices();
      const sanitized = devices.map(d => ({
        id: d.id,
        endpoint: d.endpoint,
        keys: d.subscription?.keys || {},
        userId: d.userId,
        userEmail: d.userEmail || '',
        userName: d.userName,
        role: d.userRole || d.role || 'FUNCIONARIO',
        userRole: d.userRole || d.role || 'FUNCIONARIO',
        platform: d.deviceInfo?.platform || d.platform || 'desconhecido',
        userAgent: d.deviceInfo?.userAgent || d.userAgent || '',
        isPWA: Boolean(d.deviceInfo?.isPWA || d.isPWA),
        isMobile: Boolean(d.deviceInfo?.isMobile || d.isMobile),
        permission: d.permission || 'granted',
        authorized: d.authorized !== false,
        active: d.active !== false,
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
        lastSeenAt: d.lastSeenAt || d.updatedAt,
        endpointPreview: d.endpoint ? `${d.endpoint.slice(0, 35)}...` : 'N/A'
      }));
      res.json({ ok: true, devices: sanitized, count: sanitized.length, total: sanitized.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: 'Falha ao listar dispositivos no Firestore: ' + (err?.message || err), stage: 'firestore' });
    }
  });

  app.get(['/api/notifications/status', '/api/notificacoes/status'], async (req, res) => {
    try {
      const result = await getActiveAuthorizedDevices();
      const currentKeys = getCurrentVapidKeys();
      const keyCheck = verifyVapidKeyPair(currentKeys.publicKey, currentKeys.privateKey);
      res.json({
        ok: result.querySuccess,
        success: result.querySuccess,
        backendWorking: true,
        vapidConfigured: keyCheck.matches,
        vapidKeyPairMatches: keyCheck.matches,
        vapidPublicKeyPrefix: keyCheck.publicKeyPrefix,
        vapidPrivateKeyConfigured: keyCheck.privateKeyConfigured,
        vapidError: !keyCheck.matches ? keyCheck.error : undefined,
        vapidPublicKey: currentKeys.publicKey,
        firestoreAccessible: result.querySuccess,
        totalDevices: result.totalDevices,
        activeAuthorizedCount: result.activeDevices.length,
        validSubscriptionsCount: result.activeDevices.length,
        authorizedDevices: result.activeDevices.map(d => ({
          id: d.id,
          userName: d.userName,
          userRole: d.userRole || d.role,
          platform: d.deviceInfo?.platform || d.platform || 'desconhecido',
          updatedAt: d.updatedAt
        })),
        source: result.source
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        success: false,
        backendWorking: false,
        firestoreAccessible: false,
        error: 'Falha ao consultar status: ' + (err?.message || err),
        stage: 'firestore',
        totalDevices: 0,
        activeAuthorizedCount: 0,
        validSubscriptionsCount: 0,
        authorizedDevices: []
      });
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      system: 'AndradeAgro',
      slogan: 'Tecnologia para gestão inteligente do agronegócio.',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/info', (req, res) => {
    res.json({
      name: 'AndradeAgro',
      version: '2.4.0',
      description: 'Sistema completo de controle de abastecimento, frotas, máquinas e manutenções agrícolas.',
      developer: 'AndradeAgro Tech Team'
    });
  });

  // Central Database Sync Endpoints
  app.get('/api/db', (req, res) => {
    res.json({
      version: dbVersion,
      data: serverDb
    });
  });

  app.post('/api/db', (req, res) => {
    const { key, value, fullData } = req.body || {};
    if (fullData && typeof fullData === 'object') {
      serverDb = { ...serverDb, ...fullData };
      dbVersion = Date.now();
      saveDatabase();
    } else if (key) {
      serverDb[key] = value;
      dbVersion = Date.now();
      saveDatabase();
    }
    res.json({ success: true, version: dbVersion, data: serverDb });
  });

  app.post('/api/db/sync', (req, res) => {
    const { clientData } = req.body || {};
    let updated = false;

    if (clientData && typeof clientData === 'object') {
      for (const [key, val] of Object.entries(clientData)) {
        if (serverDb[key] === undefined && val !== undefined) {
          serverDb[key] = val;
          updated = true;
        }
      }
    }

    if (updated) {
      dbVersion = Date.now();
      saveDatabase();
    }

    res.json({ version: dbVersion, data: serverDb });
  });

  // MACHINES API
  app.get('/api/machines', (req, res) => {
    res.json(serverDb['andradeagro_vehicles_v1'] || []);
  });

  app.post('/api/machines', (req, res) => {
    const machine = req.body;
    let list = serverDb['andradeagro_vehicles_v1'] || [];
    const index = list.findIndex((m: any) => m.id === machine.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...machine };
    } else {
      list.unshift(machine);
    }
    serverDb['andradeagro_vehicles_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true, data: machine });
  });

  app.put('/api/machines/:id', (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let list = serverDb['andradeagro_vehicles_v1'] || [];
    const index = list.findIndex((m: any) => m.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...fields };
      serverDb['andradeagro_vehicles_v1'] = list;
      dbVersion = Date.now();
      saveDatabase();
      res.json({ success: true, data: list[index] });
    } else {
      res.status(404).json({ error: 'Machine not found' });
    }
  });

  app.delete('/api/machines/:id', (req, res) => {
    const { id } = req.params;
    let list = serverDb['andradeagro_vehicles_v1'] || [];
    list = list.filter((m: any) => m.id !== id);
    serverDb['andradeagro_vehicles_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true });
  });

  // EMPLOYEES API
  app.get('/api/employees', (req, res) => {
    res.json(serverDb['andradeagro_users_v1'] || []);
  });

  app.post('/api/employees', (req, res) => {
    const user = req.body;
    let list = serverDb['andradeagro_users_v1'] || [];
    const index = list.findIndex((u: any) => u.id === user.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...user };
    } else {
      list.unshift(user);
    }
    serverDb['andradeagro_users_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true, data: user });
  });

  app.put('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let list = serverDb['andradeagro_users_v1'] || [];
    const index = list.findIndex((u: any) => u.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...fields };
      serverDb['andradeagro_users_v1'] = list;
      dbVersion = Date.now();
      saveDatabase();
      res.json({ success: true, data: list[index] });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });

  app.delete('/api/employees/:id', (req, res) => {
    const { id } = req.params;
    let list = serverDb['andradeagro_users_v1'] || [];
    list = list.filter((u: any) => u.id !== id);
    serverDb['andradeagro_users_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true });
  });

  // FUEL RECORDS API
  app.get('/api/fuel-records', (req, res) => {
    res.json(serverDb['andradeagro_fuel_logs_v1'] || []);
  });

  app.post('/api/fuel-records', (req, res) => {
    const log = req.body;
    let list = serverDb['andradeagro_fuel_logs_v1'] || [];
    const index = list.findIndex((f: any) => f.id === log.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...log };
    } else {
      list.unshift(log);
    }
    serverDb['andradeagro_fuel_logs_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true, data: log });
  });

  app.delete('/api/fuel-records/:id', (req, res) => {
    const { id } = req.params;
    let list = serverDb['andradeagro_fuel_logs_v1'] || [];
    list = list.filter((f: any) => f.id !== id);
    serverDb['andradeagro_fuel_logs_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true });
  });

  // MAINTENANCE API
  app.get('/api/maintenance', (req, res) => {
    res.json(serverDb['andradeagro_maintenance_logs_v1'] || []);
  });

  app.post('/api/maintenance', (req, res) => {
    const log = req.body;
    let list = serverDb['andradeagro_maintenance_logs_v1'] || [];
    const index = list.findIndex((m: any) => m.id === log.id);
    const isNew = index < 0;
    if (index >= 0) {
      list[index] = { ...list[index], ...log };
    } else {
      list.unshift(log);
    }
    serverDb['andradeagro_maintenance_logs_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();

    if (isNew) {
      dispatchPushToAuthorizedUsers({
        eventType: 'NEW_MAINTENANCE',
        eventId: log.id || `mnt-${Date.now()}`,
        equipmentName: log.equipmentName || 'Máquina / Veículo',
        description: log.description || log.type || 'Manutenção registrada.'
      }).catch(err => console.error('[Push Notification] Error on maintenance trigger:', err));
    }

    res.json({ success: true, data: log });
  });

  app.put('/api/maintenance/:id', (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let list = serverDb['andradeagro_maintenance_logs_v1'] || [];
    const index = list.findIndex((m: any) => m.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...fields };
      serverDb['andradeagro_maintenance_logs_v1'] = list;
      dbVersion = Date.now();
      saveDatabase();
      res.json({ success: true, data: list[index] });
    } else {
      res.status(404).json({ error: 'Maintenance record not found' });
    }
  });

  app.delete('/api/maintenance/:id', (req, res) => {
    const { id } = req.params;
    let list = serverDb['andradeagro_maintenance_logs_v1'] || [];
    list = list.filter((m: any) => m.id !== id);
    serverDb['andradeagro_maintenance_logs_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true });
  });

  // GAS STATIONS API
  app.get('/api/gas-stations', (req, res) => {
    res.json(serverDb['andradeagro_gas_stations_v1'] || []);
  });

  app.post('/api/gas-stations', (req, res) => {
    const station = req.body;
    let list = serverDb['andradeagro_gas_stations_v1'] || [];
    const index = list.findIndex((g: any) => g.id === station.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...station };
    } else {
      list.unshift(station);
    }
    serverDb['andradeagro_gas_stations_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true, data: station });
  });

  app.put('/api/gas-stations/:id', (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let list = serverDb['andradeagro_gas_stations_v1'] || [];
    const index = list.findIndex((g: any) => g.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...fields };
      serverDb['andradeagro_gas_stations_v1'] = list;
      dbVersion = Date.now();
      saveDatabase();
      res.json({ success: true, data: list[index] });
    } else {
      res.status(404).json({ error: 'Gas station not found' });
    }
  });

  app.delete('/api/gas-stations/:id', (req, res) => {
    const { id } = req.params;
    let list = serverDb['andradeagro_gas_stations_v1'] || [];
    list = list.filter((g: any) => g.id !== id);
    serverDb['andradeagro_gas_stations_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
    res.json({ success: true });
  });

  // ISSUES API
  app.get('/api/issues', (req, res) => {
    res.json(serverDb['andradeagro_machine_issues_v1'] || []);
  });

  app.post('/api/issues', (req, res) => {
    const issue = req.body;
    let list = serverDb['andradeagro_machine_issues_v1'] || [];
    const index = list.findIndex((i: any) => i.id === issue.id);
    const isNew = index < 0;
    if (index >= 0) {
      list[index] = { ...list[index], ...issue };
    } else {
      list.unshift(issue);
    }
    serverDb['andradeagro_machine_issues_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();

    if (isNew) {
      dispatchPushToAuthorizedUsers({
        eventType: 'NEW_ISSUE',
        eventId: issue.id || `iss-${Date.now()}`,
        equipmentName: issue.equipmentName || 'Máquina Agrícola',
        description: issue.description || 'Problema reportado.'
      }).catch(err => console.error('[Push Notification] Error on issue trigger:', err));
    }

    res.json({ success: true, data: issue });
  });

  app.put('/api/issues/:id', (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    let list = serverDb['andradeagro_machine_issues_v1'] || [];
    const index = list.findIndex((i: any) => i.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...fields };
      serverDb['andradeagro_machine_issues_v1'] = list;
      dbVersion = Date.now();
      saveDatabase();
      res.json({ success: true, data: list[index] });
    } else {
      res.status(404).json({ error: 'Issue not found' });
    }
  });

  // Strict catch-all for unhandled /api/* routes - ALWAYS return JSON 404, never HTML!
  app.all('/api/*', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({
      success: false,
      error: `Endpoint de API não encontrado: ${req.method} ${req.path}`,
      message: 'A rota de API solicitada não existe no servidor.'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AndradeAgro] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

