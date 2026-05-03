import { createFileRoute, redirect } from '@tanstack/react-router'

import { AddUserPage } from '#/components/AddUserPage'
import { ProtectedPage } from '#/components/ProtectedPage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/addUser')({
  beforeLoad: async () => {
    const session = await requireSession('/addUser')
    if (session.role === 'deduplication') {
      throw redirect({ to: '/' })
    }
  },
  component: AddUserRoute,
})

function AddUserRoute() {
  return (
    <ProtectedPage>
      <AddUserPage />
    </ProtectedPage>
  )
}
