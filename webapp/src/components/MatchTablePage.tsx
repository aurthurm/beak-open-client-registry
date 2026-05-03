import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
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
    const data = Array.isArray(query.data) ? query.data : []
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
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{titleMap[mode]}</h2>
          <p className="text-muted-foreground">
            {mode === 'review'
              ? 'Patients flagged by the matching engine and waiting for review.'
              : 'Patients auto-linked by the engine and ready for audit or export.'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rows..."
            className="w-[250px] lg:w-[350px]"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CR ID</TableHead>
              <TableHead>Surname</TableHead>
              <TableHead>Given Names</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Source ID</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date Flagged</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const source = clients.find((client) => client.id === row.source)?.displayName || row.source
              return (
                <TableRow key={`${row.id}-${row.uid}`}>
                  <TableCell>
                    <Badge variant="outline">
                      <Link to={`/resolve/${row.id}`} search={{ flagType: mode === 'auto' ? 'autoMatches' : 'potentialMatches' }} className="no-underline">
                        {row.uid}
                      </Link>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.family}</TableCell>
                  <TableCell>{row.given}</TableCell>
                  <TableCell>{source}</TableCell>
                  <TableCell className="font-mono text-xs">{row.source_id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {row.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.date ? format(new Date(row.date), 'PPP') : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  {query.isLoading ? 'Loading...' : 'No rows found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
