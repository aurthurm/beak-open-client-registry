import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { PageHeader } from '#/components/PageHeader'
import { Alert } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Label } from '#/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Switch } from '#/components/ui/switch'
import { fetchPotentialMatches, resolveMatchIssue } from '#/lib/ocrux'
import { useAppStore } from '#/store'
import type { PotentialRow } from '#/lib/types'

const ADD_TEXT = 'Assign to new CR ID'
const NEW_PREFIX = 'New CR ID '
const NICKNAMES = [
  'Aluminum', 'Beryllium', 'Carbon', 'Dysprosium', 'Europium', 'Flourine', 'Gallium', 'Hydrogen',
  'Iron', 'Krypton', 'Lithium', 'Magnesium', 'Nitrogen', 'Oxygen', 'Phosphorus', 'Copper',
  'Sodium', 'Titanium', 'Uranium', 'Vanadium', 'Xenon', 'Gold', 'Zinc',
]

function shuffle<T>(items: T[]) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function ResolvePage({
  clientId,
  flagType,
}: {
  clientId: string
  flagType?: string
}) {
  const setAlert = useAppStore((state) => state.setAlert)
  const setProgress = useAppStore((state) => state.showProgress)
  const hideProgress = useAppStore((state) => state.hideProgress)
  const auth = useAppStore((state) => state.auth)

  const [rows, setRows] = useState<PotentialRow[]>([])
  const [useNickname, setUseNickname] = useState(true)
  const [includeCRID, setIncludeCRID] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingChange, setPendingChange] = useState<{ oldId: string; newId: string; rowId: string; cohort: boolean } | null>(null)
  const [newCounter, setNewCounter] = useState(1)
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [applyToCohort, setApplyToCohort] = useState<Record<string, boolean>>({})
  const [showMatrix, setShowMatrix] = useState(true)
  const [showReview, setShowReview] = useState(false)

  const query = useQuery({
    queryKey: ['potential-matches', clientId, flagType],
    queryFn: () => fetchPotentialMatches(clientId),
  })

  useEffect(() => {
    if (!query.data) {
      return
    }

    let response = [...query.data]
    if (flagType === 'autoMatches') {
      const parent = response.find((item) => item.id === clientId)
      if (parent) {
        response = response.filter((item) => item.uid === parent.uid)
      }
    }

    setRows(response.map((row) => ({ ...row, ouid: row.uid })))
    const unique = Array.from(new Set(response.map((row) => row.uid))).filter(Boolean)
    const shuffled = shuffle([...NICKNAMES])
    const nextNicknames: Record<string, string> = {}
    unique.forEach((uid, index) => {
      nextNicknames[uid] = shuffled[index] || `Group ${index + 1}`
    })
    setNicknames(nextNicknames)
    setNewCounter(1)
  }, [clientId, flagType, query.data])

  const grouped = useMemo(() => {
    const buckets: Record<string, PotentialRow[]> = {}
    for (const row of rows) {
      buckets[row.uid] ||= []
      buckets[row.uid].push(row)
    }
    return buckets
  }, [rows])

  const reviewRows = rows.filter((row) => row.uid !== row.ouid)
  const bucketsModified = reviewRows.length > 0

  const scoreHeaders = useMemo(() => {
    const keys = new Set<string>()
    for (const row of rows) {
      Object.keys(row.scores || {}).forEach((key) => keys.add(key))
    }
    return Array.from(keys)
  }, [rows])

  const saveMutation = useMutation({
    mutationFn: async () =>
      resolveMatchIssue({
        resolves: rows,
        resolvingFrom: clientId,
        removeFlag: !bucketsModified,
        flagType,
      }),
    onMutate: () => {
      setProgress('Saving match changes')
    },
    onSuccess: () => {
      hideProgress()
      query.refetch()
      setAlert({
        show: true,
        type: 'success',
        message: 'Match changes saved successfully.',
      })
    },
    onError: () => {
      hideProgress()
      setAlert({
        show: true,
        type: 'error',
        message: 'Unable to save match changes.',
      })
    },
  })

  function cridDisplay(uid: string) {
    return useNickname ? `${nicknames[uid] || uid}${includeCRID ? ` (${uid})` : ''}` : uid
  }

  function setTarget(rowId: string, oldId: string, newId: string, cohort: boolean) {
    setPendingChange({ oldId, newId, rowId, cohort })
    setConfirmOpen(true)
  }

  function applyChange() {
    if (!pendingChange) return

    let target = pendingChange.newId
    if (target === ADD_TEXT) {
      target = `${NEW_PREFIX}${newCounter}`
      setNicknames((current) => ({ ...current, [target]: shuffle([...NICKNAMES])[0] || `Group ${newCounter}` }))
      setNewCounter((current) => current + 1)
    }

    setRows((current) =>
      current.map((row) => {
        if (pendingChange.cohort && row.uid === pendingChange.oldId) {
          return { ...row, uid: target }
        }
        if (!pendingChange.cohort && row.id === pendingChange.rowId) {
          return { ...row, uid: target }
        }
        return row
      }),
    )

    setConfirmOpen(false)
    setPendingChange(null)
  }

  function reviewSummaryRows() {
    return reviewRows.map((row) => ({
      source: row.source,
      source_id: row.source_id,
      original_cr_id: row.ouid || row.uid,
      new_cr_id: row.uid,
    }))
  }

  return (
    <section className="grid gap-4">
      <PageHeader
        eyebrow="Resolve"
        title={`Resolve ${flagType === 'autoMatches' ? 'auto matches' : 'potential matches'}`}
        description="Rebucket patient candidates while preserving the existing backend resolution flow."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => setShowMatrix(true)}>
              Show score matrix
            </Button>
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => setShowReview(true)} disabled={saveMutation.isPending}>
              Save changes
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          {Object.entries(grouped).map(([uid, list]) => (
            <Card key={uid} className="border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-3">
                  {cridDisplay(uid)}
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                    CR ID: {uid}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Keep cohort</th>
                        <th className="px-3 py-2">Record</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Given</th>
                        <th className="px-3 py-2">Family</th>
                        <th className="px-3 py-2">UID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row) => (
                        <tr key={row.id} className="border-t border-white/5">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={Boolean(applyToCohort[row.id || ''])}
                              onCheckedChange={(checked) =>
                                setApplyToCohort((current) => ({ ...current, [row.id || '']: Boolean(checked) }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={row.uid}
                              onValueChange={(value) => setTarget(row.id, row.uid, value, Boolean(applyToCohort[row.id || '']))}
                            >
                              <SelectTrigger className="w-[16rem] border-white/10 bg-slate-950/60 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(grouped).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {cridDisplay(option)}
                                  </SelectItem>
                                ))}
                                <SelectItem value={ADD_TEXT}>{ADD_TEXT}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">{row.source}</td>
                          <td className="px-3 py-2">{row.given}</td>
                          <td className="px-3 py-2">{row.family}</td>
                          <td className="px-3 py-2">{row.source_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Options</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="nickname">Simplified naming</Label>
                <Switch id="nickname" checked={useNickname} onCheckedChange={setUseNickname} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="include-crid">Include real CR ID</Label>
                <Switch id="include-crid" checked={includeCRID} onCheckedChange={setIncludeCRID} />
              </div>
              <Separator className="bg-white/10" />
              <div className="text-sm text-slate-300">Rows changed: {reviewRows.length}</div>
              <div className="text-sm text-slate-300">Current user: {auth.username || 'Guest'}</div>
            </CardContent>
          </Card>

          {showMatrix ? (
            <Card className="border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle>Score matrix</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-300">
                    <tr>
                      <th className="px-2 py-1">Source</th>
                      {scoreHeaders.map((header) => (
                        <th key={header} className="px-2 py-1">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`score-${row.id}`} className="border-t border-white/5">
                        <td className="px-2 py-1">{row.source} {row.source_id}</td>
                        {scoreHeaders.map((header) => (
                          <td key={header} className="px-2 py-1">{row.scores?.[header] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Confirm bucket change</DialogTitle>
            <DialogDescription className="text-slate-300">
              {pendingChange?.cohort ? 'This change will apply to the whole cohort.' : 'This change will apply to a single row.'}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-slate-200">
            Move {pendingChange?.rowId} from <Badge className="mx-1">{pendingChange?.oldId}</Badge> to <Badge className="mx-1">{pendingChange?.newId}</Badge>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyChange}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Review changes</DialogTitle>
            <DialogDescription className="text-slate-300">
              {bucketsModified ? 'Confirm the rows that will be moved before saving.' : 'No buckets were changed. Saving will remove the current flag.'}
            </DialogDescription>
          </DialogHeader>
          {bucketsModified ? (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Source ID</th>
                    <th className="px-3 py-2">Original CR ID</th>
                    <th className="px-3 py-2">New CR ID</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewSummaryRows().map((row, index) => (
                    <tr key={`${row.source_id}-${index}`} className="border-t border-white/5">
                      <td className="px-3 py-2">{row.source}</td>
                      <td className="px-3 py-2">{row.source_id}</td>
                      <td className="px-3 py-2">{row.original_cr_id}</td>
                      <td className="px-3 py-2">{row.new_cr_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => setShowReview(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowReview(false)
                saveMutation.mutate()
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
