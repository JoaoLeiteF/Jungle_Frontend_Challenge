import { useState } from 'react'
import { Wordmark } from '@/components/wordmark'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogIn, LogOut, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { session, useSession } from '@/app/session'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

const NAV = [
  { label: 'Início', to: '/', match: (p: string, _q: string) => p === '/' },
  { label: 'Mercado', to: '/', hash: 'catalogo', match: (p: string, _q: string) => /^\/(nft|cart|checkout|orders)/.test(p) },
  { label: 'Criadores', to: '/em-breve', search: { secao: 'Criadores' }, match: (p: string, q: string) => p === '/em-breve' && q.includes('Criadores') },
  { label: 'Aprenda', to: '/em-breve', search: { secao: 'Aprenda' }, match: (p: string, q: string) => p === '/em-breve' && q.includes('Aprenda') },
] as const

export function CartBadgeLink({ className }: { className?: string }) {
  const cart = useCart()
  const count = cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
  return (
    <Link to="/cart" className={cn('group/cart relative grid size-10 place-items-center rounded-md transition-colors hover:bg-surface-raised', className)} aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}>
      <Icon name="cart" className="size-6 text-cream transition-transform duration-200 group-hover/cart:-translate-y-0.5" />
      {count > 0 && (
        <span aria-hidden className="absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-ink">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function SearchBox({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const close = () => {
    setLeaving(true)
    setTimeout(onDone, 160)
  }
  return (
    <form
      role="search"
      className={cn(
        'relative flex origin-right items-center',
        leaving ? 'animate-out fade-out zoom-out-95 slide-out-to-right-2 duration-150' : 'animate-in fade-in zoom-in-95 slide-in-from-right-4 duration-300 ease-out',
      )}
      style={leaving ? { animationFillMode: 'forwards' } : undefined}
      onSubmit={(e) => {
        e.preventDefault()
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
        navigate({ to: '/', search: (prev) => ({ ...prev, q: q || undefined, page: undefined }), hash: 'catalogo' })
        close()
      }}
    >
      <Icon name="search" className="pointer-events-none absolute left-3 size-4 text-sand" />
      <label htmlFor="header-search" className="sr-only">
        Buscar NFTs
      </label>
      <input
        id="header-search"
        name="q"
        autoFocus
        placeholder="Buscar NFTs, coleções…"
        onKeyDown={(e) => e.key === 'Escape' && close()}
        className="h-10 w-64 rounded-full border border-line-soft bg-surface-card pr-10 pl-9 text-sm transition-colors placeholder:text-sand-muted focus:border-brand"
      />
      <button type="button" onClick={close} aria-label="Fechar busca" className="absolute right-1.5 grid size-7 place-items-center rounded-full text-sand transition-colors hover:bg-surface-raised hover:text-cream">
        <X className="size-4" aria-hidden />
      </button>
    </form>
  )
}

export function Header() {
  const { pathname, searchStr } = useLocation()
  const s = useSession()
  const [searching, setSearching] = useState(false)
  return (
    <header className="mx-auto hidden h-[77px] max-w-[1200px] items-center border-b border-line px-6 md:flex xl:px-0">
      <Link to="/" className="group/brand text-lg" aria-label="Kurio — página inicial">
        <Wordmark animated />
      </Link>
      <nav aria-label="Principal" className="mx-auto flex h-full items-stretch gap-6 lg:gap-10">
        {NAV.map((item) => {
          const active = item.match(pathname, searchStr)
          return (
            <Link
              key={item.label}
              to={item.to}
              hash={'hash' in item ? item.hash : undefined}
              search={'search' in item ? item.search : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center text-base transition-colors after:absolute after:inset-x-0 after:bottom-2 after:h-[3px] after:origin-center after:scale-x-0 after:rounded after:bg-highlight after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-highlight hover:after:scale-x-50',
                active && 'font-bold text-highlight after:scale-x-100 hover:after:scale-x-100',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="flex items-center gap-3">
        {searching ? (
          <SearchBox onDone={() => setSearching(false)} />
        ) : (
          <button type="button" onClick={() => setSearching(true)} className="grid size-10 place-items-center rounded-md hover:bg-surface-raised" aria-label="Abrir busca">
            <Icon name="search" className="size-6 text-cream" />
          </button>
        )}
        <CartBadgeLink />
        {s.status === 'authenticated' ? (
          <div className="flex items-center gap-2">
            <Link to="/profile" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-raised" aria-label={`Perfil de ${s.user.displayName}`}>
              {s.user.avatarUrl ? <img src={s.user.avatarUrl} alt="" className="size-7 rounded-full object-cover" /> : <UserRound className="size-5" aria-hidden />}
              <span className="max-w-28 truncate max-lg:hidden">{s.user.displayName}</span>
            </Link>
            <Button variant="ghost" size="icon-sm" onClick={() => session.logout()} aria-label="Sair">
              <LogOut aria-hidden />
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" className="h-9 px-3 text-base">
            <Link to="/login" search={{ redirect: pathname === '/login' ? undefined : pathname }}>
              <LogIn aria-hidden className="size-5" /> Entrar
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
