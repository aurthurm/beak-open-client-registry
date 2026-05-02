import { useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { PageHeader } from '#/components/PageHeader'
import { SearchTerm } from '#/components/SearchTerm'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { fetchDisplayConfig, fetchPatients, flattenPatientRows } from '#/lib/ocrux'
import { useAppStore } from '#/store'

const EXCLUDED_TAG = '5c827da5-4858-4f3d-a50c-62ece001efea'

function buildQuery({
  count,
  pos,
  filters,
}: {
  count: number
  pos: string
  filters: Record<string, string>
}) {
  const params = new URLSearchParams()
  params.set('_count', String(count))
  params.set('_total', 'accurate')
  params.set('_tag:not', EXCLUDED_TAG)

  if (pos) {
    params.set('_tag', `http://openclientregistry.org/fhir/clientid|${pos}`)
  }

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    params.set(key, value)
  }

  return `?${params.toString()}`
}

export function PatientListPage() {
  const navigate = useNavigate()
  const clients = useAppStore((state) => state.clients)
  const [count, setCount] = useState(10)
  const [pos, setPos] = useState('')
  const [pagePath, setPagePath] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const displayQuery = useQuery({
    queryKey: ['displayConfig'],
    queryFn: fetchDisplayConfig,
  })

  const patientQueryString = useMemo(
    () => buildQuery({ count, pos, filters }),
    [count, filters, pos],
  )

  const patientsQuery = useQuery({
    queryKey: ['patients', patientQueryString, pagePath],
    queryFn: () => fetchPatients(pagePath || patientQueryString),
    placeholderData: keepPreviousData,
  })

  const displayConfig = displayQuery.data?.fields || []
  const rows = useMemo(
    () => flattenPatientRows(patientsQuery.data || { entry: [] }, { fields: displayConfig }, clients),
    [clients, displayConfig, patientsQuery.data],
  )

  const links = patientsQuery.data?.link || []
  const nextPath = links.find((link) => link.relation === 'next')?.url?.replace(/^\/fhir/, '/ocrux/fhir') || ''
  const previousPath = links.find((link) => link.relation === 'previous')?.url?.replace(/^\/fhir/, '/ocrux/fhir') || ''

  function handleFilterChange(key: string, value: string) {
    setPagePath('')
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function clearFilter(key: string) {
    setPagePath('')
    setFilters((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow="Registry Overview"
        title="Patients"
        description="Search and review registry patients using the same backend queries as the legacy UI."
        actions={(
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
              Total {patientsQuery.data?.total ?? rows.length}
            </Badge>
            <Select
              value={String(count)}
              onValueChange={(value) => {
                setPagePath('')
                setCount(Number(value))
              }}
            >
              <SelectTrigger className="w-36 border-white/10 bg-slate-950/60 text-white">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <div className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-[0_24px_50px_rgba(0,0,0,0.25)] backdrop-blur-md">
        <div className="flex flex-wrap gap-3">
          {(displayConfig || [])
            .filter((field) => field.searchable && field.searchparameter)
            .map((field) => (
              <SearchTerm
                key={field.searchparameter}
                label={field.label || field.searchparameter || 'Search'}
                value={filters[field.searchparameter || ''] || ''}
                onValueChange={(value) => handleFilterChange(field.searchparameter || '', value)}
                onClear={() => clearFilter(field.searchparameter || '')}
              />
            ))}
          <label className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Source</span>
            <Select value={pos || '__all__'} onValueChange={(value) => { setPagePath(''); setPos(value === '__all__' ? '' : value); }}>
              <SelectTrigger className="border-white/10 bg-slate-950/60 text-white">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sources</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
              <tr>
                {(displayConfig || []).map((field) => (
                  <th key={field.label} className="px-4 py-3">{field.label}</th>
                ))}
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                  onClick={() => navigate({ to: `/client/${row.id}`, search: { pos } })}
                >
                  {(displayConfig || []).map((field) => (
                    <td key={field.label} className="px-4 py-3 text-slate-100">
                      {String(row[field.label || ''] || '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-slate-200">{row.pos || '—'}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-400" colSpan={(displayConfig || []).length + 1}>
                    {patientsQuery.isLoading ? 'Loading patients...' : 'No patients found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!previousPath}
            className="border-white/10 bg-white/5 text-white"
            onClick={() => setPagePath(previousPath)}
          >
            Previous
          </Button>
          <div className="text-sm text-slate-300">
            Showing {rows.length} of {patientsQuery.data?.total ?? rows.length}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!nextPath}
            className="border-white/10 bg-white/5 text-white"
            onClick={() => setPagePath(nextPath)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  )
}
