import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

export function PatientCard({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value?: string | number | null | undefined }>
}) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1 px-2 pb-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span className="text-xs font-medium text-right max-w-[200px] truncate">
              {row.value || '—'}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
