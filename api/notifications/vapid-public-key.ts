import { handleCors, sendJson, getVapidPublicKey } from '../_lib/pushEngine.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const publicKey = getVapidPublicKey();
    return sendJson(res, 200, { publicKey });
  } catch (err: any) {
    console.error('[API /api/notifications/vapid-public-key] Error:', err);
    return sendJson(res, 200, { publicKey: 'BGk3AhmnXVavteh2WDsz5PLh4flo97VKKiLbTByKGeT7nSCgGrhm2LVdMgIpcYAt7Kih5zfOWJeJrev6h5mW6ig' });
  }
}
