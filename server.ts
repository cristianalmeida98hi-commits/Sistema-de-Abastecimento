import express from 'express';
import path from 'path';
import fs from 'fs';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { 
  INITIAL_USERS, INITIAL_VEHICLES, INITIAL_GAS_STATIONS, 
  INITIAL_FUEL_LOGS, INITIAL_MAINTENANCE_LOGS, INITIAL_ALERTS, 
  INITIAL_AUDIT_LOGS, INITIAL_SETTINGS, INITIAL_MACHINE_ISSUES, INITIAL_PREVENTIVE_ITEMS 
} from './src/data/seedData';

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    if (!serverDb['andradeagro_user_devices_v1']) {
      serverDb['andradeagro_user_devices_v1'] = [];
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
  let vapidKeys = serverDb['andradeagro_vapid_keys'];
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  } else if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
    vapidKeys = webpush.generateVAPIDKeys();
    serverDb['andradeagro_vapid_keys'] = vapidKeys;
    saveDatabase();
    console.log('[Push Notification] Generated persistent VAPID keys.');
  }

  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:suporte@andradeagro.com.br';
  try {
    webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);
    console.log('[Push Notification] Web Push VAPID setup successfully configured.');
  } catch (err) {
    console.error('[Push Notification] Error configuring VAPID:', err);
  }

  // Helper function to dispatch push notifications to authorized devices (ADMIN and MANUTENCAO only)
  async function dispatchPushToAuthorizedUsers(event: {
    eventType: 'NEW_ISSUE' | 'NEW_MAINTENANCE' | 'OIL_CHANGE_DUE' | 'TEST';
    eventId: string;
    equipmentName: string;
    description: string;
    equipmentId?: string;
    targetUserId?: string;
  }) {
    const { eventType, eventId, equipmentName, description, equipmentId, targetUserId } = event;

    // Deduplication check
    let processedList: string[] = serverDb['andradeagro_processed_push_events'] || [];
    if (processedList.includes(eventId)) {
      console.log(`[Push Notification] Event ${eventId} already processed. Deduplicating.`);
      return { success: false, duplicate: true, sentCount: 0 };
    }

    processedList.push(eventId);
    if (processedList.length > 500) {
      processedList = processedList.slice(-500);
    }
    serverDb['andradeagro_processed_push_events'] = processedList;
    saveDatabase();

    let title = '⚠️ Notificação AndradeAgro';
    let url = '/';

    if (eventType === 'NEW_ISSUE') {
      title = '⚠️ Novo problema registrado';
      url = `/?tab=alerts&issueId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
    } else if (eventType === 'NEW_MAINTENANCE') {
      title = '🔧 Nova manutenção registrada';
      url = `/?tab=maintenance&maintenanceId=${encodeURIComponent(eventId)}&equipmentId=${encodeURIComponent(equipmentId || '')}`;
    } else if (eventType === 'OIL_CHANGE_DUE') {
      title = '⚠️ Troca de óleo pendente';
      url = `/?tab=maintenance&equipmentId=${encodeURIComponent(equipmentId || '')}`;
    } else if (eventType === 'TEST') {
      title = '🔔 Teste de Notificação Push';
      url = '/?tab=settings';
    }

    const notificationBody = eventType === 'OIL_CHANGE_DUE'
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

    const devices: any[] = serverDb['andradeagro_user_devices_v1'] || [];
    // Strict Role Enforcement: Only ADMIN and MANUTENCAO can receive notifications. FUNCIONARIO is excluded!
    const targetDevices = devices.filter(d => {
      if (d.active === false) return false;
      if (!d.subscription || !d.subscription.endpoint) return false;
      if (targetUserId) return d.userId === targetUserId;
      return d.userRole === 'ADMIN' || d.userRole === 'MANUTENCAO';
    });

    console.log(`[Push Notification] Dispatching ${eventType} (${eventId}) to ${targetDevices.length} authorized devices.`);

    let sentCount = 0;
    let failedCount = 0;
    const invalidEndpoints: string[] = [];

    await Promise.all(
      targetDevices.map(async (device) => {
        try {
          await webpush.sendNotification(device.subscription, payload);
          sentCount++;
        } catch (err: any) {
          failedCount++;
          console.warn(`[Push Notification] Error sending push to device:`, err?.statusCode || err?.message);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            invalidEndpoints.push(device.subscription.endpoint);
          }
        }
      })
    );

    // Clean up expired tokens
    if (invalidEndpoints.length > 0) {
      serverDb['andradeagro_user_devices_v1'] = devices.map(d => {
        if (d.subscription && invalidEndpoints.includes(d.subscription.endpoint)) {
          return { ...d, active: false, updatedAt: new Date().toISOString() };
        }
        return d;
      });
      saveDatabase();
      console.log(`[Push Notification] Deactivated ${invalidEndpoints.length} expired device subscriptions.`);
    }

    return {
      success: true,
      duplicate: false,
      sentCount,
      failedCount,
      recipientsCount: targetDevices.length,
      message: targetDevices.length === 0 
        ? 'Nenhum dispositivo ativo registrado para usuários autorizados (ADMIN/MANUTENÇÃO).'
        : `Enviado para ${sentCount} de ${targetDevices.length} dispositivos.`
    };
  }


  // PUSH NOTIFICATIONS API
  app.get('/api/notifications/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.get('/api/notifications/devices', (req, res) => {
    res.json({ devices: serverDb['andradeagro_user_devices_v1'] || [] });
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

  app.post('/api/notifications/subscribe', (req, res) => {
    try {
      const { userId, userName, userRole, subscription, deviceInfo } = req.body;
      if (!userId || !subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription payload' });
      }

      let devices: any[] = serverDb['andradeagro_user_devices_v1'] || [];
      const existingIndex = devices.findIndex((d: any) => 
        d.subscription && d.subscription.endpoint === subscription.endpoint
      );

      const deviceRecord = {
        id: existingIndex >= 0 ? devices[existingIndex].id : `dev-${userId}-${Date.now()}`,
        userId,
        userName: userName || 'Usuário',
        userRole: userRole || 'FUNCIONARIO',
        endpoint: subscription.endpoint,
        subscription,
        deviceInfo: deviceInfo || {},
        active: true,
        updatedAt: new Date().toISOString(),
        createdAt: existingIndex >= 0 ? devices[existingIndex].createdAt : new Date().toISOString()
      };

      if (existingIndex >= 0) {
        devices[existingIndex] = deviceRecord;
      } else {
        devices.unshift(deviceRecord);
      }

      serverDb['andradeagro_user_devices_v1'] = devices;
      saveDatabase();
      console.log(`[Push Notification] Registered device subscription for ${userName} (${userRole}).`);

      res.json({ success: true, device: deviceRecord });
    } catch (err: any) {
      console.error('[Push Notification] Error saving subscription:', err);
      res.status(500).json({ error: 'Failed to subscribe device' });
    }
  });

  app.post('/api/notifications/unsubscribe', (req, res) => {
    try {
      const { endpoint, userId } = req.body;
      let devices: any[] = serverDb['andradeagro_user_devices_v1'] || [];

      devices = devices.map((d: any) => {
        if ((endpoint && d.subscription && d.subscription.endpoint === endpoint) || 
            (userId && !endpoint && d.userId === userId)) {
          return { ...d, active: false, updatedAt: new Date().toISOString() };
        }
        return d;
      });

      serverDb['andradeagro_user_devices_v1'] = devices;
      saveDatabase();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to unsubscribe device' });
    }
  });

  app.post('/api/notifications/dispatch-event', async (req, res) => {
    try {
      const { eventType, eventId, equipmentName, description, equipmentId } = req.body;
      if (!eventType || !eventId) {
        return res.status(400).json({ error: 'eventType and eventId are required' });
      }

      const result = await dispatchPushToAuthorizedUsers({
        eventType,
        eventId,
        equipmentName: equipmentName || 'Equipamento Agrícola',
        description: description || 'Evento registrado no sistema.',
        equipmentId
      });

      res.json(result);
    } catch (err: any) {
      console.error('[Push Notification] Error dispatching event:', err);
      res.status(500).json({ error: 'Failed to dispatch notification' });
    }
  });

  app.post('/api/notifications/test', async (req, res) => {
    try {
      const { userId } = req.body;
      const result = await dispatchPushToAuthorizedUsers({
        eventType: 'TEST',
        eventId: `test-${Date.now()}`,
        equipmentName: 'AndradeAgro',
        description: 'Notificações push em tempo real ativas e funcionando perfeitamente!',
        targetUserId: userId
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to send test push' });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

