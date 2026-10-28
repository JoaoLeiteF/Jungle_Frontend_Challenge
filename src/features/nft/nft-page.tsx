import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Search, Star } from 'lucide-react'
import { isApiError } from '@/api/client'
import type { Nft } from '@/api/contracts'
import { Icon } from '@/components/icon'
import { NftImage } from '@/components/nft-image'
import { QuantityStepper } from '@/components/quantity-stepper'
import { ErrorState, Skeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAddToCart } from '@/features/cart/queries'
import { FavoriteButton, NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { catalogQuery, nftQuery } from '@/features/catalog/queries'
import { NotFoundPage } from '@/features/misc/not-found'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const route = getRouteApi('/nft/$nftId')

const VIEWS = [
  { label: 'Obra completa', style: {} },
  { label: 'Detalhe do rosto', style: { transform: 'scale(1.6)', transformOrigin: '50% 35%' } },
  { label: 'Detalhe do acessório', style: { transform: 'scale(1.8)', transformOrigin: '50% 85%' } },
  { label: 'Detalhe da textura', style: { transform: 'scale(2.2)', transformOrigin: '25% 60%' } },
]

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-4', i <= Math.round(rating) ? 'fill-brand text-brand' : 'fill-sand-muted/40 text-sand-muted')} />
      ))}
    </span>
  )
}

function Gallery({ nft }: { nft: Nft }) {
  const [view, setView] = useState(0)
  const [zoom, setZoom] = useState(false)
  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-7">
      <div role="radiogroup" aria-label="Vistas da obra" className="grid grid-cols-4 gap-3 md:flex md:flex-col">
        {VIEWS.map((v, i) => (
          <button
            key={v.label}
            type="button"
            role="radio"
            aria-checked={view === i}
            aria-label={v.label}
            onClick={() => setView(i)}
            className={cn('aspect-square w-full max-w-[100px] overflow-hidden rounded-[10px] border-2 md:size-[100px]', view === i ? 'border-brand' : 'border-transparent')}
          >
            <NftImage image={nft.image} alt="" sizes="100px" style={v.style} />
          </button>
        ))}
      </div>
      <div className="relative min-w-0 flex-1 bg-surface-card p-3 md:p-5">
        <div
          className="group/lens overflow-hidden rounded-[22px] [@media(hover:hover)]:cursor-zoom-in"
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse') return
            const r = e.currentTarget.getBoundingClientRect()
            e.currentTarget.style.setProperty('--lens-x', `${((e.clientX - r.left) / r.width) * 100}%`)
            e.currentTarget.style.setProperty('--lens-y', `${((e.clientY - r.top) / r.height) * 100}%`)
          }}
          onClick={() => setZoom(true)}
        >
          <div className="origin-[var(--lens-x,50%)_var(--lens-y,50%)] transition-transform duration-300 ease-out group-hover/lens:scale-[2.2]">
            <NftImage image={nft.image} alt={`${nft.name} — ${VIEWS[view]!.label.toLowerCase()}`} priority sizes="(min-width: 768px) 640px, 90vw" style={VIEWS[view]!.style} />
          </div>
        </div>
        <button type="button" onClick={() => setZoom(true)} aria-label="Ampliar imagem" className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-ink text-cream hover:bg-brand hover:text-ink">
          <Search className="size-5" aria-hidden />
        </button>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,820px)] border-line bg-surface-card p-3">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">Imagem ampliada da obra</DialogDescription>
          <NftImage image={nft.image} alt={nft.name} sizes="820px" className="rounded-[16px]" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Purchase({ nft }: { nft: Nft }) {
  const navigate = useNavigate()
  const add = useAddToCart()
  const firstAvailable = nft.editions.find((e) => e.edition === 3 && e.available > 0) ?? nft.editions.find((e) => e.available > 0)
  const [editionId, setEditionId] = useState(firstAvailable?.edition ?? 3)
  const edition = nft.editions.find((e) => e.edition === editionId)!
  const limit = Math.min(edition.available, edition.maxPerOrder)
  const [wanted, setQty] = useState(1)
  const qty = Math.max(1, Math.min(wanted, limit))

  const soldOut = edition.available === 0
  const allSoldOut = nft.editions.every((e) => e.available === 0)
  const buy = (goToCart: boolean) =>
    add.mutate({ nftId: nft.id, edition: edition.edition, quantity: qty, name: nft.name }, { onSuccess: () => goToCart && navigate({ to: '/cart' }) })

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 font-bold">Edição:</legend>
        <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-2">
          {nft.editions.map((e) => {
            const out = e.available === 0
            return (
              <button
                key={e.edition}
                type="button"
                role="radio"
                aria-checked={e.edition === editionId}
                aria-disabled={out}
                aria-label={`Edição ${e.label}, ${formatEth(e.priceEth)}${out ? ', esgotada' : `, ${e.available} disponíveis`}`}
                onClick={() => !out && setEditionId(e.edition)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-sm uppercase',
                  e.edition === editionId ? 'border-brand text-highlight' : 'border-line-soft text-sand',
                  out && 'cursor-not-allowed line-through opacity-50',
                )}
              >
                {e.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-sand" aria-live="polite">
          {soldOut ? (
            <span className="text-danger">Edição {edition.label} esgotada — escolha outra edição.</span>
          ) : (
            `${edition.available} disponíveis · até ${edition.maxPerOrder} por pedido`
          )}
        </p>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="md:sr-only">Qtd.</span>
          <QuantityStepper value={qty} max={Math.max(1, limit)} onChange={setQty} label="quantidade" disabled={soldOut} />
        </div>
        <p className="text-xl font-bold text-highlight md:hidden">{formatEth(edition.priceEth)}</p>
        <div className="flex gap-2 max-md:w-full">
          <Button onClick={() => buy(true)} disabled={soldOut} loading={add.isPending} className="h-10 px-9 max-md:flex-1 max-md:rounded-full">
            {allSoldOut ? 'ESGOTADO' : 'COMPRAR'}
          </Button>
          <Button variant="outline" size="icon-lg" className="rounded-full md:hidden" onClick={() => buy(false)} disabled={soldOut || add.isPending} aria-label="Adicionar ao carrinho">
            <Icon name="shop" className="size-5" />
          </Button>
          <FavoriteButton nft={nft} withLabel className="h-10 rounded-[4px] border border-brand px-4 text-sm text-cream hover:bg-brand/10 max-md:hidden" />
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Preço da edição {edition.label}: {formatEth(edition.priceEth)}
      </p>
    </div>
  )
}

function Related({ nft }: { nft: Nft }) {
  const related = useQuery(catalogQuery({ collections: [nft.collection], pageSize: 6, sort: 'rating-desc' }))
  const items = related.data?.items.filter((n) => n.id !== nft.id).slice(0, 5)
  if (related.data && !items?.length) return null
  return (
    <section aria-labelledby="related" className="mt-20">
      <h2 id="related" className="border-b border-line pb-2 font-bold text-highlight">
        Mais desta coleção
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[22px]">
        {items
          ? items.map((n, i) => (
              <li key={n.id} className="reveal-x" style={{ animationRange: `entry ${i * 6}% cover ${32 + i * 6}%` }}>
                <NftCard nft={n} />
              </li>
            ))
          : Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
      </ul>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="mt-[68px] grid gap-8 md:grid-cols-[minmax(0,572px)_1fr]" aria-label="Carregando NFT" role="status">
      <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-7">
        <div className="grid grid-cols-4 gap-3 md:flex md:flex-col">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full max-w-[100px] rounded-[10px] md:size-[100px]" />
          ))}
        </div>
        <div className="flex-1 bg-surface-card p-5">
          <Skeleton className="aspect-square w-full rounded-[22px]" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

export function NftPage() {
  const { nftId } = route.useParams()
  const router = useRouter()
  const query = useQuery(nftQuery(nftId))
  const nft = query.data

  if (query.isError && isApiError(query.error) && query.error.status === 404)
    return <NotFoundPage title="NFT não encontrado" message="Este NFT não existe ou foi retirado do mercado." />
  if (query.isError && !nft) return <ErrorState className="mt-10" message={isApiError(query.error) ? query.error.message : undefined} onRetry={() => query.refetch()} retrying={query.isFetching} />
  if (!nft) return <DetailSkeleton />

  const price = nft.editions.find((e) => e.edition === 3)?.priceEth ?? nft.listPriceEth
  return (
    <article aria-labelledby="nft-title">
      <div className="flex items-center justify-between py-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="grid size-9 place-items-center rounded-full bg-surface-card">
          <ChevronLeft aria-hidden />
        </button>
        <FavoriteButton nft={nft} className="grid size-9 place-items-center rounded-full bg-surface-card text-brand" />
      </div>
      <nav aria-label="Trilha" className="mt-6 mb-4 text-base font-bold max-md:hidden">
        <Link to="/" className="hover:text-highlight">
          Início
        </Link>{' '}
        /{' '}
        <Link to="/" hash="catalogo" className="hover:text-highlight">
          Mercado
        </Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-[minmax(0,572px)_1fr] md:gap-8">
        <Gallery nft={nft} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 id="nft-title" className="text-xl font-bold md:text-[28px]">
              {nft.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <p className="text-xl font-bold text-highlight max-md:hidden">{formatEth(price)}</p>
            <p className="flex items-center gap-2 text-sm">
              <Stars rating={nft.rating} />
              <span>
                <span className="sr-only">Nota {nft.rating} de 5, </span>
                {nft.reviewCount} avaliações de colecionadores
              </span>
            </p>
          </div>
          <section aria-labelledby="about">
            <h2 id="about" className="font-bold">
              Sobre este NFT:
            </h2>
            <p className="mt-2 text-sm leading-6 text-sand">{nft.description}</p>
          </section>
          <Purchase key={nft.id} nft={nft} />
          <dl className="flex flex-col gap-2 text-sm text-sand">
            <div className="flex gap-1">
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Coleção:</dt>
              <dd>
                <Link to="/" search={{ collections: nft.collection }} className="hover:text-highlight">
                  {nft.collectionName}
                </Link>
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <Share nft={nft} />
        </div>
      </div>

      <Tabs defaultValue="details" className="mt-16">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-x-6 gap-y-2 rounded-none border-b border-line bg-transparent p-0">
          {[
            ['details', 'Detalhes do NFT'],
            ['reviews', `Avaliações de colecionadores (${nft.reviewCount})`],
          ].map(([v, label]) => (
            <TabsTrigger
              key={v}
              value={v!}
              className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-2 text-left text-sm whitespace-normal md:text-base data-[state=active]:border-highlight data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-highlight data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="details" className="mt-4 flex flex-col gap-4 text-sm leading-6 text-sand">
          <p>
            {nft.name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na rede. A obra explora identidade,
            movimento e luz em um mundo digital sem fronteiras.
          </p>
          <p>
            A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência. {nft.creator} recebe {nft.royaltyPercent}% de
            direitos autorais nas vendas secundárias.
          </p>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-bold text-cream">Rede:</dt>
              <dd>Cunhado na {nft.network === 'ethereum' ? 'Ethereum' : nft.network === 'polygon' ? 'Polygon' : 'Solana'} com procedência imutável e metadados armazenados no IPFS.</dd>
            </div>
            <div>
              <dt className="font-bold text-cream">Contrato:</dt>
              <dd>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</dd>
            </div>
            <div>
              <dt className="font-bold text-cream">Direitos autorais:</dt>
              <dd>
                {nft.contractAddress.slice(0, 6)}…{nft.contractAddress.slice(-4)} • Contrato inteligente ERC-721 verificado.
              </dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          <ul className="flex flex-col gap-4">
            {nft.reviews?.map((r) => (
              <li key={r.id} className="rounded-md bg-surface-card p-4 text-sm">
                <p className="flex items-center gap-2 font-bold">
                  {r.author} <Stars rating={r.rating} />
                  <span className="sr-only">{r.rating} de 5</span>
                </p>
                <p className="mt-1 text-sand">{r.text}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
      <Related nft={nft} />
    </article>
  )
}

function Share({ nft }: { nft: Nft }) {
  const url = typeof location !== 'undefined' ? `${location.origin}/nft/${nft.id}` : ''
  const text = `${nft.name} na Kurio`
  const links = [
    { label: 'LinkedIn', icon: 'linkedin' as const, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: 'E-mail', icon: 'message' as const, href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}` },
    { label: 'Twitter', icon: 'twitter' as const, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  ]
  return (
    <div className="flex items-center gap-3 text-sm font-bold">
      <span>Compartilhar este NFT:</span>
      <ul className="flex items-center gap-2">
        {links.map((l) => (
          <li key={l.label} className="flex">
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Compartilhar no ${l.label} (abre em nova aba)`}
              className="grid size-8 place-items-center rounded-full border border-line-soft text-cream transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-ink active:scale-95"
            >
              <Icon name={l.icon} className={l.icon === 'message' ? 'size-5' : 'size-[30px]'} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
