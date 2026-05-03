import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { clearSession } from '#/lib/auth'
import { useAppStore } from '#/store'

export const Route = createFileRoute('/logout')({
  component: LogoutRoute,
})

function LogoutRoute() {
  const navigate = useNavigate()

  useEffect(() => {
    clearSession()
    useAppStore.getState().clearAuth()
    navigate({ to: '/login', replace: true })
  }, [navigate])

  return null
}
