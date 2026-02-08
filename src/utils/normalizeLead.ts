export type NormalizedLead = {
  id: string
  name: string
  phone: string
  city: string
  request: string
  createdAt: string
  status: 'new' | 'success' | 'failed'
  category: import('../types/leadCategory').LeadCategory
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

  // Normalize category
  let category = String(raw.category ?? 'new').toLowerCase()
  if (!['hot', 'warm', 'cold', 'non_target', 'postponed', 'new'].includes(category)) {
    category = 'new'
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
    ...(comments_count !== undefined && !Number.isNaN(comments_count)
      ? { comments_count }
      : {}),
    ...(last_comment ? { last_comment } : {}),
    ...(score !== undefined ? { score } : {}),
    ...(lastClientMessageAt ? { lastClientMessageAt } : {}),
    ...(isAiMuted !== undefined ? { isAiMuted } : {}),
  }
}
