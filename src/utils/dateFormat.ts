const timeZone = 'Asia/Almaty'

export const parseLeadDate = (createdAtRaw: string) => {
  const trimmed = createdAtRaw.trim()
  if (!trimmed) {
    return new Date(Number.NaN)
  }
  const hasOffset = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed)
  if (hasOffset) {
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/.exec(
      trimmed,
    )
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const hour = Number(match[4] ?? '0')
    const minute = Number(match[5] ?? '0')
    const second = Number(match[6] ?? '0')
    const millisecond = Number((match[7] ?? '0').padEnd(3, '0'))
    const offsetMinutes = 300
    const utcMillis =
      Date.UTC(year, month, day, hour, minute, second, millisecond) -
      offsetMinutes * 60 * 1000
    return new Date(utcMillis)
  }
  return new Date(trimmed)
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

export function formatTimeAlmatyFix(createdAtRaw: string) {
  const dt = new Date(createdAtRaw)
  const fixed = addHours(dt, 5)
  return fixed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function formatBadgeAlmatyFix(createdAtRaw: string) {
  const dt = new Date(createdAtRaw)
  const fixed = addHours(dt, 5)

  const nowFixed = addHours(new Date(), 0)
  const sameDay = fixed.toDateString() === nowFixed.toDateString()
  const yesterday = new Date(nowFixed)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = fixed.toDateString() === yesterday.toDateString()

  const time = fixed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (sameDay) return `Сегодня, ${time}`
  if (isYesterday) return `Вчера, ${time}`
  return `${fixed.toLocaleDateString('ru-RU')}, ${time}`
}

export const formatTimeHHMM = (createdAtRaw: string) => {
  const created = parseLeadDate(createdAtRaw)
  if (Number.isNaN(created.getTime())) {
    return createdAtRaw
  }
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(created)
}

export const formatLeadBadge = (createdAtRaw: string) => {
  const created = parseLeadDate(createdAtRaw)
  if (Number.isNaN(created.getTime())) {
    return createdAtRaw
  }

  const now = new Date()
  const formatDateKey = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value ?? ''
    const month = parts.find((part) => part.type === 'month')?.value ?? ''
    const day = parts.find((part) => part.type === 'day')?.value ?? ''
    return `${year}-${month}-${day}`
  }

  const todayKey = formatDateKey(now)
  const yesterdayKey = formatDateKey(new Date(now.getTime() - 86400000))
  const createdKey = formatDateKey(created)

  const time = formatTimeHHMM(createdAtRaw)

  if (createdKey === todayKey) {
    return `Сегодня, ${time}`
  }

  if (createdKey === yesterdayKey) {
    return `Вчера, ${time}`
  }

  const date = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
  }).format(created)

  return `${date}, ${time}`
}
