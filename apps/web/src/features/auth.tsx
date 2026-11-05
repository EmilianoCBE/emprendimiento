import './auth.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { CodeSentResponse, Me, Zone } from '@aterriza/contracts'
import { Button, ErrorNote, LinkButton, Note, Page, Select, TextArea, TextInput, Toggle } from '../design/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/session'

/** Solo rutas internas: evita redirecciones abiertas (`?volver=https://sitio-falso`). */
function safeReturn(value: string | null): string {
  return value && /^\/(?!\/)/.test(value) && !value.includes('\\') ? value : '/'
}
const homeFor = (me: Me) => (me.role === 'landlord' ? '/mis-viviendas' : me.role === 'admin' ? '/admin' : me.role === 'mentor' ? '/mensajes' : '/viviendas')

const DEMO_ACCOUNTS = [
  ['lucia', 'Estudiante internacional'],
  ['diego', 'Mentor'],
  ['marcela', 'Arrendadora'],
  ['admin', 'Administración'],
] as const

export function LoginPage() {
  const { setMe, config, me } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const back = params.get('volver')
  const after = (m: Me) => navigate(back ? safeReturn(back) : homeFor(m), { replace: true })
  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => api.post<Me>('/auth/login', body),
    onSuccess: (m) => {
      setMe(m)
      after(m)
    },
  })
  useEffect(() => {
    if (me && !login.isPending) navigate(homeFor(me), { replace: true })
    // Solo al entrar a la pantalla con sesión activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const needsVerification = (login.error as { code?: string } | null)?.code === 'email_not_verified'
  return (
    <div className="authwrap">
      <h1>Entrar</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate({ email, password })
        }}
      >
        <TextInput label="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextInput label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorNote error={login.error} />
        {needsVerification && <LinkButton to={`/confirmar?correo=${encodeURIComponent(email)}`} variant="secondary">Confirmar mi correo</LinkButton>}
        <Button type="submit" busy={login.isPending}>{login.isPending ? 'Entrando…' : 'Entrar'}</Button>
        <p className="small">
          <Link to="/recuperar">Olvidé mi contraseña</Link>. ¿Sin cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </form>
      {config?.demoMode && (
        <section className="stack stack--tight mt-8">
          <h2>Cuentas de demostración</h2>
          <div className="demoaccounts">
            {DEMO_ACCOUNTS.map(([name, role]) => (
              <button key={name} type="button" onClick={() => login.mutate({ email: `${name}@demo.aterriza.mx`, password: config.demoPassword ?? '' })}>
                <b>{role}</b>
                <span className="muted small">{name}@demo.aterriza.mx</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const ROLES = [
  ['student', 'Voy a mudarme para estudiar', 'Busca vivienda, habla con mentores y planea tu llegada.'],
  ['mentor', 'Quiero orientar a quien llega', 'Comparte lo que aprendiste con estudiantes de tu universidad.'],
  ['landlord', 'Rento una vivienda', 'Publica para estudiantes después de una revisión.'],
] as const

export function RegisterPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<(typeof ROLES)[number][0]>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [homeCountry, setCountry] = useState('')
  const [accept, setAccept] = useState(false)
  const register = useMutation({
    mutationFn: () => api.post<CodeSentResponse>('/auth/register', { role, fullName, email, password, homeCountry: homeCountry || undefined }),
    onSuccess: (res) => navigate(`/confirmar?correo=${encodeURIComponent(email)}`, { state: { devCode: res.devCode } }),
  })
  return (
    <div className="authwrap">
      <h1>Crear cuenta</h1>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          register.mutate()
        }}
      >
        <fieldset className="rolepick">
          <legend className="rolepick__legend">¿Para qué vas a usar Aterriza?</legend>
          {ROLES.map(([value, title, detail]) => (
            <label key={value}>
              <input type="radio" name="role" checked={role === value} onChange={() => setRole(value)} />
              <span><b>{title}</b><span className="small muted">{detail}</span></span>
            </label>
          ))}
        </fieldset>
        <TextInput label="Nombre completo" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} />
        <TextInput label="Correo" type="email" autoComplete="email" hint={role === 'student' ? 'Con tu correo institucional, tu validación es automática.' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextInput label="Contraseña" type="password" autoComplete="new-password" hint="Al menos 10 caracteres. Una frase es fácil de recordar y difícil de adivinar." value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} maxLength={128} />
        {role !== 'landlord' && <TextInput label="País de origen (opcional)" autoComplete="country-name" value={homeCountry} onChange={(e) => setCountry(e.target.value)} maxLength={60} />}
        <Toggle checked={accept} onChange={(e) => setAccept(e.target.checked)} label={<>Acepto los <Link to="/terminos">términos</Link> y el <Link to="/privacidad">aviso de privacidad</Link>.</>} />
        <ErrorNote error={register.error} />
        <Button type="submit" busy={register.isPending} disabled={!accept}>{register.isPending ? 'Creando…' : 'Crear cuenta'}</Button>
        <p className="small">¿Ya tienes cuenta? <Link to="/entrar">Entrar</Link></p>
      </form>
    </div>
  )
}

export function VerifyPage() {
  const { setMe } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const email = params.get('correo') ?? ''
  const [devCode, setDevCode] = useState<string | undefined>((location.state as { devCode?: string } | null)?.devCode)
  const [code, setCode] = useState('')
  const verify = useMutation({
    mutationFn: () => api.post<Me>('/auth/verify-email', { email, code }),
    onSuccess: (m) => {
      setMe(m)
      navigate(m.role === 'student' ? '/cuenta' : m.role === 'mentor' ? '/cuenta' : homeFor(m), { replace: true })
    },
  })
  const resend = useMutation({ mutationFn: () => api.post<CodeSentResponse>('/auth/resend-code', { email }), onSuccess: (r) => setDevCode(r.devCode) })
  return (
    <div className="authwrap">
      <h1>Confirma tu correo</h1>
      <div className="stack">
        <p>Si {email || 'tu correo'} no tenía una cuenta confirmada, te enviamos un código de 6 dígitos. Caduca en 15 minutos.</p>
        {devCode && <Note tone="warning" title="Modo demostración">No se envían correos. Tu código es <b>{devCode}</b>.</Note>}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            verify.mutate()
          }}
        >
          <TextInput label="Código" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
          <ErrorNote error={verify.error ?? resend.error} />
          <Button type="submit" busy={verify.isPending}>Confirmar correo</Button>
          <Button type="button" variant="quiet" onClick={() => resend.mutate()} busy={resend.isPending}>Enviar otro código</Button>
        </form>
      </div>
    </div>
  )
}

export function ForgotPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [devCode, setDevCode] = useState<string>()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const forgot = useMutation({
    mutationFn: () => api.post<CodeSentResponse>('/auth/forgot-password', { email }),
    onSuccess: (r) => {
      setSent(true)
      setDevCode(r.devCode)
    },
  })
  const reset = useMutation({ mutationFn: () => api.post('/auth/reset-password', { email, code, password }), onSuccess: () => navigate('/entrar', { replace: true }) })
  return (
    <div className="authwrap">
      <h1>Recupera tu acceso</h1>
      {!sent ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            forgot.mutate()
          }}
        >
          <TextInput label="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <ErrorNote error={forgot.error} />
          <Button type="submit" busy={forgot.isPending}>Enviar código</Button>
        </form>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            reset.mutate()
          }}
        >
          <p>Si hay una cuenta con ese correo, te enviamos un código.</p>
          {devCode && <Note tone="warning" title="Modo demostración">Tu código es <b>{devCode}</b>.</Note>}
          <TextInput label="Código" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
          <TextInput label="Contraseña nueva" type="password" autoComplete="new-password" hint="Al menos 10 caracteres." value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
          <ErrorNote error={reset.error} />
          <Button type="submit" busy={reset.isPending}>Cambiar contraseña</Button>
        </form>
      )}
    </div>
  )
}

function StudentValidation({ me }: { me: Me }) {
  const { setMe } = useSession()
  const client = useQueryClient()
  const { config } = useSession()
  const [matricula, setMatricula] = useState('')
  const submit = useMutation({
    mutationFn: () => api.post<Me>('/me/student-verification', { matricula }),
    onSuccess: (m) => {
      client.setQueryData(['me'], m)
      void setMe
    },
  })
  const domains = config?.institutionalDomains.map((d) => `@${d}`).join(' o ') ?? ''
  if (me.studentStatus === 'verified') return <Note tone="ok" title={`Matrícula validada: ${me.matricula}`}>Ya puedes solicitar viviendas y hablar con mentores.</Note>
  if (me.studentStatus === 'pending') return <Note tone="warning" title="Tu matrícula está en revisión">Una persona la revisará y te avisaremos. Mientras tanto puedes explorar todo.</Note>
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        submit.mutate()
      }}
    >
      {me.studentStatus === 'rejected' && <Note tone="danger" title="No pudimos validar tu matrícula">Revísala y vuelve a enviarla.</Note>}
      <p>Valida tu matrícula para solicitar viviendas y hablar con mentores. Con un correo {domains} es inmediato; con otro correo, una persona la revisa.</p>
      <TextInput label="Matrícula" placeholder="A01234567" value={matricula} onChange={(e) => setMatricula(e.target.value)} required maxLength={9} />
      <ErrorNote error={submit.error} />
      <div><Button type="submit" busy={submit.isPending}>Validar matrícula</Button></div>
    </form>
  )
}

interface MentorProfileRow { kind: 'local' | 'ex_exchange'; university: string; headline: string; bio: string; languages: string[]; topics: string[]; zone_id: string | null; status: string; accepting: boolean }

function MentorProfile() {
  const client = useQueryClient()
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') })
  const profile = useQuery({ queryKey: ['mentor-profile'], queryFn: () => api.get<MentorProfileRow | null>('/me/mentor-profile') })
  const [f, setF] = useState({ kind: 'local', university: 'Tec de Monterrey, Campus Monterrey', headline: '', bio: '', languages: 'Español', topics: 'Vivienda, Transporte', zoneId: '', accepting: true })
  useEffect(() => {
    const p = profile.data
    if (p) setF({ kind: p.kind, university: p.university, headline: p.headline, bio: p.bio, languages: p.languages.join(', '), topics: p.topics.join(', '), zoneId: p.zone_id ?? '', accepting: p.accepting })
  }, [profile.data])
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const save = useMutation({
    mutationFn: () => api.put('/me/mentor-profile', { ...f, languages: list(f.languages), topics: list(f.topics), zoneId: f.zoneId || null }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['mentor-profile'] }),
  })
  const status = profile.data?.status
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      {status === 'approved' && <Note tone="ok" title="Tu perfil es público">Si cambias tu presentación, volverá a revisión.</Note>}
      {status === 'pending' && <Note tone="warning" title="Tu perfil está en revisión">Te avisaremos cuando se publique.</Note>}
      {status === 'rejected' && <Note tone="danger" title="Tu perfil no se aprobó">Revísalo y vuelve a guardarlo.</Note>}
      <Select label="Tu experiencia" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
        <option value="local">Soy estudiante local</option>
        <option value="ex_exchange">Ya viví el cambio de ciudad o país</option>
      </Select>
      <TextInput label="Universidad" value={f.university} onChange={(e) => setF({ ...f, university: e.target.value })} required />
      <Select label="Zona que conoces" value={f.zoneId} onChange={(e) => setF({ ...f, zoneId: e.target.value })}>
        <option value="">Ninguna en particular</option>
        {zones.data?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
      </Select>
      <TextInput label="Presentación breve" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} required minLength={10} maxLength={120} />
      <TextArea label="Sobre ti" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} required minLength={30} maxLength={1000} />
      <TextInput label="Idiomas" hint="Separados por comas." value={f.languages} onChange={(e) => setF({ ...f, languages: e.target.value })} required />
      <TextInput label="Temas en los que ayudas" hint="Separados por comas." value={f.topics} onChange={(e) => setF({ ...f, topics: e.target.value })} required />
      <Toggle label="Estoy recibiendo solicitudes" checked={f.accepting} onChange={(e) => setF({ ...f, accepting: e.target.checked })} />
      <ErrorNote error={save.error} />
      <div><Button type="submit" busy={save.isPending}>Guardar perfil</Button></div>
    </form>
  )
}

export function AccountPage() {
  const { me, setMe } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      setMe(null)
      navigate('/')
    },
  })
  const logoutAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSuccess: () => {
      setMe(null)
      navigate('/')
    },
  })
  const remove = useMutation({
    mutationFn: () => api.del('/me', { password }),
    onSuccess: () => {
      setMe(null)
      navigate('/')
    },
  })
  if (!me) return null
  return (
    <Page narrow title={me.fullName} lead={me.email}>
      <div className="stack stack--lg">
        {me.role === 'student' && <section className="panel stack"><h2>Validación de estudiante</h2><StudentValidation me={me} /></section>}
        {me.role === 'student' && (
          <section className="panel stack">
            <h2>Planea tu llegada</h2>
            <div className="btnrow">
              <LinkButton to="/checklist" variant="secondary">Mi checklist</LinkButton>
              <LinkButton to="/presupuesto" variant="secondary">Calculadora de presupuesto</LinkButton>
              <LinkButton to="/guias" variant="secondary">Guías</LinkButton>
            </div>
          </section>
        )}
        {me.role === 'mentor' && <section className="panel stack"><h2>Tu perfil de mentor</h2><MentorProfile /></section>}
        <section className="panel stack">
          <h2>Tu cuenta y tus datos</h2>
          <div className="btnrow">
            <Button variant="secondary" busy={logout.isPending} onClick={() => logout.mutate()}>Cerrar sesión</Button>
            <a className="btn btn--secondary" href="/api/v1/me/export" download>Descargar mis datos</a>
            <Button variant="secondary" busy={logoutAll.isPending} onClick={() => logoutAll.mutate()}>Cerrar sesión en todos mis dispositivos</Button>
          </div>
          <ErrorNote error={logoutAll.error} />
          {!confirmDelete ? (
            <div><Button variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar mi cuenta</Button></div>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                remove.mutate()
              }}
            >
              <Note tone="danger" title="No se puede deshacer">Borramos tus datos personales y cerramos tu sesión. Tus reseñas quedan sin tu nombre.</Note>
              <TextInput label="Confirma con tu contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <ErrorNote error={remove.error} />
              <div className="btnrow">
                <Button type="submit" variant="danger" busy={remove.isPending}>Eliminar definitivamente</Button>
                <Button type="button" variant="quiet" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </Page>
  )
}
