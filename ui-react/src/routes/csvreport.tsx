import { createFileRoute } from '@tanstack/react-router'

import { CsvReportPage } from '#/components/CsvReportPage'
import { ProtectedPage } from '#/components/ProtectedPage'
import { requireSession } from '#/lib/session'

export const Route = createFileRoute('/csvreport')({
  beforeLoad: async () => requireSession('/csvreport'),
  component: CsvReportRoute,
})

function CsvReportRoute() {
  return (
    <ProtectedPage>
      <CsvReportPage />
    </ProtectedPage>
  )
}
