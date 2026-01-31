import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthProvider'
import { LeadsProvider } from './context/LeadsProvider'
import { BASE_URL } from './config/appConfig'

if (import.meta.env.DEV) {
  console.log('[BuildCRM] API BASE_URL:', BASE_URL)
}

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LeadsProvider>
          <App />
        </LeadsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
