import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import LeadListItem from '../components/LeadListItem'
import { useLeads } from '../context/LeadsContext'

const HotLeads = () => {
  const navigate = useNavigate()
  const { leads, loadLeads, isLoading, error, lastLoadedAt, pendingLeadIds } =
    useLeads()

  useEffect(() => {
    if (leads.length === 0) {
      loadLeads()
    }
  }, [leads.length, loadLeads])

  const hotLeads = useMemo(() => {
    if (lastLoadedAt === null) {
      return []
    }
    const threshold = lastLoadedAt - 24 * 60 * 60 * 1000
    return leads.filter((lead) => {
      if (lead.status !== 'new') {
        return false
      }
      const createdAt = new Date(lead.createdAt)
      if (Number.isNaN(createdAt.getTime())) {
        return false
      }
      return createdAt.getTime() < threshold
    })
  }, [leads, lastLoadedAt])

  return (
    <div className="page-stack">
      <div className="screen-header">
        <div>
          <h1 className="title">Горячие лиды</h1>
          <p className="subtitle">Лиды, которые ждут больше 24 часов</p>
        </div>
      </div>
      <div className="lead-list">
        {hotLeads.map((lead) => (
          <LeadListItem
            key={lead.id}
            lead={lead}
            pendingSync={pendingLeadIds.includes(lead.id)}
            onClick={() => navigate(`/leads/${lead.id}`)}
          />
        ))}
      </div>
      {isLoading && <div className="info-text">Загрузка лидов…</div>}
      {error && <div className="error-text">{error}</div>}
      {!isLoading && !error && hotLeads.length === 0 && (
        <div className="info-text">Горячих лидов пока нет</div>
      )}
    </div>
  )
}

export default HotLeads
