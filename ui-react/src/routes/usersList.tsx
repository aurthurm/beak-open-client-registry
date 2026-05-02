import { createFileRoute, redirect } from '@tanstack/react-router'

import { ProtectedPage } from '#/components/ProtectedPage'
import { UsersListPage } from '#/components/UsersListPage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/usersList')({
  beforeLoad: async () => {
    const session = await requireSession('/usersList')
    if (session.role === 'deduplication') {
      throw redirect({ to: '/' })
    }
  },
  component: UsersListRoute,
})

function UsersListRoute() {
  return (
    <ProtectedPage>
      <UsersListPage />
    </ProtectedPage>
  )
}
