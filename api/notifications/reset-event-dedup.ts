import { 
  handleCors, 
  sendJson, 
  parseRequestBody, 
  resetEventDeduplication 
} from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const { prefix, eventId } = body;
    const result = resetEventDeduplication({ prefix, eventId });
    return sendJson(res, 200, { success: true, ...result });
  } catch (err: any) {
    console.error('[API /api/notifications/reset-event-dedup] Error:', err);
    return sendJson(res, 200, { success: false, error: 'Falha ao resetar deduplicação: ' + (err?.message || err) });
  }
}
