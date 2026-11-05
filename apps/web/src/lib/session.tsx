import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { Me, PublicConfig } from '@aterriza/contracts'
import { ApiError, api } from './api'

interface SessionValue {
  me: Me | null
  loading: boolean
  config: PublicConfig | null
  setMe(me: Me | null): void
}
const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Me>('/me')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
  })
  const configQuery = useQuery({ queryKey: ['config'], queryFn: () => api.get<PublicConfig>('/config'), staleTime: Infinity })
  const value = useMemo<SessionValue>(
    () => ({
      me: meQuery.data ?? null,
      loading: meQuery.isLoading,
      config: configQuery.data ?? null,
      setMe: (me) => {
        client.setQueryData(['me'], me)
        // Al cambiar de persona no debe quedar nada de la sesión anterior en memoria.
        client.removeQueries({ predicate: (q) => !['me', 'config', 'zones', 'guides'].includes(String(q.queryKey[0])) })
      },
    }),
    [meQuery.data, meQuery.isLoading, configQuery.data, client],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession fuera de SessionProvider')
  return value
}

/** Eventos en vivo: mensajes, notificaciones y cambios de solicitudes. */
export function useLiveEvents(): void {
  const { me } = useSession()
  const client = useQueryClient()
  const userId = me?.id
  useEffect(() => {
    if (!userId) return
    const source = new EventSource('/api/v1/events')
    const refresh = (...keys: string[]) => () => keys.forEach((k) => void client.invalidateQueries({ queryKey: [k] }))
    source.addEventListener('message', refresh('messages', 'conversations'))
    source.addEventListener('notification', refresh('notifications'))
    source.addEventListener('conversation', refresh('conversations'))
    source.addEventListener('booking', refresh('bookings', 'booking', 'my-listings'))
    return () => source.close()
  }, [userId, client])
}
