import { handleCors, sendJson, parseRequestBody, unregisterDevice } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed', stage: 'http' });
  }

  try {
    const body = await parseRequestBody(req);
    const { endpoint, deviceId, userId } = body;

    await unregisterDevice({ endpoint, deviceId, userId });

    return sendJson(res, 200, {
      ok: true,
      message: 'Dispositivo desativado com sucesso'
    });
  } catch (err: any) {
    console.error('[API /api/notifications/unsubscribe] Error:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Falha ao desativar dispositivo no Firestore: ' + (err?.message || err),
      stage: 'firestore'
    });
  }
}
