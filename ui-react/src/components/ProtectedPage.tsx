import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { AppShell } from '#/components/AppShell'
import { readClientSession } from '#/lib/auth'
import { useBootstrapData } from '#/lib/queries'
import { useAppStore } from '#/store'

export function ProtectedPage({ children }: { children: ReactNode }) {
  const setAuth = useAppStore((state) => state.setAuth)

  useEffect(() => {
    const session = readClientSession()
    if (session) {
      setAuth(session)
    }
  }, [setAuth])

  useBootstrapData()

  return <AppShell>{children}</AppShell>
}
