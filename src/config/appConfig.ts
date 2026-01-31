const fallbackApiUrl = 'https://crm-api-5vso.onrender.com'
const fallbackWhatsApp = '+77768776637'

const envApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
export const BASE_URL = envApiUrl || fallbackApiUrl

export const SUPPORT_WHATSAPP =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.trim() || fallbackWhatsApp

/** Check if running in dev or with ?debug=1 query param */
export const isDebugMode = () =>
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'))
