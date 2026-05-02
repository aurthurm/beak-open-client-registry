import { createFileRoute } from '@tanstack/react-router'

import { ChangePasswordPage } from '#/components/ChangePasswordPage'
import { ProtectedPage } from '#/components/ProtectedPage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/changePassword')({
  beforeLoad: async () => requireSession('/changePassword'),
  component: ChangePasswordRoute,
})

function ChangePasswordRoute() {
  return (
    <ProtectedPage>
      <ChangePasswordPage />
    </ProtectedPage>
  )
}
