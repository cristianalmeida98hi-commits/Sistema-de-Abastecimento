import { handleCors, sendJson, parseRequestBody, registerDevice, isValidPushSubscription } from '../_lib/pushEngine.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed', stage: 'http' });
  }

  try {
    const body = await parseRequestBody(req);
    const { userId, userEmail, userName, userRole, subscription, deviceInfo } = body;

    if (!subscription || typeof subscription !== 'object' || !subscription.endpoint) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Endpoint da PushSubscription não informado ou inválido',
        stage: 'validacao'
      });
    }

    if (!isValidPushSubscription(subscription)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Chaves da PushSubscription inválidas (p256dh e auth requeridas)',
        stage: 'validacao'
      });
    }

    const result = await registerDevice({
      userId: userId || 'anonymous',
      userEmail,
      userName,
      userRole,
      subscription,
      deviceInfo
    });

    if (!result.ok) {
      return sendJson(res, 500, {
        ok: false,
        deviceId: result.deviceId,
        error: result.error || 'Falha ao persistir dispositivo no Firestore',
        message: result.message || 'Falha ao persistir dispositivo no Firestore',
        stage: 'firestore'
      });
    }

    return sendJson(res, 200, {
      ok: true,
      deviceId: result.deviceId,
      message: 'Dispositivo sincronizado com sucesso',
      device: result.device
    });
  } catch (err: any) {
    console.error('[API /api/notifications/subscribe] Error:', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Falha ao sincronizar dispositivo no Firestore: ' + (err?.message || err),
      stage: 'firestore'
    });
  }
}
