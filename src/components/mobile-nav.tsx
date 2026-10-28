import { Link, useLocation } from '@tanstack/react-router'
import { Heart, Home, Search } from 'lucide-react'
import { useCart } from '@/features/cart/queries'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

/** Bottom tab bar from the mobile Figma frames (hidden from md up). */
export function MobileNav() {
  const { pathname } = useLocation()
  const cart = useCart()
  const count = cart.data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
  const item = (active: boolean) => cn('flex flex-1 flex-col items-center gap-1 py-2 text-[11px]', active ? 'text-highlight' : 'text-cream')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-end">
        <li className="flex flex-1">
          <Link to="/" className={item(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
            <Home className="size-5" aria-hidden /> Início
          </Link>
        </li>
        <li className="flex flex-1">
          <Link to="/profile/favorites" className={item(pathname === '/profile/favorites')}>
            <Heart className="size-5" aria-hidden /> Favoritos
          </Link>
        </li>
        <li className="flex flex-1 justify-center">
          <Link to="/cart" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className="relative -mt-6 grid size-14 place-items-center rounded-full border-4 border-ink bg-brand text-ink">
            <Icon name="shop" className="size-6" />
            {count > 0 && (
              <span aria-hidden className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-cream px-1 text-[10px] leading-5 font-bold text-ink">
                {count}
              </span>
            )}
          </Link>
        </li>
        <li className="flex flex-1">
          <Link to="/" hash="catalogo" className={item(false)}>
            <Search className="size-5" aria-hidden /> Buscar
          </Link>
        </li>
        <li className="flex flex-1">
          <Link to="/profile" className={item(pathname.startsWith('/profile') && pathname !== '/profile/favorites')}>
            <Icon name="user" className="size-5" /> Perfil
          </Link>
        </li>
      </ul>
    </nav>
  )
}
