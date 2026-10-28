import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QuantityStepper({
  value,
  max,
  min = 1,
  onChange,
  label,
  size = 'md',
  disabled,
}: {
  value: number
  max: number
  min?: number
  onChange: (next: number) => void
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const btn = cn(
    'grid place-items-center rounded-full bg-brand text-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-sand-muted',
    size === 'sm' ? 'size-6' : 'size-10 rounded-[14px]',
  )
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir ${label}`}>
        <Minus className={size === 'sm' ? 'size-4' : 'size-6'} aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-5 text-center tabular-nums">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar ${label}`}>
        <Plus className={size === 'sm' ? 'size-4' : 'size-6'} aria-hidden />
      </button>
    </div>
  )
}
