import { apiUrl } from './apiBaseUrl'

export function watchStream({ streamUrl, fallbackUrl, fallbackUrls = [], onStatus, onError }) {
  const params = new URLSearchParams({ url: streamUrl })

  if (fallbackUrl) {
    params.set('fallbackUrl', fallbackUrl)
  }

  if (fallbackUrls.length) {
    params.set('fallbackUrls', JSON.stringify(fallbackUrls))
  }

  const eventSource = new EventSource(apiUrl(`/api/watch?${params.toString()}`))
  let reconnectNoticeTimer = null
  let closed = false

  const clearReconnectNotice = () => {
    if (reconnectNoticeTimer) {
      window.clearTimeout(reconnectNoticeTimer)
      reconnectNoticeTimer = null
    }
  }

  eventSource.addEventListener('status', (event) => {
    clearReconnectNotice()
    onStatus(JSON.parse(event.data))
  })

  eventSource.addEventListener('open', clearReconnectNotice)

  eventSource.onerror = () => {
    if (closed || reconnectNoticeTimer) return

    reconnectNoticeTimer = window.setTimeout(() => {
      if (closed || eventSource.readyState === EventSource.OPEN) return

      onError?.({
        status: 'checking',
        detail: 'Reconectando com a API de monitoramento.',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        receivedBytes: 0,
        httpStatus: null,
        contentType: null
      })
      reconnectNoticeTimer = null
    }, 3000)
  }
  return () => {
    closed = true
    clearReconnectNotice()
    eventSource.close()
  }
}

export function watchStreams({ streams, onStatus, onError }) {
  const params = new URLSearchParams({
    streams: JSON.stringify(
      streams.map((stream) => ({
        id: stream.id,
        streamUrl: stream.streamUrl,
        fallbackUrl: stream.fallbackUrl,
        fallbackUrls: stream.fallbackUrls
      }))
    )
  })

  const eventSource = new EventSource(apiUrl(`/api/watch-many?${params.toString()}`))

  eventSource.addEventListener('status', (event) => {
    onStatus(JSON.parse(event.data))
  })

  eventSource.onerror = () => {
    onError?.({
      status: 'checking',
      detail: 'Reconectando com a API de monitoramento.',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    })
  }

  return () => eventSource.close()
}
