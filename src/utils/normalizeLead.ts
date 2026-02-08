import type { LeadCategory } from '../types/leadCategory'
import { categoryToStageKey } from '../types/stage'

export type NormalizedLead = {
  id: string
  name: string
  phone: string
  city: string
  request: string
  createdAt: string
  status: 'new' | 'success' | 'failed'
  category: import('../types/leadCategory').LeadCategory  // Legacy field
  stage_key?: string  // New field - dynamic stage key
  comments_count?: number
  last_comment?: string
  score?: number  // AI score 0-100
  lastClientMessageAt?: string  // For reaction timer
  isAiMuted?: boolean  // Manual mode flag
}

const unwrapStatusValue = (value: unknown) => {
  let current = value
  for (let depth = 0; depth < 2; depth += 1) {
    if (!current || typeof current !== 'object') {
      break
    }
    const record = current as Record<string, unknown>
    const next =
      record.value ?? record.status ?? record.state ?? record.code ?? record.id
    if (next === undefined) {
      break
    }
    current = next
  }
  return current
}

export const normalizeLeadStatus = (
  value: unknown,
): NormalizedLead['status'] => {
  const normalized = String(unwrapStatusValue(value) ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (
    normalized === 'success' ||
    normalized === 'successful' ||
    normalized === 'done' ||
    normalized === 'finished' ||
    normalized === 'complete' ||
    normalized === 'completed' ||
    normalized === 'ok' ||
    normalized === 'approved' ||
    normalized === 'won' ||
    normalized === 'positive'
  ) {
    return 'success'
  }
  if (
    normalized === 'failed' ||
    normalized === 'failure' ||
    normalized === 'rejected' ||
    normalized === 'declined' ||
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'unsuccessful' ||
    normalized === 'lost' ||
    normalized === 'negative'
  ) {
    return 'failed'
  }
  if (
    normalized === 'new' ||
    normalized === 'created' ||
    normalized === 'open' ||
    normalized === 'pending' ||
    normalized === 'in_progress' ||
    normalized === 'processing'
  ) {
    return 'new'
  }
  return 'new'
}

export const normalizeLead = (raw: Record<string, unknown>): NormalizedLead => {
  const id =
    String(
      raw.id ??
      raw._id ??
      raw.leadId ??
      raw.lead_id ??
      raw.uuid ??
      raw.pk ??
      '',
    ) || ''
  const name = String(
    raw.name ??
    raw.full_name ??
    raw.fullName ??
    raw.client_name ??
    raw.contact_name ??
    '',
  )
  const phone = String(
    raw.phone ??
    raw.phoneNumber ??
    raw.mobile ??
    raw.contact_phone ??
    raw.tel ??
    '',
  )
  const city = String(raw.city ?? raw.town ?? raw.location ?? raw.region ?? '')
  const request = String(raw.summary || raw.request || raw.description || '')
  const createdRaw = String(raw.created_at ?? raw.createdAt ?? raw.created ?? '')
  const createdAt =
    createdRaw ||
    new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Almaty' })
      .replace(' ', 'T')
  const status = normalizeLeadStatus(raw.status ?? 'new')

  // Normalize  // Category (legacy field for backward compat)
  const rawCategory = raw.category ?? raw.lead_category
  const validCategories: LeadCategory[] = [
    'no_reply',
    'wants_call',
    'partial_data',
    'full_data',
    'rejected',
    'non_target',
    'postponed',
    'won',
  ]
  let category: LeadCategory = 'no_reply'
  if (typeof rawCategory === 'string' && validCategories.includes(rawCategory as LeadCategory)) {
    category = rawCategory as LeadCategory
  }

  // Stage key (new field - dynamic)
  // Priority: raw.stage_key > categoryToStageKey(raw.category)
  let stage_key: string | undefined
  if (typeof raw.stage_key === 'string' && raw.stage_key.trim()) {
    stage_key = raw.stage_key.trim()
  } else if (rawCategory) {
    // Migration: map old category to stage_key
    stage_key = categoryToStageKey(rawCategory as string)
  }

  const comments_count =
    typeof raw.comments_count === 'number'
      ? raw.comments_count
      : typeof raw.comments_count === 'string'
        ? parseInt(raw.comments_count, 10)
        : undefined
  const last_comment =
    typeof raw.last_comment === 'string' ? raw.last_comment : undefined

  // AI features
  const score = typeof raw.score === 'number' ? raw.score : undefined
  const lastClientMessageAt = raw.last_client_message_at
    ? String(raw.last_client_message_at)
    : undefined
  const isAiMuted = typeof raw.is_ai_muted === 'boolean' ? raw.is_ai_muted : undefined

  return {
    id,
    name,
    phone,
    city,
    request,
    createdAt,
    status,
    category: category as import('../types/leadCategory').LeadCategory,
    stage_key,  // New field
    ...(comments_count !== undefined && !Number.isNaN(comments_count)
      ? { comments_count }
      : {}),
    ...(last_comment ? { last_comment } : {}),
    ...(score !== undefined ? { score } : {}),
    ...(lastClientMessageAt ? { lastClientMessageAt } : {}),
    ...(isAiMuted !== undefined ? { isAiMuted } : {}),
  }
}
