import crypto from 'node:crypto';

function send(res: any, status: number, body: Record<string, unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).json(body);
}

/**
 * Bloqueia chamadas cross-origin ao endpoint. As funções são chamadas pelo próprio
 * site; não aceitamos origem ausente, inválida ou diferente do host que recebeu a requisição.
 * Isso é uma defesa contra abuso via navegador/CSRF, não substitui autenticação forte.
 */
function hasSameOrigin(req: any): boolean {
  const origin = req.headers?.origin;
  const host = req.headers?.host;
  if (typeof origin !== 'string' || typeof host !== 'string' || !host.trim()) return false;

  try {
    const parsed = new URL(origin);
    if (parsed.username || parsed.password) return false;
    const originHost = parsed.host.toLowerCase();
    const requestHost = host.split(',')[0].trim().toLowerCase();
    const isSecure = parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestHost));
    if (!isSecure || originHost !== requestHost) return false;

    const fetchSite = req.headers?.['sec-fetch-site'];
    if (typeof fetchSite === 'string' && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida o Firebase ID token pela API oficial de Authentication.
 * Não depende de Firebase Admin/Service Account, que não está configurado em todos os ambientes Vercel.
 */
async function verifyUser(req: any): Promise<boolean> {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;

  const apiKey = process.env.FIREBASE_API_KEY || 'AIzaSyCKLaXPZ3xq5M2CCRVBkwRHS-7dQoBelEY';
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: match[1] })
    });
    if (!response.ok) return false;
    const result = await response.json() as any;
    return Array.isArray(result.users) && result.users.length > 0;
  } catch (error) {
    console.warn('[Cloudinary] Não foi possível validar o token Firebase:', (error as any)?.message || error);
    return false;
  }
}

function cleanId(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) : '';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método não permitido.' });
  if (!hasSameOrigin(req)) return send(res, 403, { ok: false, error: 'Origem da requisição não permitida.' });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return send(res, 503, { ok: false, error: 'Configuração do Cloudinary incompleta no servidor.' });
  }
  if (!(await verifyUser(req))) return send(res, 401, { ok: false, error: 'Sessão Firebase inválida. Entre novamente no sistema.' });

  const issueId = cleanId(req.body?.issueId);
  const photoId = cleanId(req.body?.photoId);
  if (!issueId || !photoId) return send(res, 400, { ok: false, error: 'Identificadores da foto inválidos.' });

  const timestamp = Math.floor(Date.now() / 1000);
  const public_id = `andrade_agro/defeitos/${issueId}/${photoId}`;
  const upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET || 'andrade_agro_defeitos';
  const params: Record<string, string | number> = { public_id, timestamp, upload_preset };
  const toSign = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&') + process.env.CLOUDINARY_API_SECRET;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  return send(res, 200, {
    ok: true,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    publicId: public_id,
    uploadPreset: upload_preset,
    signature
  });
}
