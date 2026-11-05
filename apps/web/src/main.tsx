import '@fontsource-variable/big-shoulders-display'
import '@fontsource-variable/source-sans-3'
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

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
