import { Loader2 } from 'lucide-react'

import { useAppStore } from '#/store'

export function ProgressOverlay() {
  const progress = useAppStore((state) => state.progress)

  if (!progress.show) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 backdrop-blur-sm">
      <div className="flex min-w-[20rem] items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-5 py-4 text-white shadow-2xl">
        <Loader2 className="size-5 animate-spin text-emerald-300" />
        <div>
          <div className="text-sm font-semibold">{progress.title || 'Working...'}</div>
          <div className="text-xs text-slate-300">Please wait while the registry updates.</div>
        </div>
      </div>
    </div>
  )
}
