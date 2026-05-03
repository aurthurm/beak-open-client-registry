import { createFileRoute } from '@tanstack/react-router'

import { ProtectedPage } from '#/components/ProtectedPage'
import { ResolvePage } from '#/components/ResolvePage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/resolve/$clientId')({
  validateSearch: (search) => ({
    flagType: typeof search.flagType === 'string' ? search.flagType : '',
  }),
  beforeLoad: async ({ params }) => requireSession(`/resolve/${params.clientId}`),
  component: ResolveRoute,
})

function ResolveRoute() {
  const params = Route.useParams()
  const search = Route.useSearch()

  return (
    <ProtectedPage>
      <ResolvePage clientId={params.clientId} flagType={search.flagType as string | undefined} />
    </ProtectedPage>
  )
}
