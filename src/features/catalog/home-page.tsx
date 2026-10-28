import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { SORTS, TABS, type CatalogQuery, type Sort, type Tab } from '@/api/contracts'
import { isApiError } from '@/api/client'
import { Icon } from '@/components/icon'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState, RefreshingHint } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { Filters, type SearchPatch } from './filters'
import { NftCard, NftCardSkeleton } from './nft-card'
import { catalogQuery } from './queries'

const route = getRouteApi('/')

const TAB_LABEL: Record<Tab, string> = { all: 'Todos os NFTs', new: 'Novos lançamentos', trending: 'Em alta' }
const SORT_LABEL: Record<Sort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  'name-asc': 'Nome (A–Z)',
  'rating-desc': 'Mais bem avaliados',
}

const SLIDES = [
  { image: 'emerald-ape', eyebrow: 'Bem-vindo à Kurio', title: 'Seja dono do futuro da arte digital', text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.', search: {} },
  { image: 'sage-nomad', eyebrow: 'Coleções verificadas', title: 'Arte com procedência registrada na rede', text: 'Cada obra tem histórico imutável, metadados no IPFS e royalties automáticos para quem cria.', search: { collections: 'colecionaveis' } },
  { image: 'golden-beat', eyebrow: 'Em alta esta semana', title: 'Os drops que os colecionadores mais disputam', text: 'Edições limitadas com alta procura — entre antes que a próxima esgote.', search: { tab: 'trending' as const } },
]

export function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="relative mt-6 overflow-hidden rounded-[20px] bg-surface-card md:mt-0 md:overflow-visible md:rounded-none md:bg-transparent">
      <div className="grid items-center gap-6 p-4 md:grid-cols-[1fr_minmax(0,450px)] md:gap-10 md:p-0 md:py-6" aria-live="polite">
        <div className="md:pl-8">
          <p className="text-xs font-medium tracking-[0.1em] md:text-sm">{slide.eyebrow}</p>
          <h1 className="mt-3 text-xl leading-tight font-bold tracking-[0.04em] uppercase md:mt-5 md:text-[43px] md:leading-[70px]">{slide.title}</h1>
          <p className="mt-3 max-w-[520px] text-xs leading-5 text-sand md:text-sm md:leading-[26px]">{slide.text}</p>
          <Button asChild className="mt-6 h-[31px] px-5 text-base md:mt-8 md:h-[31px]">
            <Link to="/" search={slide.search} hash="catalogo">
              EXPLORAR
            </Link>
          </Button>
        </div>
        <div className="mx-auto w-[45%] max-w-[450px] md:w-full">
          <NftImage image={slide.image} alt={`Arte em destaque: ${slide.title}`} priority={index === 0} sizes="(min-width: 768px) 450px, 40vw" className="rounded-[14px] md:rounded-hero" />
        </div>
      </div>
      <div className="flex justify-center gap-2 pb-3 md:absolute md:bottom-10 md:left-[52%] md:pb-0">
        {SLIDES.map((s, i) => (
          <button
            key={s.image}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Destaque ${i + 1} de ${SLIDES.length}`}
            aria-current={i === index}
            className={cn('size-2.5 rounded-full border border-brand', i === index ? 'bg-brand' : 'bg-brand/40')}
          />
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
  return (
    <Link to="/nft/$nftId" params={{ nftId: 'sage-nomad-009' }} className="group block bg-surface-card pt-4 hover:bg-surface-raised" aria-label="NFT em destaque: Sage Nomad #009, oferta limitada">
      <p className="px-4 text-lg font-bold tracking-wide text-highlight">NFT EM DESTAQUE</p>
      <p className="px-4 pb-3 text-center font-bold">OFERTA LIMITADA</p>
      <NftImage image="sage-nomad" alt="" sizes="(min-width: 1024px) 310px, 90vw" className="aspect-[310/368] rounded-[22px] object-[50%_20%]" />
    </Link>
  )
}

function Catalog() {
  const search = route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const topRef = useRef<HTMLHeadingElement>(null)
  const query: CatalogQuery = {
    q: search.q,
    collections: search.collections?.split(',') as CatalogQuery['collections'],
    networks: search.networks?.split(',') as CatalogQuery['networks'],
    min: search.min,
    max: search.max,
    tab: search.tab,
    sort: search.sort,
    page: search.page ?? 1,
    pageSize: 9,
  }
  const catalog = useQuery(catalogQuery(query))
  const data = catalog.data

  // Any filter change restarts pagination; only explicit page moves keep it.
  const update = (patch: SearchPatch, keepPage = false) => navigate({ search: (prev) => ({ ...prev, ...patch, ...(keepPage ? {} : { page: undefined }) }), resetScroll: false })
  const goToPage = (page: number) => {
    update({ page: page === 1 ? undefined : page }, true)
    topRef.current?.scrollIntoView({ block: 'start' })
  }
  const activeFilters = !!(search.q || search.collections || search.networks || search.min || search.max)

  const filters = <Filters data={data} search={search} onChange={update} />
  return (
    <section aria-labelledby="catalogo" className="grid gap-8 lg:grid-cols-[226px_1fr] lg:gap-[22px]">
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
        {/* mobile/tablet: search + filters sheet (Figma mobile "Explorar coleções") */}
        <div className="mb-4 flex gap-2 lg:hidden">
          <form
            role="search"
            className="flex flex-1 items-center gap-2 rounded-[10px] bg-surface-card px-3"
            onSubmit={(e) => {
              e.preventDefault()
              update({ q: String(new FormData(e.currentTarget).get('q') ?? '').trim() || undefined })
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
          <ErrorState className="mt-6" message={isApiError(catalog.error) ? catalog.error.message : undefined} onRetry={() => catalog.refetch()} />
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
            {catalog.isError && <ErrorState className="mt-4" title="Não foi possível atualizar" message="Mostrando os últimos resultados carregados." onRetry={() => catalog.refetch()} />}
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
    { image: 'emerald-ape', title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', search: { tab: 'new' as const } },
    { image: 'neon-vessel', title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', search: { collections: 'arte-digital' } },
  ]
  return (
    <section aria-label="Promoções" className="grid gap-6 md:grid-cols-2 md:gap-[38px]">
      {items.map((p) => (
        <article key={p.image} className="grid grid-cols-[minmax(0,156px)_1fr] items-center gap-4 bg-surface-card md:grid-cols-[156px_1fr]">
          <NftImage image={p.image} alt="" sizes="156px" className="h-full object-cover" />
          <div className="py-4 pr-4 text-right">
            <h2 className="text-sm leading-[19px] font-bold md:text-base">{p.title}</h2>
            <p className="mt-3 text-xs leading-[19px] text-sand">{p.text}</p>
            <Button asChild size="sm" className="mt-3 h-[31px] px-4">
              <Link to="/" search={p.search} hash="catalogo">
                Explorar <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { image: 'neon-vessel', date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.' },
  { image: 'emerald-ape', date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.' },
  { image: 'sage-nomad', date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.' },
  { image: 'golden-beat', date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.' },
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
          <li key={p.title} className="bg-surface-card">
            <article>
              <NftImage image={p.image} alt="" sizes="(min-width: 1024px) 270px, 45vw" className="aspect-[270/195]" />
              <div className="p-3 text-[10px] leading-4">
                <p className="text-sand">
                  {p.date} | Leitura de {p.read}
                </p>
                <h3 className="mt-2 text-sm leading-[17px] font-bold">{p.title}</h3>
                <p className="mt-2 text-sand">{p.text}</p>
                <Link to="/em-breve" search={{ secao: 'Diário da Cunhagem' }} className="mt-2 inline-block font-bold text-highlight hover:underline" aria-label={`Ler mais: ${p.title}`}>
                  Ler mais →
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
  // honor #catalogo links coming from other pages
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
