import { handleOptions, probeStream, sendJson } from './_monitor.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método não permitido.' })
    return
  }

  if (!req.query.url) {
    sendJson(res, 400, { error: 'Parâmetro url é obrigatório.' })
    return
  }

  sendJson(res, 200, await probeStream(req.query.url, req.query.fallbackUrl))
}
