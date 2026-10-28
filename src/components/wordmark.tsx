import { cn } from '@/lib/utils'

const LETTERS = 'KURIO'.split('')

/** Facet mark + spaced name. `animated` plays the one-time letter rise (header and auth only). */
export function Wordmark({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-[0.45em] font-bold', className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-[1.1em] shrink-0 text-brand transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/brand:rotate-90">
        <path d="M12 1 23 12 12 23 1 12Z" fill="currentColor" />
        <path d="M12 6 18 12 12 18 6 12Z" fill="var(--color-highlight)" opacity="0.6" />
        <path d="M12 1v22M1 12h22" stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="1.1" />
      </svg>
      <span className="sr-only">KURIO</span>
      <span aria-hidden className="mr-[-0.3em] tracking-[0.3em]">
        {LETTERS.map((l, i) => (
          <span key={i} className={cn('inline-block', animated && 'wordmark-letter')} style={animated ? { animationDelay: `${120 + i * 70}ms` } : undefined}>
            {l}
          </span>
        ))}
      </span>
    </span>
  )
}
