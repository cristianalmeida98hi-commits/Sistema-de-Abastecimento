import { handleCors, sendJson, getEngineStatus } from '../_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  const status = getEngineStatus();
  return sendJson(res, 200, status);
}
