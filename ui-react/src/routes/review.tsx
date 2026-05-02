import { createFileRoute } from '@tanstack/react-router'

import { ProtectedPage } from '#/components/ProtectedPage'
import { MatchTablePage } from '#/components/MatchTablePage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/review')({
  beforeLoad: async () => requireSession('/review'),
  component: ReviewRoute,
})

function ReviewRoute() {
  return (
    <ProtectedPage>
      <MatchTablePage mode="review" />
    </ProtectedPage>
  )
}
