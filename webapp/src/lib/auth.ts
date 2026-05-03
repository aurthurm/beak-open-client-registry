import Cookies from 'js-cookie'
import { getServerBackendOrigin } from '#/lib/ports'
import type { AuthState, Session } from '#/lib/types'

const COOKIE_KEYS = ['token', 'username', 'userID', 'role'] as const

export function parseCookie(header: string | undefined, key: string) {
  if (!header) return ''
  const match = header.match(new RegExp(`(?:^|; )${key}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export function readClientSession(): Session {
  const token = Cookies.get('token') || ''
  if (!token) return null

  return {
    token,
    username: Cookies.get('username') || '',
    userID: Cookies.get('userID') || '',
    role: Cookies.get('role') || '',
  }
}

export function saveSession(auth: AuthState) {
  Cookies.set('token', auth.token, { expires: 30 })
  Cookies.set('username', auth.username, { expires: 30 })
  Cookies.set('userID', auth.userID, { expires: 30 })
  Cookies.set('role', auth.role, { expires: 30 })
}

export function clearSession() {
  for (const key of COOKIE_KEYS) {
    Cookies.remove(key)
  }
}

export const getSessionFn = async () => {
  const token = Cookies.get('token')
  if (!token) return null

  try {
    const res = await fetch('/ocrux/isTokenActive/', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) return null

    const active = await res.text()
    if (!String(active).includes('true')) return null

    return readClientSession()
  } catch (err) {
    console.error('Failed to fetch session', err)
    return null
  }
}
