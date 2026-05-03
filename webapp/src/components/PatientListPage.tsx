import { useNavigate } from '@tanstack/react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { PageHeader } from '#/components/PageHeader'
import { SearchTerm } from '#/components/SearchTerm'
import { Badge } from '#/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '#/components/ui/pagination'
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

function normalizeFhirLink(url?: string) {
  if (!url) {
    return ''
  }

  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }

  const pathname = parsed ? parsed.pathname : url
  const search = parsed ? parsed.search : ''

  if (pathname.startsWith('/ocrux/fhir')) {
    return `${pathname}${search}`
  }

  if (pathname.startsWith('/fhir')) {
    return `${pathname.replace(/^\/fhir/, '/ocrux/fhir')}${search}`
  }

  if (pathname.startsWith('fhir')) {
    return `/ocrux/${pathname}${search}`
  }

  return `${pathname}${search}`
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
  const nextPath = normalizeFhirLink(links.find((link) => link.relation === 'next')?.url)
  const previousPath = normalizeFhirLink(links.find((link) => link.relation === 'previous')?.url)

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
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Patients</h2>
          <Badge variant="secondary" className="h-8 px-3">
            Total {patientsQuery.data?.total ?? rows.length}
          </Badge>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase text-muted-foreground">Source</span>
            <Select value={pos || '__all__'} onValueChange={(value) => { setPagePath(''); setPos(value === '__all__' ? '' : value); }}>
              <SelectTrigger className="w-[200px]">
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
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase text-muted-foreground">Rows per page</span>
            <Select
              value={String(count)}
              onValueChange={(value) => {
                setPagePath('')
                setCount(Number(value))
              }}
            >
              <SelectTrigger className="w-[120px]">
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
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
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
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {(displayConfig || []).map((field) => (
                  <TableHead key={field.label}>{field.label}</TableHead>
                ))}
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: `/client/${row.id}`, search: { pos } })}
                >
                  {(displayConfig || []).map((field) => (
                    <TableCell key={field.label}>
                      {String(row[field.label || ''] || '—')}
                    </TableCell>
                  ))}
                  <TableCell>{row.pos || '—'}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={(displayConfig || []).length + 1} className="h-24 text-center">
                    {patientsQuery.isLoading ? 'Loading patients...' : 'No patients found.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {rows.length} of {patientsQuery.data?.total ?? rows.length}
          </div>
          <Pagination className="w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className={!previousPath ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  onClick={() => previousPath && setPagePath(previousPath)}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  className={!nextPath ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  onClick={() => nextPath && setPagePath(nextPath)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}
