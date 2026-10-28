import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { EmptyState, ErrorState } from '@/components/states'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { nftQuery, useFavorites } from '@/features/catalog/queries'

export function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data ?? []
  const nfts = useQueries({ queries: ids.map((id) => nftQuery(id)) })
  return (
    <section aria-labelledby="fav-title" className="flex flex-col gap-5">
      <h1 id="fav-title" className="text-lg font-bold">
        Lista de interesse
      </h1>
      {favorites.isError ? (
        <ErrorState onRetry={() => favorites.refetch()} />
      ) : favorites.data && !ids.length ? (
        <EmptyState title="Nenhum favorito ainda">
          <Link to="/" hash="catalogo" className="text-highlight underline">
            Explore o mercado
          </Link>{' '}
          e toque no coração para guardar NFTs aqui.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {(favorites.data ? nfts : [{}, {}, {}]).map((q, i) => (
            <li key={ids[i] ?? i}>{'data' in q && q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
