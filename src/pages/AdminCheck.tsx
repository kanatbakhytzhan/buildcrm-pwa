import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdminDiagnosticsDb,
  getAdminTenantSnapshot,
  getAdminTenants,
  postAdminDiagnosticsSmokeTest,
  type AdminTenant,
} from '../services/api'
import { useEffect } from 'react'

const AdminCheck = () => {
  const navigate = useNavigate()
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
    <div className="page-stack page-desktop-fullwidth">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Проверка</h1>
          <p className="subtitle">Диагностика системы</p>
        </div>
        <div className="action-card">
          <button className="ghost-button" type="button" onClick={() => navigate('/admin/tenants')}>
            Клиенты
          </button>
        </div>
      </div>

      {/* Tenant Snapshot */}
      <div className="card">
        <div className="card-title">Tenant Snapshot</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>
          Получить полный снимок настроек клиента: AI, WhatsApp, AmoCRM.
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <select
            className="field-input"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            style={{ flex: 1, maxWidth: 300 }}
          >
            <option value="">Выберите клиента...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            className="secondary-button"
            type="button"
            onClick={handleSnapshot}
            disabled={snapshotLoading || !selectedTenantId}
          >
            {snapshotLoading ? 'Загрузка...' : 'Получить'}
          </button>
        </div>
        {snapshotError && <div className="error-text">{snapshotError}</div>}
        {snapshotResult != null && (
          <pre className="diag-output">{String(formatJson(snapshotResult))}</pre>
        )}
      </div>

      {/* DB Diagnostics */}
      <div className="card">
        <div className="card-title">DB Diagnostics</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>
          Проверить таблицы базы данных на целостность.
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={handleDb}
          disabled={dbLoading}
        >
          {dbLoading ? 'Проверка...' : 'Запустить проверку'}
        </button>
        {dbError && <div className="error-text" style={{ marginTop: 12 }}>{dbError}</div>}
        {dbResult != null && (
          <pre className="diag-output">{String(formatJson(dbResult))}</pre>
        )}
      </div>

      {/* Smoke Test */}
      <div className="card">
        <div className="card-title">Smoke Test</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>
          Быстрый тест работоспособности backend: auth, DB, AI.
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={handleSmoke}
          disabled={smokeLoading}
        >
          {smokeLoading ? 'Тестирование...' : 'Запустить тест'}
        </button>
        {smokeError && <div className="error-text" style={{ marginTop: 12 }}>{smokeError}</div>}
        {smokeResult != null && (
          <pre className="diag-output">{String(formatJson(smokeResult))}</pre>
        )}
      </div>
    </div>
  )
}

export default AdminCheck
