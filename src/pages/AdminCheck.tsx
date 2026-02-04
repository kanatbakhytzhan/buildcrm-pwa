import { useCallback, useState, useEffect } from 'react'
import {
  getAdminDiagnosticsDb,
  getAdminTenantSnapshot,
  getAdminTenants,
  postAdminDiagnosticsSmokeTest,
  type AdminTenant,
} from '../services/api'

const AdminCheck = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')

  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotResult, setSnapshotResult] = useState<unknown>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  const [dbLoading, setDbLoading] = useState(false)
  const [dbResult, setDbResult] = useState<unknown>(null)
  const [dbError, setDbError] = useState<string | null>(null)

  const [smokeLoading, setSmokeLoading] = useState(false)
  const [smokeResult, setSmokeResult] = useState<unknown>(null)
  const [smokeError, setSmokeError] = useState<string | null>(null)

  useEffect(() => {
    getAdminTenants().then(setTenants).catch(() => setTenants([]))
  }, [])

  const handleSnapshot = useCallback(async () => {
    if (!selectedTenantId) return
    setSnapshotLoading(true)
    setSnapshotResult(null)
    setSnapshotError(null)
    try {
      const data = await getAdminTenantSnapshot(selectedTenantId)
      setSnapshotResult(data)
    } catch (err) {
      setSnapshotError((err as { message?: string })?.message || 'Ошибка')
    } finally {
      setSnapshotLoading(false)
    }
  }, [selectedTenantId])

  const handleDb = useCallback(async () => {
    setDbLoading(true)
    setDbResult(null)
    setDbError(null)
    try {
      const data = await getAdminDiagnosticsDb()
      setDbResult(data)
    } catch (err) {
      setDbError((err as { message?: string })?.message || 'Ошибка')
    } finally {
      setDbLoading(false)
    }
  }, [])

  const handleSmoke = useCallback(async () => {
    setSmokeLoading(true)
    setSmokeResult(null)
    setSmokeError(null)
    try {
      const data = await postAdminDiagnosticsSmokeTest()
      setSmokeResult(data)
    } catch (err) {
      setSmokeError((err as { message?: string })?.message || 'Ошибка')
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

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Диагностика</h1>
          <p className="admin-page-subtitle">Проверка системы</p>
        </div>
      </div>

      <div className="admin-diag-grid">
        {/* Tenant Snapshot */}
        <div className="admin-diag-card">
          <h3 className="admin-diag-title">Tenant Snapshot</h3>
          <p className="admin-settings-hint">
            Получить полный снимок настроек клиента: AI, WhatsApp, AmoCRM.
          </p>
          <div className="admin-diag-controls">
            <select
              className="admin-input"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              <option value="">Выберите клиента...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              className="admin-btn admin-btn--secondary"
              type="button"
              onClick={handleSnapshot}
              disabled={snapshotLoading || !selectedTenantId}
            >
              {snapshotLoading ? 'Загрузка...' : 'Получить'}
            </button>
          </div>
          {snapshotError && <div className="admin-alert admin-alert--error">{snapshotError}</div>}
          {snapshotResult != null && (
            <pre className="admin-diag-output">{String(formatJson(snapshotResult))}</pre>
          )}
        </div>

        {/* DB Diagnostics */}
        <div className="admin-diag-card">
          <h3 className="admin-diag-title">DB Diagnostics</h3>
          <p className="admin-settings-hint">
            Проверить таблицы базы данных на целостность.
          </p>
          <button
            className="admin-btn admin-btn--secondary"
            type="button"
            onClick={handleDb}
            disabled={dbLoading}
          >
            {dbLoading ? 'Проверка...' : 'Запустить проверку'}
          </button>
          {dbError && <div className="admin-alert admin-alert--error" style={{ marginTop: 12 }}>{dbError}</div>}
          {dbResult != null && (
            <pre className="admin-diag-output">{String(formatJson(dbResult))}</pre>
          )}
        </div>

        {/* Smoke Test */}
        <div className="admin-diag-card">
          <h3 className="admin-diag-title">Smoke Test</h3>
          <p className="admin-settings-hint">
            Быстрый тест работоспособности backend: auth, DB, AI.
          </p>
          <button
            className="admin-btn admin-btn--secondary"
            type="button"
            onClick={handleSmoke}
            disabled={smokeLoading}
          >
            {smokeLoading ? 'Тестирование...' : 'Запустить тест'}
          </button>
          {smokeError && <div className="admin-alert admin-alert--error" style={{ marginTop: 12 }}>{smokeError}</div>}
          {smokeResult != null && (
            <pre className="admin-diag-output">{String(formatJson(smokeResult))}</pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminCheck
