import { cn } from '@/lib/utils'

const WIDTHS = [320, 640, 1254] as const

/** Responsive NFT artwork from the 4 Figma sources (public/images/nft/<name>-<w>.webp). */
export function NftImage({
  image,
  alt,
  sizes = '(min-width: 1024px) 250px, 45vw',
  priority = false,
  className,
  style,
}: {
  image: string
  alt: string
  sizes?: string
  priority?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const base = `${import.meta.env.BASE_URL}images/nft/${image}`
  return (
    <img
      src={`${base}-640.webp`}
      srcSet={WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      width={640}
      height={640}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn('aspect-square w-full object-cover', className)}
      style={style}
    />
  )
}
