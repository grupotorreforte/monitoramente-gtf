const DEFAULT_TIMEOUT_MS = 9000
const MAX_BYTES = 32768
const STREAM_LEVEL_EMIT_MS = 650
const STREAM_STALL_TIMEOUT_MS = 12000
const WATCH_MAX_RUNTIME_MS = 25000

export function setCors(res, contentType = 'application/json; charset=utf-8') {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
  res.setHeader('Content-Type', contentType)
}

export function sendJson(res, statusCode, payload) {
  setCors(res)
  res.status(statusCode).json(payload)
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false
  setCors(res)
  res.status(204).end()
  return true
}

export function normalizeSong(song) {
  if (!song) return { title: 'Sem metadata', artist: '' }

  if (song.text) {
    return {
      title: song.text,
      artist: song.artist ?? ''
    }
  }

  const title = song.title || song.name || 'Sem metadata'
  const artist = song.artist || ''

  return {
    title: artist && title ? `${artist} - ${title}` : title,
    artist
  }
}

export async function fetchNowPlaying(metadataUrl) {
  if (!metadataUrl) {
    return {
      status: 'unavailable',
      title: '',
      artist: '',
      listeners: null,
      checkedAt: new Date().toISOString(),
      detail: 'URL de metadata não configurada.'
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${metadataUrl}?_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json()
    const song = normalizeSong(payload.now_playing?.song ?? payload.nowPlaying?.song ?? payload.song)

    return {
      status: 'available',
      title: song.title,
      artist: song.artist,
      listeners: payload.listeners?.current ?? payload.listeners?.total ?? null,
      checkedAt: new Date().toISOString(),
      detail: 'Metadata atualizada.'
    }
  } catch (error) {
    return {
      status: 'unavailable',
      title: '',
      artist: '',
      listeners: null,
      checkedAt: new Date().toISOString(),
      detail: error.name === 'AbortError' ? 'Tempo limite na metadata.' : `Falha na metadata: ${error.message}.`
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function readStreamBytes(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const startedAt = performance.now()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: {
        'Icy-MetaData': '1',
        Range: `bytes=0-${MAX_BYTES - 1}`,
        'User-Agent': 'ServicoMonitoramento/0.1'
      },
      redirect: 'follow',
      signal: controller.signal
    })

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}`)
    }

    if (!response.body) {
      throw new Error('Stream sem corpo de resposta')
    }

    const reader = response.body.getReader()
    let receivedBytes = 0

    while (receivedBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value?.byteLength ?? 0
      if (receivedBytes > 0) break
    }

    await reader.cancel().catch(() => {})

    if (receivedBytes === 0) {
      throw new Error('Nenhum byte recebido')
    }

    return {
      status: 'online',
      detail: 'Stream online com bytes recebidos.',
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
      receivedBytes,
      httpStatus: response.status,
      contentType: response.headers.get('content-type')
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function probeStream(url, fallbackUrl) {
  const attempts = [url, fallbackUrl].filter(Boolean)
  let lastError = null

  for (const attemptUrl of attempts) {
    try {
      return await readStreamBytes(attemptUrl)
    } catch (error) {
      lastError = error
    }
  }

  const isTimeout = lastError?.name === 'AbortError'

  return {
    status: isTimeout ? 'timeout' : 'offline',
    detail: isTimeout ? 'Tempo limite ao conectar no stream.' : `Falha no stream: ${lastError?.message ?? 'erro desconhecido'}.`,
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    receivedBytes: 0,
    httpStatus: null,
    contentType: null
  }
}

export function sendSse(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export async function monitorStreamForSse({ id, url, fallbackUrl, res, shouldStop }) {
  const attempts = [url, fallbackUrl].filter(Boolean)
  let lastError = null

  for (const attemptUrl of attempts) {
    if (shouldStop()) return

    const controller = new AbortController()
    const startedAt = performance.now()
    let stallTimer = null
    let lastLevelEmitAt = 0
    let receivedBytes = 0

    const resetStallTimer = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => controller.abort(), STREAM_STALL_TIMEOUT_MS)
    }

    try {
      resetStallTimer()

      const response = await fetch(attemptUrl, {
        headers: {
          'Icy-MetaData': '1',
          'User-Agent': 'ServicoMonitoramento/0.1'
        },
        redirect: 'follow',
        signal: controller.signal
      })

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Stream sem corpo de resposta')
      }

      const reader = response.body.getReader()

      while (!shouldStop()) {
        resetStallTimer()
        const { done, value } = await reader.read()

        if (done) {
          throw new Error('Stream encerrado pelo servidor')
        }

        receivedBytes += value?.byteLength ?? 0
        const now = performance.now()

        if (now - lastLevelEmitAt >= STREAM_LEVEL_EMIT_MS) {
          lastLevelEmitAt = now
          sendSse(res, 'status', {
            id,
            status: 'online',
            detail: 'Stream online com leitura contínua.',
            checkedAt: new Date().toISOString(),
            latencyMs: Math.round(performance.now() - startedAt),
            receivedBytes,
            httpStatus: response.status,
            contentType: response.headers.get('content-type')
          })
        }
      }

      await reader.cancel().catch(() => {})
      return
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(stallTimer)
      controller.abort()
    }
  }

  if (!shouldStop()) {
    sendSse(res, 'status', {
      id,
      status: lastError?.name === 'AbortError' ? 'timeout' : 'offline',
      detail: lastError?.name === 'AbortError' ? 'Stream sem bytes por tempo prolongado.' : `Falha no stream: ${lastError?.message ?? 'erro desconhecido'}.`,
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    })
  }
}

export function getWatchMaxRuntimeMs() {
  return WATCH_MAX_RUNTIME_MS
}
