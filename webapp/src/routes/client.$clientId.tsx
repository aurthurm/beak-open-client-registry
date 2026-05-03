import { createFileRoute } from '@tanstack/react-router'

import { ClientDetailPage } from '#/components/ClientDetailPage'
import { ProtectedPage } from '#/components/ProtectedPage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/client/$clientId')({
  validateSearch: (search) => ({
    pos: typeof search.pos === 'string' ? search.pos : '',
    sourceId: typeof search.sourceId === 'string' ? search.sourceId : '',
  }),
  beforeLoad: async ({ params }) => requireSession(`/client/${params.clientId}`),
  component: ClientRoute,
})

function ClientRoute() {
  const params = Route.useParams()
  const search = Route.useSearch()

  return (
    <ProtectedPage>
      <ClientDetailPage
        clientId={params.clientId}
        pos={search.pos as string | undefined}
        sourceId={search.sourceId as string | undefined}
      />
    </ProtectedPage>
  )
}
