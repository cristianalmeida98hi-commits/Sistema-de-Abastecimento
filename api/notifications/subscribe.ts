import { handleCors, sendJson, parseRequestBody, registerDevice } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const { userId, userName, userRole, subscription, deviceInfo } = body;

    if (!userId || !subscription || !subscription.endpoint) {
      return sendJson(res, 400, { success: false, error: 'Payload de inscrição incompleto' });
    }

    const device = await registerDevice({
      userId,
      userName,
      userRole,
      subscription,
      deviceInfo
    });

    return sendJson(res, 200, { success: true, device });
  } catch (err: any) {
    console.error('[API /api/notifications/subscribe] Error:', err);
    return sendJson(res, 500, { success: false, error: 'Falha ao registrar dispositivo: ' + (err?.message || err) });
  }
}
