// lib/api.ts
import axios, { AxiosRequestConfig } from 'axios'

const BASE_URL  = process.env.NEXT_PUBLIC_API_URL  || 'http://localhost:5000'
const BASE_URL2 = process.env.NEXT_PUBLIC_API_URL2 || 'http://localhost:7000'

// Primary API (BASE_URL)
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Secondary API (BASE_URL2)
const api2 = axios.create({
  baseURL: BASE_URL2,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach auth token to both clients
const attachAuth = (config: any) => {
  if (typeof window !== 'undefined') {
    const path = window.location?.pathname || ''
    let token: string | null = null

    // Role-scoped tokens
    if (path.startsWith('/brand')) {
      token = localStorage.getItem('brand_token')
    } else if (path.startsWith('/influencer')) {
      token = localStorage.getItem('influencer_token')
    } else if (path.startsWith('/admin')) {
      token = localStorage.getItem('admin_token')
    }

    // Fallbacks for non-role pages or legacy storage
    if (!token) token = localStorage.getItem('brand_token')
    if (!token) token = localStorage.getItem('influencer_token')
    if (!token) token = localStorage.getItem('admin_token')
    // Final legacy fallback (compat)
    if (!token) token = localStorage.getItem('token')

    if (token) {
      config.headers!['Authorization'] = `Bearer ${token}`
    }
  }
  return config
}
api.interceptors.request.use(attachAuth)
api2.interceptors.request.use(attachAuth)

/** GET (BASE_URL) */
export const get = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL) */
export const post = async <T = any>(url: string, data?: any, opts?: { signal?: AbortSignal }): Promise<T> => {
  if (data instanceof FormData) {
    const res = await api.post<T>(url, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: opts?.signal,
    })
    return res.data
  }
  const res = await api.post<T>(url, data, { signal: opts?.signal })
  return res.data
}

/** GET (BASE_URL2) */
export const get2 = async <T = any>(url: string, params?: any): Promise<T> => {
  const res = await api2.get<T>(url, { params })
  return res.data
}

/** POST (BASE_URL2) */
export const post2 = async <T = any>(url: string, data?: any, opts?: { signal?: AbortSignal }): Promise<T> => {
  if (data instanceof FormData) {
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
  const opts: AxiosRequestConfig = {
    responseType: 'blob',
    ...config,
  }
  let response
  if (data instanceof FormData) {
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
  const opts: AxiosRequestConfig = {
    responseType: 'blob',
    ...config,
  }
  let response
  if (data instanceof FormData) {
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
