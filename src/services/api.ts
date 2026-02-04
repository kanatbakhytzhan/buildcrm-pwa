import { BASE_URL } from '../config/appConfig'
import { getToken } from './auth'

type LeadStatus = 'new' | 'success' | 'failed'

type ApiError = Error & {
  status?: number
}

/** Structured error with full diagnostic info */
export type DetailedApiError = {
  message: string
  status?: number
  url?: string
  detail?: string
  responseBody?: string
  hasAuthHeader?: boolean
  tenantId?: string | number
}

/** Map technical error messages to human-readable ones */
function humanizeError(msg: string): string {
  // Network errors
  if (/failed to fetch|network|cors|load failed|timeout|connection refused/i.test(msg)) {
    return 'Ошибка сети: сервер недоступен (Backend Down) или проблема CORS. Проверьте соединение или VPN.'
  }
  // Database errors
  if (/programmingerror|sqlalchemy|psycopg|database|relation.*does not exist/i.test(msg)) {
    return 'Ошибка базы данных на сервере. Откройте Диагностику и отправьте лог разработчику.'
  }
  // Auth errors
  if (/unauthorized|401|invalid.*token|expired/i.test(msg)) {
    return 'Сессия истекла или токен невалиден (401). Войдите снова.'
  }
  // Permission errors
  if (/forbidden|403|access.*denied|permission/i.test(msg)) {
    return 'Недостаточно прав (403).'
  }
  // Validation errors
  if (/validation|422|invalid.*value|required/i.test(msg)) {
    return `Ошибка валидации: ${msg}`
  }
  // Not found
  if (/404|not found/i.test(msg)) {
    return 'Ресурс не найден (404).'
  }
  return msg
}

/** Global API error parser - use this everywhere to extract meaningful error info */
export function parseApiError(err: unknown): { status?: number; detail: string; raw?: unknown } {
  if (!err) return { detail: 'Неизвестная ошибка' }

  // Already a DetailedApiError
  if (typeof err === 'object' && err !== null && 'detail' in err) {
    const e = err as DetailedApiError
    const rawDetail = e.detail || e.message || 'Ошибка запроса'
    return {
      status: e.status,
      detail: humanizeError(rawDetail),
      raw: err,
    }
  }

  // Regular Error with message
  if (err instanceof Error) {
    return {
      detail: humanizeError(err.message),
      raw: err,
    }
  }

  // Object with detail/message
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    let detail = e.detail ?? e.message ?? e.error

    // Ensure we never return [object Object]
    if (detail && typeof detail === 'object') {
      try {
        detail = JSON.stringify(detail)
      } catch {
        detail = 'Ошибка запроса (неизвестный формат)'
      }
    }

    if (typeof detail === 'string') {
      return { status: e.status as number | undefined, detail: humanizeError(detail), raw: err }
    }
  }

  // String
  if (typeof err === 'string') {
    return { detail: humanizeError(err) }
  }

  // Fallback - never show raw objects
  try {
    const str = JSON.stringify(err)
    return { detail: humanizeError(str.slice(0, 300)) }
  } catch {
    return { detail: 'Ошибка запроса' }
  }
}

/** Extract hostname from full URL or return as-is if already hostname */
export function normalizeAmoDomain(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()

  // If it looks like a full URL, extract hostname
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      return url.hostname
    } catch {
      // Invalid URL, try to extract anyway
      const match = trimmed.match(/https?:\/\/([^\/]+)/)
      if (match) return match[1]
    }
  }

  // Remove trailing slashes and paths
  return trimmed.replace(/\/.*$/, '').replace(/^www\./, '')
}

let unauthorizedHandler: (() => void) | null = null

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler
}

/** Build structured error with full diagnostics */
const buildDetailedError = async (
  response: Response,
  requestUrl: string,
  hasAuth: boolean,
  options?: { skipUnauthorized?: boolean; isLogin?: boolean; tenantId?: string | number },
): Promise<DetailedApiError> => {
  let detail: string | undefined
  let responseBody = ''
  let message = `HTTP ${response.status}`

  try {
    responseBody = await response.text()
    if (responseBody) {
      try {
        const data = JSON.parse(responseBody)
        detail = data?.detail || data?.message || data?.error
        if (typeof detail === 'object') {
          detail = JSON.stringify(detail)
        }
        message = detail || `HTTP ${response.status}`
      } catch {
        // Not JSON, use first 300 chars
        detail = responseBody.slice(0, 300)
        message = `HTTP ${response.status}: ${detail.slice(0, 100)}`
      }
    }
  } catch {
    message = `HTTP ${response.status} (no body)`
  }

  if (response.status === 401) {
    message = options?.isLogin ? 'Неверный логин или пароль' : 'Сессия истекла. Войдите снова.'
    if (!options?.skipUnauthorized) {
      unauthorizedHandler?.()
    }
  }

  return {
    message,
    status: response.status,
    url: requestUrl,
    detail,
    responseBody: responseBody.slice(0, 500),
    hasAuthHeader: hasAuth,
    tenantId: options?.tenantId,
  }
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

/** Retry fetch with exponential backoff for network errors (Render cold start) */
async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 2,
  delay = 2000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (e) {
      const isLast = attempt === retries
      if (isLast || !isNetworkFailure(e)) {
        throw e
      }
      // Wait before retry (Render cold start can take 10-30s)
      await new Promise((r) => setTimeout(r, delay * (attempt + 1)))
    }
  }
  throw new Error('Network request failed after retries')
}

const request = async <T>(path: string, options?: RequestInit) => {
  const url = fullUrl(path)
  let response: Response
  try {
    response = await fetchWithRetry(url, options)
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error('[api] fetch failed', { url, method: options?.method ?? 'GET', error: e })
    }
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      isNetworkFailure(e)
        ? 'Сервер не отвечает. Возможно, идёт запуск (до 30 сек). Обновите страницу.'
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
  payload: { status?: LeadStatus; next_call_at?: string | null;[key: string]: unknown },
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

/** POST /api/leads/selection — получить lead_ids по текущим фильтрам (для ROP). 404 → stub. */
export const postLeadsSelection = async (filters: {
  search?: string
  status?: string
  unassigned_only?: boolean
  mine_only?: boolean
  assigned_only?: boolean
}): Promise<{ lead_ids: (string | number)[] }> => {
  const url = fullUrl('/api/leads/selection')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(filters),
  })
  if (response.status === 404 || response.status === 501) {
    const err = new Error('Backend required') as ApiError
    err.status = response.status
    throw err
  }
  if (!response.ok) throw await buildError(response)
  const data = (await response.json()) as { lead_ids?: (string | number)[] }
  return { lead_ids: Array.isArray(data.lead_ids) ? data.lead_ids : [] }
}

/** POST /api/leads/assign/plan — предпросмотр или применение распределения. dry_run=true → только план. 404 → stub. */
export const postLeadsAssignPlan = async (
  payload: {
    lead_ids: (string | number)[]
    mode: 'round_robin' | 'by_counts' | 'by_ranges'
    manager_ids?: (string | number)[]
    counts?: Record<string, number>
    ranges?: Array<{ manager_id: string | number; from: number; to: number }>
    sort?: 'date_asc' | 'date_desc' | 'status'
    set_status_in_progress?: boolean
  },
  dryRun: boolean,
): Promise<{ plan?: Array<{ lead_id: string | number; assigned_to_id: string | number }>; assigned?: number }> => {
  const url = fullUrl('/api/leads/assign/plan')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ ...payload, dry_run: dryRun }),
  })
  if (response.status === 404 || response.status === 501) {
    const err = new Error('Backend required') as ApiError
    err.status = response.status
    throw err
  }
  if (!response.ok) throw await buildError(response)
  const data = (await response.json()) as {
    plan?: Array<{ lead_id: string | number; assigned_to_id: string | number }>
    assigned?: number
  }
  return data
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
  phone_number?: string
  phone_number_id?: string
  is_active?: boolean
  verify_token?: string | null
  waba_id?: string | null
  // ChatFlow fields
  token?: string
  instance_id?: string
  active?: boolean
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

/** Test WhatsApp: send a test message */
export type WhatsAppTestResult = {
  ok: boolean
  message: string
  details?: string
  status?: number
}

export const testWhatsApp = async (
  tenantId: string | number,
  payload: { phone: string; message: string },
): Promise<WhatsAppTestResult> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/whatsapp/test`)
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({
        phone: payload.phone.replace(/\D/g, ''),
        message: payload.message || 'Тестовое сообщение',
      }),
    })
  } catch (e) {
    return {
      ok: false,
      message: 'Ошибка сети: не удалось отправить запрос',
      details: e instanceof Error ? e.message : String(e),
    }
  }

  let data: Record<string, unknown> = {}
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>
    } catch {
      data = { raw: text }
    }
  }

  // Handle auth errors specially
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      message: 'Вы не авторизованы. Перезайдите в систему.',
      details: JSON.stringify(data, null, 2),
      status: response.status,
    }
  }

  if (response.ok && data.ok !== false) {
    return {
      ok: true,
      message: 'Сообщение отправлено!',
      details: JSON.stringify(data, null, 2),
    }
  }

  // Extract error message
  const errorMsg = typeof data.detail === 'string'
    ? data.detail
    : typeof data.message === 'string'
      ? data.message
      : typeof data.error === 'string'
        ? data.error
        : `Ошибка ${response.status}`

  return {
    ok: false,
    message: errorMsg,
    details: JSON.stringify(data, null, 2),
    status: response.status,
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

/* --- Notifications (in-app) --- */
export type AppNotification = {
  id: string | number
  title?: string
  body?: string
  read?: boolean
  created_at?: string
  type?: string
}

export const getNotifications = async (
  unreadOnly = true,
): Promise<AppNotification[]> => {
  const url = fullUrl(`/api/notifications?unread=${unreadOnly}`)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404 || response.status === 501) {
    return []
  }
  if (!response.ok) throw await buildError(response)
  const data = await response.json()
  if (Array.isArray(data)) return data as AppNotification[]
  if (Array.isArray((data as { items?: unknown[] }).items)) return (data as { items: AppNotification[] }).items
  if (Array.isArray((data as { notifications?: unknown[] }).notifications)) return (data as { notifications: AppNotification[] }).notifications
  return []
}

export const markNotificationsRead = async (): Promise<void> => {
  const url = fullUrl('/api/notifications/read')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({}),
  })
  if (response.status === 404 || response.status === 501) return
  if (!response.ok) throw await buildError(response)
}

/* --- Admin diagnostics --- */
export const getAdminDiagnosticsDb = async (): Promise<unknown> => {
  return request<unknown>('/api/admin/diagnostics/db', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
}

export const postAdminDiagnosticsSmokeTest = async (): Promise<unknown> => {
  return request<unknown>('/api/admin/diagnostics/smoke-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({}),
  })
}

export const postAdminDiagnosticsCheckAiPrompt = async (
  tenantId: string | number,
  message: string,
): Promise<unknown> => {
  return request<unknown>('/api/admin/diagnostics/check-ai-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ tenant_id: tenantId, message: message.trim() || '' }),
  })
}

export const postAdminDiagnosticsCheckMute = async (
  tenantId: string | number,
  chatKey: string,
): Promise<unknown> => {
  return request<unknown>('/api/admin/diagnostics/check-mute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ tenant_id: tenantId, chat_key: chatKey.trim() || '' }),
  })
}

/* --- V3: Import, Reports, Auto-assign --- */

export type ImportLeadsResult = {
  created?: number
  skipped?: number
  errors?: number
  preview?: Record<string, unknown>[]
  errors_list?: string[]
}

export const importLeads = async (
  file: File,
  options: { tenant_id?: string | number; dry_run: boolean; mapping?: Record<string, string> },
): Promise<ImportLeadsResult> => {
  const form = new FormData()
  form.append('file', file)
  if (options.tenant_id != null) form.append('tenant_id', String(options.tenant_id))
  form.append('dry_run', String(options.dry_run))
  if (options.mapping) form.append('mapping', JSON.stringify(options.mapping))
  const url = fullUrl('/api/admin/import/leads')
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
  })
  if (response.status === 401 || response.status === 403) {
    const err = new Error('Нет доступа') as ApiError
    err.status = response.status
    throw err
  }
  if (response.status === 422) {
    const text = await response.text()
    let detail = text
    try {
      const j = JSON.parse(text) as { detail?: string | unknown }
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j)
    } catch {
      // keep text
    }
    throw new Error(detail) as ApiError
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Ошибка сервера') as ApiError
  }
  const data = await response.json()
  return data as ImportLeadsResult
}

async function reportRequest(path: string, params: { date_from?: string; date_to?: string }): Promise<unknown> {
  const q = new URLSearchParams()
  if (params.date_from) q.set('date_from', params.date_from)
  if (params.date_to) q.set('date_to', params.date_to)
  const url = fullUrl(`${path}?${q}`)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404 || response.status === 501) return null
  if (!response.ok) throw await buildError(response)
  return response.json()
}

export const getReportsSummary = async (params: {
  date_from?: string
  date_to?: string
}): Promise<unknown> => reportRequest('/api/admin/reports/summary', params)

export const getReportsSla = async (params: {
  date_from?: string
  date_to?: string
}): Promise<unknown> => reportRequest('/api/admin/reports/sla', params)

export const getReportsWorkload = async (params: {
  date_from?: string
  date_to?: string
}): Promise<unknown> => reportRequest('/api/admin/reports/workload', params)

export type AutoAssignRule = {
  id: string | number
  name?: string
  is_active?: boolean
  priority?: number
  match_city?: string
  match_language?: string
  match_object_type?: string
  match_contains?: string
  time_from?: string
  time_to?: string
  days_of_week?: number[]
  strategy?: 'fixed' | 'round_robin' | 'least_loaded'
  fixed_user_id?: string | number
}

export const getAutoAssignRules = async (tenantId: string | number): Promise<AutoAssignRule[]> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/auto-assign-rules`)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404 || response.status === 501) return []
  if (!response.ok) throw await buildError(response)
  const data = await response.json()
  return Array.isArray(data) ? (data as AutoAssignRule[]) : []
}

export const createAutoAssignRule = async (
  tenantId: string | number,
  body: Partial<AutoAssignRule>,
): Promise<unknown> => {
  return request<unknown>(`/api/admin/tenants/${tenantId}/auto-assign-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

export const updateAutoAssignRule = async (
  ruleId: string | number,
  body: Partial<AutoAssignRule>,
): Promise<unknown> => {
  return request<unknown>(`/api/admin/auto-assign-rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
}

export const deleteAutoAssignRule = async (ruleId: string | number): Promise<void> => {
  return request<void>(`/api/admin/auto-assign-rules/${ruleId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
}

export const assignLeadsByRange = async (body: {
  tenant_id?: string | number
  status?: string
  unassigned_only?: boolean
  from_index: number
  to_index: number
  strategy: 'round_robin' | 'fixed' | 'custom_map'
  manager_ids?: (string | number)[]
  fixed_user_id?: string | number
  custom_map?: Array<{ manager_id: string | number; count: number }>
  dry_run?: boolean
}): Promise<{ assigned?: number; skipped?: number; plan?: Array<{ lead_id: string | number; name?: string; phone?: string; assigned_to?: string | number }> }> => {
  const data = await request<unknown>('/api/admin/leads/assign-by-range', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  return (data ?? {}) as { assigned?: number; skipped?: number; plan?: Array<{ lead_id: string | number; name?: string; phone?: string; assigned_to?: string | number }> }
}

/* --- Tenant settings (universal admin) --- */

export type TenantSettings = {
  id?: string | number
  name?: string
  ai_enabled?: boolean
  ai_prompt?: string | null
  ai_after_submit_behavior?: string | null
  whatsapp_source?: 'chatflow' | 'amomarket' | null
  chatflow_token?: string | null
  chatflow_token_masked?: string | null
  chatflow_instance_id?: string | null
  chatflow_phone_number?: string | null
  chatflow_active?: boolean
  chatflow_binding_exists?: boolean
  chatflow_health_ok?: boolean
  amocrm_connected?: boolean
  amocrm_domain?: string | null
  amocrm_base_domain?: string | null
  amocrm_expires_at?: string | null
  _raw?: unknown // For diagnostics
}

/** Normalize backend response to flat TenantSettings structure */
function normalizeTenantSettings(raw: unknown, tenantId?: string | number): TenantSettings {
  if (!raw || typeof raw !== 'object') {
    return { id: tenantId }
  }

  const r = raw as Record<string, unknown>

  // Backend may return nested structure: { settings: {...}, whatsapp: {...}, amocrm: {...} }
  // OR flat structure directly
  const settings = (r.settings && typeof r.settings === 'object' ? r.settings : r) as Record<string, unknown>
  const whatsapp = (r.whatsapp && typeof r.whatsapp === 'object' ? r.whatsapp : r) as Record<string, unknown>
  const amocrm = (r.amocrm && typeof r.amocrm === 'object' ? r.amocrm : r) as Record<string, unknown>

  // Extract values with priority: nested object > flat > null
  const ai_prompt = settings.ai_prompt ?? r.ai_prompt ?? null
  const ai_enabled = settings.ai_enabled_global ?? settings.ai_enabled ?? r.ai_enabled ?? r.ai_enabled_global
  const ai_behavior = settings.ai_after_lead_submitted_behavior ?? settings.ai_after_submit_behavior ?? r.ai_after_submit_behavior ?? 'polite_close'

  // WhatsApp fields - check both nested and flat
  const wa_source = (settings.whatsapp_source ?? whatsapp.whatsapp_source ?? r.whatsapp_source ?? 'chatflow') as TenantSettings['whatsapp_source']
  const cf_token = (whatsapp.chatflow_token ?? whatsapp.token ?? r.chatflow_token ?? null) as string | null
  const cf_token_masked = (whatsapp.chatflow_token_masked ?? whatsapp.token_masked ?? r.chatflow_token_masked ?? null) as string | null
  const cf_instance = (whatsapp.chatflow_instance_id ?? whatsapp.instance_id ?? r.chatflow_instance_id ?? null) as string | null
  const cf_phone = (whatsapp.chatflow_phone_number ?? whatsapp.phone_number ?? r.chatflow_phone_number ?? null) as string | null
  const cf_active = whatsapp.chatflow_active ?? whatsapp.active ?? whatsapp.is_active ?? r.chatflow_active
  const cf_binding = whatsapp.binding_exists ?? whatsapp.chatflow_binding_exists ?? r.chatflow_binding_exists
  const cf_health = whatsapp.health_ok ?? whatsapp.chatflow_health_ok ?? r.chatflow_health_ok

  // AmoCRM fields
  const amo_connected = amocrm.connected ?? r.amocrm_connected ?? false
  const amo_domain = (amocrm.domain ?? amocrm.base_domain ?? r.amocrm_domain ?? null) as string | null
  const amo_base = (amocrm.base_domain ?? settings.amocrm_base_domain ?? r.amocrm_base_domain ?? null) as string | null
  const amo_expires = (amocrm.expires_at ?? r.amocrm_expires_at ?? null) as string | null

  // Compute binding_exists if not provided
  const hasToken = Boolean(cf_token?.trim() || cf_token_masked?.trim())
  const hasInstance = Boolean(cf_instance?.trim())

  // Get id with proper type checking
  const extractId = (): string | number | undefined => {
    if (typeof r.tenant_id === 'string' || typeof r.tenant_id === 'number') return r.tenant_id
    if (typeof r.id === 'string' || typeof r.id === 'number') return r.id
    if (typeof settings.id === 'string' || typeof settings.id === 'number') return settings.id
    return tenantId
  }

  return {
    id: extractId(),
    name: (r.tenant_name ?? r.name ?? settings.name ?? '') as string,
    ai_enabled: ai_enabled !== false,
    ai_prompt: ai_prompt as string | null,
    ai_after_submit_behavior: ai_behavior as string,
    whatsapp_source: wa_source,
    chatflow_token: cf_token,
    chatflow_token_masked: cf_token_masked,
    chatflow_instance_id: cf_instance,
    chatflow_phone_number: cf_phone,
    chatflow_active: cf_active !== false,
    chatflow_binding_exists: cf_binding === true ? true : (hasToken && hasInstance),
    chatflow_health_ok: cf_health === true,
    amocrm_connected: amo_connected === true,
    amocrm_domain: amo_domain,
    amocrm_base_domain: amo_base,
    amocrm_expires_at: amo_expires,
  }
}

export const getTenantSettings = async (
  tenantId: string | number,
): Promise<TenantSettings> => {
  const requestUrl = fullUrl(`/api/admin/tenants/${tenantId}/settings`)
  const headers = authHeaders()
  const hasAuth = Boolean((headers as Record<string, string>).Authorization)

  let response: Response
  try {
    response = await fetch(requestUrl, { method: 'GET', headers: { ...headers } })
  } catch (e) {
    // Network error
    const err: DetailedApiError = {
      message: e instanceof Error ? e.message : 'Network error',
      url: requestUrl,
      hasAuthHeader: hasAuth,
      tenantId,
      detail: 'Fetch failed - возможно CORS или сервер недоступен',
    }
    throw err
  }

  if (response.status === 404) {
    // fallback: try to get from tenant + whatsapp binding + amo status
    const [tenantRes, bindingRes, amoRes] = await Promise.all([
      request<unknown>(`/api/admin/tenants/${tenantId}`, {
        method: 'GET',
        headers: { ...authHeaders() },
      }).catch(() => null),
      getTenantWhatsappBinding(tenantId).catch(() => ({})),
      getAmoStatus(tenantId).catch(() => ({ connected: false })),
    ])
    const tenant = tenantRes as AdminTenant | null
    const binding = bindingRes as TenantWhatsappBinding
    const amo = amoRes as AmoStatus
    const tokenVal = binding.token ?? null
    const hasToken = Boolean(tokenVal?.trim())
    const hasInstance = Boolean(binding.instance_id?.trim())
    return {
      id: tenant?.id,
      name: tenant?.name,
      ai_enabled: tenant?.ai_enabled !== false,
      ai_prompt: tenant?.ai_prompt ?? null,
      ai_after_submit_behavior: 'polite_close',
      whatsapp_source: (tenant as Record<string, unknown>)?.whatsapp_source as TenantSettings['whatsapp_source'] ?? 'chatflow',
      chatflow_token: tokenVal,
      chatflow_token_masked: hasToken ? `${tokenVal!.slice(0, 20)}...` : null,
      chatflow_instance_id: binding.instance_id ?? null,
      chatflow_phone_number: binding.phone_number ?? null,
      chatflow_active: binding.active !== false,
      chatflow_binding_exists: hasToken && hasInstance,
      amocrm_connected: amo.connected,
      amocrm_domain: amo.domain ?? null,
      amocrm_base_domain: (tenant as Record<string, unknown>)?.amocrm_base_domain as string | null ?? null,
      amocrm_expires_at: amo.expires_at ?? null,
    }
  }

  if (!response.ok) {
    const detailedErr = await buildDetailedError(response, requestUrl, hasAuth, { tenantId })
    throw detailedErr
  }

  const rawData = await response.json()
  console.log('[API] getTenantSettings raw response:', rawData)

  // Normalize the response structure
  const normalized = normalizeTenantSettings(rawData, tenantId)
  return { ...normalized, _raw: rawData }
}

export const updateTenantSettings = async (
  tenantId: string | number,
  payload: Partial<TenantSettings>,
): Promise<TenantSettings | null> => {
  const requestUrl = fullUrl(`/api/admin/tenants/${tenantId}/settings`)
  const headers = authHeaders()

  let response: Response
  try {
    response = await fetch(requestUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    // Network error - throw detailed error
    const err: DetailedApiError = {
      message: e instanceof Error ? e.message : 'Network error',
      url: requestUrl,
      hasAuthHeader: Boolean((headers as Record<string, string>).Authorization),
      tenantId,
      detail: 'Не удалось отправить запрос. Проверьте соединение с интернетом.',
    }
    throw err
  }

  if (response.status === 404) {
    // fallback: update tenant + whatsapp binding separately
    await updateAdminTenant(tenantId, {
      ai_enabled: payload.ai_enabled,
      ai_prompt: payload.ai_prompt,
    })
    if (payload.chatflow_token !== undefined || payload.chatflow_instance_id !== undefined) {
      await postTenantWhatsappBinding(tenantId, {
        token: payload.chatflow_token,
        instance_id: payload.chatflow_instance_id,
        phone_number: payload.chatflow_phone_number,
        active: payload.chatflow_active,
      })
    }
    // Return null to indicate fallback was used - caller should refetch
    return null
  }

  if (!response.ok) {
    const detailedErr = await buildDetailedError(response, requestUrl,
      Boolean((headers as Record<string, string>).Authorization),
      { tenantId }
    )
    throw detailedErr
  }

  // Try to return updated settings if backend provides them
  try {
    const text = await response.text()
    if (text) {
      return JSON.parse(text) as TenantSettings
    }
  } catch {
    // Backend didn't return JSON, that's ok
  }
  return null
}

/* --- AmoCRM integration --- */

export type AmoStatus = {
  connected: boolean
  domain?: string | null
  expires_at?: string | null
  pipeline_id?: string | number | null
}

export const getAmoAuthUrl = async (
  tenantId: string | number,
  baseDomain?: string,
): Promise<{ url: string }> => {
  const params = new URLSearchParams()
  if (baseDomain) params.set('base_domain', baseDomain)
  const queryStr = params.toString()
  const path = `/api/admin/tenants/${tenantId}/amocrm/auth-url${queryStr ? `?${queryStr}` : ''}`
  const url = fullUrl(path)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (!response.ok) {
    const text = await response.text()
    let detail = text
    try {
      const j = JSON.parse(text) as { detail?: unknown; message?: string }
      detail = typeof j.detail === 'string' ? j.detail : (j.message ?? JSON.stringify(j.detail ?? j))
    } catch {
      // keep text
    }
    const err = new Error(detail) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  const data = await response.json()
  return { url: (data as { url?: string; auth_url?: string })?.url ?? (data as { auth_url?: string })?.auth_url ?? '' }
}

export const getAmoStatus = async (
  tenantId: string | number,
): Promise<AmoStatus> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/amocrm/status`)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404) {
    return { connected: false, domain: null, expires_at: null }
  }
  if (!response.ok) throw await buildError(response)
  const data = await response.json()
  return {
    connected: (data as Record<string, unknown>).connected === true,
    domain: (data as Record<string, unknown>).domain as string | null,
    expires_at: (data as Record<string, unknown>).expires_at as string | null,
    pipeline_id: (data as Record<string, unknown>).pipeline_id as string | number | null,
  }
}

export type AmoPipelineMapping = {
  stage_key: string
  stage_id: string | number | null
}

export const getAmoPipelineMapping = async (
  tenantId: string | number,
): Promise<AmoPipelineMapping[]> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/amocrm/mapping`)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404) return []
  if (!response.ok) throw await buildError(response)
  const data = await response.json()
  return Array.isArray(data) ? (data as AmoPipelineMapping[]) : []
}

export const saveAmoPipelineMapping = async (
  tenantId: string | number,
  mapping: AmoPipelineMapping[],
  pipelineId?: string | number,
): Promise<void> => {
  // Convert array [{stage_key, stage_id}] to dictionary {stage_key: stage_id}
  const mappingDict: Record<string, number> = {}
  mapping.forEach(m => {
    if (m.stage_id) {
      mappingDict[m.stage_key] = Number(m.stage_id)
    }
  })

  await request<unknown>(`/api/admin/tenants/${tenantId}/amocrm/pipeline-mapping`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      mapping: mappingDict,
      primary_pipeline_id: pipelineId
    }),
  })
}

/** PUT /api/admin/tenants/{id}/amocrm/primary-pipeline */
export const savePrimaryPipeline = async (
  tenantId: string | number,
  pipelineId: string | number,
): Promise<void> => {
  await request<unknown>(`/api/admin/tenants/${tenantId}/amocrm/primary-pipeline`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ pipeline_id: pipelineId }),
  })
}

/* --- AmoCRM Pipelines & Stages --- */

export type AmoPipeline = {
  id: number | string
  name: string
  is_main?: boolean
}

export type AmoStage = {
  id: number | string
  name: string
  pipeline_id: number | string
  sort?: number
  color?: string
  is_won?: boolean   // Successful close
  is_lost?: boolean  // Lost/rejected
}



export const getAmoStages = async (
  tenantId: string | number,
  pipelineId?: string | number,
): Promise<AmoStage[]> => {
  let path = `/api/admin/tenants/${tenantId}/amocrm/stages`
  if (pipelineId) path += `?pipeline_id=${pipelineId}`
  const url = fullUrl(path)
  const response = await fetch(url, { method: 'GET', headers: { ...authHeaders() } })
  if (response.status === 404) return []
  if (!response.ok) throw await buildError(response)
  const data = await response.json()
  return Array.isArray(data) ? (data as AmoStage[]) :
    (data as { stages?: AmoStage[] })?.stages ?? []
}

/** Stage key to Russian name mapping for auto-fill */
export const STAGE_NAME_TO_KEY: Record<string, string> = {
  'неразобранное': 'unsorted',
  'новый': 'new',
  'в работе': 'in_progress',
  '1-й звонок': 'call_1',
  '1 звонок': 'call_1',
  'первый звонок': 'call_1',
  '2-й звонок': 'call_2',
  '2 звонок': 'call_2',
  'второй звонок': 'call_2',
  '3-й звонок': 'call_3',
  '3 звонок': 'call_3',
  'третий звонок': 'call_3',
  'ремонт не готов': 'repair_not_ready',
  'другой город': 'other_city',
  'игнор': 'ignore',
  'назначен замер': 'measurement_assigned',
  'провел замер': 'measurement_done',
  'отказ после замера': 'after_measurement_reject',
  'успешно реализовано': 'won',
  'закрыто и не реализовано': 'lost',
}

/* --- Mute lead chat --- */

export const muteLeadChat = async (
  leadId: string | number,
  muted: boolean,
): Promise<void> => {
  await postLeadAiMute(String(leadId), { muted })
}

/* --- Admin diagnostics: tenant snapshot --- */

export const getAdminTenantSnapshot = async (
  tenantId: string | number,
): Promise<unknown> => {
  return request<unknown>(`/api/admin/diagnostics/tenant/${tenantId}/snapshot`, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
}

/* --- Self-check tenant --- */

export type SelfCheckItem = {
  key: string
  label: string
  ok: boolean
  message?: string
  action?: 'open_ai' | 'open_whatsapp' | 'open_amocrm' | 'reconnect_amo'
}

export type SelfCheckResult = {
  tenant_id: string | number
  tenant_name?: string
  checks: SelfCheckItem[]
  all_ok: boolean
}

export const selfCheckTenant = async (
  tenantId: string | number,
): Promise<SelfCheckResult> => {
  const url = fullUrl(`/api/admin/tenants/${tenantId}/self-check`)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({}),
  })
  if (response.status === 404) {
    // fallback: build checks from settings
    const settings = await getTenantSettings(tenantId).catch(() => null)
    const amoStatus = await getAmoStatus(tenantId).catch(() => ({ connected: false }))
    const checks: SelfCheckItem[] = []

    checks.push({
      key: 'tenant_active',
      label: 'Tenant активен',
      ok: true,
      message: 'Клиент существует',
    })

    checks.push({
      key: 'ai_enabled',
      label: 'AI включён',
      ok: settings?.ai_enabled !== false,
      message: settings?.ai_enabled !== false ? 'AI-менеджер работает' : 'AI выключен — бот не отвечает',
      action: settings?.ai_enabled === false ? 'open_ai' : undefined,
    })

    checks.push({
      key: 'ai_prompt',
      label: 'AI prompt заполнен',
      ok: Boolean(settings?.ai_prompt?.trim()),
      message: settings?.ai_prompt?.trim() ? 'Инструкция задана' : 'Нет AI инструкции — бот работает по умолчанию',
      action: !settings?.ai_prompt?.trim() ? 'open_ai' : undefined,
    })

    const waSource = settings?.whatsapp_source ?? 'chatflow'
    if (waSource === 'chatflow') {
      const hasChatflow = Boolean(settings?.chatflow_token?.trim() && settings?.chatflow_instance_id?.trim())
      checks.push({
        key: 'whatsapp_linked',
        label: 'WhatsApp привязан',
        ok: hasChatflow,
        message: hasChatflow ? 'ChatFlow настроен' : 'Нет привязки ChatFlow — бот не может отвечать',
        action: !hasChatflow ? 'open_whatsapp' : undefined,
      })
    } else {
      checks.push({
        key: 'whatsapp_linked',
        label: 'WhatsApp (AmoCRM)',
        ok: true,
        message: 'Используется AmoCRM Marketplace',
      })
    }

    checks.push({
      key: 'amocrm_connected',
      label: 'AmoCRM подключён',
      ok: amoStatus.connected,
      message: amoStatus.connected ? `Домен: ${(amoStatus as AmoStatus).domain ?? '—'}` : 'AmoCRM не подключён',
      action: !amoStatus.connected ? 'reconnect_amo' : undefined,
    })

    return {
      tenant_id: tenantId,
      tenant_name: settings?.name ?? undefined,
      checks,
      all_ok: checks.every((c) => c.ok),
    }
  }
  if (!response.ok) throw await buildError(response)
  const data = await response.json()
  return data as SelfCheckResult
}

/* --- New AmoCRM features (Discovery etc.) --- */

export type AmoDiscoveryResult = {
  pipelines: AmoPipeline[]
  custom_fields: Array<{ id: number; name: string; type_id?: number }>
}

/** GET /api/admin/tenants/{id}/amocrm/discovery */
export const getAmoDiscovery = async (tenantId: string | number): Promise<AmoDiscoveryResult> => {
  const data = await request<unknown>(`/api/admin/tenants/${tenantId}/amocrm/discovery`, {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  // Normalize response
  const d = data as { pipelines?: AmoPipeline[]; custom_fields?: unknown[] }
  return {
    pipelines: Array.isArray(d.pipelines) ? d.pipelines : [],
    custom_fields: Array.isArray(d.custom_fields)
      ? (d.custom_fields as Array<{ id: number; name: string; type_id?: number }>)
      : [],
  }
}

/** POST /api/admin/tenants/{id}/amocrm/default-pipeline */
export const saveTenantDefaultPipeline = async (
  tenantId: string | number,
  pipelineId: string | number,
): Promise<void> => {
  await request<unknown>(`/api/admin/tenants/${tenantId}/amocrm/default-pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ pipeline_id: pipelineId }),
  })
}

/** POST /api/admin/tenants/{id}/amocrm/test-sync */
export const testAmoSync = async (
  tenantId: string | number,
  payload: { phone: string; text: string },
): Promise<{ ok: boolean; message: string; data?: unknown }> => {
  const data = await request<unknown>(`/api/admin/tenants/${tenantId}/amocrm/test-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  })
  return data as { ok: boolean; message: string; data?: unknown }
}

// Re-export or define getAmoPipelines for compatibility
export const getAmoPipelines = async (
  tenantId: string | number,
): Promise<AmoPipeline[]> => {
  try {
    const d = await getAmoDiscovery(tenantId)
    return d.pipelines
  } catch {
    return []
  }
}
