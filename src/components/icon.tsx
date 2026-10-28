import { cn } from '@/lib/utils'

export type FigmaIcon = 'search' | 'shop' | 'user' | 'arrow-down' | 'message' | 'x' | 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'thank-you'

/** Figma-exported SVGs (public/icons) painted with currentColor through a CSS mask — no JS, no duplication. */
export function Icon({ name, className }: { name: FigmaIcon; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-5 shrink-0 bg-current', className)}
      style={{
        maskImage: `url(${import.meta.env.BASE_URL}icons/${name}.svg)`,
        WebkitMaskImage: `url(${import.meta.env.BASE_URL}icons/${name}.svg)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
}
