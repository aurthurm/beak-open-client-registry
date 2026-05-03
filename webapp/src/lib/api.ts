import { readClientSession } from '#/lib/auth'
import { getBrowserBackendOrigin, getServerBackendOrigin } from '#/lib/ports'
import { useAppStore } from '#/store'
import type { AuthState } from '#/lib/types'

type RequestOptions = RequestInit & {
  auth?: Partial<AuthState>
}

function apiBaseUrl() {
  if (typeof window === 'undefined') {
    return getServerBackendOrigin()
  }
  return getBrowserBackendOrigin()
}

function tokenFromState(auth?: Partial<AuthState>) {
  if (auth?.token) {
    return auth.token
  }

  const token = useAppStore.getState().auth.token
  if (token) {
    return token
  }

  if (typeof window !== 'undefined') {
    return readClientSession()?.token || ''
  }

  return ''
}

export async function apiFetch(path: string, options: RequestOptions = {}) {
  const token = tokenFromState(options.auth)
  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

  if (!response.ok) {
    const text = await response.text()
    const error = new Error(text || response.statusText)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export async function getJson<T>(path: string) {
  return apiFetch(path) as Promise<T>
}

export async function postJson<T>(path: string, body?: unknown) {
  return apiFetch(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<T>
}

export async function postForm<T>(path: string, formData: FormData) {
  return apiFetch(path, {
    method: 'POST',
    body: formData,
  }) as Promise<T>
}
