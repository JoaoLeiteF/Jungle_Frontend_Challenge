import { useEffect, useId, useState } from 'react'
import type { CatalogPage } from '@/api/contracts'
import type { CatalogSearch } from '@/app/router'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/states'
import { cmpEth, isEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

export type SearchPatch = Partial<CatalogSearch>

const toggleIn = (csv: string | undefined, value: string) => {
  const set = new Set(csv?.split(',').filter(Boolean))
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].join(',') : undefined
}

function FacetList({ title, items, selected, onToggle }: { title: string; items: CatalogPage['facets']['collections']; selected?: string; onToggle: (v: string) => void }) {
  const chosen = new Set(selected?.split(','))
  return (
    <fieldset>
      <legend className="mb-3 text-lg font-bold">{title}</legend>
      <ul className="flex flex-col gap-1">
        {/* alphabetical: the Figma order was flagged as hard to scan */}
        {[...items]
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
          .map((f) => {
            const on = chosen.has(f.value)
            return (
              <li key={f.value}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(f.value)}
                  className={cn('flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-surface-raised', on ? 'font-bold text-highlight' : 'text-cream')}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn('size-3 rounded-[3px] border', on ? 'border-highlight bg-highlight' : 'border-line-soft')} />
                    {f.label}
                  </span>
                  <span className={cn('tabular-nums', on ? 'text-highlight' : 'text-brand')}>({f.count})</span>
                </button>
              </li>
            )
          })}
      </ul>
    </fieldset>
  )
}

function PriceRange({ range, search, onApply }: { range: { min: string; max: string }; search: CatalogSearch; onApply: (p: SearchPatch) => void }) {
  const id = useId()
  const bounds = [Number(range.min), Number(range.max)] as const
  const [min, setMin] = useState(search.min ?? range.min)
  const [max, setMax] = useState(search.max ?? range.max)
  useEffect(() => {
    setMin(search.min ?? range.min)
    setMax(search.max ?? range.max)
  }, [search.min, search.max, range.min, range.max])

  const valid = isEth(min) && isEth(max) && cmpEth(min, max) <= 0
  return (
    <fieldset>
      <legend className="mb-3 text-lg font-bold">Faixa de preço</legend>
      <Slider
        min={bounds[0]}
        max={bounds[1]}
        step={0.01}
        value={[Number(isEth(min) ? min : bounds[0]), Number(isEth(max) ? max : bounds[1])]}
        onValueChange={([a, b]) => {
          setMin(a!.toFixed(2))
          setMax(b!.toFixed(2))
        }}
        aria-label="Faixa de preço em ETH"
        className="my-4"
      />
      {/* Sliders are imprecise on touch: typed bounds are the exact source of truth. */}
      <div className="flex items-end gap-2 text-sm">
        <label className="flex flex-1 flex-col gap-1" htmlFor={`${id}-min`}>
          Mín. (ETH)
          <input id={`${id}-min`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value.replace(',', '.'))} aria-invalid={!valid} className="h-8 w-full rounded border border-line-soft bg-ink px-2" />
        </label>
        <label className="flex flex-1 flex-col gap-1" htmlFor={`${id}-max`}>
          Máx. (ETH)
          <input id={`${id}-max`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(',', '.'))} aria-invalid={!valid} className="h-8 w-full rounded border border-line-soft bg-ink px-2" />
        </label>
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        {valid ? `Preço: ${min} – ${max} ETH` : <span className="text-danger">Informe um intervalo válido (mín. ≤ máx.).</span>}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onApply({ min: min === range.min ? undefined : min, max: max === range.max ? undefined : max })}
          className="rounded-[4px] bg-brand px-3 py-1 text-sm font-bold text-ink hover:bg-brand-light disabled:opacity-50"
        >
          Aplicar
        </button>
        {(search.min || search.max) && (
          <button type="button" onClick={() => onApply({ min: undefined, max: undefined })} className="px-2 text-sm text-highlight hover:underline">
            Limpar
          </button>
        )}
      </div>
    </fieldset>
  )
}

export function Filters({ data, search, onChange }: { data?: CatalogPage; search: CatalogSearch; onChange: (p: SearchPatch) => void }) {
  if (!data)
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    )
  return (
    <div className="flex flex-col gap-8">
      <FacetList title="Coleções" items={data.facets.collections} selected={search.collections} onToggle={(v) => onChange({ collections: toggleIn(search.collections, v) })} />
      <PriceRange range={data.facets.priceRange} search={search} onApply={onChange} />
      <FacetList title="Rede" items={data.facets.networks} selected={search.networks} onToggle={(v) => onChange({ networks: toggleIn(search.networks, v) })} />
    </div>
  )
}
