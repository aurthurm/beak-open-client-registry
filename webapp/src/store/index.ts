import { create } from 'zustand'

import type { AuthState, ClientEntry, CsvUpload } from '#/lib/types'

type AppState = {
  auth: AuthState
  clients: ClientEntry[]
  systemURI: Record<string, { displayName: string; uri: string | string[] }>
  totalMatchIssues: number
  totalAutoMatches: number
  csvs: CsvUpload[]
  setAuth: (auth: AuthState) => void
  clearAuth: () => void
  setClients: (clients: ClientEntry[]) => void
  setSystemURI: (systemURI: Record<string, { displayName: string; uri: string | string[] }>) => void
  setCounts: (counts: { totalMatchIssues: number; totalAutoMatches: number }) => void
  setCsvs: (csvs: CsvUpload[]) => void
}

const initialAuth: AuthState = {
  token: '',
  username: '',
  userID: '',
  role: '',
}

export const useAppStore = create<AppState>((set) => ({
  auth: initialAuth,
  clients: [],
  systemURI: {},
  totalMatchIssues: 0,
  totalAutoMatches: 0,
  csvs: [],
  setAuth: (auth) => set({ auth }),
  clearAuth: () => set({ auth: initialAuth }),
  setClients: (clients) => set({ clients }),
  setSystemURI: (systemURI) => set({ systemURI }),
  setCounts: (counts) => set(counts),
  setCsvs: (csvs) => set({ csvs }),
}))
