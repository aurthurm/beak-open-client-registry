import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { PageHeader } from '#/components/PageHeader'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { fetchAutoMatches, fetchMatchIssues } from '#/lib/ocrux'
import { useAppStore } from '#/store'
import type { MatchRow } from '#/lib/types'

type Mode = 'review' | 'auto'

const titleMap: Record<Mode, string> = {
  review: 'Action Required',
  auto: 'Auto Matches',
}

const fetcherMap = {
  review: fetchMatchIssues,
  auto: fetchAutoMatches,
}

export function MatchTablePage({ mode }: { mode: Mode }) {
  const clients = useAppStore((state) => state.clients)
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: [mode === 'review' ? 'matchIssues' : 'autoMatches'],
    queryFn: fetcherMap[mode],
  })

  const rows = useMemo(() => {
    const data = (query.data || []) as MatchRow[]
    if (!search.trim()) {
      return data
    }

    const term = search.toLowerCase()
    return data.filter((row) =>
      [row.uid, row.family, row.given, row.reason, row.source, row.source_id, row.birthdate]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [query.data, search])

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow={mode === 'review' ? 'Registry Queue' : 'Automated Queue'}
        title={titleMap[mode]}
        description={mode === 'review'
          ? 'Patients flagged by the matching engine and waiting for review.'
          : 'Patients auto-linked by the engine and ready for audit or export.'}
        actions={(
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rows"
            className="w-full max-w-sm border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
          />
        )}
      />

      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-[0_24px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
            <tr>
              <th className="px-4 py-3">CR ID</th>
              <th className="px-4 py-3">Surname</th>
              <th className="px-4 py-3">Given Names</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Source ID</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Date Flagged</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const source = clients.find((client) => client.id === row.source)?.displayName || row.source
              return (
                <tr key={`${row.id}-${row.uid}`} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                      <Link to={`/resolve/${row.id}`} search={{ flagType: mode === 'auto' ? 'autoMatches' : 'potentialMatches' }} className="no-underline">
                        {row.uid}
                      </Link>
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{row.family}</td>
                  <td className="px-4 py-3">{row.given}</td>
                  <td className="px-4 py-3">{source}</td>
                  <td className="px-4 py-3">{row.source_id}</td>
                  <td className="px-4 py-3 uppercase">{row.reason}</td>
                  <td className="px-4 py-3">{row.date ? format(new Date(row.date), 'PPPpp') : '—'}</td>
                </tr>
              )
            })}
            {!rows.length ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={7}>
                  {query.isLoading ? 'Loading...' : 'No rows found.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
