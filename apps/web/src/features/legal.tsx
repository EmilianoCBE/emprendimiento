import './planning.css'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LinkButton, Note, Page } from '../design/ui'
import { PHOTO_CREDITS } from './photo-credits'

const DRAFT = (
  <Note tone="warning" title="Borrador sin validez legal">
    Este texto es un borrador de un proyecto estudiantil. Un abogado debe revisarlo, y hay que definir a la persona responsable, antes de abrir la plataforma al público.
  </Note>
)

/** Cada pregunta tiene dirección propia (`/ayuda#sello`) para enlazarla desde donde surge la duda (heurística 10). */
const FAQ: [string, string, string][] = [
  ['cobro', '¿Aterriza cobra algo?', 'A los estudiantes, no. Tampoco procesa ni recibe pagos de renta: esos ocurren entre estudiante y arrendador, después de firmar contrato.'],
  ['sello', '¿Qué significa el sello?', 'Cada segmento es una revisión hecha por una persona: documentos de propiedad, identidad del arrendador, contrato con recibos y fotos con fecha. Reduce el riesgo, pero no sustituye que revises tu contrato.'],
  ['solicitar', '¿Por qué no puedo solicitar algunas viviendas?', 'Solo se pueden solicitar las que tienen las cuatro revisiones. Las demás se muestran con claridad sobre lo que falta.'],
  ['matricula', 'Aún no tengo correo de la universidad. ¿Puedo registrarme?', 'Sí. Regístrate con tu correo y envía tu matrícula: una persona la revisa. Mientras tanto puedes ver viviendas, guías y usar la calculadora.'],
  ['transferencia', 'Me pidieron una transferencia para apartar. ¿Qué hago?', 'No transfieras sin ver el lugar y sin contrato. Reporta la vivienda desde su ficha y pregúntale a un mentor.'],
  ['direccion', '¿Cuándo veo la dirección exacta?', 'Cuando el arrendador acepta tu solicitud. Antes solo se muestra una ubicación aproximada, para proteger a quien vive ahí.'],
  ['estados', '¿Qué significa cada estado de mi solicitud?', 'Solicitud enviada: el arrendador aún no responde. Videollamada agendada: verán el lugar en vivo. Aceptada: ya ves la dirección y pueden firmar contrato. Contrato confirmado: tú avisas que ya firmaste, y la vivienda deja de aparecer en la búsqueda. Estancia concluida: ya puedes dejar tu reseña.'],
  ['cancelar', '¿Puedo cancelar?', 'Sí, puedes cancelar tu solicitud antes de confirmar el contrato. Una vez firmado, aplica lo que diga tu contrato.'],
  ['estimaciones', '¿De dónde salen los costos estimados?', 'La renta, el depósito y lo que incluye vienen del anuncio. Luz, internet, traslados y comisiones bancarias son supuestos de trabajo del equipo, aún sin validar con recibos reales: cada uno se marca como estimado. Puedes ajustarlos a tu caso en la calculadora de presupuesto.'],
]

export function HelpPage() {
  const { hash } = useLocation()
  const target = hash.slice(1)
  useEffect(() => {
    if (!target) return
    // Después del desplazamiento al inicio que hace el shell al cambiar de pantalla.
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [target])
  return (
    <Page narrow title="Ayuda" lead="Las dudas que más se repiten. Si algo no te cuadra con una vivienda, repórtala desde su ficha.">
      <div className="faq">
        {FAQ.map(([id, q, a]) => (
          <details key={id} id={id} open={id === target || undefined}>
            <summary>{q}</summary>
            <p>{a}</p>
            {id === 'estimaciones' && <p className="mt-2"><Link to="/presupuesto">Abrir la calculadora</Link></p>}
          </details>
        ))}
      </div>
      <div className="btnrow mt-8">
        <LinkButton to="/guias/como-reconocer-una-estafa" variant="secondary">Cómo reconocer una estafa</LinkButton>
        <LinkButton to="/mentores" variant="secondary">Hablar con un mentor</LinkButton>
      </div>
      <div className="faq mt-8"><details>
        <summary>Créditos de las fotos de demostración</summary>
        <p className="small muted mt-2">No son las viviendas reales. Vienen de Wikimedia Commons; se redimensionaron y se les quitaron los metadatos.</p>
        <ul className="small mt-2">
          {PHOTO_CREDITS.map((c) => (
            <li key={c.source} className="mt-1">
              <a href={c.source} target="_blank" rel="noreferrer">{c.title}</a>, {c.author}, {c.license}
            </li>
          ))}
        </ul>
      </details></div>
    </Page>
  )
}

export function PrivacyPage() {
  return (
    <Page narrow title="Aviso de privacidad">
      <div className="prose">
        {DRAFT}
        <h2>Qué datos usamos</h2>
        <p>Nombre, correo, país de origen, matrícula y lo que publiques en la plataforma: mensajes, solicitudes, reseñas y reportes.</p>
        <h2>Para qué</h2>
        <ul>
          <li>Crear tu cuenta y confirmar que perteneces a la comunidad estudiantil.</li>
          <li>Conectarte con arrendadores y mentores.</li>
          <li>Prevenir fraudes. Los mensajes se revisan automáticamente para avisar de señales de estafa.</li>
        </ul>
        <h2>Qué no hacemos</h2>
        <ul>
          <li>No vendemos tus datos.</li>
          <li>No pedimos ni guardamos datos de pago.</li>
          <li>No mostramos tu correo a otras personas.</li>
        </ul>
        <h2>Tus derechos</h2>
        <p>Desde tu cuenta puedes descargar tus datos y eliminar tu cuenta. Para cualquier otra solicitud de acceso, rectificación, cancelación u oposición, hará falta el contacto del responsable, aún por definir.</p>
      </div>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page narrow title="Términos de uso">
      <div className="prose">
        {DRAFT}
        <h2>Qué es Aterriza</h2>
        <p>Un proyecto estudiantil que conecta a estudiantes con viviendas revisadas y con mentores. No está afiliado ni respaldado por el Tecnológico de Monterrey.</p>
        <h2>Qué significa el sello</h2>
        <p>Indica qué puntos se revisaron y cuándo. Reduce el riesgo, pero no garantiza el resultado de una renta ni sustituye tu propia revisión del contrato.</p>
        <h2>Pagos</h2>
        <p>Aterriza no procesa pagos ni actúa como depositario. Cualquier pago ocurre entre estudiante y arrendador, fuera de la plataforma.</p>
        <h2>Reglas de convivencia</h2>
        <ul>
          <li>Publica solo información real.</li>
          <li>No acoses, no suplantes a nadie y no pidas pagos sin contrato.</li>
          <li>Podemos retirar contenido y cerrar cuentas que incumplan estas reglas.</li>
        </ul>
      </div>
    </Page>
  )
}
