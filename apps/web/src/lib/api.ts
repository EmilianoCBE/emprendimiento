import type { ApiErrorBody } from '@aterriza/contracts'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message)
  }
}

const BASE = '/api/v1'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      // El encabezado es parte de la defensa anti-CSRF del servidor.
      headers: {
        'X-Requested-With': 'aterriza',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network', 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.')
  }
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error
    throw new ApiError(res.status, err?.code ?? 'unknown', err?.message ?? 'Algo falló. Vuelve a intentar.', err?.details)
  }
  return data as T
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T,>(path: string, body: unknown = {}) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body: unknown = {}) => request<T>('PATCH', path, body),
  del: <T,>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
