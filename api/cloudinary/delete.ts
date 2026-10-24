import crypto from 'node:crypto';
import { getFirebaseAdminDb } from '../_lib/pushEngine.js';

const nodeRequire = (await import('node:module')).createRequire(import.meta.url);

function send(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).json(body);
}

async function verifyUser(req: any): Promise<boolean> {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  if (!getFirebaseAdminDb()) return false;
  try {
    const { getApps } = nodeRequire('firebase-admin/app');
    const { getAuth } = nodeRequire('firebase-admin/auth');
    const app = getApps()[0];
    if (!app) return false;
    await getAuth(app).verifyIdToken(match[1]);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido.' });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return send(res, 503, { ok: false, error: 'Configuração do Cloudinary incompleta.' });
  if (!(await verifyUser(req))) return send(res, 401, { ok: false, error: 'Sessão Firebase inválida.' });

  const ids = req.body?.publicIds;
  if (!Array.isArray(ids) || ids.length > 3) return send(res, 400, { ok: false, error: 'Lista de fotos inválida.' });

  const results = [];
  for (const rawId of ids) {
    if (typeof rawId !== 'string' || !/^andrade_agro\/defeitos\/[a-zA-Z0-9_-]{1,100}\/[a-zA-Z0-9_-]{1,120}$/.test(rawId)) {
      results.push({ publicId: String(rawId || ''), ok: false, error: 'Identificador fora da pasta permitida.' });
      continue;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${rawId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');
    try {
      const form = new URLSearchParams({ public_id: rawId, timestamp: String(timestamp), api_key: apiKey, signature });
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      results.push({ publicId: rawId, ok: response.ok && (payload.result === 'ok' || payload.result === 'not found') });
    } catch (error) {
      results.push({ publicId: rawId, ok: false, error: 'Falha de conexão com o Cloudinary.' });
    }
  }
  return send(res, 200, { ok: results.every(item => item.ok), results });
}
