import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PageHeader } from '#/components/PageHeader'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
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
import { Label } from '#/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Switch } from '#/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { fetchPotentialMatches, resolveMatchIssue } from '#/lib/ocrux'
import { useAppStore } from '#/store'
import type { PotentialRow } from '#/lib/types'
import { Eye, X } from 'lucide-react'

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
  const [openDetailRows, setOpenDetailRows] = useState<Record<string, boolean>>({})
  const detailDockRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!Object.values(openDetailRows).some(Boolean)) {
      return
    }

    detailDockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [openDetailRows])

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
    mutationFn: async () => {
      const promise = resolveMatchIssue({
        resolves: rows,
        resolvingFrom: clientId,
        removeFlag: !bucketsModified,
        flagType,
      })
      toast.promise(promise, {
        loading: 'Saving match changes...',
        success: 'Match changes saved successfully.',
        error: 'Unable to save match changes.',
      })
      return promise
    },
    onSuccess: () => {
      query.refetch()
    },
  })

  function cridDisplay(uid: string) {
    return useNickname ? `${nicknames[uid] || uid}${includeCRID ? ` (${uid})` : ''}` : uid
  }

  function cridColumnLabel() {
    if (!useNickname) {
      return 'CR ID'
    }

    return includeCRID ? 'Temporary CR ID / Actual CR ID' : 'Temporary CR ID'
  }

  function formatBirthDate(value?: string) {
    if (!value) {
      return '—'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  }

  function getBirthDateValue(row: PotentialRow) {
    return (row.birthDate as string | undefined) || row.birthdate || ''
  }

  function getPhoneValue(row: PotentialRow) {
    const value = row.phone
    if (typeof value === 'string' && value.trim()) {
      return value
    }

    return '—'
  }

  function getResolveDetailRows(detail: PotentialRow) {
    const fields = [
      { label: 'Source', value: detail.source || '—' },
      { label: 'Source ID', value: detail.source_id || '—', mono: true },
      { label: 'Surname', value: detail.family || '—' },
      { label: 'Given Names', value: detail.given || '—' },
      { label: 'Gender', value: detail.gender || '—', capitalize: true },
      { label: 'Date of Birth', value: formatBirthDate(getBirthDateValue(detail)) },
      { label: 'phone', value: getPhoneValue(detail) },
    ]

    const extras = Object.entries(detail)
      .filter(([key]) => key.startsWith('identifier_') || key.startsWith('extension_'))
      .map(([key, value]) => ({
        label: key,
        value: typeof value === 'string' ? value : value === null || value === undefined ? '—' : JSON.stringify(value),
        mono: key.startsWith('identifier_'),
      }))

    return [...fields, ...extras]
  }

  function scoreEntries(row: PotentialRow) {
    return Object.entries(row.scores || {}).sort(([left], [right]) => left.localeCompare(right))
  }

  function toggleDetailRow(row: PotentialRow) {
    setOpenDetailRows((current) => ({ ...current, [row.id]: !current[row.id] }))
  }

  function closeDetailRow(rowId: string) {
    setOpenDetailRows((current) => ({ ...current, [rowId]: false }))
  }

  function setTarget(rowId: string, oldId: string, newId: string, cohort: boolean) {
    if (newId === oldId) {
      return
    }

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

  const openDetailList = rows.filter((row) => openDetailRows[row.id])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader
        title={`Resolve ${flagType === 'autoMatches' ? 'auto matches' : 'potential matches'}`}
        description="Rebucket patient candidates while preserving the existing backend resolution flow."
        actions={(
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setShowMatrix(!showMatrix)}>
              {showMatrix ? 'Hide' : 'Show'} matrix
            </Button>
            <Button size="sm" onClick={() => setShowReview(true)} disabled={saveMutation.isPending}>
              Save changes
            </Button>
          </div>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-6">
          {Object.entries(grouped).map(([uid, list]) => (
            <Card key={uid}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {cridDisplay(uid)}
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    ID: {uid}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border">
                  <Table className="table-fixed">
                    <caption className="sr-only">
                      Records assigned to {cridDisplay(uid)}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14 px-1 text-[10px]">Move all</TableHead>
                        <TableHead className="w-[11rem] px-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium leading-none">{cridColumnLabel()}</span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Target Bucket</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-[6rem] px-2 text-[10px]">Source</TableHead>
                        <TableHead className="w-[8rem] px-2 text-[10px]">Source ID</TableHead>
                        <TableHead className="w-[8rem] px-2 text-[10px]">Surname</TableHead>
                        <TableHead className="w-[9rem] px-2 text-[10px]">Given Names</TableHead>
                        <TableHead className="w-[7rem] px-2 text-[10px]">Date of Birth</TableHead>
                        <TableHead className="w-[5rem] px-2 text-[10px]">Gender</TableHead>
                        <TableHead className="w-[5rem] px-2 text-[10px]">Full View</TableHead>
                        <TableHead className="px-2 text-[10px]">Scores</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="px-1">
                            <Checkbox
                              aria-label="Move all records in this temporary CR ID"
                              checked={Boolean(applyToCohort[row.id || ''])}
                              onCheckedChange={(checked) =>
                                setApplyToCohort((current) => ({ ...current, [row.id || '']: Boolean(checked) }))
                              }
                            />
                          </TableCell>
                          <TableCell className="px-2">
                            <Select
                              value={row.uid}
                              onValueChange={(value) => setTarget(row.id, row.uid, value, Boolean(applyToCohort[row.id || '']))}
                            >
                              <SelectTrigger className="h-8 w-full justify-between gap-2 px-2 text-[11px]">
                                <span className="min-w-0 flex-1 truncate text-left leading-tight">
                                  {cridDisplay(row.uid)}
                                </span>
                              </SelectTrigger>
                              <SelectContent className="w-max min-w-[18rem] max-w-[calc(100vw-2rem)]">
                                {Object.keys(grouped).map((option) => (
                                  <SelectItem key={option} value={option} className="whitespace-normal break-words">
                                    <span className="block max-w-full break-words">
                                      {cridDisplay(option)}
                                    </span>
                                  </SelectItem>
                                ))}
                                <SelectItem value={ADD_TEXT} className="whitespace-normal break-words">
                                  <span className="block max-w-full break-words">{ADD_TEXT}</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {row.source}
                          </TableCell>
                          <TableCell className="px-2 text-[11px] font-mono text-muted-foreground">
                            <Link
                              to="/client/$clientId"
                              params={{ clientId: row.id }}
                              search={{ pos: row.source, sourceId: row.source_id }}
                              className="break-all underline-offset-2 hover:underline"
                            >
                              {row.source_id}
                            </Link>
                          </TableCell>
                          <TableCell className="px-2 text-[11px] font-medium leading-tight">{row.family || '—'}</TableCell>
                          <TableCell className="px-2 text-[11px] leading-tight">{row.given || '—'}</TableCell>
                          <TableCell className="px-2 text-[11px]">{formatBirthDate(getBirthDateValue(row))}</TableCell>
                          <TableCell className="px-2 text-[11px] capitalize">{row.gender || '—'}</TableCell>
                          <TableCell className="px-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-[11px]"
                              onClick={() => toggleDetailRow(row)}
                            >
                              <Eye className="size-3.5" />
                              {openDetailRows[row.id] ? 'Hide' : 'View'}
                            </Button>
                          </TableCell>
                          <TableCell className="px-2">
                            <div className="flex flex-wrap gap-1">
                              {scoreEntries(row).length ? (
                                <>
                                  {scoreEntries(row).slice(0, 2).map(([key, value]) => (
                                    <Badge key={`${row.id}-${key}`} variant="outline" className="h-5 max-w-full px-1.5 text-[10px] tabular-nums">
                                      {key}: {String(value)}
                                    </Badge>
                                  ))}
                                  {scoreEntries(row).length > 2 ? (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
                                      +{scoreEntries(row).length - 2}
                                    </Badge>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resolution Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="nickname" className="text-xs">Temporary CR IDs</Label>
                <Switch id="nickname" checked={useNickname} onCheckedChange={setUseNickname} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="include-crid" className="text-xs">Show actual CR IDs</Label>
                <Switch id="include-crid" checked={includeCRID} onCheckedChange={setIncludeCRID} />
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="text-sm font-medium">{reviewRows.length} rows modified</p>
                <p className="text-xs text-muted-foreground">User: {auth.username || 'Guest'}</p>
              </div>
            </CardContent>
          </Card>

          {showMatrix && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Score Matrix</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4 text-[10px]">Source</TableHead>
                        {scoreHeaders.map((header) => (
                          <TableHead key={header} className="px-2 text-[10px]">{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={`score-${row.id}`}>
                          <TableCell className="px-4 py-2 font-mono text-[9px] truncate max-w-[80px]">
                            {row.source_id}
                          </TableCell>
                          {scoreHeaders.map((header) => (
                            <TableCell key={header} className="px-2 py-2 text-[10px]">
                              {row.scores?.[header] ?? '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingChange?.cohort ? 'Move all records' : 'Move one record'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.cohort ? 'Apply this move to all records in the same temporary CR ID.' : 'Move this single record to another temporary CR ID.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Move <span className="font-mono text-foreground">{pendingChange?.rowId}</span> from{' '}
            <Badge variant="outline">{pendingChange?.oldId}</Badge> to <Badge>{pendingChange?.newId}</Badge>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyChange}>Apply Move</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Resolution Changes</DialogTitle>
            <DialogDescription>
              {bucketsModified ? 'Verify the following record reassignments.' : 'No changes detected. Proceed to clear the current match flag.'}
            </DialogDescription>
          </DialogHeader>
          {bucketsModified && (
            <div className="max-h-[400px] overflow-y-auto rounded-md border mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source ID</TableHead>
                    <TableHead>Original CR ID</TableHead>
                    <TableHead>New CR ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewSummaryRows().map((row, index) => (
                    <tr key={`${row.source_id}-${index}`} className="border-b last:border-0">
                      <td className="px-4 py-2 text-sm font-mono">{row.source_id}</td>
                      <td className="px-4 py-2 text-sm"><Badge variant="outline">{row.original_cr_id}</Badge></td>
                      <td className="px-4 py-2 text-sm"><Badge>{row.new_cr_id}</Badge></td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowReview(false)}>Go Back</Button>
            <Button
              onClick={() => {
                setShowReview(false)
                saveMutation.mutate()
              }}
            >
              Commit Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div ref={detailDockRef} className="space-y-4">
        {openDetailList.length ? (
          <Card className="border-dashed border-muted-foreground/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Eye className="size-4" />
                Patient detail comparison
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {openDetailList.length} open
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {openDetailList.map((detail) => (
                  <Card key={detail.id} className="min-w-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          Source: {detail.source} {detail.source_id}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => closeDetailRow(detail.id)}
                          aria-label={`Close detail for ${detail.source_id}`}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="space-y-2">
                        {getResolveDetailRows(detail).map((row, index, allRows) => (
                          <div
                            key={`${detail.id}-${row.label}-${index}`}
                            className={[
                              'grid grid-cols-[10rem_minmax(0,1fr)] gap-2',
                              index < allRows.length - 1 ? 'border-b border-dashed border-border/70 pb-2' : '',
                            ].join(' ')}
                          >
                            <span className="text-muted-foreground">{row.label}</span>
                            <span
                              className={[
                                'min-w-0 break-words text-right font-medium',
                                row.mono ? 'font-mono text-xs' : '',
                                row.capitalize ? 'capitalize' : '',
                              ].join(' ')}
                            >
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Scores</p>
                        {scoreEntries(detail).length ? (
                          scoreEntries(detail).map(([key, value]) => (
                            <div key={`${detail.id}-${key}`} className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">{key}</span>
                              <Badge variant="secondary" className="tabular-nums">
                                {String(value)}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground">No scores available.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
