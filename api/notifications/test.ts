import { 
  handleCors, 
  sendJson, 
  parseRequestBody, 
  dispatchPushToAuthorizedUsers 
} from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
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
  } catch (err: any) {
    console.error('[API /api/notifications/test] Error:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'Falha interna ao processar notificação de teste: ' + (err?.message || err),
      sentCount: 0
    });
  }
}
