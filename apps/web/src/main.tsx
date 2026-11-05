import '@fontsource-variable/overpass'
import '@fontsource-variable/atkinson-hyperlegible-next'
import 'leaflet/dist/leaflet.css'
import './design/tokens.css'
import './design/base.css'
import './design/controls.css'
import './design/brand.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { SessionProvider } from './lib/session'
import { ToastProvider } from './lib/toast'

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <SessionProvider>
        <BrowserRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
