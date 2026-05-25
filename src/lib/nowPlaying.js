import { apiUrl } from './apiBaseUrl'

export const emptyNowPlaying = {
  status: 'idle',
  title: 'Aguardando metadados',
  artist: '',
  listeners: null,
  checkedAt: null,
  detail: 'Nenhuma consulta executada.'
}

let isNowPlayingApiUnavailable = false

export async function fetchNowPlaying(metadataUrl) {
  if (!metadataUrl || isNowPlayingApiUnavailable) {
    return {
      ...emptyNowPlaying,
      status: 'unavailable',
      title: 'Metadados indisponíveis',
      detail: !metadataUrl ? 'URL de metadata não configurada.' : 'API de metadata indisponível neste ambiente.',
      checkedAt: new Date().toISOString()
    }
  }

  const params = new URLSearchParams({ url: metadataUrl })

  try {
    const response = await fetch(apiUrl(`/api/now-playing?${params.toString()}`), {
      cache: 'no-store'
    })

    if (!response.ok) {
      if (response.status === 404) {
        isNowPlayingApiUnavailable = true
      }

      throw new Error(`API HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return {
      ...emptyNowPlaying,
      status: 'unavailable',
      title: 'Metadados indisponíveis',
      checkedAt: new Date().toISOString(),
      detail: `API de metadata indisponível: ${error.message}.`
    }
  }
}
