import { apiUrl } from './apiBaseUrl'

export async function probeStream(streamUrl, fallbackUrl, fallbackUrls = []) {
  const startedAt = performance.now()
  const params = new URLSearchParams({ url: streamUrl })

  if (fallbackUrl) {
    params.set('fallbackUrl', fallbackUrl)
  }

  if (fallbackUrls.length) {
    params.set('fallbackUrls', JSON.stringify(fallbackUrls))
  }

  try {
    const response = await fetch(apiUrl(`/api/probe?${params.toString()}`), {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return {
      status: 'offline',
      detail: `API de monitoramento indisponível: ${error.message}.`,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    }
  }
}
