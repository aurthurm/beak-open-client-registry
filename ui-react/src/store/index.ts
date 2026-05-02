import { create } from 'zustand'

import type { AlertState, AuthState, ClientEntry, CsvUpload, ProgressState } from '#/lib/types'

type AppState = {
  auth: AuthState
  alert: AlertState
  progress: ProgressState
  clients: ClientEntry[]
  systemURI: Record<string, { displayName: string; uri: string | string[] }>
  totalMatchIssues: number
  totalAutoMatches: number
  csvs: CsvUpload[]
  setAuth: (auth: AuthState) => void
  clearAuth: () => void
  setAlert: (alert: Partial<AlertState> & Pick<AlertState, 'show' | 'type' | 'message'>) => void
  clearAlert: () => void
  showProgress: (title: string) => void
  hideProgress: () => void
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
  alert: {
    show: false,
    type: 'success',
    message: '',
  },
  progress: {
    show: false,
    title: '',
  },
  clients: [],
  systemURI: {},
  totalMatchIssues: 0,
  totalAutoMatches: 0,
  csvs: [],
  setAuth: (auth) => set({ auth }),
  clearAuth: () => set({ auth: initialAuth }),
  setAlert: (alert) =>
    set((state) => ({
      alert: {
        ...state.alert,
        ...alert,
      },
    })),
  clearAlert: () =>
    set({
      alert: {
        show: false,
        type: 'success',
        message: '',
      },
    }),
  showProgress: (title) =>
    set({
      progress: {
        show: true,
        title,
      },
    }),
  hideProgress: () =>
    set({
      progress: {
        show: false,
        title: '',
      },
    }),
  setClients: (clients) => set({ clients }),
  setSystemURI: (systemURI) => set({ systemURI }),
  setCounts: (counts) => set(counts),
  setCsvs: (csvs) => set({ csvs }),
}))
