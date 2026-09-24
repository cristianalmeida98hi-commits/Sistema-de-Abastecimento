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
} from './_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];
  const queryPath = Array.isArray(req.query?.path)
    ? req.query.path.join('/')
    : (typeof req.query?.path === 'string' ? req.query.path : '');
  const combined = `${pathname}/${queryPath}`.toLowerCase();

  // Failsafe: se uma requisição de notificações for capturada pelo catch-all do Vercel
  if (combined.includes('notification') || combined.includes('notificac') || req.query?.action) {
    const match = combined.match(/(?:notifications|notificacoes)\/([^/?]+)/);
    const action = match ? match[1] : (req.query?.action || (queryPath.split('/').pop() || ''));
    
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
        const code = 200;
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
      return sendJson(res, 200, { success: false, error: err?.message || String(err) });
    }
  }

  return sendJson(res, 404, {
    success: false,
    error: `Endpoint de API não encontrado no servidor: ${req.method} ${rawUrl}`,
    message: 'Esta rota de API não está configurada.',
    timestamp: new Date().toISOString()
  });
}
