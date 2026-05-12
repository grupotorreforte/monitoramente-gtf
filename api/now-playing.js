import { fetchNowPlaying, handleOptions, sendJson } from './_monitor.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método não permitido.' })
    return
  }

  sendJson(res, 200, await fetchNowPlaying(req.query.url))
}
