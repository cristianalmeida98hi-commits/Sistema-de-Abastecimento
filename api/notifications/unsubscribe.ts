import { handleCors, sendJson, parseRequestBody, unregisterDevice } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const { endpoint, userId } = body;
    unregisterDevice({ endpoint, userId });
    return sendJson(res, 200, { success: true });
  } catch (err: any) {
    console.error('[API /api/notifications/unsubscribe] Error:', err);
    return sendJson(res, 500, { success: false, error: 'Falha ao desinscrever dispositivo: ' + (err?.message || err) });
  }
}
