import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

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
