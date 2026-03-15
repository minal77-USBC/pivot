import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import App from './App.jsx'

Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 40, color: "#ff4757", fontFamily: "system-ui", fontSize: 14 }}>Something went wrong. Please refresh the page.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
