import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'

import { getServerBackendOrigin } from '#/lib/ports'
import type { Session } from '#/lib/types'
import { parseCookie } from '#/lib/auth'

export function sanitizeRedirect(url: unknown) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return '/'
  }

  return url
}

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const cookieHeader = getRequestHeader('cookie')
  const token = parseCookie(cookieHeader, 'token')

  if (!token) {
    return null satisfies Session
  }

  const res = await fetch(`${getServerBackendOrigin()}/ocrux/isTokenActive/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    return null satisfies Session
  }

  const active = await res.text()
  if (!String(active).includes('true')) {
    return null satisfies Session
  }

  return {
    token,
    username: parseCookie(cookieHeader, 'username'),
    userID: parseCookie(cookieHeader, 'userID'),
    role: parseCookie(cookieHeader, 'role'),
  } satisfies Session
})

export async function requireSession(redirectTo: string) {
  const session = await getSession()

  if (!session) {
    throw redirect({
      to: '/login',
      search: { redirect: sanitizeRedirect(redirectTo) },
    })
  }

  return session
}
