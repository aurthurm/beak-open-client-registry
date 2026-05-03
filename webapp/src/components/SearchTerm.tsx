import { X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

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
    <div className="flex min-w-[200px] flex-col gap-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative flex items-center">
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={`Search ${label}...`}
          className="pr-8"
        />
        {value && onClear ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 h-full w-8 hover:bg-transparent"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
