import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PageHeader } from '#/components/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { fetchAuditEvents, fetchPatient, fetchPatientById, fetchPatients, BROKEN_MATCH_URL, breakMatch, unbreakMatch } from '#/lib/ocrux'
import { useAppStore } from '#/store'
import type { AuditRow, FhirPatient } from '#/lib/types'
import { ChevronLeft, ChevronRight, Copy, Info, History, User, Link as LinkIcon, Split } from 'lucide-react'

const CRUID_TAG = import.meta.env.VITE_OCRUX_CRUID_TAG || '5c827da5-4858-4f3d-a50c-62ece001efea'

function decodeBase64(value: string) {
  if (typeof window === 'undefined') {
    return Buffer.from(value, 'base64').toString('ascii')
  }

  return window.atob(value)
}

function parseAudit(entry: Record<string, unknown>): AuditRow {
  const resource = entry as {
    recorded?: string
    subtype?: Array<{ system?: string; code?: string }>
    outcome?: string
    outcomeDesc?: string
    agent?: Array<{ altId?: string; network?: { address?: string } }>
    entity?: Array<{ name?: string; what?: { reference?: string }; detail?: Array<{ type?: string; valueString?: string; valueBase64Binary?: string }> }>
  }

  const result: AuditRow = {
    type: 'submittedResource',
    recorded: resource.recorded || '',
  }
  let isBreak = false
  let isUnBreak = false

  for (const entity of resource.entity || []) {
    if (entity.name === 'break' || entity.name === 'breakFrom') {
      isBreak = true
    }
    if (entity.name === 'unBreak' || entity.name === 'unBreakFromResource') {
      isUnBreak = true
    }
  }

  if (isBreak) {
    result.type = 'breakMatch'
    result.breakFrom = []
    for (const entity of resource.entity || []) {
      if (entity.name === 'break' && entity.what?.reference) result.break = entity.what.reference
      if (entity.name === 'oldCRUID' && entity.what?.reference) result.CRUID = entity.what.reference
      if (entity.name === 'breakFrom' && entity.what?.reference) result.breakFrom.push(entity.what.reference)
    }
  } else if (isUnBreak) {
    result.type = 'unBreak'
    result.unBreakFrom = []
    for (const entity of resource.entity || []) {
      if (entity.name === 'unBreak' && entity.what?.reference) result.unBreak = entity.what.reference
      if (entity.name === 'unBreakFromCRUID' && entity.what?.reference) result.unBreakFromCRUID = entity.unBreakFromCRUID
      if (entity.name === 'unBreakFromResource' && entity.what?.reference) result.unBreakFrom.push(entity.what.reference)
    }
  }

  result.outcome = resource.outcome
  result.outcomeDesc = resource.outcomeDesc
  if (resource.agent?.[0]) {
    result.username = resource.agent[0].altId
    result.ipaddress = resource.agent[0].network?.address
  }

  for (const entity of resource.entity || []) {
    if (entity.name !== 'submittedResource') {
      continue
    }

    result.submittedResource = entity.what?.reference
    result.matchData = []

    for (const detail of entity.detail || []) {
      if (detail.type === 'match' && detail.valueBase64Binary) {
        try {
          const matches = JSON.parse(decodeBase64(detail.valueBase64Binary)) as {
            rule?: { matchingType?: string; fields?: Record<string, { algorithm?: string; threshold?: number; mValue?: number; uValue?: number; fhirpath?: string }> }
            query?: string
            autoMatches?: unknown
            potentialMatches?: unknown
            conflictsMatchResults?: unknown
          }

          const decisionRule = Object.entries(matches.rule?.fields || {}).map(([name, details]) => ({
            name,
            id: name,
            details,
          }))

          result.matchData.push({
            matchingType: matches.rule?.matchingType,
            decisionRule,
            query: matches.query,
            autoMatches: typeof matches.autoMatches === 'string' ? matches.autoMatches : JSON.stringify(matches.autoMatches || {}, null, 2),
            potentialMatches: typeof matches.potentialMatches === 'string' ? matches.potentialMatches : JSON.stringify(matches.potentialMatches || {}, null, 2),
            conflictsMatchResults: typeof matches.conflictsMatchResults === 'string' ? matches.conflictsMatchResults : JSON.stringify(matches.conflictsMatchResults || {}, null, 2),
          })
        } catch {
          // ignore malformed audit payloads
        }
      }
    }
  }

  return result
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function formatHistoryTimestamp(value?: string) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function historyDetailLabel(detailIndex: number, matchingType?: string) {
  return `Decision Rule ${detailIndex + 1} => Matching Type: ${matchingType || 'rule'}`
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied to clipboard`)
  } catch {
    toast.error(`Unable to copy ${label.toLowerCase()}`)
  }
}

function renderRuleDetailValue(detail: Record<string, unknown>) {
    const algorithm = detail.algorithm ? String(detail.algorithm) : ''
    const threshold = detail.threshold ?? ''
    const mValue = detail.mValue ?? ''
    const uValue = detail.uValue ?? ''
    const fhirpath = detail.fhirpath ? String(detail.fhirpath) : ''
    const matchingType = typeof detail.matchingType === 'string' ? detail.matchingType : ''

    return (
      <div className="space-y-2 text-xs text-foreground">
        {algorithm ? <div>Algorithm - {algorithm}</div> : null}
        {threshold !== '' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>Threshold</span>
            <Badge variant="destructive" className="font-mono text-[10px]">
              {String(threshold)}
            </Badge>
          </div>
        ) : null}
        {fhirpath ? <div>FHIR Path - {fhirpath}</div> : null}
        {matchingType === 'probabilistic' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">mValue</span>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {String(mValue)}
            </Badge>
            <span className="font-semibold">- uValue</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {String(uValue)}
            </Badge>
          </div>
        ) : null}
      </div>
    )
  }

export function ClientDetailPage({ clientId, pos, sourceId }: { clientId: string; pos?: string; sourceId?: string }) {
  const username = useAppStore((state) => state.auth.username)
  const systemURI = useAppStore((state) => state.systemURI)
  const [selectedBreaks, setSelectedBreaks] = useState<Record<string, boolean>>({})
  const [selectedUnbreaks, setSelectedUnbreaks] = useState<Record<string, boolean>>({})
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false)
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false)
  const [advancedHistory, setAdvancedHistory] = useState<Record<string, boolean>>({})
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0)

  const submittedQuery = useQuery({
    queryKey: ['client-submitted', clientId],
    queryFn: () => fetchPatientById(clientId),
  })

  const submitted = submittedQuery.data?.entry?.[0]?.resource as FhirPatient | undefined
  const goldenId = submitted?.link?.[0]?.other?.reference?.split('/').pop() || clientId

  const linkedQuery = useQuery({
    queryKey: ['client-linked', goldenId],
    queryFn: () => fetchPatient(goldenId),
    enabled: Boolean(goldenId),
  })

  const auditQuery = useQuery({
    queryKey: ['client-audit', clientId],
    queryFn: () => fetchAuditEvents(clientId),
  })

  const brokenIds = useMemo(() => {
    const extensions = submitted?.extension || []
    const ids: string[] = []
    for (const ext of extensions) {
      if (ext.url === BROKEN_MATCH_URL) {
        const reference = ext.valueReference?.reference?.split('/').pop()
        if (reference) ids.push(reference)
      }
    }
    return ids
  }, [submitted])

  const brokenQuery = useQuery({
    queryKey: ['client-broken', brokenIds.join(',')],
    queryFn: () => fetchPatients(`?_id=${brokenIds.join(',')}`),
    enabled: brokenIds.length > 0,
  })

  const breakMutation = useMutation({
    mutationFn: async () => {
      const ids = Object.entries(selectedBreaks)
        .filter(([, selected]) => selected)
        .map(([fid]) => `Patient/${fid}`)
      const promise = breakMatch(ids, username)
      toast.promise(promise, {
        loading: 'Breaking match connections...',
        success: 'Matches were broken successfully.',
        error: 'Unable to break the selected matches.',
      })
      return promise
    },
    onSuccess: () => {
      setSelectedBreaks({})
      submittedQuery.refetch()
      linkedQuery.refetch()
      auditQuery.refetch()
    },
  })

  const revertMutation = useMutation({
    mutationFn: async () => {
      const broken = Object.entries(selectedUnbreaks)
        .filter(([, selected]) => selected)
        .map(([fid]) => fid)
      const matches = linkedQuery.data?.entry?.map((entry: any) => entry.resource.id).filter(Boolean) as string[] || []
      const payload = broken.flatMap((fid) => matches.map((matchId) => ({ id1: `Patient/${fid}`, id2: `Patient/${matchId}` })))
      const promise = unbreakMatch(payload, username)
      toast.promise(promise, {
        loading: 'Restoring match connections...',
        success: 'Broken matches were restored successfully.',
        error: 'Unable to restore the selected matches.',
      })
      return promise
    },
    onSuccess: () => {
      setSelectedUnbreaks({})
      submittedQuery.refetch()
      linkedQuery.refetch()
      auditQuery.refetch()
    },
  })

  const linkedRows = linkedQuery.data?.entry
    ?.map((entry: any) => entry.resource as FhirPatient)
    .filter((resource): resource is FhirPatient => Boolean(resource) && !resource.meta?.tag?.some((tag) => tag.code === CRUID_TAG)) || []
  const brokenRows = brokenQuery.data?.entry?.map((entry: any) => entry.resource as FhirPatient).filter(Boolean) || []
  const auditRows = auditQuery.data?.entry?.map((entry: any) => parseAudit(entry.resource as Record<string, unknown>)) || []
  const selectedRecord = linkedRows[selectedRecordIndex] || linkedRows.find((resource) => resource.id === clientId) || linkedRows[0] || submitted

  useEffect(() => {
    if (!linkedRows.length) {
      return
    }

    const sourceIndex = linkedRows.findIndex((resource) => resource.id === clientId)
    const nextIndex = sourceIndex >= 0 ? sourceIndex : 0
    if (selectedRecordIndex >= linkedRows.length || selectedRecordIndex === 0 && sourceIndex >= 0) {
      setSelectedRecordIndex(nextIndex)
    }
  }, [clientId, linkedRows, selectedRecordIndex])

  function getSystemURIDisplayName(uri?: string) {
    if (!uri) {
      return null
    }

    if (uri === 'http://openclientregistry.org/fhir/sourceid') {
      return { id: 'internalid', name: 'Internal ID' }
    }

    for (const [id, entry] of Object.entries(systemURI)) {
      if (Array.isArray(entry.uri) ? entry.uri.includes(uri) : entry.uri === uri) {
        return { id, name: entry.displayName }
      }
    }

    return null
  }

  function getOfficialName(resource: FhirPatient) {
    const official = resource.name?.find((item) => item.use === 'official') || resource.name?.[0]
    const given = official?.given?.join(' ') || ''
    return {
      family: official?.family || '—',
      given: given || '—',
    }
  }

  function getRecordId(resource: FhirPatient) {
    for (const identifier of resource.identifier || []) {
      const display = getSystemURIDisplayName(identifier.system)
      if (display?.id === 'internalid') {
        return identifier.value || '—'
      }
    }

    return resource.id || '—'
  }

  function getSourceDisplay(resource: FhirPatient) {
    const tag = resource.meta?.tag?.find((entry) => entry.system === 'http://openclientregistry.org/fhir/clientid')
    return tag?.display || tag?.code || '—'
  }

  function getPhone(resource: FhirPatient) {
    return resource.telecom?.find((item) => item.system === 'phone')?.value || '—'
  }

  function selectPreviousRecord() {
    setSelectedRecordIndex((current) => Math.max(0, current - 1))
  }

  function selectNextRecord() {
    setSelectedRecordIndex((current) => Math.min(Math.max(linkedRows.length - 1, 0), current + 1))
  }

  function selectRecord(index: number) {
    setSelectedRecordIndex(index)
  }

  function getSubmittedRows(resource: FhirPatient) {
    const official = getOfficialName(resource)
    const rows = [
      { label: 'Submitting system', value: getSourceDisplay(resource) },
      { label: 'Surname (official)', value: official.family },
      { label: 'Gender', value: resource.gender || '—' },
      { label: 'Date of Birth', value: resource.birthDate || '—' },
      { label: 'phone', value: getPhone(resource) },
      { label: 'Internal ID', value: getRecordId(resource) },
    ]

    for (const identifier of resource.identifier || []) {
      const display = getSystemURIDisplayName(identifier.system)
      if (display?.id === 'internalid') {
        continue
      }

      rows.push({
        label: display?.name || identifier.system || 'Identifier',
        value: identifier.value || '—',
      })
    }

    return rows
  }

  function renderMatchRow(resource: FhirPatient, isBroken = false, isActive = false, onSelect?: () => void) {
    const name = getOfficialName(resource)
    const key = resource.id || resource.link?.[0]?.other?.reference || resource.birthDate || `${resource.gender || ''}-${resource.identifier?.[0]?.value || ''}`
    const selectId = resource.id || ''
    const selected = isBroken ? Boolean(selectedUnbreaks[selectId]) : Boolean(selectedBreaks[selectId])
    const setSelected = isBroken ? setSelectedUnbreaks : setSelectedBreaks
    const selectLabel = isBroken ? 'Select to revert' : 'Select to break'

    return (
      <TableRow
        key={key}
        className={[
          isActive ? 'bg-muted/60' : '',
          !isBroken && onSelect ? 'cursor-pointer' : '',
        ].join(' ')}
        onClick={!isBroken ? onSelect : undefined}
      >
        <TableCell className="w-10 px-2">
          <div className="flex items-center justify-center">
            <Checkbox
              id={`${isBroken ? 'revert' : 'break'}-${selectId}`}
              checked={selected}
              aria-label={selectLabel}
              onCheckedChange={(checked) =>
                setSelected((current) => ({ ...current, [selectId]: Boolean(checked) }))
              }
            />
          </div>
        </TableCell>
        <TableCell className="px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          {getSourceDisplay(resource)}
        </TableCell>
        <TableCell className="px-2 font-mono text-[11px]">{getRecordId(resource)}</TableCell>
        <TableCell className="px-2 text-[11px] font-medium leading-tight">{name.family}</TableCell>
        <TableCell className="px-2 text-[11px] leading-tight">{name.given}</TableCell>
        <TableCell className="px-2 text-[11px] capitalize">{resource.gender || '—'}</TableCell>
        <TableCell className="px-2 text-[11px]">{formatAuditValue(resource.birthDate || '—') || '—'}</TableCell>
      </TableRow>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader
        title={`Client ${clientId}`}
        description={[
          pos ? `Source filter: ${pos}` : null,
          sourceId ? `Source record: ${sourceId}` : null,
          !pos && !sourceId ? 'Full linked record and history for the selected patient.' : null,
        ].filter(Boolean).join(' • ')}
        actions={(
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={Object.values(selectedBreaks).every((value) => !value) || breakMutation.isPending}
              onClick={() => setBreakConfirmOpen(true)}
            >
              <Split className="mr-2 h-4 w-4" />
              Break selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Object.values(selectedUnbreaks).every((value) => !value) || revertMutation.isPending}
              onClick={() => setRevertConfirmOpen(true)}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              Revert selected
            </Button>
          </div>
        )}
      />

      <Tabs defaultValue="record" className="space-y-4">
        <TabsList>
          <TabsTrigger value="record" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Record
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-4">
          {selectedRecord ? (
            <div className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
                <Card className="min-w-0 self-start">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span>CRUID: {goldenId}</span>
                      <Badge variant="secondary" className="font-mono">
                        {selectedRecordIndex + 1} / {linkedRows.length || 1}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={selectPreviousRecord}
                        disabled={selectedRecordIndex <= 0}
                        aria-label="Previous record"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{selectedRecordIndex + 1} of {linkedRows.length || 1}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={selectNextRecord}
                        disabled={selectedRecordIndex >= linkedRows.length - 1}
                        aria-label="Next record"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/20 transition-all duration-300 ease-out">
                      {getSubmittedRows(selectedRecord).map((row, index, rows) => (
                        <div
                          key={`${row.label}-${index}`}
                          className={[
                            'grid grid-cols-[10rem_minmax(0,1fr)] gap-3 px-3 py-2',
                            index < rows.length - 1 ? 'border-b' : '',
                          ].join(' ')}
                        >
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <span className="min-w-0 break-words text-right text-xs font-medium">{row.value || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-w-0">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-muted-foreground" />
                      Matched Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {linkedRows.length > 0 ? (
                      <div className="overflow-hidden rounded-md border">
                        <Table className="w-full table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8 px-2 text-[10px]" />
                              <TableHead className="w-[9rem] px-2 text-[10px]">Submitting system</TableHead>
                              <TableHead className="w-[8rem] px-2 text-[10px]">Record ID</TableHead>
                              <TableHead className="w-[8rem] px-2 text-[10px]">Surname</TableHead>
                              <TableHead className="w-[9rem] px-2 text-[10px]">Given names</TableHead>
                              <TableHead className="w-[5rem] px-2 text-[10px]">Gender</TableHead>
                              <TableHead className="w-[7rem] px-2 text-[10px]">Birth date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {linkedRows.map((resource, rowIndex) => renderMatchRow(resource, false, rowIndex === selectedRecordIndex, () => selectRecord(rowIndex)))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <Alert variant="secondary" className="border-none bg-muted/50">
                        <Info className="h-4 w-4" />
                        <AlertTitle className="text-xs">No matched records</AlertTitle>
                        <AlertDescription className="text-xs text-muted-foreground">
                          This record is not linked to any other matched records.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Object.values(selectedBreaks).every((value) => !value) || breakMutation.isPending || linkedRows.length < 2}
                        onClick={() => setBreakConfirmOpen(true)}
                      >
                        <Split className="mr-2 h-4 w-4" />
                        Break matches
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="min-w-0">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Split className="h-5 w-5 text-muted-foreground" />
                    Broken Matches
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {brokenRows.length ? (
                    <>
                      <div className="overflow-hidden rounded-md border">
                        <Table className="w-full table-fixed">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8 px-2 text-[10px]" />
                              <TableHead className="w-[9rem] px-2 text-[10px]">Submitting system</TableHead>
                              <TableHead className="w-[8rem] px-2 text-[10px]">Record ID</TableHead>
                              <TableHead className="w-[8rem] px-2 text-[10px]">Surname</TableHead>
                              <TableHead className="w-[9rem] px-2 text-[10px]">Given names</TableHead>
                              <TableHead className="w-[5rem] px-2 text-[10px]">Gender</TableHead>
                              <TableHead className="w-[7rem] px-2 text-[10px]">Birth date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {brokenRows.map((resource) => renderMatchRow(resource, true))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Object.values(selectedUnbreaks).every((value) => !value) || revertMutation.isPending}
                          onClick={() => setRevertConfirmOpen(true)}
                        >
                          <LinkIcon className="mr-2 h-4 w-4" />
                          Revert break
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Alert variant="secondary" className="border-none bg-muted/50">
                      <Info className="h-4 w-4" />
                      <AlertTitle className="text-xs">Clean Record</AlertTitle>
                      <AlertDescription className="text-xs text-muted-foreground">
                        No broken matches are currently attached to this record.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">Loading patient record...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
            </CardHeader>
            <CardContent>
              {auditRows.length ? (
                <Accordion type="single" collapsible className="overflow-hidden rounded-md border">
                  {auditRows.map((event, index) => {
                    const eventTitle =
                      event.type === 'submittedResource'
                        ? 'Submitted resource'
                        : event.type === 'breakMatch'
                          ? 'Break match'
                          : 'Revert break'

                    return (
                      <AccordionItem key={`${event.recorded}-${index}`} value={`event-${index}`}>
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex w-full flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={event.type === 'breakMatch' ? 'destructive' : 'default'}>
                                {eventTitle}
                              </Badge>
                              <span className="text-xs font-medium text-muted-foreground">
                                Event {formatHistoryTimestamp(event.recorded)}
                              </span>
                            </div>
                            {event.username ? (
                              <span className="text-xs text-muted-foreground">by {event.username}</span>
                            ) : null}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <div className="space-y-3 pb-1">
                            {event.type !== 'submittedResource' ? (
                              <p className="text-xs text-muted-foreground">User: <span className="text-foreground">{event.username || '—'}</span></p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              Operation: <span className="font-semibold text-foreground">{event.operation || '—'}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Operation time: <span className="text-foreground">{formatHistoryTimestamp(event.recorded)}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Patient status:
                              <Badge variant={event.outcomeCode === '0' ? 'default' : 'destructive'} className="ml-2 align-middle">
                                {event.outcome || '—'}
                              </Badge>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              IP Address: <span className="text-foreground">{event.ipaddress || '—'}</span>
                            </p>

                            {event.type === 'breakMatch' ? (
                              <div className="grid gap-3 md:grid-cols-3">
                                <Card className="border-green-600/30 bg-green-50/40 dark:bg-green-950/10">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Break</p>
                                    <p className="mt-2 font-mono text-sm font-semibold">{event.break || '—'}</p>
                                  </CardContent>
                                </Card>
                                <Card className="border-red-600/30 bg-red-50/40 dark:bg-red-950/10">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Old CRUID</p>
                                    <p className="mt-2 font-mono text-sm font-semibold">{event.CRUID || '—'}</p>
                                  </CardContent>
                                </Card>
                                <Card className="border-red-600/30 bg-red-50/40 dark:bg-red-950/10">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Broken From</p>
                                    <div className="mt-2 space-y-1 font-mono text-sm font-semibold">
                                      {(event.breakFrom || []).length ? (
                                        event.breakFrom?.map((item) => <div key={item}>{item}</div>)
                                      ) : (
                                        <div>—</div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}

                            {event.type === 'unBreak' ? (
                              <div className="grid gap-3 md:grid-cols-3">
                                <Card className="border-green-600/30 bg-green-50/40 dark:bg-green-950/10">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Reverting</p>
                                    <p className="mt-2 font-mono text-sm font-semibold">{event.unBreak || '—'}</p>
                                  </CardContent>
                                </Card>
                                <Card className="border-red-600/30 bg-red-50/40 dark:bg-red-950/10">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground">CRUIDs</p>
                                    <p className="mt-2 font-mono text-sm font-semibold">{event.unBreakFromCRUID || '—'}</p>
                                  </CardContent>
                                </Card>
                                <Card className="border-red-600/30 bg-red-50/40 dark:bg-red-950/10">
                                  <CardContent className="p-3 text-center">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Unbroken From</p>
                                    <div className="mt-2 space-y-1 font-mono text-sm font-semibold">
                                      {(event.unBreakFrom || []).length ? (
                                        event.unBreakFrom?.map((item) => <div key={item}>{item}</div>)
                                      ) : (
                                        <div>—</div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            ) : null}

                            {event.matchData?.length ? (
                              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                                <div className="space-y-4">
                                  {event.matchData.map((detail, detailIndex) => {
                                    const collapseKey = `${index}-${detailIndex}`
                                    const expanded = advancedHistory[collapseKey] ?? false

                                    return (
                                      <div key={collapseKey} className="space-y-3 rounded-md border bg-muted/30 p-4">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                          {historyDetailLabel(detailIndex, detail.matchingType)}
                                        </h5>

                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-transparent">
                                              <TableHead className="h-8 text-[10px]">Field</TableHead>
                                              <TableHead className="h-8 text-[10px]">Details</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {detail.decisionRule?.map((rule) => (
                                              <TableRow key={rule.id} className="bg-transparent">
                                                <TableCell className="py-2 text-xs">{rule.name}</TableCell>
                                                <TableCell className="py-2">
                                                  {renderRuleDetailValue(rule.details || {})}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="px-0 text-xs text-primary hover:bg-transparent hover:underline"
                                          onClick={() => setAdvancedHistory((current) => ({ ...current, [collapseKey]: !current[collapseKey] }))}
                                        >
                                          {expanded ? 'Hide Advanced Details' : 'View Advanced Details'}
                                        </Button>
                                      </div>
                                    )
                                  })}
                                </div>

                                <div className="space-y-3">
                                  {event.matchData.map((detail, detailIndex) => {
                                    const collapseKey = `${index}-${detailIndex}`
                                    const expanded = advancedHistory[collapseKey] ?? false

                                    return (
                                      <div key={`${collapseKey}-raw`} className="rounded-md border bg-muted/30 p-4">
                                        <div className="mb-3">
                                          <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            View Advanced Details
                                          </h5>
                                          <p className="text-[10px] text-muted-foreground">
                                            {historyDetailLabel(detailIndex, detail.matchingType)}
                                          </p>
                                        </div>

                                        <div className="space-y-2">
                                          <details open={expanded} className="group rounded-md border bg-background px-3 py-2">
                                            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[10px] font-medium text-primary hover:underline">
                                              <span>Elasticsearch Query</span>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={(event) => {
                                                  event.preventDefault()
                                                  event.stopPropagation()
                                                  void copyToClipboard(formatAuditValue(detail.query), 'Elasticsearch Query')
                                                }}
                                                aria-label="Copy Elasticsearch Query"
                                              >
                                                <Copy className="h-3.5 w-3.5" />
                                              </Button>
                                            </summary>
                                            <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-[9px]">
                                              {formatAuditValue(detail.query)}
                                            </pre>
                                          </details>
                                          <details open={expanded} className="group rounded-md border bg-background px-3 py-2">
                                            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[10px] font-medium text-primary hover:underline">
                                              <span>Elasticsearch Automatches Results</span>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={(event) => {
                                                  event.preventDefault()
                                                  event.stopPropagation()
                                                  void copyToClipboard(formatAuditValue(detail.autoMatches), 'Elasticsearch Automatches Results')
                                                }}
                                                aria-label="Copy Elasticsearch Automatches Results"
                                              >
                                                <Copy className="h-3.5 w-3.5" />
                                              </Button>
                                            </summary>
                                            <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-[9px]">
                                              {formatAuditValue(detail.autoMatches)}
                                            </pre>
                                          </details>
                                          <details open={expanded} className="group rounded-md border bg-background px-3 py-2">
                                            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[10px] font-medium text-primary hover:underline">
                                              <span>Elasticsearch Potential Matches Results</span>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={(event) => {
                                                  event.preventDefault()
                                                  event.stopPropagation()
                                                  void copyToClipboard(formatAuditValue(detail.potentialMatches), 'Elasticsearch Potential Matches Results')
                                                }}
                                                aria-label="Copy Elasticsearch Potential Matches Results"
                                              >
                                                <Copy className="h-3.5 w-3.5" />
                                              </Button>
                                            </summary>
                                            <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-[9px]">
                                              {formatAuditValue(detail.potentialMatches)}
                                            </pre>
                                          </details>
                                          <details open={expanded} className="group rounded-md border bg-background px-3 py-2">
                                            <summary className="flex cursor-pointer items-center justify-between gap-3 text-[10px] font-medium text-primary hover:underline">
                                              <span>Elasticsearch Conflicts Matches Results</span>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={(event) => {
                                                  event.preventDefault()
                                                  event.stopPropagation()
                                                  void copyToClipboard(formatAuditValue(detail.conflictsMatchResults), 'Elasticsearch Conflicts Matches Results')
                                                }}
                                                aria-label="Copy Elasticsearch Conflicts Matches Results"
                                              >
                                                <Copy className="h-3.5 w-3.5" />
                                              </Button>
                                            </summary>
                                            <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded bg-black/5 p-2 font-mono text-[9px]">
                                              {formatAuditValue(detail.conflictsMatchResults)}
                                            </pre>
                                          </details>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {!event.matchData?.length && event.type === 'submittedResource' ? (
                              <pre className="overflow-auto rounded bg-muted p-2 text-[10px]">
                                {JSON.stringify(event, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              ) : (
                <div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground italic">
                  No audit events found for this client.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={breakConfirmOpen} onOpenChange={setBreakConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Break Record Connections?</AlertDialogTitle>
            <AlertDialogDescription>
              This will separate the selected records from this cohort. This action is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setBreakConfirmOpen(false); breakMutation.mutate(); }}>Break Connections</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revertConfirmOpen} onOpenChange={setRevertConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Record Connections?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-link the selected broken records back to this cohort.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setRevertConfirmOpen(false); revertMutation.mutate(); }}>Restore Connections</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
