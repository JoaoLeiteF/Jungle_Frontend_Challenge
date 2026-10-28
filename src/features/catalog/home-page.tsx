import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { SORTS, TABS, type Sort, type Tab } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { Icon } from '@/components/icon'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState, RefreshingHint } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { Filters, type SearchPatch } from './filters'
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

const SLIDES = [
  {
    image: 'emerald-ape',
    eyebrow: 'Bem-vindo à Kurio',
    title: 'Seja dono do futuro da arte digital',
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    search: {},
  },
  {
    image: 'sage-nomad',
    eyebrow: 'Coleções verificadas',
    title: 'Arte com procedência registrada na rede',
    text: 'Cada obra tem histórico imutável, metadados no IPFS e royalties automáticos para quem cria.',
    search: { collections: 'colecionaveis' },
  },
  {
    image: 'golden-beat',
    eyebrow: 'Em alta esta semana',
    title: 'Os drops que os colecionadores mais disputam',
    text: 'Edições limitadas com alta procura — entre antes que a próxima esgote.',
    search: { tab: 'trending' as const },
  },
]

const AUTOPLAY_MS = 6000

export function Hero() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [warm, setWarm] = useState(false)
  const touchX = useRef<number | null>(null)
  const go = (i: number) => setIndex((i + SLIDES.length) % SLIDES.length)

  useEffect(() => {
    const t = setTimeout(() => setWarm(true), 1500)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [index, paused])

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative isolate mt-6 overflow-hidden rounded-[20px] bg-[radial-gradient(130%_110%_at_88%_8%,#5a3520_0%,#38220f_40%,#241612_78%)] before:absolute before:-top-24 before:-right-20 before:-z-10 before:size-72 before:rounded-full before:bg-brand/10 md:mt-0 md:rounded-none md:bg-none md:before:hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1)
        if (e.key === 'ArrowLeft') go(index - 1)
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0]!.clientX - (touchX.current ?? e.changedTouches[0]!.clientX)
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
      }}
    >
      <div className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translateX(-${index * 100}%)` }} aria-live={paused ? 'polite' : 'off'}>
        {SLIDES.map((slide, i) => {
          const active = i === index
          const Title = active ? 'h1' : 'p'
          return (
            <div
              key={slide.image}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${SLIDES.length}`}
              inert={!active}
              className={cn(
                'grid w-full shrink-0 grid-cols-[1fr_40%] items-center gap-3 p-4 transition-opacity duration-700 md:grid-cols-[1fr_minmax(0,450px)] md:gap-10 md:p-0 md:py-6',
                active ? 'opacity-100' : 'opacity-0',
              )}
            >
              <div className={cn('transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:pl-8', active ? 'translate-y-0' : 'translate-y-3')}>
                <p className="text-xs font-medium tracking-[0.1em] md:text-sm">{slide.eyebrow}</p>
                <Title className="mt-2 text-base leading-tight font-bold tracking-[0.04em] uppercase md:mt-5 md:max-w-[600px] md:text-[43px] md:leading-[70px]">{slide.title}</Title>
                <p className="mt-2 max-w-[520px] text-[11px] leading-4 text-sand md:mt-3 md:text-sm md:leading-[26px]">{slide.text}</p>
                <Button asChild className="mt-3 h-[31px] px-4 text-sm max-md:h-auto max-md:bg-transparent max-md:px-0 max-md:text-highlight max-md:hover:bg-transparent md:mt-8 md:px-5 md:text-base">
                  <Link to="/" search={slide.search} hash="catalogo">
                    EXPLORAR <ArrowRight aria-hidden className="md:hidden" />
                  </Link>
                </Button>
              </div>
              <div className="relative w-full max-w-[450px]">
                <div className="aspect-square overflow-hidden rounded-[14px] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.7)] md:rounded-hero md:shadow-none">
                  {(i === 0 || warm) && (
                    <NftImage
                      image={slide.image}
                      alt={`Arte em destaque: ${slide.title}`}
                      priority={i === 0 || warm}
                      sizes="(min-width: 768px) 450px, 40vw"
                      className={cn('transition-transform duration-[1200ms] ease-out', active ? 'scale-100' : 'scale-105')}
                    />
                  )}
                </div>
                {warm && (
                  <button
                    type="button"
                    onClick={() => go(i + 1)}
                    aria-label={`Próximo destaque: ${SLIDES[(i + 1) % SLIDES.length]!.title}`}
                    className={cn(
                      'absolute -bottom-3 -left-4 w-[46%] overflow-hidden rounded-[10px] ring-2 ring-surface-card shadow-[0_6px_14px_-6px_rgb(0_0_0/0.8)] transition-[transform,opacity] delay-300 duration-500 ease-out active:scale-95 md:hidden',
                      active ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
                    )}
                  >
                    <NftImage image={SLIDES[(i + 1) % SLIDES.length]!.image} alt="" sizes="80px" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-center pb-2 md:absolute md:bottom-9 md:left-[52%] md:pb-0">
        {SLIDES.map((s, i) => (
          <button key={s.image} type="button" onClick={() => setIndex(i)} aria-label={`Destaque ${i + 1} de ${SLIDES.length}`} aria-current={i === index} className="group/dot grid h-6 min-w-6 place-items-center px-1">
            <span aria-hidden className={cn('relative h-2.5 overflow-hidden rounded-full border border-brand transition-all duration-500 ease-out', i === index ? 'w-6 bg-brand/40' : 'w-2.5 bg-brand/40 group-hover/dot:bg-brand/70')}>
              {i === index && <span key={index} className="dot-progress absolute inset-0 origin-left bg-brand" style={{ animationPlayState: paused ? 'paused' : 'running', animationDuration: `${AUTOPLAY_MS}ms` }} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
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
            <Button asChild size="sm" className="mt-3 h-[31px] px-4">
              <Link to="/" search={p.search} hash="catalogo">
                Explorar <ArrowRight aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
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
      <Hero />
      <Catalog />
      <Promos />
      <Blog />
    </div>
  )
}
