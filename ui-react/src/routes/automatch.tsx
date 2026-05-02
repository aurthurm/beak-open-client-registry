import { createFileRoute } from '@tanstack/react-router'

import { ProtectedPage } from '#/components/ProtectedPage'
import { MatchTablePage } from '#/components/MatchTablePage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/automatch')({
  beforeLoad: async () => requireSession('/automatch'),
  component: AutoMatchRoute,
})

function AutoMatchRoute() {
  return (
    <ProtectedPage>
      <MatchTablePage mode="auto" />
    </ProtectedPage>
  )
}
