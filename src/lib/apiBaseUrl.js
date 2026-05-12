const LOCAL_API_BASE_URL = 'http://localhost:8787'

export const API_BASE_URL =
  import.meta.env.VITE_MONITOR_API_URL ?? (import.meta.env.DEV ? LOCAL_API_BASE_URL : '')

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
