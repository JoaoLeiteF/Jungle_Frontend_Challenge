import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { NETWORKS, WALLET_PROVIDERS, walletInputSchema, type Wallet, type WalletInput } from '@/api/contracts'
import { applyApiErrors, Field, FormAlert, inputClass } from '@/components/field'
import { ErrorState, Skeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { NETWORK_LABEL, PROVIDER_LABEL } from '@/features/checkout/checkout-page'
import { cn } from '@/lib/utils'
import { useMe, useSaveWallet, useWallets } from './queries'

type Role = Wallet['role']

function toInput(w: Wallet): WalletInput {
  return { role: w.role, label: w.label, provider: w.provider, network: w.network, address: w.address, ensName: w.ensName ?? '', ownerName: w.ownerName, email: w.email, referralCode: w.referralCode ?? '' }
}

function SelectField({ label, error, children, ...props }: React.ComponentProps<'select'> & { label: string; error?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm">
        {label}
        <span className="text-coral" aria-hidden>
          *
        </span>
      </label>
      <select id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className={cn(inputClass, 'bg-ink')} {...props}>
        {children}
      </select>
      {error && (
        <p id={`${id}-e`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function WalletForm({ role, wallet, template, onDone }: { role: Role; wallet?: Wallet; template?: WalletInput; onDone?: () => void }) {
  const save = useSaveWallet()
  const me = useMe()
  const [error, setError] = useState<string | null>(null)
  const empty: WalletInput = { role, label: role === 'primary' ? 'Principal' : 'Reserva', provider: 'metamask', network: 'ethereum', address: '', ensName: '', ownerName: me.data?.displayName ?? '', email: me.data?.email ?? '', referralCode: '' }
  const form = useForm<WalletInput>({ resolver: zodResolver(walletInputSchema), defaultValues: wallet ? toInput(wallet) : empty })
  useEffect(() => {
    if (template) form.reset({ ...template, role, label: form.getValues('label'), address: '' })
  }, [template, role, form])

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const saved = await save.mutateAsync({ id: wallet?.id, input: values })
      form.reset(toInput(saved))
      toast.success(`Carteira ${saved.label} salva.`)
      onDone?.()
    } catch (e) {
      setError(applyApiErrors(form, e))
    }
  })
  const { errors, isSubmitting } = form.formState
  const network = form.watch('network')
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormAlert message={error} />
      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <Field label="Nome do perfil" required error={errors.ownerName} {...form.register('ownerName')} />
        <Field label="Apelido da carteira" required error={errors.label} {...form.register('label')} />
        <SelectField label="Rede" error={errors.network?.message} {...form.register('network')}>
          {NETWORKS.map((n) => (
            <option key={n} value={n}>
              {NETWORK_LABEL[n]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Tipo de carteira" error={errors.provider?.message} {...form.register('provider')}>
          {WALLET_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABEL[p]}
            </option>
          ))}
        </SelectField>
        <Field label="Endereço da carteira" required placeholder={network === 'solana' ? 'Endereço base58' : 'Endereço 0x da carteira'} autoComplete="off" spellCheck={false} error={errors.address} {...form.register('address')} />
        <Field label="Nome ENS (opcional)" placeholder="nome.eth" disabled={network !== 'ethereum'} hint={network !== 'ethereum' ? 'ENS só existe na rede Ethereum.' : undefined} error={errors.ensName} {...form.register('ensName')} />
        <Field label="E-mail" type="email" required error={errors.email} {...form.register('email')} />
        <Field label="Código de indicação (opcional)" error={errors.referralCode} {...form.register('referralCode')} />
      </div>
      <Button type="submit" loading={isSubmitting} className="h-[38px] w-fit px-4">
        {isSubmitting ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

export function WalletsPage() {
  const wallets = useWallets()
  const me = useMe() // new-wallet defaults come from the profile
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [copyPrimary, setCopyPrimary] = useState(false)
  if (wallets.isError || me.isError) return <ErrorState onRetry={() => (wallets.refetch(), me.refetch())} retrying={wallets.isFetching || me.isFetching} />
  if (!wallets.data || !me.data) return <Skeleton className="h-96" />
  const primary = wallets.data.find((w) => w.role === 'primary')
  const secondary = wallets.data.find((w) => w.role === 'secondary')

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="primary-title" className="flex flex-col gap-5">
        <div>
          <h1 id="primary-title" className="text-lg font-bold">
            Carteira principal
          </h1>
          <p className="text-xs text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
        </div>
        <WalletForm key={primary?.id ?? 'new-primary'} role="primary" wallet={primary} />
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!secondary && !addingSecondary && <p className="text-xs text-sand">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          {!secondary && (
            <div className="flex items-center gap-4 text-sm">
              {primary && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={copyPrimary}
                    onChange={(e) => {
                      setCopyPrimary(e.target.checked)
                      if (e.target.checked) setAddingSecondary(true)
                    }}
                    className="size-4 accent-brand"
                  />
                  Igual à carteira principal
                </label>
              )}
              {!addingSecondary && (
                <button type="button" onClick={() => setAddingSecondary(true)} className="font-bold text-highlight hover:underline">
                  Adicionar
                </button>
              )}
            </div>
          )}
        </div>
        {(secondary || addingSecondary) && (
          <WalletForm
            key={secondary?.id ?? 'new-secondary'}
            role="secondary"
            wallet={secondary}
            template={copyPrimary && primary && !secondary ? toInput(primary) : undefined}
            onDone={() => {
              setAddingSecondary(false)
              setCopyPrimary(false)
            }}
          />
        )}
      </section>
    </div>
  )
}
