import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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
    <div className="page-stack">
      <div className="page-header">
        <div className="page-header__text">
          <h1 className="title">Диагностика</h1>
          <p className="subtitle">Проверка таблиц, smoke test, AI prompt, mute</p>
        </div>
        <div className="action-card">
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/admin/tenants')}
          >
            Клиенты
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/admin/users')}
          >
            Пользователи
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Запустить проверку таблиц</div>
        <p className="info-text" style={{ marginBottom: 12 }}>
          GET /api/admin/diagnostics/db
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={dbLoading || loading !== null}
          onClick={runDb}
        >
          {dbLoading ? 'Запрос…' : 'Проверить таблицы'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Smoke test</div>
        <p className="info-text" style={{ marginBottom: 12 }}>
          POST /api/admin/diagnostics/smoke-test
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={smokeLoading || loading !== null}
          onClick={runSmoke}
        >
          {smokeLoading ? 'Запрос…' : 'Smoke test'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">Проверить AI prompt tenant</div>
        <p className="info-text" style={{ marginBottom: 12 }}>
          Tenant + сообщение для проверки ответа AI
        </p>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Клиент (tenant)</span>
            <select
              className="field-input"
              value={aiTenantId}
              onChange={(e) => setAiTenantId(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Сообщение (message)</span>
            <input
              className="field-input"
              type="text"
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              placeholder="Текст для проверки ответа"
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!aiTenantId || aiLoading || loading !== null}
            onClick={runCheckAi}
          >
            {aiLoading ? 'Запрос…' : 'Проверить'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Проверить mute</div>
        <p className="info-text" style={{ marginBottom: 12 }}>
          Tenant + chat_key для проверки статуса mute
        </p>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Клиент (tenant)</span>
            <select
              className="field-input"
              value={muteTenantId}
              onChange={(e) => setMuteTenantId(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Chat key</span>
            <input
              className="field-input"
              type="text"
              value={muteChatKey}
              onChange={(e) => setMuteChatKey(e.target.value)}
              placeholder="Ключ чата"
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!muteTenantId || muteLoading || loading !== null}
            onClick={runCheckMute}
          >
            {muteLoading ? 'Запрос…' : 'Проверить'}
          </button>
        </div>
      </div>

      {output && (
        <div className={`card admin-diagnostics-output admin-diagnostics-output--${output.type}`}>
          <div className="card-title">
            {output.type === 'ok' ? 'Ответ' : 'Ошибка'}
          </div>
          <pre className="admin-diagnostics-json">
            {formatJson(output.data)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default AdminDiagnostics
