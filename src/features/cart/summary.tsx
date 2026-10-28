import { useId, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { isApiError } from '@/api/client'
import type { Quote } from '@/api/contracts'
import { Skeleton } from '@/components/states'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useCart, useCoupon } from './queries'

export function CouponField({ compact }: { compact?: boolean }) {
  const id = useId()
  const cart = useCart()
  const coupon = useCoupon()
  const [code, setCode] = useState('')
  const error = coupon.isError && isApiError(coupon.error) ? (coupon.error.fields?.code ?? coupon.error.message) : null
  const applied = cart.data?.couponCode

  if (applied)
    return (
      <div className="flex items-center justify-between rounded-[4px] border border-brand/50 bg-brand/5 px-3 py-2 text-sm animate-in fade-in slide-in-from-top-1 duration-300" role="status">
        <span>
          Cupom <strong className="text-highlight">{applied}</strong> aplicado
        </span>
        <button type="button" onClick={() => coupon.mutate(null)} disabled={coupon.isPending} className="text-highlight hover:underline">
          Remover
        </button>
      </div>
    )
  return (
    <form
      className="animate-in fade-in duration-300"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) coupon.mutate(code.trim(), { onSuccess: () => setCode('') })
      }}
    >
      {!compact && (
        <label htmlFor={id} className="mb-2 block text-sm font-bold">
          Código promocional
        </label>
      )}
      <div className={cn('flex', compact && 'rounded-full bg-surface-card p-1')}>
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-label={compact ? 'Código promocional' : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('h-10 min-w-0 flex-1 border border-line-soft bg-transparent px-2 text-xs placeholder:text-sand', compact ? 'rounded-full border-0' : 'rounded-l-[4px]')}
        />
        <button type="submit" disabled={coupon.isPending || !code.trim()} className={cn('inline-flex items-center gap-2 bg-brand px-5 font-bold text-ink transition-[background-color,transform] hover:bg-brand-light active:scale-[0.97] disabled:opacity-60', compact ? 'rounded-full' : 'rounded-r-[4px]')}>
          {coupon.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {coupon.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </form>
  )
}

export function QuoteIssues({ quote }: { quote?: Quote }) {
  if (!quote?.issues.length) return null
  return (
    <div role="alert" className="flex gap-3 rounded-md border border-amber/60 bg-amber/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
      <ul className="flex flex-col gap-1">
        {quote.issues.map((i) => (
          <li key={`${i.itemId}-${i.kind}`}>{i.message}</li>
        ))}
      </ul>
    </div>
  )
}

export function QuoteTotals({ quote, loading }: { quote?: Quote; loading?: boolean }) {
  if (!quote)
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Calculando resumo">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
    )
  const discount = quote.discountEth === '0.00' ? '00.00' : formatEth(quote.discountEth).replace(' ETH', '')
  return (
    <dl className={cn('flex flex-col gap-3 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg">{formatEth(quote.subtotalEth)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>{quote.coupon ? `Desconto (${quote.coupon.code} −${quote.coupon.percentOff}%)` : 'Desconto do lançamento'}</dt>
        <dd key={discount} className="animate-in fade-in duration-500">
          (-) {discount}
        </dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between">
          <dt>Taxa de rede</dt>
          <dd className="text-lg">{formatEth(quote.networkFeeEth)}</dd>
        </div>
        <span className="self-end text-xs text-highlight">Taxa estimada</span>
      </div>
      <div className="flex justify-between border-t border-line pt-4 text-lg font-bold">
        <dt>Total</dt>
        <dd key={quote.totalEth} className="text-highlight animate-in fade-in duration-500" aria-live="polite">
          {formatEth(quote.totalEth)}
        </dd>
      </div>
    </dl>
  )
}
