import express from 'express';
import path from 'path';
import fs from 'fs';
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
    if (index >= 0) {
      list[index] = { ...list[index], ...log };
    } else {
      list.unshift(log);
    }
    serverDb['andradeagro_maintenance_logs_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
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
    if (index >= 0) {
      list[index] = { ...list[index], ...issue };
    } else {
      list.unshift(issue);
    }
    serverDb['andradeagro_machine_issues_v1'] = list;
    dbVersion = Date.now();
    saveDatabase();
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

