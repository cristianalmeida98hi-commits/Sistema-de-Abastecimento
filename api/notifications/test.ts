import { 
  handleCors, 
  sendJson, 
  parseRequestBody, 
  dispatchPushToAuthorizedUsers 
} from '../_lib/pushEngine.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  console.log(`[API /api/notifications/test] Requisição POST recebida em /api/notifications/test`);

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed', stage: 'http' });
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

    const isOk = result.ok || result.success;
    return sendJson(res, 200, {
      ok: isOk,
      success: isOk,
      totalDevices: result.totalDevices,
      sent: result.sent !== undefined ? result.sent : result.sentCount,
      sentCount: result.sentCount,
      failed: result.failed !== undefined ? result.failed : result.failedCount,
      failedCount: result.failedCount,
      removed: result.removed !== undefined ? result.removed : (result.removedCount || 0),
      removedCount: result.removedCount || 0,
      recipientsCount: result.recipientsCount,
      stage: result.stage,
      errors: result.errors,
      message: result.message
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Erro interno ao disparar teste push');
    console.error('[API /api/notifications/test] ERRO TÉCNICO:', errorMsg);

    return sendJson(res, 500, {
      ok: false,
      success: false,
      stage: 'erro_execucao',
      error: 'Falha técnica no servidor: ' + errorMsg,
      message: 'Falha técnica no servidor: ' + errorMsg,
      totalDevices: 0,
      sent: 0,
      sentCount: 0,
      failed: 1,
      failedCount: 1,
      removed: 0,
      removedCount: 0,
      errors: [errorMsg]
    });
  }
}
