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

/** Current user AI settings. GET /api/me/ai-settings */
export const getMyAiSettings = async (): Promise<{ ai_enabled: boolean }> => {
  const data = await request<unknown>('/api/me/ai-settings', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  const obj = (data ?? {}) as { ai_enabled?: boolean }
  return { ai_enabled: obj.ai_enabled !== false }
}

/** Update current user AI settings. PATCH /api/me/ai-settings */
export const updateMyAiSettings = async (
  ai_enabled: boolean,
): Promise<{ ai_enabled: boolean }> => {
  const data = await request<unknown>('/api/me/ai-settings', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ ai_enabled }),
  })
  const obj = (data ?? {}) as { ai_enabled?: boolean }
  return { ai_enabled: obj.ai_enabled !== false }
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

/** Row for v2 leads table. GET /api/v2/leads/table */
export type V2LeadTableRow = {
  id: string | number
  lead_number?: number | null
  name?: string | null
  phone?: string | null
  city?: string | null
  object?: string | null
  area?: string | null
  status?: string | null
  date?: string | null
  created_at?: string | null
  assigned_to_id?: string | number | null
  assigned_to_name?: string | null
  next_call_at?: string | null
  tenant_id?: string | number | null
  last_comment?: string | null
}

/** Current user (GET /api/me or /api/auth/me). For role-based UI. */
export type MeUser = {
  id?: string | number
  email?: string
  role?: 'admin' | 'owner' | 'rop' | 'manager'
  tenant_id?: string | number | null
  is_admin?: boolean
}

export type V2LeadsTableResult = { list: V2LeadTableRow[]; total: number }

function extractV2LeadsTable(data: unknown): V2LeadsTableResult {
  const json = data as Record<string, unknown> | unknown[] | null | undefined
  let list: unknown[] = []
  if (json != null && typeof json === 'object') {
    if (Array.isArray(json)) {
      list = json
    } else {
      const obj = json as Record<string, unknown>
      if (Array.isArray(obj.rows)) list = obj.rows as unknown[]
      else if (Array.isArray(obj.leads)) list = obj.leads as unknown[]
      else if (Array.isArray(obj.items)) list = obj.items as unknown[]
      else if (Array.isArray(obj.data)) list = obj.data as unknown[]
      else if (obj.ok && Array.isArray(obj.result)) list = obj.result as unknown[]
      else list = []
    }
  }
  const arr = Array.isArray(list) ? list : []
  const total = (json != null && typeof json === 'object' && !Array.isArray(json))
    ? (typeof (json as Record<string, unknown>).total === 'number'
        ? (json as Record<string, unknown>).total as number
        : arr.length)
    : arr.length
  console.log('leads raw json', json)
  console.log('normalized list length', arr.length)
  return { list: arr as V2LeadTableRow[], total }
}

export const getV2LeadsTable = async (): Promise<V2LeadsTableResult> => {
  const data = await request<unknown>('/api/v2/leads/table', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  return extractV2LeadsTable(data)
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

/** PATCH /api/leads/{id} — status, next_call_at, etc. */
export const updateLeadFields = async (
  id: string,
  payload: { status?: LeadStatus; next_call_at?: string | null; [key: string]: unknown },
) => {
  const data = await request<unknown>(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return data
}

/** GET /api/me or /api/auth/me — current user and role. 404 → null. */
export const getMe = async (): Promise<MeUser | null> => {
  const paths = ['/api/me', '/api/auth/me']
  for (const path of paths) {
    const url = fullUrl(path)
    const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
    if (response.status === 404) continue
    if (!response.ok) throw await buildError(response)
    const text = await response.text()
    if (!text) return null
    try {
      const data = JSON.parse(text) as Record<string, unknown>
      const role = (data.role as string) ?? (data.is_admin ? 'admin' : undefined)
      const id = data.id != null ? data.id as string | number : undefined
      const tenant_id = data.tenant_id != null && data.tenant_id !== '' ? (data.tenant_id as string | number) : null
      return {
        id,
        email: data.email as string,
        role: role as MeUser['role'],
        tenant_id,
        is_admin: data.is_admin === true,
      }
    } catch {
      return null
    }
  }
  return null
}

const ASSIGN_UNAVAILABLE = 'Функция обновляется'

/** PATCH /api/leads/{id}/assign — assign lead to user. 404/403 → throw with friendly message. */
export const assignLead = async (
  leadId: string,
  payload: { assigned_to_id: string | number | null },
) => {
  const url = fullUrl(`/api/leads/${leadId}/assign`)
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  if (response.status === 401 || response.status === 403) {
    const err = new Error('Недостаточно прав') as ApiError
    err.status = response.status
    throw err
  }
  if (response.status === 404) {
    const err = new Error(ASSIGN_UNAVAILABLE) as ApiError
    err.status = 404
    throw err
  }
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

/** POST /api/leads/bulk-assign — bulk assign. Returns { assigned: N, skipped: M }. */
export const bulkAssignLeads = async (
  payload: {
    lead_ids: (string | number)[]
    assigned_to_id: string | number
    set_status_in_progress?: boolean
  },
): Promise<{ assigned: number; skipped: number }> => {
  const url = fullUrl('/api/leads/bulk-assign')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  if (response.status === 401 || response.status === 403) {
    const err = new Error('Недостаточно прав') as ApiError
    err.status = response.status
    throw err
  }
  if (response.status === 404) {
    const err = new Error(ASSIGN_UNAVAILABLE) as ApiError
    err.status = 404
    throw err
  }
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  return {
    assigned: Number(data.assigned ?? 0),
    skipped: Number(data.skipped ?? 0),
  }
}

/** Снять назначение с одного лида (PATCH assign с null). */
export const unassignLead = async (leadId: string): Promise<void> => {
  await assignLead(leadId, { assigned_to_id: null })
}

/** Массовое снятие назначения. Если бэк даёт bulk-unassign — используем его, иначе по одному. */
export const bulkUnassignLeads = async (
  leadIds: (string | number)[],
): Promise<{ unassigned: number }> => {
  const url = fullUrl('/api/leads/bulk-unassign')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ lead_ids: leadIds }),
  })
  if (response.status === 404 || response.status === 501) {
    const results = await Promise.all(
      leadIds.map((id) =>
        assignLead(String(id), { assigned_to_id: null }).then(() => true).catch(() => false),
      ),
    )
    return { unassigned: results.filter(Boolean).length }
  }
  if (response.status === 401 || response.status === 403) {
    const err = new Error('Недостаточно прав') as ApiError
    err.status = response.status
    throw err
  }
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  return { unassigned: Number(data.unassigned ?? data.count ?? leadIds.length) }
}

export const deleteLead = async (id: string) => {
  return request<void>(`/api/leads/${id}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
    },
  })
}

/** GET /api/leads/{lead_id}/ai-status. 404 → default (not muted, global on). */
export const getLeadAiStatus = async (
  leadId: string,
): Promise<{ ai_muted_in_chat?: boolean; ai_enabled_global?: boolean }> => {
  const url = fullUrl(`/api/leads/${leadId}/ai-status`)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404) {
    return { ai_muted_in_chat: false, ai_enabled_global: true }
  }
  if (!response.ok) throw await buildError(response)
  const text = await response.text()
  if (!text) return { ai_muted_in_chat: false, ai_enabled_global: true }
  try {
    const obj = JSON.parse(text) as { ai_muted_in_chat?: boolean; ai_enabled_global?: boolean }
    return {
      ai_muted_in_chat: obj.ai_muted_in_chat === true,
      ai_enabled_global: obj.ai_enabled_global !== false,
    }
  } catch {
    return { ai_muted_in_chat: false, ai_enabled_global: true }
  }
}

/** POST /api/leads/{lead_id}/ai-mute { muted: boolean } */
export const postLeadAiMute = async (
  leadId: string,
  payload: { muted: boolean },
) => {
  return request<unknown>(`/api/leads/${leadId}/ai-mute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
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
  /** ChatFlow webhook: full URL or key to build URL */
  webhook_url?: string | null
  webhook_key?: string | null
  /** ChatFlow / WhatsApp binding */
  token?: string | null
  instance_id?: string | null
  phone_number?: string | null
  whatsapp_active?: boolean
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

/** PATCH tenant: only core fields (no WhatsApp binding). */
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
  if (import.meta.env.DEV) {
    console.log('[AdminTenants] PATCH /api/admin/tenants/' + tenantId, payload)
  }
  const result = await request<unknown>(`/api/admin/tenants/${tenantId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  if (import.meta.env.DEV) {
    console.log('[AdminTenants] PATCH response', result)
  }
  return result
}

/** WhatsApp/ChatFlow binding for one tenant (single object). */
export type TenantWhatsappBinding = {
  token?: string | null
  instance_id?: string | null
  phone_number?: string | null
  active?: boolean
}

const BINDING_404_MESSAGE =
  'Не удалось сохранить привязку: endpoint отсутствует'

/** GET binding: GET /api/admin/tenants/{id}/whatsapp. 404 → empty binding. */
export const getTenantWhatsappBinding = async (
  tenantId: string | number,
): Promise<TenantWhatsappBinding> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/whatsapp`)
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  const text = await response.text()
  if (import.meta.env.DEV) {
    console.log('[AdminTenants] GET whatsapp', response.status, text?.slice(0, 200))
  }
  if (response.status === 404) {
    return { token: '', instance_id: '', phone_number: '', active: true }
  }
  if (!response.ok) throw await buildError(response)
  if (!text) return { token: '', instance_id: '', phone_number: '', active: true }
  try {
    const data = JSON.parse(text) as unknown
    const pickBinding = (o: Record<string, unknown>) => ({
      token: String((o.chatflow_token ?? o.token) ?? '').trim(),
      instance_id: String((o.chatflow_instance_id ?? o.instance_id) ?? '').trim(),
      phone_number: String((o.phone_number as string) ?? '').trim(),
      active: (o.active as boolean) !== false,
    })
    if (Array.isArray(data) && data.length > 0) {
      return pickBinding(data[0] as Record<string, unknown>)
    }
    return pickBinding(data as Record<string, unknown>)
  } catch {
    return { token: '', instance_id: '', phone_number: '', active: true }
  }
}

/** POST binding: POST /api/admin/tenants/{id}/whatsapp. Body: chatflow_token, chatflow_instance_id, phone_number, active. */
export const postTenantWhatsappBinding = async (
  tenantId: string | number,
  payload: {
    token?: string | null
    instance_id?: string | null
    phone_number?: string | null
    active?: boolean
  },
) => {
  const chatflow_token =
    payload.token != null ? String(payload.token).trim() : ''
  const chatflow_instance_id =
    payload.instance_id != null ? String(payload.instance_id).trim() : ''
  const phone_number =
    payload.phone_number != null ? String(payload.phone_number).trim() : ''
  const body = {
    chatflow_token: chatflow_token || null,
    chatflow_instance_id: chatflow_instance_id || null,
    phone_number: phone_number || null,
    active: payload.active !== false,
  }
  if (import.meta.env.DEV) {
    console.log('[AdminTenants] POST /api/admin/tenants/' + tenantId + '/whatsapp', {
      chatflow_token: chatflow_token ? `***len=${chatflow_token.length}` : null,
      chatflow_instance_id: chatflow_instance_id || null,
      phone_number: phone_number || null,
      active: body.active,
    })
  }
  const url = fullUrl(`/api/admin/tenants/${tenantId}/whatsapp`)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (import.meta.env.DEV) {
    console.log('[AdminTenants] POST whatsapp response', response.status, text?.slice(0, 300))
  }
  if (response.status === 404) {
    const err = new Error(BINDING_404_MESSAGE) as ApiError
    err.status = 404
    throw err
  }
  if (!response.ok) {
    let message = 'Не удалось сохранить привязку'
    if (text) {
      try {
        const json = JSON.parse(text) as {
          message?: string
          detail?: string | unknown[] | unknown
        }
        if (typeof json.message === 'string') message = json.message
        else if (typeof json.detail === 'string') message = json.detail
        else if (Array.isArray(json.detail) && json.detail.length > 0) {
          const first = json.detail[0] as { msg?: string; message?: string }
          message = first.msg ?? first.message ?? JSON.stringify(json.detail[0])
        } else if (json.detail != null) message = String(json.detail)
      } catch {
        message = text.slice(0, 200)
      }
    }
    const err = new Error(message) as ApiError
    err.status = response.status
    throw err
  }
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
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

const TENANT_USERS_404_MESSAGE =
  'Эндпоинт не найден. Проверь, что бэк обновлён и есть /api/admin/tenants/:id/users'

export const getTenantUsers = async (
  tenantId: string | number,
): Promise<TenantUser[]> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/users`)
  const response = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  if (response.status === 404) {
    const err = new Error(TENANT_USERS_404_MESSAGE) as Error & { status?: number }
    err.status = 404
    throw err
  }
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

/* --- CRM v2 Pro: Pipelines, Tasks, SSE --- */

export type PipelineStage = {
  id: string | number
  name: string
  order?: number
}

export type Pipeline = {
  id: string | number
  name?: string
  is_default?: boolean
  stages?: PipelineStage[]
}

export type PipelineLead = {
  id: string | number
  name?: string | null
  phone?: string | null
  city?: string | null
  object?: string | null
  area?: string | null
  status?: string | null
  stage_id?: string | number | null
  assigned_to_id?: string | number | null
  assigned_to_name?: string | null
  last_comment?: string | null
  created_at?: string | null
  date?: string | null
}

export type LeadTask = {
  id: string | number
  lead_id: string | number
  lead_name?: string | null
  type?: string
  due_at: string
  done?: boolean
  comment?: string | null
  created_at?: string | null
}

function extractPipelines(data: unknown): Pipeline[] {
  if (Array.isArray(data)) return data as Pipeline[]
  const o = data as { pipelines?: unknown[]; data?: unknown[] }
  if (Array.isArray(o?.pipelines)) return o.pipelines as Pipeline[]
  if (Array.isArray(o?.data)) return o.data as Pipeline[]
  return []
}

export const getPipelines = async (): Promise<Pipeline[]> => {
  const data = await request<unknown>('/api/pipelines', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  return extractPipelines(data ?? [])
}

/** GET /api/leads — for pipeline Kanban (includes stage_id when backend supports it). */
export const getLeadsForPipeline = async (): Promise<PipelineLead[]> => {
  const data = await request<unknown>('/api/leads', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  const leads = Array.isArray((data as { leads?: unknown[] })?.leads)
    ? (data as { leads: unknown[] }).leads
    : Array.isArray(data)
      ? data
      : []
  return leads as PipelineLead[]
}

/** PATCH /api/leads/{id}/stage — move lead to stage. */
export const patchLeadStage = async (
  leadId: string,
  stageId: string | number,
): Promise<unknown> => {
  return request<unknown>(`/api/leads/${leadId}/stage`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ stage_id: stageId }),
  })
}

function extractTasks(data: unknown): LeadTask[] {
  if (Array.isArray(data)) return data as LeadTask[]
  const o = data as { tasks?: unknown[]; items?: unknown[]; data?: unknown[] }
  if (Array.isArray(o?.tasks)) return o.tasks as LeadTask[]
  if (Array.isArray(o?.items)) return o.items as LeadTask[]
  if (Array.isArray(o?.data)) return o.data as LeadTask[]
  return []
}

/** GET /api/tasks — filter: today | overdue | week. Manager sees own, rop/owner see tenant. */
export const getTasks = async (
  filter: 'today' | 'overdue' | 'week' = 'today',
): Promise<LeadTask[]> => {
  const data = await request<unknown>(`/api/tasks?filter=${filter}`, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  return extractTasks(data ?? [])
}

/** POST /api/leads/{id}/tasks — create call task. */
export const createLeadTask = async (
  leadId: string,
  payload: { due_at: string; comment?: string; type?: string },
): Promise<LeadTask> => {
  const data = await request<unknown>(`/api/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ ...payload, type: payload.type ?? 'call' }),
  })
  return (data ?? {}) as LeadTask
}

/** PATCH /api/tasks/{id}/complete — mark task done. */
export const completeTask = async (taskId: string | number): Promise<unknown> => {
  return request<unknown>(`/api/tasks/${taskId}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ done: true }),
  })
}

/** PATCH/PUT pipeline stages (reorder, rename, add). */
export const updatePipelineStages = async (
  pipelineId: string | number,
  stages: { id?: string | number; name: string; order?: number }[],
): Promise<unknown> => {
  return request<unknown>(`/api/pipelines/${pipelineId}/stages`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ stages }),
  })
}

/** SSE: subscribe to events. On lead_created call onLeadCreated(payload). On error/close use polling. */
export function subscribeEvents(options: {
  onLeadCreated: (payload: { name?: string; city?: string; id?: string | number }) => void
  onError: () => void
}): () => void {
  const token = getToken()
  const url = fullUrl(`/api/events/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`)
  let cancelled = false
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  const POLL_MS = 45000

  const startPolling = () => {
    if (cancelled || pollTimer) return
    pollTimer = setTimeout(() => {
      pollTimer = null
      options.onLeadCreated({})
      startPolling()
    }, POLL_MS)
  }

  try {
    const es = new EventSource(url)
    es.onmessage = (event) => {
      if (cancelled) return
      try {
        const data = JSON.parse(event.data || '{}') as { type?: string; payload?: unknown }
        if (data.type === 'lead_created' && data.payload) {
          const p = data.payload as { name?: string; city?: string; id?: string | number }
          options.onLeadCreated(p)
        }
      } catch {
        // ignore parse errors
      }
    }
    es.onerror = () => {
      es.close()
      if (!cancelled) {
        options.onError()
        startPolling()
      }
    }
    return () => {
      cancelled = true
      es.close()
      if (pollTimer) clearTimeout(pollTimer)
    }
  } catch {
    startPolling()
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }
}
