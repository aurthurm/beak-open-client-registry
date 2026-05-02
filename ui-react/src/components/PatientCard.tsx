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
    <Card className="border-white/10 bg-white/5 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm uppercase tracking-[0.2em] text-emerald-200">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{row.label}</span>
            <Badge variant="secondary" className="max-w-[65%] justify-end bg-white/5 text-right text-slate-100">
              {row.value || '—'}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
