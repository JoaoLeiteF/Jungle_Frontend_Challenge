import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PasswordInput, ProfileInput, WalletInput } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/app/query'
import { session, useSession } from '@/app/session'

const useUserId = () => {
  const s = useSession()
  return s.status === 'authenticated' ? s.user.id : null
}

export function useMe() {
  const userId = useUserId()
  return useQuery({ queryKey: qk.me(userId ?? '-'), queryFn: ({ signal }) => api.me.get({ signal }), enabled: !!userId })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (input: ProfileInput) => api.me.update(input),
    onSuccess: (user) => {
      qc.setQueryData(qk.me(user.id), user)
      session.updateUser(user)
    },
    onSettled: () => userId && qc.invalidateQueries({ queryKey: qk.me(userId) }),
  })
}

export const useChangePassword = () => useMutation({ mutationFn: (input: PasswordInput) => api.me.changePassword(input) })

export function useWallets() {
  const userId = useUserId()
  return useQuery({ queryKey: qk.wallets(userId ?? '-'), queryFn: ({ signal }) => api.wallets.list({ signal }).then((r) => r.items), enabled: !!userId })
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WalletInput }) => (id ? api.wallets.update(id, input) : api.wallets.create(input)),
    onSettled: () => userId && qc.invalidateQueries({ queryKey: qk.wallets(userId) }),
  })
}
