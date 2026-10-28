import { Link, useNavigate } from '@tanstack/react-router'
import { Eye, Heart, Sparkles } from 'lucide-react'
import type { Nft } from '@/api/contracts'
import { useSession } from '@/app/session'
import { Icon } from '@/components/icon'
import { NftImage } from '@/components/nft-image'
import { Skeleton } from '@/components/states'
import { useAddToCart } from '@/features/cart/queries'
import { LivePrice } from '@/components/live-price'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useFavorites, useToggleFavorite } from './queries'

export function FavoriteButton({ nft, className, withLabel }: { nft: Pick<Nft, 'id' | 'name'>; className?: string; withLabel?: boolean }) {
  const s = useSession()
  const navigate = useNavigate()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const on = !!favorites.data?.includes(nft.id)
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={s.status === 'loading' || toggle.isPending}
      aria-label={withLabel ? undefined : on ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
      onClick={() => {
        if (s.status !== 'authenticated') return navigate({ to: '/login', search: { redirect: `/nft/${nft.id}` } })
        toggle.mutate({ nftId: nft.id, on: !on, name: nft.name })
      }}
      className={cn('flex items-center justify-center gap-2 transition-colors', className)}
    >
      <Heart className={cn('size-5', on && 'fill-current')} aria-hidden />
      {withLabel && (on ? 'Favoritado' : 'Favoritar')}
    </button>
  )
}

const isRare = (nft: Nft) => nft.attributes.includes('Raro') || nft.attributes.includes('Lendário')

export function NftCard({ nft, priority }: { nft: Nft; priority?: boolean }) {
  const add = useAddToCart()
  const defaultEdition = nft.editions[2]!
  const action = 'grid size-8 place-items-center rounded-md bg-ink/85 text-cream shadow-[0_2px_8px_rgb(0_0_0/0.35)] transition-[background-color,color,transform] duration-150 hover:bg-brand hover:text-ink active:scale-90 disabled:opacity-50'
  return (
    <article className={cn('group flex flex-col gap-3', !priority && 'animate-in fade-in duration-500 ease-out')} aria-labelledby={`nft-${nft.id}`}>
      <div className="relative rounded-sm bg-surface-card p-3 transition-[background-color,transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:bg-surface-raised group-hover:shadow-[0_12px_24px_-12px_rgb(0_0_0/0.6)]">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} tabIndex={-1} aria-hidden className="block overflow-hidden rounded-card">
          <NftImage image={nft.image} alt="" priority={priority} className="transition-transform duration-500 ease-out group-hover:scale-105" />
        </Link>
        {isRare(nft) && (
          <span className="rare-badge absolute overflow-hidden top-5 left-5 inline-flex items-center gap-1 rounded-full bg-brand py-0.5 pr-2.5 pl-2 text-[11px] font-bold tracking-[0.08em] text-ink shadow-[0_2px_8px_rgb(0_0_0/0.4)]">
            <Sparkles className="size-3" aria-hidden />
            RARO
          </span>
        )}
        <FavoriteButton nft={nft} className={cn(action, 'absolute top-5 right-5 md:hidden')} />
        <div className="absolute inset-x-0 bottom-5 flex translate-y-2 justify-center gap-2 opacity-0 transition-[opacity,transform] duration-300 ease-out group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden">
          <button
            type="button"
            className={action}
            aria-label={`Adicionar ${nft.name} (edição ${defaultEdition.label}) ao carrinho`}
            disabled={add.isPending || defaultEdition.available === 0}
            onClick={() => add.mutate({ nftId: nft.id, edition: defaultEdition.edition, quantity: 1, name: nft.name })}
          >
            <Icon name="shop" className="size-4" />
          </button>
          <FavoriteButton nft={nft} className={action} />
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={action} aria-label={`Ver detalhes de ${nft.name}`}>
            <Eye className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div>
        <h3 id={`nft-${nft.id}`} className="text-base">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="transition-colors hover:text-highlight focus-visible:text-highlight">
            {nft.name}
          </Link>
        </h3>
        <p className="mt-1 font-bold text-highlight">
          <span className="sr-only">Preço: </span>
          <LivePrice value={nft.listPriceEth} />
          {nft.compareAtEth && (
            <s className="ml-2 font-normal text-sand">
              <span className="sr-only">antes </span>
              {formatEth(nft.compareAtEth)}
            </s>
          )}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="rounded-sm bg-surface-card p-3">
        <Skeleton className="aspect-square w-full rounded-card" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
