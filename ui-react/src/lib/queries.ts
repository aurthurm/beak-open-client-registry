import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getJson } from '#/lib/api'
import { useAppStore } from '#/store'
import type { ClientEntry, CsvUpload } from '#/lib/types'

export const queryKeys = {
  clients: ['clients'] as const,
  systemURI: ['systemURI'] as const,
  matchIssues: ['matchIssues'] as const,
  autoMatches: ['autoMatches'] as const,
  csvUploads: ['csvUploads'] as const,
  displayConfig: ['displayConfig'] as const,
}

export function useBootstrapData() {
  const setClients = useAppStore((state) => state.setClients)
  const setSystemURI = useAppStore((state) => state.setSystemURI)
  const setCounts = useAppStore((state) => state.setCounts)
  const setCsvs = useAppStore((state) => state.setCsvs)

  const clientsQuery = useQuery({
    queryKey: queryKeys.clients,
    queryFn: () => getJson<ClientEntry[]>('/ocrux/config/getClients'),
  })

  const systemQuery = useQuery({
    queryKey: queryKeys.systemURI,
    queryFn: () => getJson<Record<string, { displayName: string; uri: string | string[] }>>('/ocrux/config/getURI'),
  })

  const matchCountQuery = useQuery({
    queryKey: queryKeys.matchIssues,
    queryFn: () => getJson<number>('/ocrux/match/count-match-issues'),
    refetchInterval: 60_000,
  })

  const autoMatchQuery = useQuery({
    queryKey: queryKeys.autoMatches,
    queryFn: () => getJson<number>('/ocrux/match/count-new-auto-matches'),
    refetchInterval: 60_000,
  })

  const csvQuery = useQuery({
    queryKey: queryKeys.csvUploads,
    queryFn: () => getJson<CsvUpload[]>('/ocrux/csv/getCSVUpload'),
  })

  useEffect(() => {
    if (clientsQuery.data) setClients(clientsQuery.data)
  }, [clientsQuery.data, setClients])

  useEffect(() => {
    if (systemQuery.data) setSystemURI(systemQuery.data)
  }, [setSystemURI, systemQuery.data])

  useEffect(() => {
    if (matchCountQuery.data === undefined || autoMatchQuery.data === undefined) {
      return
    }

    setCounts({
      totalMatchIssues: matchCountQuery.data,
      totalAutoMatches: autoMatchQuery.data,
    })
  }, [autoMatchQuery.data, matchCountQuery.data, setCounts])

  useEffect(() => {
    if (csvQuery.data) setCsvs(csvQuery.data)
  }, [csvQuery.data, setCsvs])

  return {
    clientsQuery,
    systemQuery,
    matchCountQuery,
    autoMatchQuery,
    csvQuery,
  }
}
