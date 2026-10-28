import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import type { ApiErrorBody, ErrorCode } from './contracts'
import { storage } from './storage'

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'NETWORK' | 'TIMEOUT'
  readonly fields?: Record<string, string>
  readonly details?: unknown

  constructor(status: number, code: ApiError['code'], message: string, fields?: Record<string, string>, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.details = details
  }

  /** Network failures, timeouts and 5xx are worth retrying; 4xx never are. */
  get transient() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = storage.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Cart-Id', storage.getCartId())
  return config
})

type UnauthorizedListener = (code: ErrorCode) => void
let onUnauthorized: UnauthorizedListener = () => {}
/** The session layer subscribes here so a 401 anywhere expires the session in one place. */
export function setUnauthorizedHandler(listener: UnauthorizedListener) {
  onUnauthorized = listener
}

http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isCancel(error)) return Promise.reject(error)
  if (!(error instanceof AxiosError)) return Promise.reject(error)
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
    return Promise.reject(new ApiError(0, 'TIMEOUT', 'A requisição excedeu o tempo limite.'))
  if (!error.response) return Promise.reject(new ApiError(0, 'NETWORK', 'Sem conexão com o servidor.'))

  const body = error.response.data as Partial<ApiErrorBody> | undefined
  const status = error.response.status
  const code = body?.error?.code ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION')
  const apiError = new ApiError(status, code, body?.error?.message ?? 'Erro inesperado.', body?.error?.fields, body?.error?.details)
  if (status === 401 && storage.getToken()) onUnauthorized(code)
  return Promise.reject(apiError)
})

/** Every response is parsed against its contract: a mismatch is a bug, surfaced loudly. */
export async function request<S extends z.ZodType>(schema: S, config: AxiosRequestConfig): Promise<z.infer<S>> {
  const { data } = await http.request(config)
  return schema.parse(data)
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
