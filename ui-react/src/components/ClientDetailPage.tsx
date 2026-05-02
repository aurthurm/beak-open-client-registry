import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { PageHeader } from '#/components/PageHeader'
import { PatientCard } from '#/components/PatientCard'
import { Alert } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { fetchAuditEvents, fetchPatient, fetchPatientById, fetchPatients, BROKEN_MATCH_URL, breakMatch, unbreakMatch } from '#/lib/ocrux'
import { useAppStore } from '#/store'
import type { AuditRow, FhirPatient } from '#/lib/types'

function toCardRows(resource: FhirPatient) {
  const names = resource.name || []
  const identifiers = resource.identifier || []
  const telecom = resource.telecom || []
  return [
    { label: 'Record ID', value: resource.id },
    { label: 'Gender', value: resource.gender },
    { label: 'Birth date', value: resource.birthDate },
    { label: 'Names', value: names.map((name) => `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()).filter(Boolean).join(' | ') },
    { label: 'Identifiers', value: identifiers.map((id) => `${id.system || 'id'}: ${id.value || ''}`).join(' | ') },
    { label: 'Telecom', value: telecom.map((item) => `${item.system || 'telecom'}: ${item.value || ''}`).join(' | ') },
  ]
}

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
      if (entity.name === 'unBreakFromCRUID' && entity.what?.reference) result.unBreakFromCRUID = entity.what.reference
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
            rule?: { fields?: Record<string, { algorithm?: string; threshold?: number; mValue?: number; uValue?: number; fhirpath?: string }> }
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
            matchingType: 'rule',
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

export function ClientDetailPage({ clientId, pos }: { clientId: string; pos?: string }) {
  const username = useAppStore((state) => state.auth.username)
  const setAlert = useAppStore((state) => state.setAlert)
  const [selectedBreaks, setSelectedBreaks] = useState<Record<string, boolean>>({})
  const [selectedUnbreaks, setSelectedUnbreaks] = useState<Record<string, boolean>>({})

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
      return breakMatch(ids, username)
    },
    onSuccess: () => {
      setSelectedBreaks({})
      submittedQuery.refetch()
      linkedQuery.refetch()
      auditQuery.refetch()
      setAlert({ show: true, type: 'success', message: 'Matches were broken successfully.' })
    },
    onError: () => {
      setAlert({ show: true, type: 'error', message: 'Unable to break the selected matches.' })
    },
  })

  const revertMutation = useMutation({
    mutationFn: async () => {
      const broken = Object.entries(selectedUnbreaks)
        .filter(([, selected]) => selected)
        .map(([fid]) => fid)
      const matches = linkedQuery.data?.entry?.map((entry) => entry.resource.id).filter(Boolean) as string[] || []
      const payload = broken.flatMap((fid) => matches.map((matchId) => ({ id1: `Patient/${fid}`, id2: `Patient/${matchId}` })))
      return unbreakMatch(payload, username)
    },
    onSuccess: () => {
      setSelectedUnbreaks({})
      submittedQuery.refetch()
      linkedQuery.refetch()
      auditQuery.refetch()
      setAlert({ show: true, type: 'success', message: 'Broken matches were restored successfully.' })
    },
    onError: () => {
      setAlert({ show: true, type: 'error', message: 'Unable to restore the selected matches.' })
    },
  })

  const linkedRows = linkedQuery.data?.entry?.map((entry) => entry.resource as FhirPatient).filter(Boolean) || []
  const brokenRows = brokenQuery.data?.entry?.map((entry) => entry.resource as FhirPatient).filter(Boolean) || []
  const auditRows = auditQuery.data?.entry?.map((entry) => parseAudit(entry.resource as Record<string, unknown>)) || []

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow="Patient Drilldown"
        title={`Client ${clientId}`}
        description={pos ? `Source filter: ${pos}` : 'Full linked record and history for the selected patient.'}
        actions={(
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white"
              disabled={Object.values(selectedBreaks).every((value) => !value) || breakMutation.isPending}
              onClick={() => breakMutation.mutate()}
            >
              Break selected
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white"
              disabled={Object.values(selectedUnbreaks).every((value) => !value) || revertMutation.isPending}
              onClick={() => revertMutation.mutate()}
            >
              Revert selected
            </Button>
          </div>
        )}
      />

      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2 bg-white/5">
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="mt-4 grid gap-4">
          {submitted ? (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    Linked record
                    <Badge variant="outline" className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                      CRUID {goldenId}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <PatientCard title="Submitted Patient" rows={toCardRows(submitted)} />
                  {linkedRows.map((resource) => (
                    <div key={resource.id} className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="font-semibold text-white">{resource.id}</div>
                        <Checkbox
                          checked={Boolean(selectedBreaks[resource.id || ''])}
                          onCheckedChange={(checked) =>
                            setSelectedBreaks((current) => ({ ...current, [resource.id || '']: Boolean(checked) }))
                          }
                        />
                      </div>
                      <PatientCard title="Linked Patient" rows={toCardRows(resource)} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle>Broken matches</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {brokenRows.length ? brokenRows.map((resource) => (
                    <div key={resource.id} className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="font-semibold text-white">{resource.id}</div>
                        <Checkbox
                          checked={Boolean(selectedUnbreaks[resource.id || ''])}
                          onCheckedChange={(checked) =>
                            setSelectedUnbreaks((current) => ({ ...current, [resource.id || '']: Boolean(checked) }))
                          }
                        />
                      </div>
                      <PatientCard title="Broken Patient" rows={toCardRows(resource)} />
                    </div>
                  )) : (
                    <Alert className="border-white/10 bg-white/5 text-slate-200">No broken matches are currently attached to this record.</Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert className="border-white/10 bg-white/5 text-slate-200">Loading patient record...</Alert>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Audit history</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {auditRows.map((event, index) => (
                <div key={`${event.recorded}-${index}`} className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{event.type}</Badge>
                    <span className="text-sm text-slate-300">{event.recorded}</span>
                    {event.username ? <span className="text-sm text-slate-400">by {event.username}</span> : null}
                  </div>
                  <Separator className="my-3 bg-white/10" />
                  {event.matchData?.length ? (
                    <div className="grid gap-4">
                      {event.matchData.map((detail, detailIndex) => (
                        <div key={`${index}-${detailIndex}`} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="text-sm font-semibold text-emerald-200">
                            Decision Rule {detailIndex + 1}
                          </div>
                          <div className="overflow-hidden rounded-xl border border-white/10">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
                                <tr>
                                  <th className="px-3 py-2">Field</th>
                                  <th className="px-3 py-2">Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.decisionRule?.map((rule) => (
                                  <tr key={rule.id} className="border-t border-white/5">
                                    <td className="px-3 py-2">{rule.name}</td>
                                    <td className="px-3 py-2 text-xs text-slate-300">
                                      <pre className="whitespace-pre-wrap">{JSON.stringify(rule.details, null, 2)}</pre>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="grid gap-2 text-xs text-slate-300">
                            <details>
                              <summary className="cursor-pointer text-emerald-200">Advanced query</summary>
                              <pre className="mt-2 overflow-auto whitespace-pre-wrap">{detail.query}</pre>
                            </details>
                            <details>
                              <summary className="cursor-pointer text-emerald-200">Auto matches</summary>
                              <pre className="mt-2 overflow-auto whitespace-pre-wrap">{detail.autoMatches}</pre>
                            </details>
                            <details>
                              <summary className="cursor-pointer text-emerald-200">Potential matches</summary>
                              <pre className="mt-2 overflow-auto whitespace-pre-wrap">{detail.potentialMatches}</pre>
                            </details>
                            <details>
                              <summary className="cursor-pointer text-emerald-200">Conflict matches</summary>
                              <pre className="mt-2 overflow-auto whitespace-pre-wrap">{detail.conflictsMatchResults}</pre>
                            </details>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="overflow-auto text-xs text-slate-300">{JSON.stringify(event, null, 2)}</pre>
                  )}
                </div>
              ))}
              {!auditRows.length ? (
                <Alert className="border-white/10 bg-white/5 text-slate-200">No audit events found.</Alert>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
