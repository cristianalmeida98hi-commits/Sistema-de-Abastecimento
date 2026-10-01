import { handleCors, sendJson, getActiveAuthorizedDevices } from '../_lib/pushEngine.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed', stage: 'http' });
  }

  try {
    const result = await getActiveAuthorizedDevices();

    // Se a consulta ao Firestore falhou, NÃO mascara silenciosamente como lista vazia
    if (!result.querySuccess) {
      const errorMsg = result.queryError || 'Falha ao consultar dispositivos no Firestore';
      console.warn('[API /api/notifications/devices] Falha no Firestore:', errorMsg);
      return sendJson(res, 500, {
        ok: false,
        success: false,
        querySuccess: false,
        queryError: errorMsg,
        error: errorMsg,
        totalDevices: 0,
        count: 0,
        devices: [],
        source: result.source,
        stage: 'firestore'
      });
    }

    // Consulta realizada com sucesso (pode ter 0 ou mais dispositivos)
    const devices = result.activeDevices.map(d => ({
      id: d.id,
      endpoint: d.endpoint,
      keys: (d as any).keys || {
        p256dh: d.subscription?.keys?.p256dh || '',
        auth: d.subscription?.keys?.auth || ''
      },
      userId: d.userId,
      userEmail: (d as any).userEmail || '',
      userName: d.userName,
      role: d.userRole || (d as any).role || 'FUNCIONARIO',
      userRole: d.userRole || (d as any).role || 'FUNCIONARIO',
      platform: d.deviceInfo?.platform || (d as any).platform || 'desconhecido',
      userAgent: d.deviceInfo?.userAgent || (d as any).userAgent || '',
      isPWA: Boolean(d.deviceInfo?.isPWA || (d as any).isPWA),
      isMobile: Boolean(d.deviceInfo?.isMobile || (d as any).isMobile),
      permission: (d as any).permission || 'granted',
      authorized: (d as any).authorized !== false,
      active: d.active !== false,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      lastSeenAt: (d as any).lastSeenAt || d.updatedAt,
      endpointPreview: d.endpoint ? `${d.endpoint.slice(0, 35)}...` : 'N/A'
    }));

    return sendJson(res, 200, {
      ok: true,
      success: true,
      querySuccess: true,
      total: result.totalDevices,
      totalDevices: result.totalDevices,
      count: devices.length,
      activeAuthorizedCount: devices.length,
      devices,
      source: result.source
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err || 'Erro interno ao consultar dispositivos');
    console.error('[API /api/notifications/devices] Error:', errorMsg);
    return sendJson(res, 500, {
      ok: false,
      success: false,
      querySuccess: false,
      queryError: errorMsg,
      error: 'Falha ao consultar dispositivos no Firestore: ' + errorMsg,
      totalDevices: 0,
      count: 0,
      devices: [],
      stage: 'firestore'
    });
  }
}
