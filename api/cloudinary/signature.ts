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
  const db = getFirebaseAdminDb();
  if (!db) return false;
  try {
    const { getApps } = nodeRequire('firebase-admin/app');
    const { getAuth } = nodeRequire('firebase-admin/auth');
    const app = getApps()[0];
    if (!app) return false;
    await getAuth(app).verifyIdToken(match[1]);
    return true;
  } catch (error) {
    console.warn('[Cloudinary] Token Firebase inválido:', (error as any)?.message || error);
    return false;
  }
}

function cleanId(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) : '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido.' });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return send(res, 503, { ok: false, error: 'Configuração do Cloudinary incompleta no servidor.' });
  }
  if (!(await verifyUser(req))) return send(res, 401, { ok: false, error: 'Sessão Firebase inválida. Entre novamente no sistema.' });

  const issueId = cleanId(req.body?.issueId);
  const photoId = cleanId(req.body?.photoId);
  if (!issueId || !photoId) return send(res, 400, { ok: false, error: 'Identificadores da foto inválidos.' });

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `andrade_agro/defeitos/${issueId}`;
  const public_id = `${folder}/${photoId}`;
  const upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET || 'andrade_agro_defeitos';
  const params: Record<string, string | number> = { folder, public_id, timestamp, upload_preset };
  const toSign = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&') + process.env.CLOUDINARY_API_SECRET;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  return send(res, 200, {
    ok: true,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    publicId: public_id,
    uploadPreset: upload_preset,
    signature
  });
}
