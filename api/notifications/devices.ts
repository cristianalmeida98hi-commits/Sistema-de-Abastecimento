import { handleCors, sendJson, getDevicesList } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed', stage: 'http' });
  }

  try {
    const devices = await getDevicesList();
    return sendJson(res, 200, {
      ok: true,
      devices,
      count: devices.length,
      total: devices.length
    });
  } catch (err: any) {
    console.error('[API /api/notifications/devices] Error:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Falha ao consultar dispositivos no Firestore: ' + (err?.message || err),
      stage: 'firestore'
    });
  }
}
