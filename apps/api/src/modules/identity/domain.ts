/** Reglas puras de identidad. */

const COMMON_PASSWORDS = new Set([
  '1234567890', '12345678910', '0123456789', 'qwertyuiop', 'contraseña', 'contrasena1', 'password123', 'password1234',
  'administrator', 'monterrey123', 'tecdemonterrey', 'iloveyou123', 'aaaaaaaaaa', '1111111111', 'abcdefghij', 'qwerty12345',
])

export function passwordProblems(password: string, email: string): string[] {
  const problems: string[] = []
  const lower = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lower)) problems.push('Esa contraseña es muy común. Elige otra.')
  if (new Set(password).size < 4) problems.push('Tu contraseña repite demasiado los mismos caracteres.')
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  if (local.length >= 4 && lower.includes(local)) problems.push('Tu contraseña no debe contener tu correo.')
  return problems
}

export function isInstitutionalEmail(email: string, domains: readonly string[]): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`))
}

export type ValidationMethod = 'institutional_email' | 'manual'

/** Sin correo institucional, una persona revisa la matrícula: es el caso típico antes de llegar. */
export function validationMethodFor(email: string, emailVerified: boolean, domains: readonly string[]): ValidationMethod {
  return emailVerified && isInstitutionalEmail(email, domains) ? 'institutional_email' : 'manual'
}

export const LOGIN_MAX_FAILURES = 5
export const LOCK_MINUTES = 15
export const SESSION_DAYS = 7
export const SESSION_IDLE_HOURS = 24
export const CODE_MINUTES = 15
export const CODE_MAX_ATTEMPTS = 5
