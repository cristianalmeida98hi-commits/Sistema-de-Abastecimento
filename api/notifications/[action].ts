import { 
  handleCors, 
  sendJson, 
  parseRequestBody, 
  getVapidPublicKey,
  registerDevice,
  unregisterDevice,
  getDevicesList,
  getEngineStatus,
  resetEventDeduplication,
  dispatchPushToAuthorizedUsers 
} from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const action = req.query?.action || (req.url ? req.url.split('?')[0].split('/').filter(Boolean).pop() : '');

  try {
    if (action === 'vapid-public-key' && req.method === 'GET') {
      return sendJson(res, 200, { publicKey: getVapidPublicKey() });
    }

    if (action === 'devices' && req.method === 'GET') {
      const devices = await getDevicesList();
      return sendJson(res, 200, { devices, total: devices.length });
    }

    if (action === 'status' && req.method === 'GET') {
      const status = await getEngineStatus();
      return sendJson(res, 200, status);
    }

    if (action === 'subscribe' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const { userId, userName, userRole, subscription, deviceInfo } = body;
      if (!userId || !subscription || !subscription.endpoint) {
        return sendJson(res, 400, { success: false, error: 'Payload de inscrição incompleto' });
      }
      const device = await registerDevice({ userId, userName, userRole, subscription, deviceInfo });
      return sendJson(res, 200, { success: true, device });
    }

    if (action === 'unsubscribe' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      await unregisterDevice({ endpoint: body.endpoint, userId: body.userId });
      return sendJson(res, 200, { success: true });
    }

    if (action === 'test' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const { userId, userName, userRole, title, description, subscription } = body;
      const result = await dispatchPushToAuthorizedUsers({
        eventType: 'TEST',
        eventId: `test-${Date.now()}`,
        equipmentName: 'AndradeAgro',
        description: description || 'Notificações Push funcionando.',
        customTitle: title || 'Teste AndradeAgro',
        targetUserId: userId,
        directSubscription: subscription,
        directUserName: userName,
        directUserRole: userRole
      });
      return sendJson(res, 200, result);
    }

    if (action === 'dispatch-event' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const { eventType, eventId, equipmentName, description, equipmentId, targetUserId, customTitle } = body;
      const result = await dispatchPushToAuthorizedUsers({
        eventType,
        eventId,
        equipmentName: equipmentName || 'Equipamento Agrícola',
        description: description || 'Evento registrado.',
        equipmentId,
        targetUserId,
        customTitle
      });
      return sendJson(res, 200, result);
    }

    if (action === 'reset-event-dedup' && req.method === 'POST') {
      const body = await parseRequestBody(req);
      const result = resetEventDeduplication({ prefix: body.prefix, eventId: body.eventId });
      return sendJson(res, 200, { success: true, ...result });
    }

    return sendJson(res, 404, {
      success: false,
      error: `Ação de notificação não encontrada: ${action}`,
      validActions: ['vapid-public-key', 'devices', 'status', 'subscribe', 'unsubscribe', 'test', 'dispatch-event', 'reset-event-dedup']
    });
  } catch (err: any) {
    console.error(`[API /api/notifications/${action}] Error:`, err);
    return sendJson(res, 500, { success: false, error: 'Erro interno: ' + (err?.message || err) });
  }
}
