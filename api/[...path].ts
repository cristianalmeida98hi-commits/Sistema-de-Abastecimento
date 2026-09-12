import { handleCors, sendJson } from './_lib/pushEngine';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const url = req.url || '';
  return sendJson(res, 404, {
    success: false,
    error: `Endpoint de API não encontrado no servidor: ${req.method} ${url}`,
    message: 'Esta rota de API não está configurada.',
    timestamp: new Date().toISOString()
  });
}
