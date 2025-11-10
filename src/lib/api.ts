// lib/api.ts
import axios, {
  AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosHeaders,
  type AxiosRequestHeaders,
} from 'axios'

export const API_BASE_URL  = process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:5000'
export const API_BASE_URL2 = process.env.NEXT_PUBLIC_API_URL2 || 'http://localhost:7000'

// ---- Single token key (change if you prefer a different name) ----
export const TOKEN_KEY = 'token'

const forceLogout = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.clear()
    try { sessionStorage.clear() } catch {}
  } catch {}
  try {
    if (window.location.pathname !== '/login') {
      window.location.replace('/login')
    }
  } catch {}
}

/** Public (no-auth) API paths – extend if you have custom routes */
const PUBLIC_PATH_PATTERNS = [
  /^\/?auth\/(login|register|signin|signup|refresh|verify|otp|forgot|reset)/i,
  /^\/?(login|register|signin|signup|forgot-password|reset-password|verify-otp|otp)/i,
  /^\/?public\//i,
]
const isPublicPath = (urlLike: unknown) => {
  const url = (urlLike ?? '').toString()
  const path = url.split('?')[0] || ''
  return PUBLIC_PATH_PATTERNS.some(rx => rx.test(path))
}

// Primary API (BASE_URL)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// Secondary API (BASE_URL2) — use only via get2/post2
const api2 = axios.create({
  baseURL: API_BASE_URL2,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

/**
 * Attach Authorization to non-public requests if a token exists.
 * IMPORTANT: Do NOT force logout here when the token is missing.
 * Let the server respond; on 401 we handle below (except for public paths).
 *
 * NOTE: Interceptors must use InternalAxiosRequestConfig in Axios v1.
 */
const attachAuth = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const url = config?.url ?? ''

  // allow callers to explicitly skip via a custom flag
  const skipAuth = (config as any).skipAuth as boolean | undefined
  if (skipAuth || isPublicPath(url)) {
    return config
  }

  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) {
        // If AxiosHeaders (has set), prefer it:
        const hdrs = config.headers as AxiosHeaders | AxiosRequestHeaders | undefined
        if (hdrs && typeof (hdrs as any).set === 'function') {
          (hdrs as AxiosHeaders).set('Authorization', `Bearer ${token}`)
        } else {
          // fallback to plain object merge
          config.headers = { ...(hdrs as any), Authorization: `Bearer ${token}` } as AxiosRequestHeaders
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return config
}
api.interceptors.request.use(attachAuth)
api2.interceptors.request.use(attachAuth)

/**
 * If API returns 401 for a protected endpoint, force logout.
 * For PUBLIC endpoints (e.g., wrong login creds), DO NOT redirect.
 */
const onResponseError = (err: any) => {
  const status = err?.response?.status
  const url = err?.config?.url
  if (status === 401 && !isPublicPath(url)) {
    forceLogout()
  }
  return Promise.reject(err)
}
api.interceptors.response.use((r) => r, onResponseError)
api2.interceptors.response.use((r) => r, onResponseError)

// (Optional) warn loudly if running on HTTPS but API URL is HTTP (mixed content -> Network Error)
if (typeof window !== 'undefined') {
  try {
    const pageIsHTTPS = window.location.protocol === 'https:'
    if (pageIsHTTPS && /^http:\/\//i.test(API_BASE_URL)) {
      // eslint-disable-next-line no-console
      console.warn(
        '[api] Page is HTTPS but NEXT_PUBLIC_API_URL is HTTP. This causes mixed-content blocking (Network Error). ' +
        'Use an HTTPS API endpoint or a same-origin relative path.'
      )
    }
  } catch {}
}

/** -------------------- NO-FALLBACK HELPERS (BASE_URL) -------------------- */
/** GET (BASE_URL) */
export const get = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL) */
export const post = async <T = any>(
  url: string,
  data?: any,
  opts?: { signal?: AbortSignal; skipAuth?: boolean }
): Promise<T> => {
  const isFD = typeof FormData !== 'undefined' && data instanceof FormData
  const baseConfig: AxiosRequestConfig = { signal: opts?.signal }

  if (isFD) {
    baseConfig.headers = { ...(baseConfig.headers || {}), 'Content-Type': 'multipart/form-data' }
  }

  // Pass skipAuth through via `as any` so TS doesn't complain,
  // interceptor will read it as (config as any).skipAuth
  const cfg = opts?.skipAuth ? ({ ...baseConfig, skipAuth: true } as any) : baseConfig

  const res = await api.post<T>(url, data, cfg)
  return res.data
}

/** -------------------- DIRECT HELPERS (BASE_URL2) -------------------- */
/** GET (BASE_URL2) */
export const get2 = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api2.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL2) */
export const post2 = async <T = any>(
  url: string,
  data?: any,
  opts?: { signal?: AbortSignal; skipAuth?: boolean }
): Promise<T> => {
  const isFD = typeof FormData !== 'undefined' && data instanceof FormData
  const baseConfig: AxiosRequestConfig = { signal: opts?.signal }

  if (isFD) {
    baseConfig.headers = { ...(baseConfig.headers || {}), 'Content-Type': 'multipart/form-data' }
  }

  const cfg = opts?.skipAuth ? ({ ...baseConfig, skipAuth: true } as any) : baseConfig

  const res = await api2.post<T>(url, data, cfg)
  return res.data
}

/** -------------------- DOWNLOAD HELPERS -------------------- */
/** Download blob (BASE_URL) */
export const downloadBlob = async (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<Blob> => {
  const opts: AxiosRequestConfig = { responseType: 'blob', ...config }
  let response
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    response = await api.post<Blob>(url, data, {
      ...opts,
      headers: { ...(opts.headers || {}), 'Content-Type': 'multipart/form-data' },
    })
  } else {
    response = await api.post<Blob>(url, data, opts)
  }
  return response.data
}

/** Download blob (BASE_URL2) */
export const downloadBlob2 = async (
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<Blob> => {
  const opts: AxiosRequestConfig = { responseType: 'blob', ...config }
  let response
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    response = await api2.post<Blob>(url, data, {
      ...opts,
      headers: { ...(opts.headers || {}), 'Content-Type': 'multipart/form-data' },
    })
  } else {
    response = await api2.post<Blob>(url, data, opts)
  }
  return response.data
}

/** Optional: tiny helpers to manage the token consistently */
export const setToken = (token: string) => {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(TOKEN_KEY, token) } catch {}
}
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const clearToken = () => {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}

export default api
export { api2 }
