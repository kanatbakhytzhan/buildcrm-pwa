import { useCallback, useEffect, useState } from 'react'
import {
  getAdminDiagnosticsDb,
  getAdminTenants,
  postAdminDiagnosticsCheckAiPrompt,
  postAdminDiagnosticsCheckMute,
  postAdminDiagnosticsSmokeTest,
  type AdminTenant,
} from '../services/api'

function formatJson(value: unknown): string {
  if (value === undefined) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const AdminDiagnostics = () => {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [output, setOutput] = useState<{ type: 'ok' | 'error'; data: unknown } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const [dbLoading, setDbLoading] = useState(false)
  const [smokeLoading, setSmokeLoading] = useState(false)
  const [aiTenantId, setAiTenantId] = useState<string>('')
  const [aiMessage, setAiMessage] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [muteTenantId, setMuteTenantId] = useState<string>('')
  const [muteChatKey, setMuteChatKey] = useState('')
  const [muteLoading, setMuteLoading] = useState(false)

  const loadTenants = useCallback(async () => {
    try {
      const list = await getAdminTenants()
      setTenants(list)
      setAiTenantId((prev) => (prev || (list[0] ? String(list[0].id) : '')))
      setMuteTenantId((prev) => (prev || (list[0] ? String(list[0].id) : '')))
    } catch {
      setTenants([])
    }
  }, [])

  useEffect(() => {
    loadTenants()
  }, [loadTenants])

  const runDb = async () => {
    setOutput(null)
    setDbLoading(true)
    setLoading('db')
    try {
      const data = await getAdminDiagnosticsDb()
      setOutput({ type: 'ok', data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOutput({ type: 'error', data: { error: msg } })
    } finally {
      setDbLoading(false)
      setLoading(null)
    }
  }

  const runSmoke = async () => {
    setOutput(null)
    setSmokeLoading(true)
    setLoading('smoke')
    try {
      const data = await postAdminDiagnosticsSmokeTest()
      setOutput({ type: 'ok', data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOutput({ type: 'error', data: { error: msg } })
    } finally {
      setSmokeLoading(false)
      setLoading(null)
    }
  }

  const runCheckAi = async () => {
    if (!aiTenantId) return
    setOutput(null)
    setAiLoading(true)
    setLoading('ai')
    try {
      const data = await postAdminDiagnosticsCheckAiPrompt(aiTenantId, aiMessage)
      setOutput({ type: 'ok', data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOutput({ type: 'error', data: { error: msg } })
    } finally {
      setAiLoading(false)
      setLoading(null)
    }
  }

  const runCheckMute = async () => {
    if (!muteTenantId) return
    setOutput(null)
    setMuteLoading(true)
    setLoading('mute')
    try {
      const data = await postAdminDiagnosticsCheckMute(muteTenantId, muteChatKey)
      setOutput({ type: 'ok', data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setOutput({ type: 'error', data: { error: msg } })
    } finally {
      setMuteLoading(false)
      setLoading(null)
    }
  }

  return (
    <div className="admin-container">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Диагностика</h1>
          <p className="admin-page-subtitle">Проверка таблиц, smoke test, AI prompt, mute</p>
        </div>
      </div>

      <div className="admin-grid-2">
        {/* DB Check */}
        <div className="card admin-settings-block">
          <div className="card-title">1. Проверка таблиц (DB)</div>
          <p className="info-text">
            GET /api/admin/diagnostics/db
          </p>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={dbLoading || loading !== null}
            onClick={runDb}
          >
            {dbLoading ? 'Запрос…' : 'Проверить таблицы'}
          </button>
        </div>

        {/* Smoke Test */}
        <div className="card admin-settings-block">
          <div className="card-title">2. Smoke Check</div>
          <p className="info-text">
            POST /api/admin/diagnostics/smoke-test
          </p>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={smokeLoading || loading !== null}
            onClick={runSmoke}
          >
            {smokeLoading ? 'Запрос…' : 'Smoke test'}
          </button>
        </div>

        {/* AI Check */}
        <div className="card admin-settings-block">
          <div className="card-title">3. Проверить AI ответ</div>
          <div className="admin-form-grid">
            <label className="admin-label">
              Клиент (tenant)
              <select
                className="admin-input"
                value={aiTenantId}
                onChange={(e) => setAiTenantId(e.target.value)}
              >
                <option value="">— Выберите —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="admin-label">
              Сообщение
              <input
                className="admin-input"
                type="text"
                value={aiMessage}
                onChange={(e) => setAiMessage(e.target.value)}
                placeholder="Текст для проверки"
              />
            </label>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={!aiTenantId || aiLoading || loading !== null}
              onClick={runCheckAi}
            >
              {aiLoading ? 'Запрос…' : 'Проверить AI'}
            </button>
          </div>
        </div>

        {/* Mute Check */}
        <div className="card admin-settings-block">
          <div className="card-title">4. Проверить Mute</div>
          <div className="admin-form-grid">
            <label className="admin-label">
              Клиент (tenant)
              <select
                className="admin-input"
                value={muteTenantId}
                onChange={(e) => setMuteTenantId(e.target.value)}
              >
                <option value="">— Выберите —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="admin-label">
              Chat Key
              <input
                className="admin-input"
                type="text"
                value={muteChatKey}
                onChange={(e) => setMuteChatKey(e.target.value)}
                placeholder="Ключ чата"
              />
            </label>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={!muteTenantId || muteLoading || loading !== null}
              onClick={runCheckMute}
            >
              {muteLoading ? 'Запрос…' : 'Проверить Mute'}
            </button>
          </div>
        </div>
      </div>

      {output && (
        <div className={`card admin-diagnostics-output ${output.type === 'ok' ? 'ok' : 'error'}`} style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="admin-subtitle" style={{ margin: 0 }}>
              {output.type === 'ok' ? '✅ Успешно' : '❌ Ошибка'}
            </h3>
            <button
              className="admin-btn admin-btn--sm admin-btn--secondary"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(output.data, null, 2))
                alert('JSON скопирован')
              }}
            >
              📋 Copy JSON
            </button>
          </div>
          <pre className="admin-diagnostics-json" style={{
            background: '#1e293b',
            color: '#e2e8f0',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
            maxHeight: 400
          }}>
            {formatJson(output.data)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default AdminDiagnostics
