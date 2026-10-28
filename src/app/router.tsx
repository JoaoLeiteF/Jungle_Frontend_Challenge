import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { collectionSchema, networkSchema, sortSchema, tabSchema } from '@/api/contracts'
import { isEth } from '@/lib/eth'
import { RootLayout } from './layout'
import { queryClient } from './query'
import { session } from './session'
import { NotFoundPage } from '@/features/misc/not-found'
import { ErrorPage } from '@/features/misc/error-page'
import { Skeleton } from '@/components/states'
import { catalogQuery, nftQuery, toCatalogQuery } from '@/features/catalog/queries'

interface RouterContext {
  queryClient: typeof queryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout, notFoundComponent: () => <NotFoundPage />, errorComponent: ErrorPage })

const list = <T extends z.ZodType>(item: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter((x) => item.safeParse(x).success).join(',') || undefined : undefined))
    .catch(undefined)
const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  collections: list(collectionSchema),
  networks: list(networkSchema),
  min: z.string().refine(isEth).optional().catch(undefined),
  max: z.string().refine(isEth).optional().catch(undefined),
  tab: tabSchema.optional().catch(undefined),
  sort: sortSchema.optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

const redirectSearch = z.object({ redirect: z.string().regex(/^\/(?!\/)/).optional().catch(undefined) })

async function requireAuth({ location }: { location: { href: string } }) {
  await session.ready()
  if (session.get().status !== 'authenticated') throw redirect({ to: '/login', search: { redirect: location.href } })
}

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => void context.queryClient.prefetchQuery(catalogQuery(toCatalogQuery(deps))),
  component: lazyRouteComponent(() => import('@/features/catalog/home-page'), 'HomePage'),
})
const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(nftQuery(params.nftId)),
  component: lazyRouteComponent(() => import('@/features/nft/nft-page'), 'NftPage'),
})
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage') })
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/features/checkout/checkout-page'), 'CheckoutPage'),
})
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/features/checkout/order-page'), 'OrderPage'),
})
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: redirectSearch,
  component: lazyRouteComponent(() => import('@/features/auth/auth-page'), 'LoginPage'),
})
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: redirectSearch,
  component: lazyRouteComponent(() => import('@/features/auth/auth-page'), 'RegisterPage'),
})
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/features/account/account-layout'), 'AccountLayout'),
})
const profileIndexRoute = createRoute({ getParentRoute: () => profileRoute, path: '/', component: lazyRouteComponent(() => import('@/features/account/profile-page'), 'ProfilePage') })
const walletsRoute = createRoute({ getParentRoute: () => profileRoute, path: '/wallets', component: lazyRouteComponent(() => import('@/features/account/wallets-page'), 'WalletsPage') })
const favoritesRoute = createRoute({ getParentRoute: () => profileRoute, path: '/favorites', component: lazyRouteComponent(() => import('@/features/account/favorites-page'), 'FavoritesPage') })
const comingSoonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/em-breve',
  validateSearch: z.object({ secao: z.string().max(40).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/features/misc/coming-soon'), 'ComingSoonPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  profileRoute.addChildren([profileIndexRoute, walletsRoute, favoritesRoute]),
  comingSoonRoute,
])

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPendingComponent: () => (
    <div role="status" aria-label="Carregando página" className="mt-[68px] flex flex-col gap-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  ),
  defaultErrorComponent: ErrorPage,
  defaultPendingMs: 150,
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
