import { handleCors, sendJson, getVapidPublicKey } from '../_lib/pushEngine.ts';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  const publicKey = getVapidPublicKey();
  return sendJson(res, 200, { publicKey });
}
