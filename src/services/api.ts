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
  options?: { skipUnauthorized?: boolean },
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
    message = 'Сессия истекла. Войдите снова.'
    if (!options?.skipUnauthorized) {
      unauthorizedHandler?.()
    }
  }
  const error = new Error(message) as ApiError
  error.status = response.status
  return error
}

const request = async <T>(path: string, options?: RequestInit) => {
  const response = await fetch(`${BASE_URL}${path}`, options)
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

export const login = async (email: string, password: string) => {
  const body = new URLSearchParams({ username: email, password })
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!response.ok) {
    throw await buildError(response, { skipUnauthorized: true })
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

export const resetAdminUserPassword = async (
  id: string | number,
  password: string,
) => {
  return request<unknown>(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ password }),
  })
}
