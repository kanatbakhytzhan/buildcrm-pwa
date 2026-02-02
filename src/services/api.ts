import { BASE_URL } from '../config/appConfig'
import { getToken } from './auth'

type LeadStatus = 'new' | 'success' | 'failed'

type ApiError = Error & {
  status?: number
}

let unauthorizedHandler: (() => void) | null = null

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler
}

const buildError = async (
  response: Response,
  options?: { skipUnauthorized?: boolean; isLogin?: boolean },
) => {
  let message = 'Ошибка запроса'
  try {
    const text = await response.text()
    if (text) {
      try {
        const data = JSON.parse(text)
        message =
          data?.message ||
          data?.detail ||
          data?.error ||
          data?.status ||
          text
      } catch {
        message = text
      }
    }
  } catch {
    message = 'Ошибка запроса'
  }
  if (response.status === 401) {
    message = options?.isLogin ? 'Неверный логин или пароль' : 'Сессия истекла. Войдите снова.'
    if (!options?.skipUnauthorized) {
      unauthorizedHandler?.()
    }
  }
  const error = new Error(message) as ApiError
  error.status = response.status
  return error
}

function isNetworkFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /failed to fetch|network error|cors|load failed/i.test(msg)
}

const request = async <T>(path: string, options?: RequestInit) => {
  const url = fullUrl(path)
  let response: Response
  try {
    response = await fetch(url, options)
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('[api] fetch failed', { url, method: options?.method ?? 'GET', error: e })
    }
    const msg = e instanceof Error ? e.message : String(e)
    const detail = import.meta.env.DEV ? ` (${url})` : ''
    throw new Error(
      isNetworkFailure(e)
        ? `Сетевая ошибка: проверьте CORS и URL API${detail}`
        : msg
    ) as ApiError
  }
  if (!response.ok) {
    throw await buildError(response)
  }
  const text = await response.text()
  if (!text) {
    return undefined as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}

const authHeaders = (): HeadersInit => {
  const token = getToken()
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
  return headers
}

/** Build full API URL (BASE_URL has no trailing slash, path must start with /) */
function fullUrl(path: string): string {
  const base = BASE_URL.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export const login = async (email: string, password: string) => {
  const path = '/api/auth/login'
  const url = fullUrl(path)
  const body = new URLSearchParams({ username: email, password }).toString()
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('[api] login fetch failed', { url, error: e })
    }
    throw new Error(
      isNetworkFailure(e)
        ? 'CORS/Network ошибка. Проверь, что backend разрешает домен Vercel в CORS.'
        : (e instanceof Error ? e.message : String(e))
    ) as ApiError
  }
  if (response.status === 404) {
    const error = new Error('API не нашёл /api/auth/login. Проверь BASE_URL и деплой backend.') as ApiError
    error.status = 404
    throw error
  }
  if (!response.ok) {
    throw await buildError(response, { skipUnauthorized: true, isLogin: true })
  }
  const text = await response.text()
  if (!text) {
    const error = new Error('Пустой ответ сервера') as ApiError
    error.status = response.status
    throw error
  }
  try {
    const data = JSON.parse(text)
    const token =
      data?.access_token ??
      data?.token ??
      data?.accessToken ??
      data?.data?.access_token ??
      data?.data?.token
    if (token && typeof token === 'string') {
      return token
    }
  } catch {
    if (text && typeof text === 'string') {
      return text
    }
  }
  const error = new Error('Токен не получен') as ApiError
  error.status = response.status
  throw error
}

/** Change password (authenticated user). POST /api/auth/change-password */
export const changePassword = async (payload: {
  current_password: string
  new_password: string
}) => {
  return request<unknown>('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
}

/** Health check for diagnostics (GET /api/health) */
export const checkApiHealth = async (): Promise<{ ok: boolean; message: string }> => {
  const url = fullUrl('/api/health')
  try {
    const response = await fetch(url, { method: 'GET' })
    if (response.ok) {
      return { ok: true, message: `API доступен (${response.status})` }
    }
    if (response.status === 404) {
      return {
        ok: false,
        message: 'API не нашёл /api/health. Проверь BASE_URL и деплой backend.',
      }
    }
    return {
      ok: false,
      message: `API вернул ${response.status}: ${response.statusText}`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (isNetworkFailure(e)) {
      return {
        ok: false,
        message: 'CORS/Network ошибка. Проверь, что backend разрешает домен Vercel в CORS.',
      }
    }
    return { ok: false, message: msg }
  }
}

export const getLeads = async (): Promise<{ raw: unknown; leads: unknown[] }> => {
  const data = await request<unknown>('/api/leads', {
    method: 'GET',
    headers: {
      ...authHeaders(),
    },
  })
  const leads = Array.isArray((data as { leads?: unknown[] })?.leads)
    ? (data as { leads: unknown[] }).leads
    : Array.isArray(data)
      ? data
      : []
  return { raw: data, leads }
}

export const getLead = async (id: string) => {
  return request<unknown>(`/api/leads/${id}`, {
    method: 'GET',
    headers: {
      ...authHeaders(),
    },
  })
}

export const updateLeadStatus = async (id: string, status: LeadStatus) => {
  const data = await request<unknown>(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ status }),
  })
  return data ?? { id, status }
}

export const deleteLead = async (id: string) => {
  return request<void>(`/api/leads/${id}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
    },
  })
}

export type LeadComment = {
  id: string | number
  lead_id?: string | number
  body?: string
  text?: string
  created_at?: string
  author?: string
}

const extractLeadComments = (data: unknown): LeadComment[] => {
  if (Array.isArray(data)) return data as LeadComment[]
  const obj = data as { comments?: unknown[]; items?: unknown[]; data?: unknown[] }
  if (Array.isArray(obj?.comments)) return obj.comments as LeadComment[]
  if (Array.isArray(obj?.items)) return obj.items as LeadComment[]
  if (Array.isArray(obj?.data)) return obj.data as LeadComment[]
  return []
}

export const getLeadComments = async (leadId: string): Promise<LeadComment[]> => {
  const url = fullUrl(`/api/leads/${leadId}/comments`)
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  if (response.status === 404) return []
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  if (!text) return []
  try {
    const data = JSON.parse(text) as unknown
    return extractLeadComments(data)
  } catch {
    return []
  }
}

/** POST /api/leads/{lead_id}/comments — body must be { "text": "<string>" } */
export const postLeadComment = async (
  leadId: string,
  text: string,
): Promise<LeadComment> => {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  const idForUrl =
    typeof leadId === 'number'
      ? String(leadId)
      : typeof leadId === 'string'
        ? leadId.trim()
        : ''
  if (!idForUrl) {
    const err = new Error('Не удалось определить lead_id') as ApiError
    err.status = 400
    throw err
  }
  const url = fullUrl(`/api/leads/${idForUrl}/comments`)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ text: trimmed }),
  })
  const responseText = await response.text()
  let responseJson: unknown = null
  if (responseText) {
    try {
      responseJson = JSON.parse(responseText)
    } catch {
      responseJson = responseText
    }
  }
  if (!response.ok) {
    if (response.status === 422) {
      console.error('[api] POST comments 422 response:', responseJson)
      const detail =
        typeof responseJson === 'object' && responseJson !== null && 'detail' in responseJson
          ? (responseJson as { detail: unknown }).detail
          : responseJson
      console.error('[api] POST comments 422 detail:', detail)
    } else {
      console.error('[api] POST comments error', response.status, responseJson)
    }
    const message =
      response.status === 401
        ? 'Сессия истекла. Войдите снова.'
        : response.status === 403
          ? 'Нет доступа'
          : response.status === 404
            ? 'Лид не найден'
            : response.status === 422
              ? 'Ошибка формата комментария'
              : response.status >= 500
                ? 'Ошибка сервера'
                : typeof responseJson === 'object' &&
                    responseJson !== null &&
                    'message' in responseJson
                  ? String((responseJson as { message: unknown }).message)
                  : 'Не удалось добавить комментарий'
    const error = new Error(message) as ApiError
    error.status = response.status
    throw error
  }
  if (!responseText) {
    const err = new Error('Пустой ответ сервера') as ApiError
    err.status = response.status
    throw err
  }
  const obj = responseJson as Record<string, unknown>
  const comment = (obj?.comment ?? obj?.data ?? obj) as LeadComment
  const bodyFromApi = comment?.body ?? (comment as { text?: string })?.text
  return { ...comment, body: bodyFromApi ?? trimmed } as LeadComment
}

export type AdminUser = {
  id: string | number
  email: string
  company_name?: string | null
  is_active: boolean
  created_at: string
}

const extractAdminUsers = (data: unknown): AdminUser[] => {
  if (Array.isArray(data)) {
    return data as AdminUser[]
  }
  if (Array.isArray((data as { users?: unknown[] })?.users)) {
    return (data as { users: AdminUser[] }).users
  }
  if (Array.isArray((data as { data?: unknown[] })?.data)) {
    return (data as { data: AdminUser[] }).data
  }
  return []
}

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const data = await request<unknown>('/api/admin/users', {
    method: 'GET',
    headers: {
      ...authHeaders(),
    },
  })
  return extractAdminUsers(data)
}

export const createAdminUser = async (payload: {
  email: string
  password: string
  company_name?: string
}) => {
  return request<unknown>('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
}

export const updateAdminUser = async (
  id: string | number,
  payload: { is_active?: boolean; company_name?: string },
) => {
  return request<unknown>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
}

/** Reset user password (admin). Backend returns temporary_password. */
export const resetAdminUserPassword = async (
  id: string | number,
): Promise<{ temporary_password: string }> => {
  const data = await request<unknown>(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({}),
  })
  const obj = (data ?? {}) as { temporary_password?: string; temp_password?: string }
  const temporary_password =
    obj.temporary_password ?? obj.temp_password ?? ''
  return { temporary_password }
}

/* --- Admin Tenants --- */

export type AdminTenant = {
  id: string | number
  name: string
  slug: string
  is_active: boolean
  default_owner_user_id?: number | null
  ai_prompt?: string | null
  ai_enabled?: boolean
}

export type TenantWhatsapp = {
  id?: string | number
  phone_number: string
  phone_number_id: string
  is_active: boolean
  verify_token?: string | null
  waba_id?: string | null
}

const extractAdminTenants = (data: unknown): AdminTenant[] => {
  if (Array.isArray(data)) return data as AdminTenant[]
  if (Array.isArray((data as { tenants?: unknown[] })?.tenants)) {
    return (data as { tenants: AdminTenant[] }).tenants
  }
  if (Array.isArray((data as { data?: unknown[] })?.data)) {
    return (data as { data: AdminTenant[] }).data
  }
  return []
}

const extractTenantWhatsapps = (data: unknown): TenantWhatsapp[] => {
  if (Array.isArray(data)) return data as TenantWhatsapp[]
  if (Array.isArray((data as { accounts?: unknown[] })?.accounts)) {
    return (data as { accounts: TenantWhatsapp[] }).accounts
  }
  if (Array.isArray((data as { whatsapp?: unknown[] })?.whatsapp)) {
    return (data as { whatsapp: TenantWhatsapp[] }).whatsapp
  }
  if (Array.isArray((data as { whatsapps?: unknown[] })?.whatsapps)) {
    return (data as { whatsapps: TenantWhatsapp[] }).whatsapps
  }
  if (Array.isArray((data as { items?: unknown[] })?.items)) {
    return (data as { items: TenantWhatsapp[] }).items
  }
  if (Array.isArray((data as { data?: unknown[] })?.data)) {
    return (data as { data: TenantWhatsapp[] }).data
  }
  return []
}

export const getAdminTenants = async (): Promise<AdminTenant[]> => {
  const data = await request<unknown>('/api/admin/tenants', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  return extractAdminTenants(data)
}

export const createAdminTenant = async (payload: {
  name: string
  slug: string
  default_owner_user_id?: number | null
  is_active: boolean
}) => {
  return request<unknown>('/api/admin/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
}

export const updateAdminTenant = async (
  tenantId: string | number,
  payload: {
    name?: string
    slug?: string
    default_owner_user_id?: number | null
    is_active?: boolean
    ai_prompt?: string | null
    ai_enabled?: boolean
  },
) => {
  return request<unknown>(`/api/admin/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
}

export const getTenantWhatsapps = async (
  tenantId: string | number,
): Promise<TenantWhatsapp[]> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/whatsapp`)
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  if (response.status === 404) return []
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  if (!text) return []
  try {
    const data = JSON.parse(text) as unknown
    if (import.meta.env.DEV) {
      console.log('[AdminTenants] whatsapp response', data)
    }
    return extractTenantWhatsapps(data)
  } catch {
    return []
  }
}

export const addTenantWhatsapp = async (
  tenantId: string | number,
  payload: {
    phone_number: string
    phone_number_id: string
    verify_token?: string
    waba_id?: string
  },
) => {
  return request<unknown>(
    `/api/admin/tenants/${tenantId}/whatsapp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    },
  )
}

export const deleteTenantWhatsapp = async (
  tenantId: string | number,
  accountId: string | number,
) => {
  return request<void>(
    `/api/admin/tenants/${tenantId}/whatsapps/${accountId}`,
    {
      method: 'DELETE',
      headers: { ...authHeaders() },
    },
  )
}

/* --- Tenant users (multi-user) --- */

export type TenantUser = {
  id: string | number
  email: string
  role?: 'manager' | 'admin'
  created_at?: string
}

const extractTenantUsers = (data: unknown): TenantUser[] => {
  if (Array.isArray(data)) return data as TenantUser[]
  const obj = data as { users?: unknown[]; items?: unknown[]; data?: unknown[] }
  if (Array.isArray(obj?.users)) return obj.users as TenantUser[]
  if (Array.isArray(obj?.items)) return obj.items as TenantUser[]
  if (Array.isArray(obj?.data)) return obj.data as TenantUser[]
  return []
}

export const getTenantUsers = async (
  tenantId: string | number,
): Promise<TenantUser[]> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/users`)
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  if (response.status === 404) return []
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  if (!text) return []
  try {
    const data = JSON.parse(text) as unknown
    return extractTenantUsers(data)
  } catch {
    return []
  }
}

export const addTenantUser = async (
  tenantId: string | number,
  payload: { email: string; role?: 'manager' | 'admin' },
) => {
  return request<unknown>(`/api/admin/tenants/${tenantId}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
}
