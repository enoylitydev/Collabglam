// lib/api.ts
import axios, { AxiosRequestConfig } from 'axios'

export const API_BASE_URL  = process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:5000'
export const API_BASE_URL2 = process.env.NEXT_PUBLIC_API_URL2 || 'http://localhost:7000'

// Primary API (BASE_URL)
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // Optional: add a reasonable timeout to surface timeouts as network errors
  timeout: 20000,
})

// Secondary API (BASE_URL2)
const api2 = axios.create({
  baseURL: API_BASE_URL2,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// Attach auth token to both clients
const attachAuth = (config: any) => {
  if (typeof window !== 'undefined') {
    const path = window.location?.pathname || ''
    let token: string | null = null

    // Role-scoped tokens
    if (path.startsWith('/brand')) token = localStorage.getItem('brand_token')
    else if (path.startsWith('/influencer')) token = localStorage.getItem('influencer_token')
    else if (path.startsWith('/admin')) token = localStorage.getItem('admin_token')

    // Fallbacks
    if (!token) token = localStorage.getItem('brand_token')
    if (!token) token = localStorage.getItem('influencer_token')
    if (!token) token = localStorage.getItem('admin_token')
    if (!token) token = localStorage.getItem('token')

    if (token) config.headers!['Authorization'] = `Bearer ${token}`
  }
  return config
}
api.interceptors.request.use(attachAuth)
api2.interceptors.request.use(attachAuth)

/** Helpers to decide fallback */
const isNetworkishError = (err: any) => {
  // No HTTP response -> CORS / DNS / mixed content / timeout / connection refused
  if (!err || err.response) return false
  // Axios codes: ERR_NETWORK, ECONNABORTED (timeout), etc.
  return true
}

const shouldFallback = (err: any) => {
  const status = err?.response?.status
  const networkish = isNetworkishError(err)
  return (
    API_BASE_URL2 &&
    API_BASE_URL2 !== API_BASE_URL &&
    (networkish || status === 404 || status === 405)
  )
}

// (Optional) warn loudly if running on HTTPS but API URL is HTTP (mixed content -> Network Error)
if (typeof window !== 'undefined') {
  try {
    const pageIsHTTPS = window.location.protocol === 'https:'
    if (pageIsHTTPS && /^http:\/\//i.test(API_BASE_URL)) {
      // This WILL be blocked by the browser; use an https API endpoint in production.
      // Keeping as console.warn to avoid noisy logs in prod builds.
      // eslint-disable-next-line no-console
      console.warn(
        '[api] Page is HTTPS but NEXT_PUBLIC_API_URL is HTTP. This causes mixed-content blocking (Network Error). ' +
        'Use an HTTPS API endpoint or a same-origin relative path.'
      )
    }
  } catch {}
}

/** GET (BASE_URL) with fallback to BASE_URL2 on 404/405 or network errors */
export const get = async <T = any>(url: string, params?: any): Promise<T> => {
  try {
    const res = await api.get<T>(url, { params })
    return res.data
  } catch (err: any) {
    if (shouldFallback(err)) {
      // eslint-disable-next-line no-console
      console.warn(`[api:get] Primary failed for ${url} -> retrying on API_BASE_URL2`)
      const res2 = await api2.get<T>(url, { params })
      return res2.data
    }
    throw err
  }
}

/** POST (BASE_URL) with fallback to BASE_URL2 on 404/405 or network errors */
export const post = async <T = any>(url: string, data?: any, opts?: { signal?: AbortSignal }): Promise<T> => {
  const isFD = typeof FormData !== 'undefined' && data instanceof FormData
  try {
    if (isFD) {
      const res = await api.post<T>(url, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: opts?.signal,
      })
      return res.data
    }
    const res = await api.post<T>(url, data, { signal: opts?.signal })
    return res.data
  } catch (err: any) {
    if (shouldFallback(err)) {
      // eslint-disable-next-line no-console
      console.warn(`[api:post] Primary failed for ${url} -> retrying on API_BASE_URL2`)
      if (isFD) {
        const res2 = await api2.post<T>(url, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: opts?.signal,
        })
        return res2.data
      } else {
        const res2 = await api2.post<T>(url, data, { signal: opts?.signal })
        return res2.data
      }
    }
    throw err
  }
}

/** GET (BASE_URL2) */
export const get2 = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api2.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL2) */
export const post2 = async <T = any>(url: string, data?: any, opts?: { signal?: AbortSignal }): Promise<T> => {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const res = await api2.post<T>(url, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: opts?.signal,
    })
    return res.data
  }
  const res = await api2.post<T>(url, data, { signal: opts?.signal })
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
      headers: { 'Content-Type': 'multipart/form-data' },
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
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  } else {
    response = await api2.post<Blob>(url, data, opts)
  }
  return response.data
}

export default api
export { api2 }
