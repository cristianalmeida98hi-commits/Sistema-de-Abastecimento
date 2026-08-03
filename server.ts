import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Central Database Persistence Setup
  const DB_FILE = path.join(process.cwd(), 'data', 'db.json');
  let serverDb: Record<string, any> = {};
  let dbVersion = 1;

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
      dbVersion++;
      saveDatabase();
    } else if (key) {
      serverDb[key] = value;
      dbVersion++;
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
      dbVersion++;
      saveDatabase();
    }

    res.json({ version: dbVersion, data: serverDb });
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
