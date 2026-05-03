import type { ReactNode } from 'react'

export function PageHeader({
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
    <div className="flex items-center justify-between px-2 pb-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="ml-auto flex items-center space-x-2">{actions}</div> : null}
    </div>
  )
}
