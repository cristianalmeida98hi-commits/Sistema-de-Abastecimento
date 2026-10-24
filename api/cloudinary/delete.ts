import crypto from 'node:crypto';

function send(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).json(body);
}

/** Valida o ID token no Firebase Authentication sem depender de credenciais Admin na Vercel. */
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
  if (!(await verifyUser(req))) return send(res, 401, { ok: false, error: 'Sessão Firebase inválida. Entre novamente no sistema.' });

  const ids = req.body?.publicIds;
  if (!Array.isArray(ids) || ids.length > 3) return send(res, 400, { ok: false, error: 'Lista de fotos inválida.' });

  const results = [];
  for (const rawId of ids) {
    const parts = typeof rawId === 'string' ? rawId.split('/') : [];
    const validPublicId = parts.length === 4 && parts[0] === 'andrade_agro' && parts[1] === 'defeitos' &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(parts[2]) && /^[a-zA-Z0-9_-]{1,120}$/.test(parts[3]);
    if (!validPublicId) {
      results.push({ publicId: String(rawId || ''), ok: false, error: 'Identificador fora da pasta permitida.' });
      continue;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${rawId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');
    try {
      const form = new URLSearchParams({ public_id: rawId, timestamp: String(timestamp), api_key: apiKey, signature });
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({})) as any;
      results.push({ publicId: rawId, ok: response.ok && (payload.result === 'ok' || payload.result === 'not found') });
    } catch {
      results.push({ publicId: rawId, ok: false, error: 'Falha de conexão com o Cloudinary.' });
    }
  }
  return send(res, 200, { ok: results.every(item => item.ok), results });
}
