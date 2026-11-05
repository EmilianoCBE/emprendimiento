import './shell.css'
import { Bell, BookOpenText, Buildings, Calculator, ChatsCircle, ClipboardText, Gauge, House, type Icon, UserCircle, UsersThree } from '@phosphor-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Component, Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
          <p className="empty__body">Vuelve a cargarla. Si sigue igual, regresa al inicio.</p>
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
            {data?.items.length === 0 && <p className="popover__empty">Aquí verás lo que te toca hacer.</p>}
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

interface NavItem {
  to: string
  label: string
  Icon: Icon
}

const VIVIENDAS: NavItem = { to: '/viviendas', label: 'Viviendas', Icon: House }
const MENTORES: NavItem = { to: '/mentores', label: 'Mentores', Icon: UsersThree }
const PRESUPUESTO: NavItem = { to: '/presupuesto', label: 'Presupuesto', Icon: Calculator }
const GUIAS: NavItem = { to: '/guias', label: 'Guías', Icon: BookOpenText }
const MENSAJES: NavItem = { to: '/mensajes', label: 'Mensajes', Icon: ChatsCircle }
const SOLICITUDES: NavItem = { to: '/solicitudes', label: 'Solicitudes', Icon: ClipboardText }
const MIS_VIVIENDAS: NavItem = { to: '/mis-viviendas', label: 'Mis viviendas', Icon: Buildings }
const ADMIN: NavItem = { to: '/admin', label: 'Administración', Icon: Gauge }
const CUENTA: NavItem = { to: '/cuenta', label: 'Cuenta', Icon: UserCircle }
const ENTRAR: NavItem = { to: '/entrar', label: 'Entrar', Icon: UserCircle }

/** Escritorio: todo a la vista. Móvil: cinco pestañas con lo más usado; lo demás, desde Cuenta. */
function navFor(role: Role | undefined): { desktop: NavItem[]; tabs: NavItem[] } {
  switch (role) {
    case 'student':
      return { desktop: [VIVIENDAS, MENTORES, PRESUPUESTO, GUIAS, SOLICITUDES, MENSAJES], tabs: [VIVIENDAS, MENTORES, MENSAJES, SOLICITUDES, CUENTA] }
    case 'landlord':
      return { desktop: [MIS_VIVIENDAS, SOLICITUDES, MENSAJES, GUIAS], tabs: [MIS_VIVIENDAS, SOLICITUDES, MENSAJES, GUIAS, CUENTA] }
    case 'mentor':
      return { desktop: [MENSAJES, MENTORES, VIVIENDAS, GUIAS], tabs: [MENSAJES, MENTORES, VIVIENDAS, GUIAS, CUENTA] }
    case 'admin':
      return { desktop: [ADMIN, VIVIENDAS, MENTORES, GUIAS], tabs: [ADMIN, VIVIENDAS, MENTORES, GUIAS, CUENTA] }
    default:
      return { desktop: [VIVIENDAS, MENTORES, PRESUPUESTO, GUIAS], tabs: [VIVIENDAS, MENTORES, PRESUPUESTO, GUIAS, ENTRAR] }
  }
}

/** Pantallas de trabajo: llevan un pie discreto en vez del pie de la portada. */
const WORK_AREAS = ['/mensajes', '/solicitudes', '/mis-viviendas', '/admin', '/cuenta', '/checklist']

function Shell({ children }: { children: ReactNode }) {
  const { me, config } = useSession()
  const location = useLocation()
  useLiveEvents()
  useEffect(() => {
    // Chrome ya devuelve una promesa aquí; un efecto no debe devolverla.
    window.scrollTo(0, 0)
  }, [location.pathname])
  const { desktop, tabs } = navFor(me?.role)
  const slimFooter = WORK_AREAS.some((area) => location.pathname.startsWith(area))
  return (
    <>
      <a href="#contenido" className="skip">
        Saltar al contenido
      </a>
      {config?.demoMode && <div className="demobar">Demostración: viviendas, personas y precios ficticios.</div>}
      <header className="topbar">
        <div className="topbar__in">
          <Link to="/" className="topbar__brand" aria-label="Aterriza, ir al inicio">
            <Logo />
          </Link>
          <nav className="nav" aria-label="Principal">
            {desktop.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar__end">
            {me ? (
              <>
                <Notifications />
                <Link to="/cuenta" className="iconbtn" aria-label="Mi cuenta">
                  <UserCircle size={26} />
                </Link>
              </>
            ) : (
              <>
                <Link to="/entrar" className="btn btn--quiet topbar__login">
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
      {slimFooter ? (
        <footer className="footer footer--slim">
          <div className="footer__in">
            <p>Proyecto estudiantil independiente. Aterriza no procesa pagos.</p>
            <div className="footer__links">
              <Link to="/ayuda">Ayuda</Link>
              <Link to="/privacidad">Privacidad</Link>
              <Link to="/terminos">Términos</Link>
            </div>
          </div>
        </footer>
      ) : (
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
      )}
      <nav className="tabbar" aria-label="Principal, móvil">
        {tabs.map(({ to, label, Icon: TabIcon }) => (
          <NavLink key={to} to={to}>
            <TabIcon size={24} aria-hidden />
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
              <Empty as="h1" title="No encontramos esta página">
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
