const fallbackApiUrl = 'https://crm-api-5vso.onrender.com'
const fallbackWhatsApp = '+77768776637'

/** Always without trailing slash to avoid double slashes in paths like /api/auth/login */
function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

const envApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
export const BASE_URL = normalizeBaseUrl(envApiUrl || fallbackApiUrl)

/** True when PROD build and VITE_API_BASE_URL was not set (using fallback) */
export const isEnvApiUrlMissing =
  import.meta.env.PROD && !envApiUrl

export const SUPPORT_WHATSAPP =
  (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.trim() || fallbackWhatsApp

/** Build-time ID for cache busting; shown in debug mode */
export const APP_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'unknown'

/** Check if running in dev or with ?debug=1 query param */
export const isDebugMode = () =>
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'))

/** CRM v2 (leads table) feature flag. Default false. */
const envCrmV2 = (import.meta.env.VITE_CRM_V2_ENABLED as string | undefined)?.trim()?.toLowerCase()
export const CRM_V2_ENABLED = envCrmV2 === 'true' || envCrmV2 === '1'
