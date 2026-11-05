import { useId } from 'react'

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size }}>
      <svg viewBox="0 0 40 24" width={size * 1.3} height={size * 0.8} aria-hidden>
        {/* Trayectoria de aterrizaje sobre la pista */}
        <path d="M2 3 Q 16 5 26 16" fill="none" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 21h20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      aterriza
    </span>
  )
}

/**
 * El sello de pasaporte: cada segmento es un criterio de verificación.
 * No decora, es el dato. Siempre incluye un texto equivalente.
 */
export function Seal({ met, total = 4, size = 88, stamp = false, label }: { met: number; total?: number; size?: number; stamp?: boolean; label?: string }) {
  const id = useId()
  const r = 33
  const cx = 50
  const gapDeg = 12
  const seg = 360 / total
  const arcs = Array.from({ length: total }, (_, i) => {
    const start = -90 + i * seg + gapDeg / 2
    const end = -90 + (i + 1) * seg - gapDeg / 2
    const pt = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cx + r * Math.sin((a * Math.PI) / 180)]
    const [x1, y1] = pt(start)
    const [x2, y2] = pt(end)
    return { d: `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`, on: i < met }
  })
  const full = met >= total
  // Por debajo de este tamaño la palabra sería ilegible; el texto equivalente sigue en aria-label.
  const showWord = size >= 110
  const text = label ?? (full ? 'verificada' : met >= 2 ? 'revisión parcial' : 'sin revisar')
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`seal ${full ? 'seal--full' : 'seal--part'} ${stamp ? 'seal--stamp' : ''}`}
      role="img"
      aria-label={`${text}: ${met} de ${total} revisiones`}
    >
      <circle cx="50" cy="50" r="48" className="seal__bg" />
      <circle cx="50" cy="50" r="48" className="seal__ring" />
      <circle cx="50" cy="50" r="43" className="seal__ring seal__ring--thin" />
      {showWord && <path id={`${id}-t`} d="M50 50 m-38.5 0 a38.5 38.5 0 1 1 77 0" fill="none" />}
      {arcs.map((a, i) => (
        <path key={i} d={a.d} className={a.on ? 'seal__seg is-on' : 'seal__seg'} />
      ))}
      <text className="seal__count" x="50" y="60" textAnchor="middle">
        {met}/{total}
      </text>
      {showWord && (
        <text className="seal__word">
          <textPath href={`#${id}-t`} startOffset="50%" textAnchor="middle">
            {text}
          </textPath>
        </text>
      )}
    </svg>
  )
}

/** Silueta del Cerro de la Silla: el perfil que identifica a Monterrey. */
export function Ridge() {
  return (
    <svg className="ridge" viewBox="0 0 1440 234" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <circle cx="782" cy="100" r="60" className="ridge__sun" />
      <g transform="scale(1 0.65)">
        <path
          className="ridge__far"
          d="M0 300 L120 248 L210 272 L330 210 L420 250 L500 226 L560 256 L1100 256 L1180 214 L1260 246 L1350 204 L1440 244 V360 H0Z"
        />
        <path
          className="ridge__near"
          d="M0 340 L190 300 L340 262 L450 186 L520 128 L575 90 L618 118 L660 170 L704 216 L752 240 L800 246 L846 232 L886 196 L926 138 L962 66 L1000 44 L1038 92 L1092 150 L1160 214 L1262 268 L1440 320 V360 H0Z"
        />
      </g>
    </svg>
  )
}
