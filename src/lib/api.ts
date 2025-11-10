// lib/api.ts
import axios, {
  AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosHeaders,
  type AxiosRequestHeaders,
} from 'axios'

export const API_BASE_URL  = process.env.NEXT_PUBLIC_API_URL  || 'https://api.collabglam.com'
export const API_BASE_URL2 = process.env.NEXT_PUBLIC_API_URL2 || 'https://api.sharemitra.com'

// ---- Single token key ----
export const TOKEN_KEY = 'token'

// const forceLogout = () => {
//   if (typeof window === 'undefined') return
//   try {
//     localStorage.clear()
//     try { sessionStorage.clear() } catch {}
//   } catch {}
//   try {
//     if (window.location.pathname !== '/login') {
//       window.location.replace('/login')
//     }
//   } catch {}
// }

// Primary API (BASE_URL)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// Secondary API (BASE_URL2)
const api2 = axios.create({
  baseURL: API_BASE_URL2,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

/** Utilities */
const attachBearer = (
  config: InternalAxiosRequestConfig,
  token: string
): InternalAxiosRequestConfig => {
  const hdrs = config.headers as AxiosHeaders | AxiosRequestHeaders | undefined
  if (hdrs && typeof (hdrs as any).set === 'function') {
    (hdrs as AxiosHeaders).set('Authorization', `Bearer ${token}`)
  } else {
    config.headers = { ...(hdrs as any), Authorization: `Bearer ${token}` } as AxiosRequestHeaders
  }
  return config
}

/** ---- Interceptors ---- */

/** PRIMARY: must have token; otherwise logout immediately */
const attachAuthPrimary = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) return attachBearer(config, token)
      // No token -> logout (only for primary API)
      // forceLogout()
    } catch {
      // storage error -> treat like missing token
      // forceLogout()
    }
  }
  return config
}

/** SECONDARY: attach token if present; never logout if missing */
const attachAuthSecondary = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) return attachBearer(config, token)
    } catch {
      // ignore
    }
  }
  return config
}

api.interceptors.request.use(attachAuthPrimary)
api2.interceptors.request.use(attachAuthSecondary)

/** 401 handling: only primary forces logout */
const onResponseErrorPrimary = (err: any) => {
  const status = err?.response?.status
  if (status === 401) {
    // forceLogout()
  }
  return Promise.reject(err)
}
const onResponseErrorSecondary = (err: any) => Promise.reject(err)

api.interceptors.response.use((r) => r, onResponseErrorPrimary)
api2.interceptors.response.use((r) => r, onResponseErrorSecondary)

// (Optional) warn about mixed-content when page is HTTPS but API is HTTP
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

/** -------------------- HELPERS -------------------- */
/** GET (BASE_URL) */
export const get = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL) */
export const post = async <T = any>(
  url: string,
  data?: any,
  opts?: { signal?: AbortSignal }
): Promise<T> => {
  const isFD = typeof FormData !== 'undefined' && data instanceof FormData
  const baseConfig: AxiosRequestConfig = { signal: opts?.signal }
  if (isFD) {
    baseConfig.headers = { ...(baseConfig.headers || {}), 'Content-Type': 'multipart/form-data' }
  }
  const res = await api.post<T>(url, data, baseConfig)
  return res.data
}

/** GET (BASE_URL2) */
export const get2 = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api2.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL2) */
export const post2 = async <T = any>(
  url: string,
  data?: any,
  opts?: { signal?: AbortSignal }
): Promise<T> => {
  const isFD = typeof FormData !== 'undefined' && data instanceof FormData
  const baseConfig: AxiosRequestConfig = { signal: opts?.signal }
  if (isFD) {
    baseConfig.headers = { ...(baseConfig.headers || {}), 'Content-Type': 'multipart/form-data' }
  }
  const res = await api2.post<T>(url, data, baseConfig)
  return res.data
}

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

/** Optional token helpers */
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
