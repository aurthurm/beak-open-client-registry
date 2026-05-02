import type { ReactNode } from 'react'

import { Badge } from '#/components/ui/badge'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_20px_40px_rgba(0,0,0,0.24)] backdrop-blur-md sm:px-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <Badge variant="outline" className="mb-3 border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            {eyebrow}
          </Badge>
        ) : null}
        <h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
