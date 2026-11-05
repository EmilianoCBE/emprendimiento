import { Bell, BookOpenText, Buildings, Calculator, ChatsCircle, House, SignOut, UserCircle } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Component, Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { AppNotification, Role } from '@aterriza/contracts'
import { Logo } from '../design/brand'
import { Button, Loading, Empty, LinkButton } from '../design/ui'
import { api } from '../lib/api'
import { useLiveEvents, useSession } from '../lib/session'
import { LandingPage } from '../features/landing'

const lazyNamed = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })))

const search = () => import('../features/listings')
const SearchPage = lazyNamed(search, 'SearchPage')
const ListingPage = lazyNamed(search, 'ListingPage')
const auth = () => import('../features/auth')
const LoginPage = lazyNamed(auth, 'LoginPage')
const RegisterPage = lazyNamed(auth, 'RegisterPage')
const VerifyPage = lazyNamed(auth, 'VerifyPage')
const ForgotPage = lazyNamed(auth, 'ForgotPage')
const AccountPage = lazyNamed(auth, 'AccountPage')
const comm = () => import('../features/community')
const MentorsPage = lazyNamed(comm, 'MentorsPage')
const MessagesPage = lazyNamed(comm, 'MessagesPage')
const plan = () => import('../features/planning')
const BudgetPage = lazyNamed(plan, 'BudgetPage')
const GuidesPage = lazyNamed(plan, 'GuidesPage')
const GuidePage = lazyNamed(plan, 'GuidePage')
const ChecklistPage = lazyNamed(plan, 'ChecklistPage')
const book = () => import('../features/bookings')
const BookingsPage = lazyNamed(book, 'BookingsPage')
const BookingPage = lazyNamed(book, 'BookingPage')
const land = () => import('../features/landlord')
const MyListingsPage = lazyNamed(land, 'MyListingsPage')
const ListingEditPage = lazyNamed(land, 'ListingEditPage')
const adm = () => import('../features/admin')
const AdminPage = lazyNamed(adm, 'AdminPage')
const legal = () => import('../features/legal')
const PrivacyPage = lazyNamed(legal, 'PrivacyPage')
const TermsPage = lazyNamed(legal, 'TermsPage')
const HelpPage = lazyNamed(legal, 'HelpPage')

/** Una falla inesperada en una pantalla nunca debe dejar la página en blanco. */
class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page page--narrow">
        <Empty title="Esta pantalla no se pudo mostrar">
          <p className="muted" style={{ marginBottom: 12 }}>Vuelve a cargarla. Si sigue igual, regresa al inicio.</p>
          <LinkButton to="/" variant="secondary">Ir al inicio</LinkButton>
        </Empty>
      </div>
    )
  }
}

/** Mejora de experiencia. La seguridad real se aplica en el servidor. */
function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { me, loading } = useSession()
  const location = useLocation()
  if (loading) return <Loading />
  if (!me) return <Navigate to={`/entrar?volver=${encodeURIComponent(location.pathname)}`} replace />
  if (roles && !roles.includes(me.role)) {
    return (
      <div className="page page--narrow">
        <Empty title="Esta sección es para otro tipo de cuenta">
          <LinkButton to="/" variant="secondary">
            Ir al inicio
          </LinkButton>
        </Empty>
      </div>
    )
  }
  return <>{children}</>
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const client = useQueryClient()
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: AppNotification[]; unread: number }>('/notifications') })
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const location = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])
  return (
    <>
      <button className="iconbtn" aria-label={`Notificaciones${data?.unread ? `: ${data.unread} sin leer` : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Bell size={24} />
        {data && data.unread > 0 && <span className="badge">{data.unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover__head">
            <b>Notificaciones</b>
            {data && data.unread > 0 && (
              <Button variant="quiet" onClick={() => readAll.mutate()}>
                Marcar como leídas
              </Button>
            )}
          </div>
          <div className="popover__list">
            {data?.items.length === 0 && <p className="muted" style={{ padding: 16 }}>Aquí verás lo que te toca hacer.</p>}
            {data?.items.map((n) => {
              const body = (
                <>
                  <p className="notif__title">{n.title}</p>
                  <p className="notif__body">{n.body}</p>
                </>
              )
              return n.link ? (
                <Link key={n.id} to={n.link} className={`notif ${n.readAt ? '' : 'is-unread'}`}>
                  {body}
                </Link>
              ) : (
                <div key={n.id} className={`notif ${n.readAt ? '' : 'is-unread'}`}>
                  {body}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function navFor(role: Role | undefined) {
  if (role === 'landlord') {
    return [
      { to: '/mis-viviendas', label: 'Mis viviendas', Icon: Buildings },
      { to: '/solicitudes', label: 'Solicitudes', Icon: House },
      { to: '/mensajes', label: 'Mensajes', Icon: ChatsCircle },
      { to: '/guias', label: 'Guías', Icon: BookOpenText },
    ]
  }
  if (role === 'admin') {
    return [
      { to: '/admin', label: 'Operación', Icon: Buildings },
      { to: '/viviendas', label: 'Viviendas', Icon: House },
      { to: '/mentores', label: 'Mentores', Icon: ChatsCircle },
      { to: '/guias', label: 'Guías', Icon: BookOpenText },
    ]
  }
  if (role === 'mentor') {
    return [
      { to: '/mensajes', label: 'Mensajes', Icon: ChatsCircle },
      { to: '/mentores', label: 'Mentores', Icon: UserCircle },
      { to: '/viviendas', label: 'Viviendas', Icon: House },
      { to: '/guias', label: 'Guías', Icon: BookOpenText },
    ]
  }
  return [
    { to: '/viviendas', label: 'Viviendas', Icon: House },
    { to: '/mentores', label: 'Mentores', Icon: ChatsCircle },
    { to: '/presupuesto', label: 'Presupuesto', Icon: Calculator },
    { to: '/guias', label: 'Guías', Icon: BookOpenText },
  ]
}

function Shell({ children }: { children: ReactNode }) {
  const { me, config, setMe } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  useLiveEvents()
  useEffect(() => {
    // Chrome ya devuelve una promesa aquí; un efecto no debe devolverla.
    window.scrollTo(0, 0)
  }, [location.pathname])
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      setMe(null)
      navigate('/')
    },
  })
  const items = navFor(me?.role)
  const tabItems = [...items, me ? { to: '/cuenta', label: 'Cuenta', Icon: UserCircle } : { to: '/entrar', label: 'Entrar', Icon: UserCircle }]
  return (
    <>
      <a href="#contenido" className="skip">
        Saltar al contenido
      </a>
      {config?.demoMode && <div className="demobar">Demostración: las viviendas, personas y precios son ficticios.</div>}
      <header className="topbar">
        <div className="topbar__in">
          <Link to="/" className="topbar__brand" aria-label="Aterriza, ir al inicio">
            <Logo />
          </Link>
          <nav className="nav" aria-label="Principal">
            {items.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
            {me?.role === 'student' && <NavLink to="/solicitudes">Solicitudes</NavLink>}
            {me?.role === 'student' && <NavLink to="/mensajes">Mensajes</NavLink>}
          </nav>
          <div className="topbar__end">
            {me ? (
              <>
                <Notifications />
                <Link to="/cuenta" className="iconbtn" aria-label="Mi cuenta">
                  <UserCircle size={26} />
                </Link>
                <button className="iconbtn" aria-label="Cerrar sesión" onClick={() => logout.mutate()}>
                  <SignOut size={24} />
                </button>
              </>
            ) : (
              <>
                <Link to="/entrar" className="btn btn--quiet topbar__login" style={{ color: 'inherit' }}>
                  Entrar
                </Link>
                <LinkButton to="/registro">Crear cuenta</LinkButton>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="contenido">
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<div className="page"><Loading /></div>}>{children}</Suspense>
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <div className="footer__in">
          <div>
            <Logo size={26} />
            <p>
              Proyecto estudiantil independiente. No está afiliado ni respaldado por el Tecnológico de Monterrey. Aterriza no procesa pagos: nunca
              transfieras dinero sin ver el lugar y sin un contrato firmado.
            </p>
          </div>
          <div className="footer__links">
            <Link to="/ayuda">Ayuda</Link>
            <Link to="/guias/como-reconocer-una-estafa">Reconocer una estafa</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/terminos">Términos</Link>
          </div>
        </div>
      </footer>
      <nav className="tabbar" aria-label="Principal, móvil">
        {tabItems.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to}>
            <Icon size={23} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/viviendas" element={<SearchPage />} />
        <Route path="/viviendas/:id" element={<ListingPage />} />
        <Route path="/mentores" element={<MentorsPage />} />
        <Route path="/presupuesto" element={<BudgetPage />} />
        <Route path="/guias" element={<GuidesPage />} />
        <Route path="/guias/:slug" element={<GuidePage />} />
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/confirmar" element={<VerifyPage />} />
        <Route path="/recuperar" element={<ForgotPage />} />
        <Route path="/ayuda" element={<HelpPage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/checklist" element={<RequireRole><ChecklistPage /></RequireRole>} />
        <Route path="/cuenta" element={<RequireRole><AccountPage /></RequireRole>} />
        <Route path="/mensajes" element={<RequireRole><MessagesPage /></RequireRole>} />
        <Route path="/mensajes/:id" element={<RequireRole><MessagesPage /></RequireRole>} />
        <Route path="/solicitudes" element={<RequireRole><BookingsPage /></RequireRole>} />
        <Route path="/solicitudes/:id" element={<RequireRole><BookingPage /></RequireRole>} />
        <Route path="/mis-viviendas" element={<RequireRole roles={['landlord']}><MyListingsPage /></RequireRole>} />
        <Route path="/mis-viviendas/nueva" element={<RequireRole roles={['landlord']}><ListingEditPage /></RequireRole>} />
        <Route path="/mis-viviendas/:id" element={<RequireRole roles={['landlord']}><ListingEditPage /></RequireRole>} />
        <Route path="/admin/*" element={<RequireRole roles={['admin']}><AdminPage /></RequireRole>} />
        <Route
          path="*"
          element={
            <div className="page page--narrow">
              <Empty title="No encontramos esta página">
                <LinkButton to="/viviendas" variant="secondary">
                  Ver viviendas
                </LinkButton>
              </Empty>
            </div>
          }
        />
      </Routes>
    </Shell>
  )
}
