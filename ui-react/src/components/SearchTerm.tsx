import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'

export function SearchTerm({
  label,
  value,
  onValueChange,
  onClear,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  onClear?: () => void
}) {
  return (
    <label className="flex min-w-[14rem] flex-1 flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={label}
          className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
        />
        {value ? (
          <Badge
            variant="secondary"
            className="cursor-pointer bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
            onClick={onClear}
          >
            Clear
          </Badge>
        ) : null}
      </div>
    </label>
  )
}
