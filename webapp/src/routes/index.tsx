import { createFileRoute } from '@tanstack/react-router'

import { PatientListPage } from '#/components/PatientListPage'
import { ProtectedPage } from '#/components/ProtectedPage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => requireSession('/'),
  component: HomeRoute,
})

function HomeRoute() {
  return (
    <ProtectedPage>
      <PatientListPage />
    </ProtectedPage>
  )
}
