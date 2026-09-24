import { 
  handleCors, 
  sendJson, 
  parseRequestBody, 
  dispatchPushToAuthorizedUsers 
} from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  console.log(`[API /api/notifications/test] [ETAPA 1/10] Requisição POST recebida em /api/notifications/test`);

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const { userId, userName, userRole, title, description, subscription } = body;

    console.log(`[API /api/notifications/test] [ETAPA 1/10] Payload do teste: usuário="${userName || userId || 'N/A'}", perfil="${userRole || 'N/A'}", possuiSubscriçãoDireta=${Boolean(subscription)}`);

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

    const httpCode = 200;
    console.log(`[API /api/notifications/test] [ETAPA 10/10] Resposta retornada: HTTP ${httpCode}, success=${result.success}, sentCount=${result.sentCount}, failedCount=${result.failedCount || 0}`);
    return sendJson(res, httpCode, result);
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Erro interno ao disparar teste push');
    const errorStack = err?.stack || '';
    console.error('[API /api/notifications/test] [ETAPA 10/10] ERRO TÉCNICO:', errorMsg, errorStack);

    return sendJson(res, 200, {
      success: false,
      stage: 'erro_execucao',
      error: 'Falha técnica no servidor: ' + errorMsg,
      message: 'Falha técnica no servidor: ' + errorMsg,
      sentCount: 0,
      failedCount: 1,
      errors: [errorMsg]
    });
  }
}
