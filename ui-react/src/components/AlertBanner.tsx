import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { useAppStore } from '#/store'

export function AlertBanner() {
  const alert = useAppStore((state) => state.alert)

  if (!alert.show) return null

  return (
    <Alert
      className={
        alert.type === 'error'
          ? 'border-rose-400/40 bg-rose-500/10 text-rose-50'
          : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-50'
      }
    >
      {alert.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      <AlertTitle className="font-semibold">
        {alert.type === 'error' ? 'Action failed' : 'Success'}
      </AlertTitle>
      <AlertDescription>{alert.message}</AlertDescription>
    </Alert>
  )
}
