import { handleCors, sendJson, getEngineStatus } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed', stage: 'http' });
  }

  try {
    const status = await getEngineStatus();
    return sendJson(res, 200, status);
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Erro interno ao consultar status');
    console.error('[API /api/notifications/status] ERRO TÉCNICO:', errorMsg);
    return sendJson(res, 500, {
      ok: false,
      success: false,
      backendWorking: false,
      firestoreAccessible: false,
      error: 'Falha ao consultar status: ' + errorMsg,
      stage: 'firestore',
      totalDevices: 0,
      activeAuthorizedCount: 0,
      validSubscriptionsCount: 0,
      authorizedDevices: []
    });
  }
}
