import { useQuery } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { isApiError } from '@/api/client'
import type { CartItem } from '@/api/contracts'
import { NftImage } from '@/components/nft-image'
import { QuantityStepper } from '@/components/quantity-stepper'
import { EmptyState, ErrorState, Skeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { catalogQuery } from '@/features/catalog/queries'
import { formatEth, mulEth } from '@/lib/eth'
import { useCart, useQuote, useRemoveItem, useUpdateQuantity } from './queries'
import { CouponField, QuoteIssues, QuoteTotals } from './summary'

function Line({ item }: { item: CartItem }) {
  const update = useUpdateQuantity()
  const remove = useRemoveItem()
  const limit = Math.min(item.available, item.maxPerOrder)
  const unavailable = item.available === 0
  return (
    <li className="grid grid-cols-[70px_1fr_auto] items-center gap-x-4 gap-y-2 bg-surface-card md:grid-cols-[70px_1fr_140px_136px_130px_48px] md:gap-x-0 md:pr-4">
      <NftImage image={item.nft.image} alt="" sizes="70px" className="row-span-2 size-[70px] md:row-span-1" />
      <div className="min-w-0 md:pl-4">
        <p className="truncate font-bold">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="hover:text-highlight">
            {item.nft.name}
          </Link>
        </p>
        <p className="text-sm text-sand">
          ID do token: {item.nft.tokenId} · Edição {item.editionLabel}
        </p>
        {unavailable ? (
          <p className="text-xs text-danger">Esgotado — remova para continuar</p>
        ) : item.quantity > limit ? (
          <p className="text-xs text-amber">Só restam {limit}</p>
        ) : null}
      </div>
      <p className="font-bold text-highlight max-md:col-start-2 max-md:row-start-2 md:font-normal md:text-cream">
        <span className="sr-only">Preço unitário: </span>
        {formatEth(item.unitPriceEth)}
      </p>
      <div className="max-md:col-start-3 max-md:row-start-1 max-md:row-end-3 max-md:flex max-md:flex-col max-md:items-end max-md:gap-2 max-md:pr-3">
        <QuantityStepper
          size="sm"
          value={item.quantity}
          max={Math.max(item.quantity > limit ? item.quantity : limit, 1)}
          onChange={(quantity) => update.mutate({ itemId: item.id, quantity })}
          label={`quantidade de ${item.nft.name}`}
          disabled={unavailable}
        />
        <button type="button" onClick={() => remove.mutate({ itemId: item.id, name: item.nft.name })} disabled={remove.isPending} aria-label={`Remover ${item.nft.name} do carrinho`} className="text-sand hover:text-danger md:hidden">
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>
      <p className="font-bold text-highlight max-md:hidden">
        <span className="sr-only">Total da linha: </span>
        {formatEth(mulEth(item.unitPriceEth, item.quantity))}
      </p>
      <button type="button" onClick={() => remove.mutate({ itemId: item.id, name: item.nft.name })} disabled={remove.isPending} aria-label={`Remover ${item.nft.name} do carrinho`} className="justify-self-center text-sand hover:text-danger max-md:hidden">
        <Trash2 className="size-5" aria-hidden />
      </button>
    </li>
  )
}

function AlsoViewed() {
  const q = useQuery(catalogQuery({ tab: 'trending', pageSize: 5, sort: 'rating-desc' }))
  return (
    <section aria-labelledby="also" className="mt-24">
      <h2 id="also" className="border-b border-line pb-2 font-bold text-highlight">
        Colecionadores também viram
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[26px]">
        {(q.data?.items ?? Array.from({ length: 5 }, () => null)).map((n, i) => (
          <li key={n?.id ?? i}>{n ? <NftCard nft={n} /> : <NftCardSkeleton />}</li>
        ))}
      </ul>
    </section>
  )
}

export function CartPage() {
  const router = useRouter()
  const cart = useCart()
  const quote = useQuote()
  const items = cart.data?.items ?? []
  const blocked = !!quote.data?.issues.some((i) => i.kind === 'sold-out') || !quote.data

  return (
    <div>
      <div className="flex items-center gap-4 py-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="grid size-9 place-items-center rounded-full bg-surface-card">
          <ChevronLeft aria-hidden />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold">Carrinho de NFTs</h1>
        <span className="size-9" />
      </div>
      <nav aria-label="Trilha" className="mt-6 text-base font-bold max-md:hidden">
        <Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link> / <span aria-current="page">Carrinho</span>
      </nav>
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      {cart.isError && !cart.data ? (
        <ErrorState className="mt-8" message={isApiError(cart.error) ? cart.error.message : undefined} onRetry={() => cart.refetch()} retrying={cart.isFetching} />
      ) : !cart.data ? (
        <div className="mt-8 flex flex-col gap-3" role="status" aria-label="Carregando carrinho">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[70px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState className="mt-8" title="Seu carrinho está vazio">
          <Button asChild className="mt-2">
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="mt-1 grid gap-10 lg:grid-cols-[782px_1fr] lg:gap-[86px]">
          <div>
            <div className="grid grid-cols-[1fr_140px_136px_130px_48px] border-b border-line pb-3 font-bold max-md:hidden md:grid-cols-[70px_1fr_140px_136px_130px_48px]" aria-hidden>
              <span className="col-span-2">NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
            </div>
            <ul className="mt-3 flex flex-col gap-3" aria-label="Itens do carrinho">
              {items.map((item) => (
                <Line key={item.id} item={item} />
              ))}
            </ul>
          </div>
          <aside aria-labelledby="summary" className="flex flex-col gap-5">
            <h2 id="summary" className="border-b border-line pb-3 text-lg font-bold max-md:sr-only">
              Resumo da carteira
            </h2>
            <CouponField />
            <QuoteIssues quote={quote.data} />
            {quote.isError && !quote.data ? (
              <ErrorState title="Não foi possível calcular o resumo" onRetry={() => quote.refetch()} retrying={quote.isFetching} />
            ) : (
              <QuoteTotals quote={quote.data} loading={quote.isFetching} />
            )}
            <Button asChild={!blocked} disabled={blocked} className="h-10 text-sm max-md:rounded-full">
              {blocked ? <span>Conectar e finalizar</span> : <Link to="/checkout">Conectar e finalizar</Link>}
            </Button>
            <Link to="/" hash="catalogo" className="text-center text-highlight hover:underline">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}
      <AlsoViewed />
    </div>
  )
}
