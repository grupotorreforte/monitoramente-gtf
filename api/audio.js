import { handleOptions, sendJson, setCors } from './_monitor.js'

export const config = {
  maxDuration: 30
}

function waitForDrain(res) {
  return new Promise((resolve) => {
    const cleanup = () => {
      res.off('drain', onDone)
      res.off('close', onDone)
      res.off('error', onDone)
    }
    const onDone = () => {
      cleanup()
      resolve()
    }

    res.once('drain', onDone)
    res.once('close', onDone)
    res.once('error', onDone)
  })
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método não permitido.' })
    return
  }

  const attempts = [req.query.url, req.query.fallbackUrl].filter(Boolean)

  if (attempts.length === 0) {
    sendJson(res, 400, { error: 'Parâmetro url é obrigatório.' })
    return
  }

  let lastError = null

  for (const attemptUrl of attempts) {
    const controller = new AbortController()
    let clientClosed = false

    req.on('close', () => {
      clientClosed = true
      controller.abort()
    })

    try {
      const headers = {
        'Icy-MetaData': '1',
        'User-Agent': 'ServicoMonitoramento/0.1'
      }

      if (req.headers.range) {
        headers.Range = req.headers.range
      }

      const response = await fetch(attemptUrl, {
        headers,
        redirect: 'follow',
        signal: controller.signal
      })

      if (response.status >= 400 || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      setCors(res, response.headers.get('content-type') ?? 'audio/mpeg')
      res.setHeader('Accept-Ranges', response.headers.get('accept-ranges') ?? 'bytes')
      res.setHeader('Cache-Control', 'no-store, no-transform')
      res.status(response.status === 206 ? 206 : 200)

      if (response.headers.get('content-range')) {
        res.setHeader('Content-Range', response.headers.get('content-range'))
      }

      const reader = response.body.getReader()

      while (!clientClosed) {
        const { done, value } = await reader.read()
        if (done) break
        if (value && !res.write(Buffer.from(value))) {
          await waitForDrain(res)
        }
      }

      await reader.cancel().catch(() => {})
      if (!res.writableEnded) {
        res.end()
      }
      return
    } catch (error) {
      lastError = error
      controller.abort()

      if (clientClosed || res.headersSent) {
        if (!res.writableEnded) {
          res.end()
        }
        return
      }
    }
  }

  sendJson(res, 502, {
    error: `Falha ao abrir proxy de áudio: ${lastError?.message ?? 'erro desconhecido'}.`
  })
}
