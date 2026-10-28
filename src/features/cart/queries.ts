import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import type { AddToCartInput, Cart } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/app/query'
import { useScope, useSession } from '@/app/session'

export function useCart() {
  const scope = useScope()
  const ready = useSession().status !== 'loading'
  return useQuery({ queryKey: qk.cart(scope), queryFn: ({ signal }) => api.cart.get({ signal }), enabled: ready, staleTime: 10_000 })
}

export function useCartCount() {
  return useCart().data?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
}

/** The API's quote is the source of truth for totals; it is never computed in the UI. */
export function useQuote(enabled = true) {
  const scope = useScope()
  const cart = useCart()
  return useQuery({
    // the cart's updatedAt is part of the key so every cart change yields a fresh quote
    queryKey: [...qk.quote(scope), cart.data?.updatedAt ?? 'none'],
    queryFn: ({ signal }) => api.quote.create({ signal }),
    enabled: enabled && !!cart.data?.items.length,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })
}

function useCartMutation<V>(fn: (v: V) => Promise<Cart>, opts: { success?: (v: V) => string; optimistic?: (cart: Cart, v: V) => Cart } = {}) {
  const qc = useQueryClient()
  const scope = useScope()
  const key = qk.cart(scope)
  return useMutation({
    mutationFn: fn,
    // Cart writes run one at a time: rapid +/− clicks can't resolve out of order and clobber each other.
    scope: { id: 'cart' },
    onMutate: async (v: V) => {
      if (!opts.optimistic) return {}
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Cart>(key)
      if (previous) qc.setQueryData(key, opts.optimistic(previous, v))
      return { previous }
    },
    onSuccess: (cart, v) => {
      qc.setQueryData(key, cart)
      if (opts.success) toast.success(opts.success(v))
    },
    onError: (e, _v, ctx) => {
      if (ctx && 'previous' in ctx && ctx.previous) qc.setQueryData(key, ctx.previous)
      toast.error(isApiError(e) ? e.message : 'Não foi possível atualizar o carrinho.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.quote(scope) }),
  })
}

export const useAddToCart = () => useCartMutation((v: AddToCartInput & { name: string }) => api.cart.add(v), { success: (v) => `${v.name} adicionado ao carrinho.` })

export const useUpdateQuantity = () =>
  useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => api.cart.update(itemId, quantity), {
    optimistic: (cart, { itemId, quantity }) => ({ ...cart, items: cart.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)) }),
  })

export const useRemoveItem = () =>
  useCartMutation(({ itemId }: { itemId: string; name: string }) => api.cart.remove(itemId), {
    optimistic: (cart, { itemId }) => ({ ...cart, items: cart.items.filter((i) => i.id !== itemId) }),
    success: ({ name }) => `${name} removido do carrinho.`,
  })

export function useCoupon() {
  const qc = useQueryClient()
  const scope = useScope()
  return useMutation({
    mutationFn: (code: string | null) => api.cart.setCoupon(code),
    scope: { id: 'cart' },
    onSuccess: (cart, code) => {
      qc.setQueryData(qk.cart(scope), cart)
      qc.invalidateQueries({ queryKey: qk.quote(scope) })
      toast.success(code ? `Cupom ${cart.couponCode} aplicado.` : 'Cupom removido.')
    },
  })
}
