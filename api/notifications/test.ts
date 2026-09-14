import { 
  handleCors, 
  sendJson, 
  parseRequestBody, 
  dispatchPushToAuthorizedUsers 
} from '../_lib/pushEngine.ts';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  console.log(`[API /api/notifications/test] [ETAPA 1/6] Requisição POST recebida em /api/notifications/test`);

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const { userId, userName, userRole, title, description, subscription } = body;

    console.log(`[API /api/notifications/test] [ETAPA 1/6] Payload do teste: usuário="${userName || userId || 'N/A'}", perfil="${userRole || 'N/A'}", possuiSubscriçãoDireta=${Boolean(subscription)}`);

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

    console.log(`[API /api/notifications/test] [ETAPA 6/6] Finalizado: sucesso=${result.success}, entregas=${result.sentCount}, falhas=${result.failedCount || 0}`);

    const httpCode = result.success ? 200 : (result.sentCount === 0 && result.recipientsCount === 0 ? 200 : 500);
    return sendJson(res, httpCode, result);
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Erro interno ao disparar teste push');
    const errorStack = err?.stack || '';
    console.error('[API /api/notifications/test] [ETAPA 6/6] ERRO TÉCNICO REAL:', errorMsg, errorStack);

    return sendJson(res, 500, {
      success: false,
      stage: 'erro_execucao',
      error: 'Falha técnica no servidor: ' + errorMsg,
      message: 'Falha técnica no servidor: ' + errorMsg,
      sentCount: 0,
      failedCount: 1,
      errors: [errorMsg],
      diagnostics: {
        etapa1_requestReceived: true,
        etapa6_technicalError: errorMsg
      }
    });
  }
}
