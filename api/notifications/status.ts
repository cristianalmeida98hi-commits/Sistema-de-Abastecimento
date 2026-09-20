import { handleCors, sendJson, getEngineStatus } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  console.log(`[API /api/notifications/status] [ETAPA 1/6] Requisição GET recebida em /api/notifications/status`);

  if (req.method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const status = await getEngineStatus();
    console.log(`[API /api/notifications/status] [ETAPA 3/6] Status concluído: ${status.activeAuthorizedCount} dispositivo(s) ativo(s) de ${status.totalDevices} no total.`);
    return sendJson(res, 200, status);
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Erro interno ao consultar status');
    console.error('[API /api/notifications/status] [ETAPA 6/6] ERRO TÉCNICO AO CONSULTAR STATUS:', errorMsg);
    return sendJson(res, 500, {
      success: false,
      vapidConfigured: true,
      error: 'Erro técnico ao consultar status: ' + errorMsg,
      totalDevices: 0,
      activeAuthorizedCount: 0,
      authorizedDevices: []
    });
  }
}
