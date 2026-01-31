const fallbackApiUrl = 'https://crm-api-5vso.onrender.com'
const fallbackWhatsApp = '+77768776637'

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || fallbackApiUrl
export const SUPPORT_WHATSAPP =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.trim() || fallbackWhatsApp
