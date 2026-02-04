import { useCallback, useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  addTenantUser,
  getAdminTenants,
  getAmoAuthUrl,
  getAmoPipelineMapping,
  getAmoPipelines,
  getAmoStages,
  getAmoStatus,
  getTenantSettings,
  getTenantUsers,
  getTenantWhatsapps,
  type TenantWhatsapp,
  normalizeAmoDomain,
  parseApiError,
  postTenantWhatsappBinding,
  saveAmoPipelineMapping,
  selfCheckTenant,
  STAGE_NAME_TO_KEY,
  testWhatsApp,
  updateTenantSettings,
  type AdminTenant,
  type AmoPipeline,
  type AmoPipelineMapping,
  type AmoStage,
  type AmoStatus,
  type DetailedApiError,
  type SelfCheckResult,
  type TenantSettings,
  type TenantUser,
} from '../services/api'
import { BASE_URL } from '../config/appConfig'

type ModalTab = 'ai' | 'whatsapp' | 'amocrm'
type SettingsStatus = 'idle' | 'loading' | 'error' | 'ready'

const STAGE_KEY_LABELS: Record<string, string> = {
  new: 'Новый лид',
  unsorted: 'Неразобранное',
  in_progress: 'В работе',
  call_1: '1-й звонок',
  call_2: '2-й звонок',
  call_3: '3-й звонок',
  repair_not_ready: 'Ремонт не готов',
  other_city: 'Другой город',
  ignore: 'Игнор',
  measurement_assigned: 'Назначен замер',
  measurement_done: 'Провел замер',
  after_measurement_reject: 'Отказ после замера',
  done: 'Успешно закрыт',
  won: 'Успешно реализовано',
  cancelled: 'Отказ',
  lost: 'Закрыто и не реализовано',
}

/** Check if error is DetailedApiError */
function isDetailedError(err: unknown): err is DetailedApiError {
  return typeof err === 'object' && err !== null && 'url' in err
}

/** Safely extract error message string using global parseApiError */
const getErrorMessage = (err: unknown): string => {
  const parsed = parseApiError(err)
  return parsed.detail
}

/** Create safe default settings to avoid undefined crashes */
function safeSettings(raw: TenantSettings | null, preserveFrom?: TenantSettings | null): TenantSettings {
  const base: TenantSettings = {
    id: raw?.id ?? undefined,
    name: raw?.name ?? '',
    ai_enabled: raw?.ai_enabled !== false,
    ai_prompt: raw?.ai_prompt ?? '',
    ai_after_submit_behavior: raw?.ai_after_submit_behavior ?? 'polite_close',
    whatsapp_source: raw?.whatsapp_source ?? 'chatflow',
    chatflow_token: raw?.chatflow_token ?? '',
    chatflow_token_masked: raw?.chatflow_token_masked ?? null,
    chatflow_instance_id: raw?.chatflow_instance_id ?? '',
    chatflow_phone_number: raw?.chatflow_phone_number ?? '',
    chatflow_active: raw?.chatflow_active !== false,
    chatflow_binding_exists: raw?.chatflow_binding_exists ?? false,
    amocrm_connected: raw?.amocrm_connected ?? false,
    amocrm_domain: raw?.amocrm_domain ?? null,
    amocrm_base_domain: raw?.amocrm_base_domain ?? '',
    amocrm_expires_at: raw?.amocrm_expires_at ?? null,
  }

  // If we have previous values and server returned empty/masked, preserve the old values
  if (preserveFrom) {
    // Token: never overwrite real token with empty or masked
    if (!base.chatflow_token && preserveFrom.chatflow_token) {
      base.chatflow_token = preserveFrom.chatflow_token
    }
    // Instance ID: preserve if server returned empty
    if (!base.chatflow_instance_id && preserveFrom.chatflow_instance_id) {
      base.chatflow_instance_id = preserveFrom.chatflow_instance_id
    }
    // Phone: preserve if server returned empty
    if (!base.chatflow_phone_number && preserveFrom.chatflow_phone_number) {
      base.chatflow_phone_number = preserveFrom.chatflow_phone_number
    }
    // AI prompt: preserve if server returned empty but we had value
    if (!base.ai_prompt && preserveFrom.ai_prompt) {
      base.ai_prompt = preserveFrom.ai_prompt
    }
  }

  return base
}

const AdminTenants = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Settings modal - state machine
  const [editOpen, setEditOpen] = useState(false)
  const [activeTenant, setActiveTenant] = useState<AdminTenant | null>(null)
  const [activeTab, setActiveTab] = useState<ModalTab>('ai')
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>('idle')
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsErrorDetail, setSettingsErrorDetail] = useState<DetailedApiError | null>(null)
  const [settings, setSettings] = useState<TenantSettings>(safeSettings(null))
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  // WhatsApp test
  const [waTestOpen, setWaTestOpen] = useState(false)
  const [waTestPhone, setWaTestPhone] = useState('')
  const [waTestMessage, setWaTestMessage] = useState('Тестовое сообщение от BuildCRM')
  const [waTestLoading, setWaTestLoading] = useState(false)
  const [waTestResult, setWaTestResult] = useState<{ ok: boolean; message: string; details?: string; status?: number } | null>(null)

  // Store original server values for WhatsApp to preserve masked tokens
  const [serverWhatsApp, setServerWhatsApp] = useState<{
    token?: string | null
    token_masked?: string | null
    instance_id?: string | null
    phone_number?: string | null
    active?: boolean
    binding_exists?: boolean
  }>({})

  // Last loaded timestamp for refresh indicator
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)

  // AmoCRM
  const [amoStatus, setAmoStatus] = useState<AmoStatus>({ connected: false })
  const [amoMapping, setAmoMapping] = useState<AmoPipelineMapping[]>([])
  const [amoLoading, setAmoLoading] = useState(false)
  const [amoBaseDomain, setAmoBaseDomain] = useState('')

  // AmoCRM Pipelines & Stages
  const [amoPipelines, setAmoPipelines] = useState<AmoPipeline[]>([])
  const [amoStages, setAmoStages] = useState<AmoStage[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [pipelinesLoading, setPipelinesLoading] = useState(false)
  const [stagesLoading, setStagesLoading] = useState(false)

  // Track dirty fields to avoid wiping secrets
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set())

  // Reference to preserve settings between tab switches
  const settingsRef = useRef<TenantSettings | null>(null)

  // Users modal
  const [usersOpen, setUsersOpen] = useState(false)
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [tenantUsersStatus, setTenantUsersStatus] = useState<'idle' | 'loading'>('idle')
  const [tenantUsersError, setTenantUsersError] = useState<string | null>(null)
  const [addUserForm, setAddUserForm] = useState({ email: '', role: 'manager' as 'manager' | 'admin' })

  // Self-check modal
  const [checkOpen, setCheckOpen] = useState(false)
  const [checkResult, setCheckResult] = useState<SelfCheckResult | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)

  // Help modal for AmoCRM setup
  const [helpOpen, setHelpOpen] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadTenants = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await getAdminTenants()
      setTenants(Array.isArray(data) ? data : [])
      setStatus('idle')
    } catch (err) {
      setError(getErrorMessage(err))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadTenants()

    // Handle AmoCRM callback redirect
    const urlParams = new URLSearchParams(window.location.search)
    const amoResult = urlParams.get('amocrm')
    const tenantIdParam = urlParams.get('tenant_id')

    if (amoResult === 'connected' && tenantIdParam) {
      showToast('✅ AmoCRM успешно подключён!')
      // Clean up URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    } else if (amoResult === 'error') {
      const errorMsg = urlParams.get('error') || 'Ошибка подключения AmoCRM'
      showToast(`❌ ${errorMsg}`)
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [loadTenants])

  // --- Settings Modal ---
  const loadSettings = useCallback(async (tenantId: string | number, preserveLocal = false) => {
    setSettingsStatus('loading')
    setSettingsError(null)
    setSettingsErrorDetail(null)
    setActionError(null)

    // Parallel fetch: Settings + WhatsApp Binding (as requested)
    let rawSettings: TenantSettings | null = null
    let waBinding: TenantWhatsapp | null = null
    let settingsErr: unknown = null

    try {
      const [s, wList] = await Promise.all([
        getTenantSettings(tenantId),
        getTenantWhatsapps(tenantId).catch(() => [])
      ])
      rawSettings = s
      waBinding = wList && wList.length > 0 ? wList[0] : null
      console.log('[AdminTenants] Loaded settings:', { rawSettings, waBinding })
    } catch (e) {
      console.error('getTenantSettings failed:', e)
      settingsErr = e
    }

    // If settings failed, show detailed error
    if (!rawSettings) {
      if (isDetailedError(settingsErr)) {
        setSettingsErrorDetail(settingsErr)
        setSettingsError(settingsErr.message || 'Ошибка загрузки настроек')
      } else {
        setSettingsError(getErrorMessage(settingsErr) || 'Не удалось загрузить настройки tenant')
        setSettingsErrorDetail({
          message: getErrorMessage(settingsErr),
          tenantId,
          detail: settingsErr instanceof Error ? settingsErr.stack : undefined,
        })
      }
      setSettingsStatus('error')
      return
    }

    // Settings loaded successfully
    try {
      // Load optional AmoCRM data
      const [rawAmoStatus, rawMapping] = await Promise.all([
        getAmoStatus(tenantId).catch(() => ({ connected: false })),
        getAmoPipelineMapping(tenantId).catch(() => []),
      ])

      // Logic: Merge settings with WhatsApp binding if available
      // Backend might return empty strings in settings, but binding has real data
      if (waBinding) {
        if (waBinding.token) rawSettings.chatflow_token = waBinding.token
        if (waBinding.instance_id) rawSettings.chatflow_instance_id = waBinding.instance_id
        if (waBinding.phone_number) rawSettings.chatflow_phone_number = waBinding.phone_number
        if (waBinding.active !== undefined) rawSettings.chatflow_active = waBinding.active
        // Synthesize binding existence
        rawSettings.chatflow_binding_exists = !!(waBinding.token && waBinding.instance_id)
      }

      // Preserve local edits if requested (e.g. after partial save)
      const preserveFrom = preserveLocal ? settingsRef.current : null
      const safe = safeSettings(rawSettings, preserveFrom)

      console.log('[AdminTenants] Processed settings:', {
        raw: rawSettings,
        waBinding,
        result: safe,
      })

      setSettings(safe)
      settingsRef.current = safe

      setServerWhatsApp({
        token: rawSettings.chatflow_token,
        token_masked: rawSettings.chatflow_token_masked,
        instance_id: rawSettings.chatflow_instance_id,
        phone_number: rawSettings.chatflow_phone_number,
        active: rawSettings.chatflow_active,
        binding_exists: rawSettings.chatflow_binding_exists,
      })

      setAmoStatus(rawAmoStatus as AmoStatus)
      setAmoBaseDomain(safe.amocrm_base_domain || (rawAmoStatus as AmoStatus).domain || '')

      // Default mapping
      const defaultMapping: AmoPipelineMapping[] = [
        { stage_key: 'unsorted', stage_id: null },
        { stage_key: 'new', stage_id: null },
        { stage_key: 'in_progress', stage_id: null },
        { stage_key: 'call_1', stage_id: null },
        { stage_key: 'call_2', stage_id: null },
        { stage_key: 'call_3', stage_id: null },
        { stage_key: 'measurement_assigned', stage_id: null },
        { stage_key: 'measurement_done', stage_id: null },
        { stage_key: 'after_measurement_reject', stage_id: null },
        { stage_key: 'done', stage_id: null },
        { stage_key: 'won', stage_id: null },
        { stage_key: 'cancelled', stage_id: null },
        { stage_key: 'lost', stage_id: null },
      ]

      setAmoMapping(
        Array.isArray(rawMapping) && rawMapping.length > 0
          ? rawMapping
          : defaultMapping
      )

      if (!preserveLocal) {
        setDirtyFields(new Set())
      }
      setLastLoadedAt(new Date())
      setSettingsStatus('ready')
    } catch (err) {
      setSettingsError(getErrorMessage(err))
      setSettingsStatus('error')
    }
  }, [dirtyFields])

  // Load AmoCRM pipelines
  const loadPipelines = useCallback(async (tenantId: string | number) => {
    setPipelinesLoading(true)
    try {
      const pipelines = await getAmoPipelines(tenantId)
      setAmoPipelines(pipelines)
      if (pipelines.length > 0) {
        const mainPipeline = pipelines.find(p => p.is_main) || pipelines[0]
        setSelectedPipelineId(String(mainPipeline.id))
        // Also load stages for this pipeline
        await loadStages(tenantId, mainPipeline.id)
      }
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setPipelinesLoading(false)
    }
  }, [])

  // Load AmoCRM stages for a pipeline
  const loadStages = useCallback(async (tenantId: string | number, pipelineId?: string | number) => {
    setStagesLoading(true)
    try {
      const stages = await getAmoStages(tenantId, pipelineId)
      setAmoStages(stages)
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setStagesLoading(false)
    }
  }, [])

  // Auto-fill mapping based on stage names
  const handleAutoFillMapping = useCallback(() => {
    if (amoStages.length === 0) {
      setActionError('Сначала загрузите стадии из AmoCRM')
      return
    }

    const newMapping: AmoPipelineMapping[] = [...amoMapping]

    amoStages.forEach(stage => {
      const nameLower = stage.name.toLowerCase().trim()

      // Try to match by name
      let matchedKey: string | null = null

      // Check exact matches first
      if (STAGE_NAME_TO_KEY[nameLower]) {
        matchedKey = STAGE_NAME_TO_KEY[nameLower]
      } else {
        // Try partial matches
        for (const [pattern, key] of Object.entries(STAGE_NAME_TO_KEY)) {
          if (nameLower.includes(pattern) || pattern.includes(nameLower)) {
            matchedKey = key
            break
          }
        }
      }

      // Check for won/lost flags
      if (stage.is_won) matchedKey = 'won'
      if (stage.is_lost) matchedKey = 'lost'

      if (matchedKey) {
        const existingIdx = newMapping.findIndex(m => m.stage_key === matchedKey)
        if (existingIdx !== -1) {
          newMapping[existingIdx] = { ...newMapping[existingIdx], stage_id: stage.id }
        } else {
          newMapping.push({ stage_key: matchedKey, stage_id: stage.id })
        }
      }
    })

    setAmoMapping(newMapping)
    showToast('Маппинг заполнен автоматически')
  }, [amoStages, amoMapping])

  const openEdit = (tenant: AdminTenant, tab: ModalTab = 'ai') => {
    setActiveTenant(tenant)
    setActiveTab(tab)
    setEditOpen(true)
    setSettingsStatus('idle')
    setSettingsError(null)
    setSettingsErrorDetail(null)
    setActionError(null)
    setDirtyFields(new Set())
    settingsRef.current = null
    // Don't reset settings to empty - let loadSettings populate them
    loadSettings(tenant.id)
  }

  const closeEdit = () => {
    setEditOpen(false)
    setActiveTenant(null)
    // Keep settings in ref for potential reopen
    settingsRef.current = settings
    setSettingsErrorDetail(null)
    setAmoStatus({ connected: false })
    setAmoMapping([])
    setAmoPipelines([])
    setAmoStages([])
    setSelectedPipelineId('')
    setSettingsStatus('idle')
    setSettingsError(null)
    setActionError(null)
    setDirtyFields(new Set())
  }

  const handleRetrySettings = () => {
    if (activeTenant) {
      loadSettings(activeTenant.id)
    }
  }

  /* AI SAVE with Verification */
  const handleSaveAi = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)

    // Store current state for rollback
    const currentValues = { ...settings }

    try {
      // 1. Prepare Payload
      // Check if user actively cleared prompt (handled via button) or modified it
      // Standard rule: don't send "" if it wasn't explicitly cleared (we'll assume "" in input means 'no change' if not dirty? No, dirty field means changed.)
      // User Req: "Don't send empty strings". "Default: no clear".

      const payload: Partial<TenantSettings> = {
        ai_enabled: settings.ai_enabled,
        ai_after_submit_behavior: settings.ai_after_submit_behavior,
      }

      // Only include ai_prompt if it has content. To clear, use the Clear button.
      // If user manually deleted text, settings.ai_prompt is "". We SKIP it to avoid wiping backend accidentally.
      if (settings.ai_prompt && settings.ai_prompt.trim() !== '') {
        if (dirtyFields.has('ai_prompt')) {
          payload.ai_prompt = settings.ai_prompt
        }
      }

      // 2. PATCH request
      await updateTenantSettings(activeTenant.id, payload)

      // 3. VERIFICATION GET
      // Must refetch to confirm it's actually saved
      const verifiedSettings = await getTenantSettings(activeTenant.id)

      // 4. Compare logic
      const promptMatch = verifiedSettings?.ai_prompt === (payload.ai_prompt || verifiedSettings?.ai_prompt)
      const enabledMatch = verifiedSettings?.ai_enabled === payload.ai_enabled

      if (promptMatch && enabledMatch) {
        setSettings(safeSettings(verifiedSettings))
        settingsRef.current = safeSettings(verifiedSettings)
        setDirtyFields(new Set()) // Clear dirty only on success
        showToast('Сохранено и проверено ✅')
      } else {
        throw new Error('Данные отправлены, но проверка не прошла. Попробуйте снова.')
      }

      await loadTenants()
    } catch (err) {
      // On error, restore or keep current state
      setSettings(currentValues)
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleClearAiPrompt = async () => {
    if (!activeTenant) return
    if (!window.confirm('Вы уверены, что хотите удалить AI prompt? Это действие нельзя отменить.')) return

    setActionStatus('loading')
    try {
      // Send explicit empty string/null to clear
      await updateTenantSettings(activeTenant.id, { ai_prompt: '' })

      // Verify
      const verified = await getTenantSettings(activeTenant.id)
      if (!verified.ai_prompt) {
        setSettings(prev => ({ ...prev, ai_prompt: '' }))
        showToast('Prompt очищен ✅')
      }
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  /* WhatsApp SAVE with Verification */
  const handleSaveWhatsApp = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)

    const currentValues = { ...settings }

    try {
      // 1. Prepare Data
      const tokenToSend = dirtyFields.has('chatflow_token')
        ? (settings.chatflow_token || undefined) // send undefined if empty to skip, UNLESS explicit clear? User said don't send empty strings.
        : undefined

      // If user typed something then deleted it -> settings.chatflow_token is "".
      // validation:
      if (settings.chatflow_token === '') {
        // User wants to clear? Or just mistake?
        // For now, skip sending empty token.
        // If user wants to clear -> we need explicit button or heuristic.
      }

      // 2. If 'chatflow' source -> POST binding
      if (settings.whatsapp_source === 'chatflow') {
        const bindingPayload: Record<string, unknown> = {
          instance_id: settings.chatflow_instance_id || null, // null if empty
          phone_number: settings.chatflow_phone_number || null,
          active: settings.chatflow_active,
        }
        if (tokenToSend && tokenToSend.trim().length > 0) {
          bindingPayload.token = tokenToSend
        }

        await postTenantWhatsappBinding(activeTenant.id, bindingPayload)
      }

      // 3. Update Settings core fields
      const settingsPayload: Partial<TenantSettings> = {
        whatsapp_source: settings.whatsapp_source,
        chatflow_instance_id: settings.chatflow_instance_id || null,
        chatflow_phone_number: settings.chatflow_phone_number || null,
        chatflow_active: settings.chatflow_active,
      }
      if (tokenToSend && tokenToSend.trim().length > 0) {
        settingsPayload.chatflow_token = tokenToSend
      }

      await updateTenantSettings(activeTenant.id, settingsPayload).catch(() => null) // ignore error here if binding worked

      // 4. VERIFICATION GET
      // Fetch binding and settings to confirm
      const [verifiedSettings, verifiedBinding] = await Promise.all([
        getTenantSettings(activeTenant.id),
        getTenantWhatsapps(activeTenant.id).then(list => list[0] || null)
      ])

      // 5. Compare
      // Check if instance ID matches
      const instanceMatch = verifiedBinding?.instance_id === (settings.chatflow_instance_id || verifiedBinding?.instance_id || '')

      if (instanceMatch) {
        // Reload fully
        if (verifiedSettings) {
          // merge
          if (verifiedBinding) {
            verifiedSettings.chatflow_token = verifiedBinding.token || verifiedSettings.chatflow_token
            verifiedSettings.chatflow_instance_id = verifiedBinding.instance_id || verifiedSettings.chatflow_instance_id
            verifiedSettings.chatflow_phone_number = verifiedBinding.phone_number || verifiedSettings.chatflow_phone_number
            verifiedSettings.chatflow_active = verifiedBinding.active
          }
          setSettings(safeSettings(verifiedSettings))
          setServerWhatsApp({
            token: verifiedSettings.chatflow_token,
            instance_id: verifiedSettings.chatflow_instance_id,
            phone_number: verifiedSettings.chatflow_phone_number,
            active: verifiedSettings.chatflow_active,
            binding_exists: !!(verifiedBinding?.token),
          })
        }

        setDirtyFields(new Set())
        showToast('Сохранено и проверено ✅')
      } else {
        throw new Error('Данные отправлены, но сервер вернул старое значение. Попробуйте еще раз.')
      }

      await loadTenants()

    } catch (err) {
      setSettings(currentValues)
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  // WhatsApp Test - using proper authenticated API client
  const handleTestWhatsApp = async () => {
    if (!activeTenant) return
    if (!waTestPhone.trim()) {
      setWaTestResult({ ok: false, message: 'Укажите номер телефона для теста' })
      return
    }

    setWaTestLoading(true)
    setWaTestResult(null)

    const result = await testWhatsApp(activeTenant.id, {
      phone: waTestPhone,
      message: waTestMessage,
    })

    setWaTestResult(result)
    setWaTestLoading(false)
  }

  const handleSaveAmoDomain = async () => {
    if (!activeTenant) return
    const domain = amoBaseDomain.trim()
    if (!domain) {
      setActionError('Укажите домен AmoCRM')
      return
    }
    setActionStatus('loading')
    setActionError(null)
    try {
      await updateTenantSettings(activeTenant.id, {
        amocrm_base_domain: domain,
      })
      showToast('Домен сохранён ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleConnectAmo = async () => {
    if (!activeTenant) return
    let domain = amoBaseDomain.trim()

    // Normalize domain from full URL if needed
    domain = normalizeAmoDomain(domain)
    setAmoBaseDomain(domain)

    if (!domain) {
      setActionError('Сначала укажите домен AmoCRM (например: mycompany.amocrm.ru)')
      return
    }

    setActionStatus('loading')
    setActionError(null)
    try {
      // First save the domain to settings
      await updateTenantSettings(activeTenant.id, {
        amocrm_base_domain: domain,
      }).catch(() => { })

      // Then get auth URL
      const result = await getAmoAuthUrl(activeTenant.id, domain)
      const url = result?.url
      if (url) {
        showToast('Откроется окно авторизации AmoCRM. После подтверждения вернитесь сюда.')
        window.open(url, '_blank')
      } else {
        setActionError('URL авторизации не получен. Проверьте, что домен корректный и интеграция настроена в AmoCRM.')
      }
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  const handleRefreshAmoStatus = async () => {
    if (!activeTenant) return
    setAmoLoading(true)
    setActionError(null)
    try {
      const st = await getAmoStatus(activeTenant.id)
      setAmoStatus(st)
      if (st.domain) setAmoBaseDomain(st.domain)
    } catch (err) {
      setAmoStatus({ connected: false })
      setActionError(getErrorMessage(err))
    } finally {
      setAmoLoading(false)
    }
  }

  const handleSaveAmoMapping = async () => {
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await saveAmoPipelineMapping(activeTenant.id, amoMapping)
      showToast('Маппинг сохранён ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  // --- Users Modal ---
  const loadTenantUsers = useCallback(async (tenantId: string | number) => {
    setTenantUsersStatus('loading')
    setTenantUsersError(null)
    try {
      const list = await getTenantUsers(tenantId)
      setTenantUsers(Array.isArray(list) ? list : [])
    } catch (err) {
      setTenantUsers([])
      setTenantUsersError(getErrorMessage(err))
    } finally {
      setTenantUsersStatus('idle')
    }
  }, [])

  const openUsers = (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setUsersOpen(true)
    setAddUserForm({ email: '', role: 'manager' })
    setActionError(null)
    loadTenantUsers(tenant.id)
  }

  const closeUsers = () => {
    setUsersOpen(false)
    setActiveTenant(null)
    setTenantUsers([])
    setTenantUsersError(null)
  }

  const handleAddUserSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeTenant) return
    setActionStatus('loading')
    setActionError(null)
    try {
      await addTenantUser(activeTenant.id, { email: addUserForm.email.trim(), role: addUserForm.role })
      setAddUserForm({ email: '', role: 'manager' })
      await loadTenantUsers(activeTenant.id)
      showToast('Пользователь добавлен ✅')
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionStatus('idle')
    }
  }

  // --- Self-Check ---
  const openCheck = async (tenant: AdminTenant) => {
    setActiveTenant(tenant)
    setCheckOpen(true)
    setCheckLoading(true)
    setCheckResult(null)
    try {
      const result = await selfCheckTenant(tenant.id)
      setCheckResult(result)
    } catch (err) {
      setCheckResult({
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        checks: [
          {
            key: 'error',
            label: 'Ошибка проверки',
            ok: false,
            message: getErrorMessage(err),
          },
        ],
        all_ok: false,
      })
    } finally {
      setCheckLoading(false)
    }
  }

  const closeCheck = () => {
    setCheckOpen(false)
    setActiveTenant(null)
    setCheckResult(null)
  }

  const handleCheckAction = (action: string) => {
    if (!activeTenant) return
    closeCheck()
    if (action === 'open_ai') openEdit(activeTenant, 'ai')
    else if (action === 'open_whatsapp') openEdit(activeTenant, 'whatsapp')
    else if (action === 'open_amocrm' || action === 'reconnect_amo') openEdit(activeTenant, 'amocrm')
  }

  const isBound = settings.chatflow_binding_exists || (settings.chatflow_token && settings.chatflow_instance_id)

  // Escape key handling
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (helpOpen) setHelpOpen(false)
        else if (checkOpen) closeCheck()
        else if (usersOpen) closeUsers()
        else if (editOpen) closeEdit()
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [editOpen, usersOpen, checkOpen, helpOpen])

  // --- Render ---
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Клиенты</h1>
          <p className="admin-page-subtitle">Управление tenants</p>
        </div>
        <button
          className="admin-btn admin-btn--primary"
          type="button"
          onClick={loadTenants}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      {status === 'loading' && <div className="admin-loading">Загрузка клиентов...</div>}

      {!error && status !== 'loading' && tenants.length === 0 && (
        <div className="admin-empty">Клиентов пока нет</div>
      )}

      {!error && tenants.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Active</th>
                <th>AI</th>
                <th>WhatsApp</th>
                <th>WA Linked</th>
                <th>AmoCRM</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="admin-table-name">{t.name}</td>
                  <td>
                    <span className={`admin-badge ${t.is_active ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                      {t.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${t.ai_enabled !== false ? 'admin-badge--ok' : 'admin-badge--off'}`}>
                      {t.ai_enabled !== false ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge--neutral">
                      {(t as Record<string, unknown>).whatsapp_source === 'amomarket' ? 'AmoCRM' : 'ChatFlow'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${t.token || t.instance_id ? 'admin-badge--ok' : 'admin-badge--warn'}`}>
                      {t.token || t.instance_id ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-badge ${(t as Record<string, unknown>).amocrm_connected ? 'admin-badge--ok' : 'admin-badge--neutral'}`}
                    >
                      {(t as Record<string, unknown>).amocrm_connected ? 'Yes' : '—'}
                    </span>
                  </td>
                  <td className="admin-table-actions">
                    <button className="admin-btn admin-btn--sm" type="button" onClick={() => openEdit(t)}>
                      Настроить
                    </button>
                    <button
                      className="admin-btn admin-btn--sm admin-btn--ghost"
                      type="button"
                      onClick={() => openUsers(t)}
                    >
                      Юзеры
                    </button>
                    <button
                      className="admin-btn admin-btn--sm admin-btn--accent"
                      type="button"
                      onClick={() => openCheck(t)}
                    >
                      Проверить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="admin-toast">{toast}</div>}

      {/* Settings Modal */}
      {/* Settings Modal - Centered and Large */}
      {editOpen && activeTenant && (
        <div className="admin-modal-overlay" onClick={closeEdit}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Настройки: {activeTenant.name}</h2>
              <button className="admin-modal-close" type="button" onClick={closeEdit}>×</button>
            </div>

            <div className="admin-modal-content">
              {/* Error Banner */}
              {settingsError && (
                <div className="admin-alert admin-alert--error">
                  <strong>Ошибка: </strong>
                  {settingsError}
                </div>
              )}

              <div className="admin-tabs">
                <button
                  type="button"
                  className={`admin-tab ${activeTab === 'ai' ? 'admin-tab--active' : ''}`}
                  onClick={() => setActiveTab('ai')}
                >
                  AI Настройки
                </button>
                <button
                  type="button"
                  className={`admin-tab ${activeTab === 'whatsapp' ? 'admin-tab--active' : ''}`}
                  onClick={() => setActiveTab('whatsapp')}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  className={`admin-tab ${activeTab === 'amocrm' ? 'admin-tab--active' : ''}`}
                  onClick={() => setActiveTab('amocrm')}
                >
                  AmoCRM
                </button>
              </div>
              <div className="admin-tabs-actions">
                {lastLoadedAt && settingsStatus === 'ready' && (
                  <span className="admin-loaded-at">
                    Загружено: {lastLoadedAt.toLocaleTimeString('ru-RU')}
                  </span>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost admin-btn--sm"
                  onClick={() => activeTenant && loadSettings(activeTenant.id)}
                  disabled={settingsStatus === 'loading'}
                >
                  🔄 Обновить
                </button>
              </div>
            </div>

            <div className="admin-modal-body">
              {/* LOADING STATE */}
              {settingsStatus === 'loading' && (
                <div className="admin-loading-panel">
                  <div className="admin-spinner" />
                  <p>Загрузка настроек...</p>
                </div>
              )}

              {/* ERROR STATE */}
              {settingsStatus === 'error' && (
                <div className="admin-error-panel admin-error-panel--detailed">
                  <div className="admin-error-icon">⚠️</div>
                  <h3>Ошибка загрузки настроек</h3>

                  {/* Main error message */}
                  <p className="admin-error-message">{settingsError || 'Не удалось загрузить настройки'}</p>

                  {/* Detailed diagnostics */}
                  {settingsErrorDetail && (
                    <div className="admin-error-diagnostics">
                      <div className="admin-error-diagnostics-title">🔧 Диагностика:</div>
                      <div className="admin-error-diagnostics-grid">
                        {settingsErrorDetail.status && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">HTTP Status:</span>
                            <span className="admin-diag-value admin-diag-value--code">{settingsErrorDetail.status}</span>
                          </div>
                        )}
                        {settingsErrorDetail.url && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">URL:</span>
                            <span className="admin-diag-value admin-diag-value--mono">{settingsErrorDetail.url}</span>
                          </div>
                        )}
                        {settingsErrorDetail.detail && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">Backend Detail:</span>
                            <span className="admin-diag-value">{settingsErrorDetail.detail}</span>
                          </div>
                        )}
                        <div className="admin-diag-row">
                          <span className="admin-diag-label">Auth Header:</span>
                          <span className={`admin-diag-value ${settingsErrorDetail.hasAuthHeader ? 'admin-diag-value--ok' : 'admin-diag-value--warn'}`}>
                            {settingsErrorDetail.hasAuthHeader ? '✅ Присутствует' : '❌ Отсутствует'}
                          </span>
                        </div>
                        {settingsErrorDetail.tenantId && (
                          <div className="admin-diag-row">
                            <span className="admin-diag-label">Tenant ID:</span>
                            <span className="admin-diag-value">{settingsErrorDetail.tenantId}</span>
                          </div>
                        )}
                      </div>

                      {/* Response body preview */}
                      {settingsErrorDetail.responseBody && (
                        <div className="admin-error-response">
                          <div className="admin-diag-label">Response (первые 500 символов):</div>
                          <pre className="admin-error-response-body">{settingsErrorDetail.responseBody}</pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="admin-error-actions">
                    <button className="admin-btn admin-btn--primary" type="button" onClick={handleRetrySettings}>
                      Повторить
                    </button>
                    {settingsErrorDetail && (
                      <button
                        className="admin-btn admin-btn--secondary"
                        type="button"
                        onClick={() => {
                          const diag = {
                            url: settingsErrorDetail.url,
                            status: settingsErrorDetail.status,
                            detail: settingsErrorDetail.detail,
                            responseBody: settingsErrorDetail.responseBody,
                            hasAuthHeader: settingsErrorDetail.hasAuthHeader,
                            tenantId: settingsErrorDetail.tenantId,
                            timestamp: new Date().toISOString(),
                          }
                          navigator.clipboard.writeText(JSON.stringify(diag, null, 2))
                          showToast('Диагностика скопирована')
                        }}
                      >
                        📋 Скопировать диагностику
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* READY STATE - AI Tab */}
              {settingsStatus === 'ready' && activeTab === 'ai' && (
                <div className="admin-settings-section">
                  <div className="admin-settings-block">
                    <div className="admin-settings-row">
                      <div className="admin-settings-info">
                        <div className="admin-settings-label">AI-менеджер (глобально)</div>
                        <div className="admin-settings-hint">
                          Когда выключено — бот не отвечает, но лиды сохраняются.
                        </div>
                      </div>
                      <label className="admin-switch">
                        <input
                          type="checkbox"
                          checked={settings.ai_enabled !== false}
                          onChange={(e) => setSettings({ ...settings, ai_enabled: e.target.checked })}
                        />
                        <span className="admin-switch-track">
                          <span className="admin-switch-thumb" />
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="admin-settings-block">
                    <label className="admin-label">AI инструкция (prompt)</label>
                    <div className="admin-settings-hint" style={{ marginBottom: 8 }}>
                      Укажите контекст: что продаёте, как общаться, какую информацию собирать.
                      <div className="admin-field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="admin-label" style={{ margin: 0 }}>System AI Prompt</label>
                        <button
                          type="button"
                          className="admin-btn-link admin-btn-link--danger"
                          onClick={handleClearAiPrompt}
                          style={{ fontSize: 12, textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Очистить prompt
                        </button>
                      </div>
                      <textarea
                        className="admin-input admin-input--textarea"
                        value={settings.ai_prompt ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setSettings(p => ({ ...p, ai_prompt: val }))
                          setDirtyFields(d => new Set(d).add('ai_prompt'))
                        }}
                        placeholder="Ты — полезный ассистент..."
                        rows={8}
                      />
                      <div className="admin-settings-hint" style={{ marginTop: 4 }}>
                        {!settings.ai_prompt && '⚠️ Prompt пустой — AI будет отвечать дефолтными фразами.'}
                        {settings.ai_prompt && `Длина: ${settings.ai_prompt.length} символов`}
                      </div>
                      <div className="admin-char-counter">
                        {(settings.ai_prompt ?? '').length} символов
                      </div>
                    </div>

                    <div className="admin-settings-block">
                      <label className="admin-label">Поведение после заявки</label>
                      <select
                        className="admin-input"
                        value={settings.ai_after_submit_behavior ?? 'polite_close'}
                        onChange={(e) => setSettings({ ...settings, ai_after_submit_behavior: e.target.value })}
                      >
                        <option value="polite_close">Вежливо завершить</option>
                      </select>
                    </div>

                    {actionError && <div className="admin-alert admin-alert--error">{actionError}</div>}

                    <button
                      className="admin-btn admin-btn--primary"
                      type="button"
                      onClick={handleSaveAi}
                      disabled={actionStatus === 'loading'}
                    >
                      {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )}

              {/* READY STATE - WhatsApp Tab */}
              {settingsStatus === 'ready' && activeTab === 'whatsapp' && (
                <div className="admin-settings-section">
                  <div className="admin-settings-block">
                    <label className="admin-label">Источник WhatsApp</label>
                    <select
                      className="admin-input"
                      value={settings.whatsapp_source ?? 'chatflow'}
                      onChange={(e) =>
                        setSettings({ ...settings, whatsapp_source: e.target.value as TenantSettings['whatsapp_source'] })
                      }
                    >
                      <option value="chatflow">ChatFlow</option>
                      <option value="amomarket">AmoCRM Marketplace</option>
                    </select>
                    <div className="admin-settings-hint" style={{ marginTop: 8, color: '#f59e0b' }}>
                      Выберите только один источник. Нельзя использовать оба.
                    </div>
                  </div>

                  {settings.whatsapp_source === 'amomarket' ? (
                    <div className="admin-info-box">
                      <strong>AmoCRM Marketplace</strong>
                      <br />
                      WhatsApp подключается внутри AmoCRM. Вебхук настраивать не нужно.
                    </div>
                  ) : (
                    <>
                      {/* Status based on server binding info */}
                      <div className={`admin-status-box ${serverWhatsApp.binding_exists || isBound ? 'admin-status-box--ok' : 'admin-status-box--warn'}`}>
                        {serverWhatsApp.binding_exists || isBound
                          ? '✅ Привязано — бот готов отвечать'
                          : '⚠️ Не привязано — бот не сможет отвечать'}
                      </div>

                      {/* Show masked token info if we have it from server */}
                      {(serverWhatsApp.token_masked || settings.chatflow_token_masked) && (
                        <div className="admin-info-box">
                          <strong>Текущий токен:</strong> {serverWhatsApp.token_masked || settings.chatflow_token_masked}
                          <br />
                          <small>Оставьте поле пустым, чтобы сохранить текущий токен. Введите новый токен, чтобы обновить.</small>
                        </div>
                      )}

                      <div className="admin-form-grid">
                        <div className="admin-settings-block">
                          <label className="admin-label">
                            ChatFlow Token (JWT)
                            {dirtyFields.has('chatflow_token') && <span style={{ color: '#f59e0b', marginLeft: 8 }}>● изменено</span>}
                          </label>
                          <textarea
                            className="admin-input admin-input--textarea"
                            value={settings.chatflow_token ?? ''}
                            onChange={(e) => {
                              setSettings({ ...settings, chatflow_token: e.target.value })
                              setDirtyFields(prev => new Set(prev).add('chatflow_token'))
                            }}
                            placeholder={serverWhatsApp.token_masked ? '(оставьте пустым для сохранения текущего)' : 'eyJhbGciOiJIUzI1NiIs...'}
                            rows={3}
                          />
                        </div>

                        <div className="admin-settings-block">
                          <label className="admin-label">
                            Instance ID
                            {dirtyFields.has('chatflow_instance_id') && <span style={{ color: '#f59e0b', marginLeft: 8 }}>● изменено</span>}
                          </label>
                          <input
                            className="admin-input"
                            type="text"
                            value={settings.chatflow_instance_id ?? ''}
                            onChange={(e) => {
                              setSettings({ ...settings, chatflow_instance_id: e.target.value })
                              setDirtyFields(prev => new Set(prev).add('chatflow_instance_id'))
                            }}
                            placeholder="ID инстанса (QR в ChatFlow)"
                          />
                        </div>

                        <div className="admin-settings-block">
                          <label className="admin-label">
                            Номер телефона
                            {dirtyFields.has('chatflow_phone_number') && <span style={{ color: '#f59e0b', marginLeft: 8 }}>● изменено</span>}
                          </label>
                          <input
                            className="admin-input"
                            type="text"
                            value={settings.chatflow_phone_number ?? ''}
                            onChange={(e) => {
                              setSettings({ ...settings, chatflow_phone_number: e.target.value })
                              setDirtyFields(prev => new Set(prev).add('chatflow_phone_number'))
                            }}
                            placeholder="+77001234567"
                          />
                        </div>

                        <div className="admin-settings-block">
                          <div className="admin-settings-row">
                            <span className="admin-label" style={{ marginBottom: 0 }}>
                              Активен
                            </span>
                            <label className="admin-switch">
                              <input
                                type="checkbox"
                                checked={settings.chatflow_active !== false}
                                onChange={(e) => setSettings({ ...settings, chatflow_active: e.target.checked })}
                              />
                              <span className="admin-switch-track">
                                <span className="admin-switch-thumb" />
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {actionError && <div className="admin-alert admin-alert--error">{actionError}</div>}

                  <div className="admin-btn-group">
                    <button
                      className="admin-btn admin-btn--primary"
                      type="button"
                      onClick={handleSaveWhatsApp}
                      disabled={actionStatus === 'loading'}
                    >
                      {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить привязку'}
                    </button>

                    {(serverWhatsApp.binding_exists || isBound) && (
                      <button
                        className="admin-btn admin-btn--secondary"
                        type="button"
                        onClick={() => setWaTestOpen(true)}
                      >
                        📱 Проверить WhatsApp
                      </button>
                    )}
                  </div>

                  {/* WhatsApp Test Panel */}
                  {waTestOpen && (
                    <div className="admin-test-panel" style={{ marginTop: 16 }}>
                      <div className="admin-divider" />
                      <h4 className="admin-subtitle">Тест отправки сообщения</h4>

                      <div className="admin-form-grid">
                        <div className="admin-settings-block">
                          <label className="admin-label">Номер телефона (получатель)</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={waTestPhone}
                            onChange={(e) => setWaTestPhone(e.target.value)}
                            placeholder="+77001234567"
                          />
                        </div>

                        <div className="admin-settings-block">
                          <label className="admin-label">Текст сообщения</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={waTestMessage}
                            onChange={(e) => setWaTestMessage(e.target.value)}
                            placeholder="Тестовое сообщение"
                          />
                        </div>
                      </div>

                      <div className="admin-btn-group" style={{ marginTop: 12 }}>
                        <button
                          className="admin-btn admin-btn--accent"
                          type="button"
                          onClick={handleTestWhatsApp}
                          disabled={waTestLoading}
                        >
                          {waTestLoading ? 'Отправка...' : '🚀 Отправить тест'}
                        </button>
                        <button
                          className="admin-btn admin-btn--ghost"
                          type="button"
                          onClick={() => {
                            setWaTestOpen(false)
                            setWaTestResult(null)
                          }}
                        >
                          Закрыть
                        </button>
                      </div>

                      {waTestResult && (
                        <div className={`admin-alert ${waTestResult.ok ? 'admin-alert--success' : 'admin-alert--error'}`} style={{ marginTop: 12 }}>
                          <strong>{waTestResult.ok ? '✅' : '❌'} {waTestResult.message}</strong>
                          {waTestResult.details && (
                            <pre style={{ marginTop: 8, fontSize: 11, overflow: 'auto', maxHeight: 150 }}>
                              {waTestResult.details}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* READY STATE - AmoCRM Tab */}
              {settingsStatus === 'ready' && activeTab === 'amocrm' && (
                <div className="admin-settings-section">
                  {amoLoading ? (
                    <div className="admin-loading-panel">
                      <div className="admin-spinner" />
                      <p>Загрузка статуса...</p>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`admin-status-box ${amoStatus?.connected ? 'admin-status-box--ok' : 'admin-status-box--warn'}`}
                      >
                        {amoStatus?.connected ? '✅ AmoCRM подключён' : '⚠️ AmoCRM не подключён'}
                      </div>

                      {amoStatus?.connected && (
                        <div className="admin-info-box">
                          <strong>Домен:</strong> {amoStatus.domain || '—'}
                          <br />
                          <strong>Истекает:</strong>{' '}
                          {amoStatus.expires_at ? new Date(amoStatus.expires_at).toLocaleString() : '—'}
                        </div>
                      )}

                      <div className="admin-settings-block">
                        <label className="admin-label">Домен AmoCRM</label>
                        <div className="admin-form-row-inline">
                          <input
                            className="admin-input"
                            type="text"
                            value={amoBaseDomain}
                            onChange={(e) => setAmoBaseDomain(e.target.value)}
                            onBlur={(e) => {
                              // Normalize domain on blur (extract hostname from full URL)
                              const normalized = normalizeAmoDomain(e.target.value)
                              if (normalized && normalized !== e.target.value) {
                                setAmoBaseDomain(normalized)
                              }
                            }}
                            placeholder="mycompany.amocrm.ru"
                          />
                          <button
                            className="admin-btn admin-btn--secondary"
                            type="button"
                            onClick={handleSaveAmoDomain}
                            disabled={actionStatus === 'loading'}
                          >
                            Сохранить
                          </button>
                        </div>
                        <div className="admin-settings-hint" style={{ marginTop: 4 }}>
                          Можно вставить ссылку целиком, например: https://company.amocrm.ru/leads/
                        </div>
                      </div>

                      <div className="admin-btn-group">
                        <button
                          className="admin-btn admin-btn--primary"
                          type="button"
                          onClick={handleConnectAmo}
                          disabled={actionStatus === 'loading'}
                        >
                          {amoStatus?.connected ? 'Переподключить' : 'Подключить AmoCRM'}
                        </button>
                        <button
                          className="admin-btn admin-btn--ghost"
                          type="button"
                          onClick={handleRefreshAmoStatus}
                          disabled={amoLoading}
                        >
                          Обновить статус
                        </button>
                        <button
                          className="admin-btn admin-btn--ghost"
                          type="button"
                          onClick={() => setHelpOpen(true)}
                        >
                          ❓ Как подключить
                        </button>
                      </div>

                      {amoStatus?.connected && (
                        <div className="admin-settings-block" style={{ marginTop: 24 }}>
                          <div className="admin-divider" />
                          <label className="admin-label">Воронки и стадии AmoCRM</label>

                          {/* Load pipelines button */}
                          <div className="admin-btn-group" style={{ marginBottom: 16 }}>
                            <button
                              className="admin-btn admin-btn--secondary"
                              type="button"
                              onClick={() => activeTenant && loadPipelines(activeTenant.id)}
                              disabled={pipelinesLoading}
                            >
                              {pipelinesLoading ? 'Загрузка...' : '📥 Загрузить воронки'}
                            </button>
                          </div>

                          {/* Pipeline selector */}
                          {amoPipelines.length > 0 && (
                            <div className="admin-settings-block">
                              <label className="admin-label">Выберите воронку</label>
                              <select
                                className="admin-input"
                                value={selectedPipelineId}
                                onChange={(e) => {
                                  setSelectedPipelineId(e.target.value)
                                  if (e.target.value && activeTenant) {
                                    loadStages(activeTenant.id, e.target.value)
                                  }
                                }}
                              >
                                <option value="">— Выберите воронку —</option>
                                {amoPipelines.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.is_main ? '(основная)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Stages list */}
                          {stagesLoading && (
                            <div className="admin-loading-panel" style={{ padding: 16 }}>
                              <div className="admin-spinner admin-spinner--sm" />
                              <span>Загрузка стадий...</span>
                            </div>
                          )}

                          {!stagesLoading && amoStages.length > 0 && (
                            <div className="admin-settings-block">
                              <label className="admin-label">Стадии воронки</label>
                              <div className="admin-stages-list">
                                {amoStages.map(stage => (
                                  <div key={stage.id} className="admin-stage-item">
                                    <span className="admin-stage-name">{stage.name}</span>
                                    <span className="admin-stage-id">ID: {stage.id}</span>
                                    {stage.is_won && <span className="admin-badge admin-badge--ok">Won</span>}
                                    {stage.is_lost && <span className="admin-badge admin-badge--off">Lost</span>}
                                  </div>
                                ))}
                              </div>

                              <button
                                className="admin-btn admin-btn--accent"
                                type="button"
                                onClick={handleAutoFillMapping}
                                style={{ marginTop: 12 }}
                              >
                                ✨ Автозаполнить маппинг по названиям
                              </button>
                            </div>
                          )}

                          <div className="admin-divider" />

                          {/* Mapping table */}
                          <label className="admin-label">Маппинг стадий</label>
                          <div className="admin-settings-hint" style={{ marginBottom: 12 }}>
                            Укажите ID стадий из вашей воронки AmoCRM для каждого статуса лида.
                          </div>
                          <table className="admin-mapping-table">
                            <thead>
                              <tr>
                                <th>Статус лида</th>
                                <th>Stage ID</th>
                                <th>Быстрый выбор</th>
                              </tr>
                            </thead>
                            <tbody>
                              {amoMapping.map((m, i) => (
                                <tr key={m.stage_key}>
                                  <td>{STAGE_KEY_LABELS[m.stage_key] || m.stage_key}</td>
                                  <td>
                                    <input
                                      className="admin-input"
                                      type="text"
                                      value={m.stage_id ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value.trim()
                                        setAmoMapping((prev) =>
                                          prev.map((x, j) => (j === i ? { ...x, stage_id: val || null } : x))
                                        )
                                      }}
                                      placeholder="ID стадии"
                                    />
                                  </td>
                                  <td>
                                    {amoStages.length > 0 && (
                                      <select
                                        className="admin-input admin-input--sm"
                                        value={m.stage_id ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          setAmoMapping((prev) =>
                                            prev.map((x, j) => (j === i ? { ...x, stage_id: val || null } : x))
                                          )
                                        }}
                                      >
                                        <option value="">—</option>
                                        {amoStages.map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button
                            className="admin-btn admin-btn--primary"
                            type="button"
                            onClick={handleSaveAmoMapping}
                            disabled={actionStatus === 'loading'}
                            style={{ marginTop: 12 }}
                          >
                            {actionStatus === 'loading' ? 'Сохраняю...' : 'Сохранить маппинг'}
                          </button>
                        </div>
                      )}

                      {actionError && (
                        <div className="admin-alert admin-alert--error" style={{ marginTop: 16 }}>
                          {actionError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {
        usersOpen && activeTenant && (
          <div className="admin-modal-backdrop" onClick={closeUsers}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Пользователи — {activeTenant.name}</h2>
                <button className="admin-modal-close" type="button" onClick={closeUsers}>
                  ×
                </button>
              </div>
              <div className="admin-modal-body">
                {tenantUsersError && <div className="admin-alert admin-alert--error">{tenantUsersError}</div>}
                {tenantUsersStatus === 'loading' ? (
                  <div className="admin-loading">Загрузка...</div>
                ) : tenantUsers.length === 0 && !tenantUsersError ? (
                  <div className="admin-empty">Пользователей пока нет</div>
                ) : (
                  <div className="admin-users-list">
                    {tenantUsers.map((u) => (
                      <div className="admin-user-item" key={u.id}>
                        <div className="admin-user-email">{u.email}</div>
                        <span className={`admin-badge ${u.role === 'admin' ? 'admin-badge--ok' : 'admin-badge--neutral'}`}>
                          {u.role === 'admin' ? 'Админ' : 'Менеджер'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="admin-divider" />

                <h3 className="admin-subtitle">Добавить пользователя</h3>
                <form onSubmit={handleAddUserSubmit}>
                  <div className="admin-form-row">
                    <input
                      className="admin-input"
                      type="email"
                      value={addUserForm.email}
                      onChange={(e) => setAddUserForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="user@company.ru"
                      required
                    />
                    <select
                      className="admin-input"
                      value={addUserForm.role}
                      onChange={(e) => setAddUserForm((p) => ({ ...p, role: e.target.value as 'manager' | 'admin' }))}
                    >
                      <option value="manager">Менеджер</option>
                      <option value="admin">Админ</option>
                    </select>
                    <button className="admin-btn admin-btn--primary" type="submit" disabled={actionStatus === 'loading'}>
                      {actionStatus === 'loading' ? '...' : 'Добавить'}
                    </button>
                  </div>
                  {actionError && (
                    <div className="admin-alert admin-alert--error" style={{ marginTop: 12 }}>
                      {actionError}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )
      }

      {/* Self-Check Modal */}
      {
        checkOpen && activeTenant && (
          <div className="admin-modal-backdrop" onClick={closeCheck}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Проверка — {activeTenant.name}</h2>
                <button className="admin-modal-close" type="button" onClick={closeCheck}>
                  ×
                </button>
              </div>
              <div className="admin-modal-body">
                {checkLoading && (
                  <div className="admin-loading-panel">
                    <div className="admin-spinner" />
                    <p>Проверяем настройки...</p>
                  </div>
                )}

                {!checkLoading && checkResult && (
                  <>
                    <div
                      className={`admin-status-box ${checkResult.all_ok ? 'admin-status-box--ok' : 'admin-status-box--warn'}`}
                      style={{ marginBottom: 16 }}
                    >
                      {checkResult.all_ok ? '✅ Все проверки пройдены!' : '⚠️ Есть проблемы — см. ниже'}
                    </div>

                    <div className="admin-check-list">
                      {checkResult.checks.map((c) => (
                        <div
                          key={c.key}
                          className={`admin-check-item ${c.ok ? 'admin-check-item--ok' : 'admin-check-item--error'}`}
                        >
                          <div className="admin-check-icon">{c.ok ? '✅' : '❌'}</div>
                          <div className="admin-check-content">
                            <div className="admin-check-label">{c.label || c.key}</div>
                            {c.message && <div className="admin-check-message">{c.message}</div>}
                            {!c.message && !c.ok && <div className="admin-check-message">Требуется настройка</div>}
                          </div>
                          {c.action && !c.ok && (
                            <button
                              className="admin-btn admin-btn--sm admin-btn--secondary"
                              type="button"
                              onClick={() => handleCheckAction(c.action!)}
                            >
                              Исправить
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* AmoCRM Help Modal */}
      {
        helpOpen && (
          <div className="admin-modal-backdrop" onClick={() => setHelpOpen(false)}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Как подключить AmoCRM</h2>
                <button className="admin-modal-close" type="button" onClick={() => setHelpOpen(false)}>
                  ×
                </button>
              </div>
              <div className="admin-modal-body">
                <div className="admin-help-steps">
                  <div className="admin-help-step">
                    <div className="admin-help-step-number">1</div>
                    <div className="admin-help-step-content">
                      <strong>Создайте интеграцию в AmoCRM</strong>
                      <p>Перейдите в AmoCRM → Настройки → Интеграции → Создать интеграцию</p>
                    </div>
                  </div>
                  <div className="admin-help-step">
                    <div className="admin-help-step-number">2</div>
                    <div className="admin-help-step-content">
                      <strong>Укажите Redirect URL</strong>
                      <p>Вставьте этот URL в настройках интеграции:</p>
                      <code className="admin-help-code">{BASE_URL}/api/integrations/amocrm/callback</code>
                      <button
                        className="admin-btn admin-btn--sm admin-btn--ghost"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${BASE_URL}/api/integrations/amocrm/callback`)
                          showToast('URL скопирован')
                        }}
                      >
                        📋 Копировать
                      </button>
                    </div>
                  </div>
                  <div className="admin-help-step">
                    <div className="admin-help-step-number">3</div>
                    <div className="admin-help-step-content">
                      <strong>Скопируйте client_id и client_secret</strong>
                      <p>Эти данные нужно добавить в переменные окружения на Render (или где развёрнут backend)</p>
                    </div>
                  </div>
                  <div className="admin-help-step">
                    <div className="admin-help-step-number">4</div>
                    <div className="admin-help-step-content">
                      <strong>Введите домен AmoCRM</strong>
                      <p>В поле выше укажите ваш домен (например: company.amocrm.ru) и нажмите Сохранить</p>
                    </div>
                  </div>
                  <div className="admin-help-step">
                    <div className="admin-help-step-number">5</div>
                    <div className="admin-help-step-content">
                      <strong>Нажмите "Подключить AmoCRM"</strong>
                      <p>Откроется окно авторизации. После успешного входа вернитесь сюда и обновите статус.</p>
                    </div>
                  </div>
                </div>
                <div className="admin-modal-footer">
                  <button className="admin-btn admin-btn--primary" type="button" onClick={() => setHelpOpen(false)}>
                    Понятно
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}

export default AdminTenants
