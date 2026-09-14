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
} from './_lib/pushEngine.ts';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];

  // Failsafe: se uma requisição de notificações for capturada pelo catch-all do Vercel
  if (pathname.includes('/notifications/')) {
    const action = pathname.split('/notifications/')[1].split('/')[0];
    
    try {
      if (action === 'status' && req.method === 'GET') {
        const status = await getEngineStatus();
        return sendJson(res, 200, status);
      }

      if (action === 'vapid-public-key' && req.method === 'GET') {
        return sendJson(res, 200, { publicKey: getVapidPublicKey() });
      }

      if (action === 'devices' && req.method === 'GET') {
        const devices = await getDevicesList();
        return sendJson(res, 200, { devices, total: devices.length });
      }

      if (action === 'test' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const result = await dispatchPushToAuthorizedUsers({
          eventType: 'TEST',
          eventId: `test-${Date.now()}`,
          equipmentName: 'AndradeAgro',
          description: body.description || 'Notificações Push funcionando.',
          customTitle: body.title || 'Teste AndradeAgro',
          targetUserId: body.userId,
          directSubscription: body.subscription,
          directUserName: body.userName,
          directUserRole: body.userRole
        });
        const code = result.success ? 200 : (result.sentCount === 0 && result.recipientsCount === 0 ? 200 : 500);
        return sendJson(res, code, result);
      }

      if (action === 'subscribe' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const device = await registerDevice(body);
        return sendJson(res, 200, { success: true, device });
      }

      if (action === 'unsubscribe' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        await unregisterDevice(body);
        return sendJson(res, 200, { success: true });
      }

      if (action === 'dispatch-event' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const result = await dispatchPushToAuthorizedUsers(body);
        return sendJson(res, 200, result);
      }

      if (action === 'reset-event-dedup' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const result = resetEventDeduplication(body);
        return sendJson(res, 200, { success: true, ...result });
      }
    } catch (err: any) {
      console.error(`[API catch-all /api/notifications/${action}] Erro:`, err);
      return sendJson(res, 500, { success: false, error: err?.message || String(err) });
    }
  }

  return sendJson(res, 404, {
    success: false,
    error: `Endpoint de API não encontrado no servidor: ${req.method} ${rawUrl}`,
    message: 'Esta rota de API não está configurada.',
    timestamp: new Date().toISOString()
  });
}
