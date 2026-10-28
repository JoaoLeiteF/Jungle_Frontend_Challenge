import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CatalogQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/app/query'
import { useSession } from '@/app/session'

/** URL search params (comma lists) → API query. Shared by the route loader and the page. */
export function toCatalogQuery(search: { q?: string; collections?: string; networks?: string; min?: string; max?: string; tab?: CatalogQuery['tab']; sort?: CatalogQuery['sort']; page?: number }): CatalogQuery {
  return {
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
}

export const catalogQuery = (q: CatalogQuery) =>
  queryOptions({
    queryKey: qk.catalog(q),
    // Query passes an AbortSignal: when filters change mid-flight the old request is cancelled,
    // and the key-per-params cache means a late response can only land in its own entry.
    queryFn: ({ signal }) => api.nfts.list(q, { signal }),
    placeholderData: keepPreviousData,
  })

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => api.nfts.get(id, { signal }),
  })

export function useFavorites() {
  const s = useSession()
  const userId = s.status === 'authenticated' ? s.user.id : null
  return useQuery({
    queryKey: qk.favorites(userId ?? '-'),
    queryFn: ({ signal }) => api.favorites.list({ signal }).then((r) => r.nftIds),
    enabled: !!userId,
  })
}

/** Optimistic toggle with rollback: the heart flips instantly, and flips back if the API refuses. */
export function useToggleFavorite() {
  const s = useSession()
  const qc = useQueryClient()
  const userId = s.status === 'authenticated' ? s.user.id : '-'
  const key = qk.favorites(userId)
  return useMutation({
    mutationFn: ({ nftId, on }: { nftId: string; on: boolean; name: string }) => (on ? api.favorites.add(nftId) : api.favorites.remove(nftId)),
    onMutate: async ({ nftId, on }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<string[]>(key)
      qc.setQueryData<string[]>(key, (ids = []) => (on ? [...new Set([...ids, nftId])] : ids.filter((i) => i !== nftId)))
      return { previous }
    },
    onError: (_e, { name, on }, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast.error(`Não foi possível ${on ? 'favoritar' : 'desfavoritar'} ${name}. Restauramos o estado anterior.`)
    },
    onSuccess: (_d, { name, on }) => toast.success(on ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}
