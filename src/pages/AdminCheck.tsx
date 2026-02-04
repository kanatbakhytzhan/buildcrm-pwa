import { useCallback, useState, useEffect } from 'react'
import {
  getAdminDiagnosticsDb,
  getAdminTenantSnapshot,
  getAdminTenants,
  postAdminDiagnosticsSmokeTest,
  type AdminTenant,
} from '../services/api'

type DiagResult = {
  data: unknown
  status: 'success' | 'error' | 'warn'
  timestamp: string
}

const AdminCheck = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)

  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotResult, setSnapshotResult] = useState<DiagResult | null>(null)
  const [snapshotExpanded, setSnapshotExpanded] = useState(true)

  const [dbLoading, setDbLoading] = useState(false)
  const [dbResult, setDbResult] = useState<DiagResult | null>(null)
  const [dbExpanded, setDbExpanded] = useState(true)

  const [smokeLoading, setSmokeLoading] = useState(false)
  const [smokeResult, setSmokeResult] = useState<DiagResult | null>(null)
  const [smokeExpanded, setSmokeExpanded] = useState(true)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    getAdminTenants()
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => setTenants([]))
  }, [])

  const handleSnapshot = useCallback(async () => {
    if (!selectedTenantId) return
    setSnapshotLoading(true)
    setSnapshotResult(null)
    try {
      const data = await getAdminTenantSnapshot(selectedTenantId)
      const hasError = (data as Record<string, unknown>)?.ok === false
      setSnapshotResult({
        data,
        status: hasError ? 'warn' : 'success',
        timestamp: new Date().toLocaleString(),
      })
    } catch (err) {
      setSnapshotResult({
        data: { error: (err as { message?: string })?.message || 'Ошибка запроса' },
        status: 'error',
        timestamp: new Date().toLocaleString(),
      })
    } finally {
      setSnapshotLoading(false)
    }
  }, [selectedTenantId])

  const handleDb = useCallback(async () => {
    setDbLoading(true)
    setDbResult(null)
    try {
      const data = await getAdminDiagnosticsDb()
      setDbResult({
        data,
        status: 'success',
        timestamp: new Date().toLocaleString(),
      })
    } catch (err) {
      setDbResult({
        data: { error: (err as { message?: string })?.message || 'Ошибка запроса' },
        status: 'error',
        timestamp: new Date().toLocaleString(),
      })
    } finally {
      setDbLoading(false)
    }
  }, [])

  const handleSmoke = useCallback(async () => {
    setSmokeLoading(true)
    setSmokeResult(null)
    try {
      const data = await postAdminDiagnosticsSmokeTest()
      const allOk = (data as Record<string, unknown>)?.all_ok === true
      setSmokeResult({
        data,
        status: allOk ? 'success' : 'warn',
        timestamp: new Date().toLocaleString(),
      })
    } catch (err) {
      setSmokeResult({
        data: { error: (err as { message?: string })?.message || 'Ошибка запроса' },
        status: 'error',
        timestamp: new Date().toLocaleString(),
      })
    } finally {
      setSmokeLoading(false)
    }
  }, [])

  const formatJson = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  const copyJson = (data: unknown) => {
    navigator.clipboard.writeText(formatJson(data)).catch(() => {})
    showToast('JSON скопирован')
  }

  const ResultCard = ({
    title,
    description,
    loading,
    result,
    expanded,
    onToggleExpand,
    onCopy,
    children,
  }: {
    title: string
    description: string
    loading: boolean
    result: DiagResult | null
    expanded: boolean
    onToggleExpand: () => void
    onCopy: () => void
    children: React.ReactNode
  }) => (
    <div className="admin-diag-card">
      <div className="admin-diag-card-header">
        <div>
          <h3 className="admin-diag-title">{title}</h3>
          <p className="admin-diag-desc">{description}</p>
        </div>
        {result && (
          <span className={`admin-badge admin-badge--${result.status === 'success' ? 'ok' : result.status === 'warn' ? 'warn' : 'off'}`}>
            {result.status === 'success' ? '✓ OK' : result.status === 'warn' ? '⚠ Warning' : '✗ Error'}
          </span>
        )}
      </div>

      <div className="admin-diag-controls">{children}</div>

      {loading && (
        <div className="admin-diag-loading">
          <div className="admin-spinner admin-spinner--sm" />
          <span>Выполняется...</span>
        </div>
      )}

      {result && !loading && (
        <div className="admin-diag-result">
          <div className="admin-diag-result-header">
            <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={onToggleExpand}>
              {expanded ? '▼ Свернуть' : '▶ Развернуть'}
            </button>
            <span className="admin-diag-timestamp">{result.timestamp}</span>
            <button className="admin-btn admin-btn--ghost admin-btn--sm" type="button" onClick={onCopy}>
              📋 Копировать JSON
            </button>
          </div>
          {expanded && (
            <pre className={`admin-diag-output admin-diag-output--${result.status}`}>{formatJson(result.data)}</pre>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Диагностика</h1>
          <p className="admin-page-subtitle">Проверка системы и настроек</p>
        </div>
        <div className="admin-btn-group">
          <button className="admin-btn admin-btn--secondary" type="button" onClick={handleSmoke} disabled={smokeLoading}>
            🔥 Smoke Test
          </button>
          <button className="admin-btn admin-btn--secondary" type="button" onClick={handleDb} disabled={dbLoading}>
            🗃️ DB Check
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="admin-toast">{toast}</div>}

      <div className="admin-diag-grid">
        {/* Tenant Snapshot */}
        <ResultCard
          title="Tenant Snapshot"
          description="Полный снимок настроек клиента: AI, WhatsApp, AmoCRM"
          loading={snapshotLoading}
          result={snapshotResult}
          expanded={snapshotExpanded}
          onToggleExpand={() => setSnapshotExpanded(!snapshotExpanded)}
          onCopy={() => snapshotResult && copyJson(snapshotResult.data)}
        >
          <select
            className="admin-input"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
          >
            <option value="">Выберите клиента...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            className="admin-btn admin-btn--primary"
            type="button"
            onClick={handleSnapshot}
            disabled={snapshotLoading || !selectedTenantId}
          >
            {snapshotLoading ? 'Загрузка...' : 'Получить снимок'}
          </button>
        </ResultCard>

        {/* DB Diagnostics */}
        <ResultCard
          title="DB Diagnostics"
          description="Проверка таблиц базы данных на целостность"
          loading={dbLoading}
          result={dbResult}
          expanded={dbExpanded}
          onToggleExpand={() => setDbExpanded(!dbExpanded)}
          onCopy={() => dbResult && copyJson(dbResult.data)}
        >
          <button
            className="admin-btn admin-btn--primary"
            type="button"
            onClick={handleDb}
            disabled={dbLoading}
          >
            {dbLoading ? 'Проверка...' : 'Запустить проверку'}
          </button>
        </ResultCard>

        {/* Smoke Test */}
        <ResultCard
          title="Smoke Test"
          description="Быстрый тест работоспособности: auth, DB, AI интеграция"
          loading={smokeLoading}
          result={smokeResult}
          expanded={smokeExpanded}
          onToggleExpand={() => setSmokeExpanded(!smokeExpanded)}
          onCopy={() => smokeResult && copyJson(smokeResult.data)}
        >
          <button
            className="admin-btn admin-btn--primary"
            type="button"
            onClick={handleSmoke}
            disabled={smokeLoading}
          >
            {smokeLoading ? 'Тестирование...' : 'Запустить тест'}
          </button>
        </ResultCard>
      </div>
    </div>
  )
}

export default AdminCheck
