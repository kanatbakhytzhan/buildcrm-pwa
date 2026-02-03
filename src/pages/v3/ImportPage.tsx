import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getAdminTenants, importLeads, type ImportLeadsResult, type AdminTenant } from '../../services/api'

const ImportPage = () => {
  const { tenantId, isAdmin } = useAuth()
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [tenantIdVal, setTenantIdVal] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportLeadsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const showTenantSelect = isAdmin && tenantId == null
  useEffect(() => {
    if (showTenantSelect) getAdminTenants().then(setTenants).catch(() => {})
  }, [showTenantSelect])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setResult(null)
    setError(null)
  }

  const handleSubmit = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await importLeads(file, {
        tenant_id: showTenantSelect && tenantIdVal ? tenantIdVal : undefined,
        dry_run: dryRun,
      })
      setResult(res)
    } catch (err) {
      const e = err as { message?: string; status?: number }
      if (e?.status === 401 || e?.status === 403) {
        setError('Нет доступа')
      } else {
        setError(e?.message ?? 'Ошибка загрузки')
      }
    } finally {
      setLoading(false)
    }
  }, [file, dryRun, tenantIdVal, showTenantSelect])

  const preview = result?.preview ?? []
  const errorsList = result?.errors_list ?? []

  return (
    <div className="page-stack page-desktop-fullwidth">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Импорт лидов</h1>
          <p className="subtitle">CSV или JSON</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Файл</div>
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={handleFileChange}
          className="field-input"
        />
      </div>

      <div className="card">
        <label className="v2-leads-checkbox" style={{ marginBottom: 12 }}>
          <input
            type="radio"
            name="importMode"
            checked={dryRun}
            onChange={() => setDryRun(true)}
          />
          Dry run (предпросмотр)
        </label>
        <label className="v2-leads-checkbox">
          <input
            type="radio"
            name="importMode"
            checked={!dryRun}
            onChange={() => setDryRun(false)}
          />
          Commit (загрузить реально)
        </label>
      </div>

      {showTenantSelect && (
        <div className="card">
          <label className="field">
            <span className="field-label">Клиент (tenant_id)</span>
            <select
              className="field-input"
              value={tenantIdVal}
              onChange={(e) => setTenantIdVal(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="primary-button"
          disabled={!file || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Загрузка…' : 'Загрузить'}
        </button>
      </div>

      {error && (
        <div className="card">
          <div className="error-text">{error}</div>
        </div>
      )}

      {result && (
        <>
          <div className="card">
            <div className="card-title">Результат</div>
            <div className="v3-stats">
              {result.created != null && <span>Создано: {result.created}</span>}
              {result.skipped != null && <span>Пропущено: {result.skipped}</span>}
              {result.errors != null && <span>Ошибок: {result.errors}</span>}
            </div>
          </div>
          {preview.length > 0 && (
            <div className="card">
              <div className="card-title">Предпросмотр (первые 20 строк)</div>
              <div className="v3-preview-wrap">
                <table className="v2-leads-table">
                  <thead>
                    <tr>
                      {Object.keys(preview[0] ?? {}).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j}>{String(v ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {errorsList.length > 0 && (
            <div className="card">
              <div className="card-title">Ошибки (до 20)</div>
              <ul className="v3-errors-list">
                {errorsList.slice(0, 20).map((msg, i) => (
                  <li key={i} className="error-text">{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ImportPage
