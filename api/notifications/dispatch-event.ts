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
    const { eventType, eventId, equipmentName, description, equipmentId, targetUserId, customTitle } = body;

    if (!eventType || !eventId) {
      return sendJson(res, 400, { success: false, error: 'eventType e eventId são obrigatórios' });
    }

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
  } catch (err: any) {
    console.error('[API /api/notifications/dispatch-event] Error:', err);
    return sendJson(res, 200, { success: false, error: 'Falha ao despachar notificação: ' + (err?.message || err) });
  }
}
