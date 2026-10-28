import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { SORTS, TABS, type Sort, type Tab } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { Icon } from '@/components/icon'
import { Wordmark } from '@/components/wordmark'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState, RefreshingHint } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Filters, type SearchPatch } from './filters'
import { Hero } from './hero'
import { NftCard, NftCardSkeleton } from './nft-card'
import { catalogQuery, nftQuery, toCatalogQuery } from './queries'

const route = getRouteApi('/')

const TAB_LABEL: Record<Tab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}
const SORT_LABEL: Record<Sort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  'name-asc': 'Nome (A–Z)',
  'rating-desc': 'Mais bem avaliados',
}

function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
  const cell = 'grid size-[33px] place-items-center rounded-[4px] border border-line-soft text-sm'
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={cn(cell, 'hover:border-brand')} onClick={() => onPage(page - 1)} aria-label="Página anterior">
              <ChevronRight className="size-4 rotate-180" aria-hidden />
            </button>
          </li>
        )}
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1]! > 1 && <span aria-hidden>…</span>}
            <button
              type="button"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              onClick={() => onPage(p)}
              className={cn(cell, p === page ? 'border-brand bg-brand font-bold text-ink' : 'hover:border-brand')}
            >
              {p}
            </button>
          </li>
        ))}
        {page < pageCount && (
          <li>
            <button type="button" className={cn(cell, 'hover:border-brand')} onClick={() => onPage(page + 1)} aria-label="Próxima página">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}

function Featured() {
  const nft = useQuery(nftQuery('sage-nomad-009')).data
  return (
    <Link
      to="/nft/$nftId"
      params={{ nftId: 'sage-nomad-009' }}
      className="group block overflow-hidden rounded-[22px] border border-line bg-surface-card pt-4 transition-[background-color,border-color,box-shadow] duration-300 hover:border-brand/60 hover:bg-surface-raised hover:shadow-[0_16px_32px_-16px_rgb(0_0_0/0.7)]"
    >
      <p className="px-4 text-lg font-bold tracking-wide text-highlight">NFT EM DESTAQUE</p>
      <p className="flex items-center justify-center gap-2 px-4 pb-3 font-bold">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
          <span className="relative size-2 rounded-full bg-brand" />
        </span>
        OFERTA LIMITADA<span className="sr-only">: Sage Nomad #009</span>
      </p>
      <div className="relative overflow-hidden rounded-[22px]">
        <NftImage image="sage-nomad" alt="" sizes="(min-width: 1024px) 310px, 90vw" className="aspect-[310/368] object-[50%_20%] transition-transform duration-700 ease-out group-hover:scale-105" />
        {nft && (
          <div aria-hidden className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-ink/90 via-ink/50 to-transparent px-4 pt-12 pb-4 animate-in fade-in duration-500">
            <span className="text-sm font-bold">{nft.name}</span>
            <span className="text-sm font-bold text-highlight">{formatEth(nft.listPriceEth)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

function Catalog() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const topRef = useRef<HTMLHeadingElement>(null)
  const catalog = useQuery(catalogQuery(toCatalogQuery(search)))
  const data = catalog.data

  const update = (patch: SearchPatch, keepPage = false) =>
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        ...(keepPage ? {} : { page: undefined }),
      }),
      resetScroll: false,
    })
  const goToPage = (page: number) => {
    update({ page: page === 1 ? undefined : page }, true)
    topRef.current?.scrollIntoView({ block: 'start' })
  }
  const activeFilters = !!(search.q || search.collections || search.networks || search.min || search.max)

  const filters = <Filters data={data} search={search} onChange={update} />
  return (
    <section aria-labelledby="catalogo" className="grid gap-8 lg:grid-cols-[310px_1fr] lg:gap-12">
      <h2 id="catalogo" ref={topRef} className="sr-only scroll-mt-24" tabIndex={-1}>
        Catálogo
      </h2>
      <aside className="max-lg:hidden">
        <div className="bg-surface-card px-3 py-4">{filters}</div>
        <div className="mt-4">
          <Featured />
        </div>
      </aside>
      <div className="min-w-0">
        <div className="mb-4 flex gap-2 lg:hidden">
          <form
            role="search"
            className="flex flex-1 items-center gap-2 rounded-[10px] bg-surface-card px-3"
            onSubmit={(e) => {
              e.preventDefault()
              update({
                q: String(new FormData(e.currentTarget).get('q') ?? '').trim() || undefined,
              })
            }}
          >
            <Icon name="search" className="size-4 text-cream" />
            <label htmlFor="mobile-search" className="sr-only">
              Explorar coleções
            </label>
            <input id="mobile-search" name="q" key={search.q} defaultValue={search.q} placeholder="Explorar coleções" className="h-10 w-full bg-transparent text-sm placeholder:text-cream" />
          </form>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon-lg" aria-label="Abrir filtros">
                <SlidersHorizontal aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto border-line bg-ink p-4">
              <SheetHeader className="p-0">
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              {filters}
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Seções do catálogo" className="flex gap-4 overflow-x-auto text-xs md:text-sm">
            {TABS.map((t) => {
              const active = (search.tab ?? 'all') === t
              return (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => update({ tab: t === 'all' ? undefined : t })}
                  className={cn('pb-1 whitespace-nowrap', active ? 'border-b-2 border-highlight text-highlight' : 'text-cream hover:text-highlight')}
                >
                  {TAB_LABEL[t]}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span id="sort-label">Ordenar por:</span>
            <Select value={search.sort ?? 'recent'} onValueChange={(v) => update({ sort: v === 'recent' ? undefined : (v as Sort) })}>
              <SelectTrigger aria-labelledby="sort-label" className="h-8 border-line-soft bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SORT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2 flex min-h-5 items-center justify-between text-xs text-sand">
          <span role="status" aria-live="polite">
            {data && !catalog.isPlaceholderData && `${data.total} ${data.total === 1 ? 'resultado' : 'resultados'}${search.q ? ` para “${search.q}”` : ''}`}
          </span>
          <RefreshingHint show={catalog.isFetching && !!data} />
        </div>

        {catalog.isError && !data ? (
          <ErrorState className="mt-6" message={isApiError(catalog.error) ? catalog.error.message : undefined} onRetry={() => catalog.refetch()} retrying={catalog.isFetching} />
        ) : !data ? (
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-[22px] md:gap-y-[38px]" aria-label="Carregando NFTs">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        ) : data.items.length === 0 ? (
          <EmptyState className="mt-6" title="Nenhum NFT encontrado">
            {activeFilters ? (
              <button type="button" className="text-highlight underline" onClick={() => navigate({ search: {} })}>
                Limpar busca e filtros
              </button>
            ) : (
              'O catálogo está vazio no momento.'
            )}
          </EmptyState>
        ) : (
          <>
            {catalog.isError && <ErrorState className="mt-4" title="Não foi possível atualizar" message="Mostrando os últimos resultados carregados." onRetry={() => catalog.refetch()} retrying={catalog.isFetching} />}
            <ul className={cn('mt-4 grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity md:grid-cols-3 md:gap-x-[22px] md:gap-y-[38px]', catalog.isPlaceholderData && 'opacity-60')} aria-busy={catalog.isFetching}>
              {data.items.map((nft, i) => (
                <li key={nft.id}>
                  <NftCard nft={nft} priority={i < 3} />
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageCount={data.pageCount} onPage={goToPage} />
          </>
        )}
      </div>
    </section>
  )
}

function Promos() {
  const items = [
    {
      image: 'emerald-ape',
      title: 'Lançamentos gênesis de edição limitada',
      text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      search: { tab: 'new' as const },
    },
    {
      image: 'neon-vessel',
      title: 'Arte digital selecionada e muito mais',
      text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      search: { collections: 'arte-digital' },
    },
  ]
  return (
    <section aria-label="Promoções" className="grid gap-6 md:grid-cols-2 md:gap-[38px]">
      {items.map((p) => (
        <article
          key={p.image}
          className="reveal group grid grid-cols-[minmax(0,156px)_1fr] items-stretch gap-4 overflow-hidden rounded-[8px] bg-surface-card transition-shadow duration-300 hover:shadow-[0_16px_32px_-16px_rgb(0_0_0/0.7)] lg:h-[250px] lg:grid-cols-[290px_1fr] lg:gap-6"
        >
          <div className="overflow-hidden rounded-r-[14px]">
            <NftImage image={p.image} alt="" sizes="(min-width: 1024px) 290px, 156px" className="h-full transition-transform duration-700 ease-out group-hover:scale-105" />
          </div>
          <div className="flex min-w-0 flex-col items-end justify-center py-4 pr-4 text-right lg:pr-8">
            <h2 className="text-sm leading-[19px] font-bold md:text-lg md:leading-6">{p.title}</h2>
            <p className="mt-3 text-xs leading-[19px] text-sand md:text-sm md:leading-6">{p.text}</p>
            <Button asChild size="sm" className="cta group/cta mt-3 h-[31px] px-4">
              <Link to="/" search={p.search} hash="catalogo">
                Explorar <ArrowRight aria-hidden className="transition-transform duration-200 group-hover/cta:translate-x-1" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  {
    image: 'neon-vessel',
    date: '12 de setembro',
    read: '6 min',
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
  },
  {
    image: 'emerald-ape',
    date: '13 de setembro',
    read: '2 min',
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
  },
  {
    image: 'sage-nomad',
    date: '15 de setembro',
    read: '3 min',
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
  },
  {
    image: 'golden-beat',
    date: '15 de setembro',
    read: '2 min',
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
  },
]

function Blog() {
  return (
    <section aria-labelledby="diario" className="text-center">
      <h2 id="diario" className="text-[23px] font-bold">
        Diário da Cunhagem
      </h2>
      <p className="mt-2 text-xs text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-8 grid grid-cols-2 gap-4 text-left lg:grid-cols-4 lg:gap-[13px]">
        {POSTS.map((p) => (
          <li key={p.title} className="reveal">
            <article className="group relative h-full overflow-hidden rounded-[8px] bg-surface-card transition-[transform,background-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:bg-surface-raised hover:shadow-[0_16px_32px_-16px_rgb(0_0_0/0.7)]">
              <div className="overflow-hidden">
                <NftImage image={p.image} alt="" sizes="(min-width: 1024px) 270px, 45vw" className="aspect-[270/195] transition-transform duration-700 ease-out group-hover:scale-105" />
              </div>
              <div className="p-3 text-[10px] leading-4">
                <p className="text-sand">
                  {p.date} | Leitura de {p.read}
                </p>
                <h3 className="mt-2 text-sm leading-[17px] font-bold">{p.title}</h3>
                <p className="mt-2 text-sand">{p.text}</p>
                <Link to="/em-breve" search={{ secao: 'Diário da Cunhagem' }} className="mt-2 inline-flex items-center gap-1 font-bold text-highlight after:absolute after:inset-0" aria-label={`Ler mais: ${p.title}`}>
                  Ler mais <ArrowRight aria-hidden className="size-3 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomePage() {
  useEffect(() => {
    if (location.hash === '#catalogo') document.getElementById('catalogo')?.scrollIntoView()
  }, [])
  return (
    <div className="flex flex-col gap-12 md:gap-24">
      <div>
        <div className="mt-5 flex items-center justify-between md:hidden">
          <Wordmark animated className="text-xl" />
          <span className="text-xs tracking-[0.08em] text-sand">Marketplace de NFTs</span>
        </div>
        <Hero />
      </div>
      <Catalog />
      <Promos />
      <Blog />
    </div>
  )
}
