import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Download, Heart, LifeBuoy, LogOut, MapPin, ShoppingCart, Tag, UserRound } from 'lucide-react'
import { session } from '@/app/session'
import { cn } from '@/lib/utils'

const ITEMS = [
  { label: 'Dados do perfil', to: '/profile', icon: UserRound },
  { label: 'Carteiras', to: '/profile/wallets', icon: MapPin },
  { label: 'Atividade', to: '/em-breve', search: { secao: 'Atividade' }, icon: ShoppingCart },
  { label: 'Lista de interesse', to: '/profile/favorites', icon: Heart },
  { label: 'Ofertas', to: '/em-breve', search: { secao: 'Ofertas' }, icon: Tag },
  { label: 'Arquivos baixados', to: '/em-breve', search: { secao: 'Arquivos baixados' }, icon: Download },
  { label: 'Suporte', to: '/em-breve', search: { secao: 'Suporte' }, icon: LifeBuoy },
] as const

export function AccountLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[310px_1fr] md:gap-7">
      <nav aria-label="Minha conta" className="h-fit bg-surface-card py-3">
        <p className="px-2.5 pb-2 text-lg font-bold">Meu perfil</p>
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0">
          {ITEMS.map(({ label, to, icon: I, ...rest }) => {
            const active = pathname === to
            return (
              <li key={label}>
                <Link
                  to={to}
                  search={'search' in rest ? rest.search : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex items-center gap-3 border-l-[6px] px-4 py-3 text-sm whitespace-nowrap text-highlight hover:bg-surface-raised', active ? 'border-brand' : 'border-transparent')}
                >
                  <I className="size-4 text-sand" aria-hidden /> {label}
                </Link>
              </li>
            )
          })}
          <li className="md:border-t md:border-line">
            <button
              type="button"
              onClick={async () => {
                await session.logout()
                navigate({ to: '/' })
              }}
              className="flex w-full items-center gap-3 border-l-[6px] border-transparent px-4 py-3 text-sm font-bold text-highlight hover:bg-surface-raised"
            >
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
