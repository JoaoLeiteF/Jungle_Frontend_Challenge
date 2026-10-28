import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, ChevronLeft, Loader2, PlugZap, Unplug } from 'lucide-react'
import { isApiError } from '@/api/client'
import { buyerSchema, NETWORKS, WALLET_PROVIDERS, type Buyer, type Network, type Quote, type Wallet, type WalletProvider } from '@/api/contracts'
import { useSession } from '@/app/session'
import { Field, FormAlert, inputClass } from '@/components/field'
import { NftImage } from '@/components/nft-image'
import { EmptyState, ErrorState, Skeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { useMe, useWallets } from '@/features/account/queries'
import { useCart, useQuote } from '@/features/cart/queries'
import { CouponField, QuoteIssues, QuoteTotals } from '@/features/cart/summary'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { attempts, draft } from './attempt'
import { useConnectWallet, useCreateOrder, useDisconnectWallet } from './queries'

export const PROVIDER_LABEL: Record<WalletProvider, string> = { walletconnect: 'WalletConnect', metamask: 'MetaMask', coinbase: 'Coinbase Wallet' }
export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Connection = { state: 'idle' } | { state: 'connecting' } | { state: 'connected'; walletId: string } | { state: 'rejected'; message: string }

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <Field label={label} value={value} readOnly className="[&_input]:bg-surface-card/60 [&_input]:text-sand" />
}

function WalletPicker({ wallets, selected, onSelect }: { wallets: Wallet[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-3 flex w-full items-center justify-between font-bold">
        Carteira conectada
        <Link to="/profile/wallets" className="text-sm font-normal text-highlight hover:underline">
          Trocar carteira
        </Link>
      </legend>
      <div role="radiogroup" aria-label="Carteira de pagamento" className="flex flex-col gap-3">
        {wallets.map((w) => (
          <label key={w.id} className={cn('flex cursor-pointer items-start gap-3 rounded-[10px] bg-surface-card p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-highlight', selected === w.id && 'outline outline-brand')}>
            <input type="radio" name="wallet" value={w.id} checked={selected === w.id} onChange={() => onSelect(w.id)} className="mt-1 accent-brand" />
            <span className="text-sm">
              <span className="block font-bold">
                {w.label} <span className="font-normal text-sand">· {w.role === 'primary' ? 'principal' : 'secundária'}</span>
              </span>
              <span className="block text-sand">{w.ensName ?? short(w.address)}</span>
              <span className="block text-sand">Rede {NETWORK_LABEL[w.network]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ReviewDialog({
  open,
  onOpenChange,
  quote,
  reviewedVersion,
  wallet,
  network,
  buyer,
  onConfirm,
  pending,
  error,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  quote?: Quote
  reviewedVersion: string | null
  wallet?: Wallet
  network: Network
  buyer: Buyer
  onConfirm: () => void
  pending: boolean
  error: string | null
}) {
  const changed = !!quote && !!reviewedVersion && quote.version !== reviewedVersion
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-line bg-surface-card sm:max-w-lg">
        <DialogTitle>Revise seu pedido</DialogTitle>
        <DialogDescription className="text-sand">Confira itens, valores, carteira e rede antes de confirmar.</DialogDescription>
        {changed && (
          <p role="alert" className="flex gap-2 rounded-md border border-amber/60 bg-amber/10 p-3 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-amber" aria-hidden /> Os valores mudaram desde que você abriu a revisão. Confira o novo total antes de confirmar.
          </p>
        )}
        {quote && (
          <>
            <ul className="flex flex-col gap-2 text-sm">
              {quote.items.map((i) => (
                <li key={i.itemId} className="flex justify-between gap-3">
                  <span>
                    {i.name} <span className="text-sand">({i.editionLabel}) × {i.quantity}</span>
                  </span>
                  <span className="text-highlight">{formatEth(i.lineTotalEth)}</span>
                </li>
              ))}
            </ul>
            <QuoteIssues quote={quote} />
            <QuoteTotals quote={quote} />
          </>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-sand">Carteira</dt>
          <dd>{wallet ? `${wallet.label} · ${PROVIDER_LABEL[wallet.provider]} · ${short(wallet.address)}` : '—'}</dd>
          <dt className="text-sand">Rede</dt>
          <dd>{NETWORK_LABEL[network]}</dd>
          <dt className="text-sand">Colecionador</dt>
          <dd>
            {buyer.displayName} (@{buyer.username})
          </dd>
        </dl>
        <FormAlert message={error} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Voltar
          </Button>
          <Button onClick={onConfirm} disabled={pending || !quote || quote.issues.length > 0}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Processando…
              </>
            ) : changed ? (
              'Confirmar novos valores'
            ) : (
              'Confirmar compra'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CheckoutPage() {
  const s = useSession()
  const userId = s.status === 'authenticated' ? s.user.id : ''
  const navigate = useNavigate()
  const router = useRouter()
  const me = useMe()
  const walletsQ = useWallets()
  const cart = useCart()
  const quote = useQuote()
  const create = useCreateOrder()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()

  const wallets = useMemo(() => [...(walletsQ.data ?? [])].sort((a, b) => Number(b.role === 'primary') - Number(a.role === 'primary')), [walletsQ.data])
  const [walletId, setWalletId] = useState<string>()
  const wallet = wallets.find((w) => w.id === walletId) ?? wallets[0]
  const [network, setNetwork] = useState<Network>()
  const [provider, setProvider] = useState<WalletProvider>()
  const [connection, setConnection] = useState<Connection>({ state: 'idle' })
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewedVersion, setReviewedVersion] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)

  const activeNetwork = network ?? wallet?.network ?? 'ethereum'
  const activeProvider = provider ?? wallet?.provider ?? 'metamask'

  const form = useForm<Buyer>({ resolver: zodResolver(buyerSchema), defaultValues: { displayName: '', username: '', email: '', note: '' } })
  // prefill from the profile, unless a saved draft (e.g. after a session expiry) exists
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !me.data) return
    prefilled.current = true
    const saved = draft.get<Buyer>()
    form.reset(saved ?? { displayName: me.data.displayName, username: me.data.username, email: me.data.email, note: '' })
  }, [me.data, form])
  useEffect(() => {
    const sub = form.watch((v) => draft.set(v))
    return () => sub.unsubscribe()
  }, [form])

  // switching wallet resets network/connector to that wallet and drops the previous connection
  const selectWallet = (id: string) => {
    if (connection.state === 'connected') disconnect.mutate(connection.walletId)
    setWalletId(id)
    setNetwork(undefined)
    setProvider(undefined)
    setConnection({ state: 'idle' })
  }

  // A previous attempt that never got its response (timeout + refresh): replay it to recover the order.
  useEffect(() => {
    if (!userId) return
    const previous = attempts.get(userId)
    if (!previous) return
    if (previous.orderId) {
      navigate({ to: '/orders/$orderId', params: { orderId: previous.orderId }, replace: true })
      return
    }
    setRecovering(true)
    create.mutate(previous.body, {
      onSuccess: (order) => navigate({ to: '/orders/$orderId', params: { orderId: order.id }, replace: true }),
      onSettled: () => setRecovering(false),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function doConnect() {
    if (!wallet) return
    setConnection({ state: 'connecting' })
    try {
      await connect.mutateAsync({ walletId: wallet.id, provider: activeProvider })
      setConnection({ state: 'connected', walletId: wallet.id })
    } catch (e) {
      setConnection({ state: 'rejected', message: isApiError(e) ? e.message : 'Não foi possível conectar.' })
    }
  }
  function doDisconnect() {
    if (connection.state === 'connected') disconnect.mutate(connection.walletId)
    setConnection({ state: 'idle' })
  }

  const networkError = wallet && activeNetwork !== wallet.network ? `${wallet.label} opera na rede ${NETWORK_LABEL[wallet.network]}.` : undefined
  const openReview = form.handleSubmit(() => {
    if (networkError || connection.state !== 'connected') return
    setOrderError(null)
    setReviewedVersion(quote.data?.version ?? null)
    setReviewOpen(true)
  })

  function confirm() {
    if (!wallet || !quote.data) return
    setOrderError(null)
    setReviewedVersion(quote.data.version) // what the user is confirming right now
    create.mutate(
      { quoteId: quote.data.id, quoteVersion: quote.data.version, walletId: wallet.id, network: activeNetwork, buyer: form.getValues() },
      {
        onSuccess: (order) => {
          draft.clear()
          navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'QUOTE_STALE') {
            // keep the old reviewed version: the dialog now flags the change and asks for a new confirmation
            setOrderError('Preço, disponibilidade ou taxas mudaram. Revise o novo total e confirme novamente.')
            return
          }
          if (isApiError(e) && e.code === 'WALLET_REJECTED') setConnection({ state: 'rejected', message: e.message })
          setOrderError(isApiError(e) ? e.message : 'Não foi possível concluir a compra. Seus itens continuam no carrinho.')
        },
      },
    )
  }

  if (recovering)
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-24 text-sand">
        <Loader2 className="animate-spin" aria-hidden /> Recuperando sua tentativa de compra…
      </p>
    )
  if (walletsQ.isError || me.isError) return <ErrorState className="mt-10" onRetry={() => (walletsQ.refetch(), me.refetch())} retrying={walletsQ.isFetching || me.isFetching} />
  if (!walletsQ.data || !cart.data)
    return (
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_405px]" role="status" aria-label="Carregando pagamento">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  if (!cart.data.items.length)
    return (
      <EmptyState className="mt-10" title="Seu carrinho está vazio">
        <Link to="/" hash="catalogo" className="text-highlight underline">
          Explorar NFTs
        </Link>
      </EmptyState>
    )
  if (!wallets.length)
    return (
      <EmptyState className="mt-10" title="Cadastre uma carteira para pagar">
        <p>As carteiras cadastradas ficam disponíveis no pagamento e recebem os NFTs comprados.</p>
        <Button asChild className="mt-3">
          <Link to="/profile/wallets">Cadastrar carteira</Link>
        </Button>
      </EmptyState>
    )

  const { errors } = form.formState
  const secondary = wallets.find((w) => w.role === 'secondary')
  return (
    <div>
      <div className="flex items-center gap-4 py-4 md:hidden">
        <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="grid size-9 place-items-center rounded-full bg-surface-card">
          <ChevronLeft aria-hidden />
        </button>
        <h1 className="text-xl font-bold">Pagamento com carteira</h1>
      </div>
      <nav aria-label="Trilha" className="mt-6 text-base font-bold max-md:hidden">
        <Link to="/">Início</Link> / <Link to="/" hash="catalogo">Mercado</Link> / <span aria-current="page">Pagamento</span>
      </nav>
      <h1 className="sr-only max-md:hidden">Pagamento</h1>

      <form onSubmit={openReview} noValidate className="mt-8 grid gap-10 lg:grid-cols-[763px_1fr] lg:gap-8">
        <section aria-labelledby="buyer" className="flex flex-col gap-6">
          <h2 id="buyer" className="text-lg font-bold">
            Perfil do colecionador
          </h2>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field label="Nome de exibição" required error={errors.displayName} {...form.register('displayName')} />
            <Field label="Nome de usuário" required error={errors.username} {...form.register('username')} />
            <div className="flex flex-col gap-2">
              <label htmlFor="checkout-network" className="text-sm">
                Rede<span className="text-coral" aria-hidden>*</span>
              </label>
              <select
                id="checkout-network"
                value={activeNetwork}
                onChange={(e) => setNetwork(e.target.value as Network)}
                aria-invalid={!!networkError}
                aria-describedby={networkError ? 'checkout-network-error' : undefined}
                className={cn(inputClass, 'bg-ink')}
              >
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {NETWORK_LABEL[n]}
                  </option>
                ))}
              </select>
              {networkError && (
                <p id="checkout-network-error" className="text-xs text-danger">
                  {networkError}
                </p>
              )}
            </div>
            <ReadOnly label="Nome do perfil" value={wallet?.ownerName ?? ''} />
            <ReadOnly label="Endereço da carteira" value={wallet?.address ?? ''} />
            <ReadOnly label="ENS ou carteira secundária" value={wallet?.ensName ?? secondary?.label ?? '—'} />
            <ReadOnly label="Tipo de carteira" value={wallet ? PROVIDER_LABEL[wallet.provider] : ''} />
            <ReadOnly label="Código de indicação" value={wallet?.referralCode ?? '—'} />
            <Field label="E-mail" type="email" required error={errors.email} {...form.register('email')} />
          </div>
          {secondary && (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={wallet?.id === secondary.id} onChange={(e) => selectWallet(e.target.checked ? secondary.id : wallets[0]!.id)} className="size-4 accent-brand" />
              Usar outra carteira? ({secondary.label})
            </label>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="checkout-note" className="text-sm">
              Observação do colecionador (opcional)
            </label>
            <textarea id="checkout-note" rows={6} className={cn(inputClass, 'h-auto max-w-[350px] py-2')} aria-invalid={!!errors.note} {...form.register('note')} />
            {errors.note && <p className="text-xs text-danger">{errors.note.message}</p>}
          </div>
        </section>

        <aside aria-labelledby="your-nfts" className="flex flex-col gap-5">
          <div className="lg:hidden">
            <WalletPicker wallets={wallets} selected={wallet?.id} onSelect={selectWallet} />
          </div>
          <h2 id="your-nfts" className="text-lg font-bold">
            Seus NFTs
          </h2>
          <ul className="flex flex-col gap-2" aria-busy={quote.isFetching}>
            {(quote.data?.items ?? []).map((i) => (
              <li key={i.itemId} className="flex items-center gap-3 bg-surface-card pr-4">
                <NftImage image={i.image} alt="" sizes="70px" className="size-[70px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{i.name}</span>
                  <span className="block text-sm text-sand">Edição {i.editionLabel}</span>
                </span>
                <span className="text-sm text-sand">(x {i.quantity})</span>
                <span className="font-bold text-highlight">{formatEth(i.lineTotalEth)}</span>
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-center">Tem um código promocional? Aplique aqui</summary>
            <div className="mt-3">
              <CouponField compact />
            </div>
          </details>
          <QuoteIssues quote={quote.data} />
          <QuoteTotals quote={quote.data} loading={quote.isFetching} />

          <fieldset>
            <legend className="mb-3 w-full text-center font-bold">Carteira e rede</legend>
            <div role="radiogroup" aria-label="Conector da carteira" className="flex flex-col gap-3">
              {WALLET_PROVIDERS.map((p) => (
                <label key={p} className={cn('flex cursor-pointer items-center gap-3 border border-line px-4 py-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-highlight', activeProvider === p && 'border-cream')}>
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    checked={activeProvider === p}
                    onChange={() => {
                      doDisconnect()
                      setProvider(p)
                    }}
                    className="accent-brand"
                  />
                  {PROVIDER_LABEL[p]}
                </label>
              ))}
            </div>
          </fieldset>

          <div role="status" aria-live="polite" className="text-sm">
            {connection.state === 'connected' ? (
              <p className="flex items-center justify-between gap-2 rounded-md bg-success/10 px-3 py-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" aria-hidden /> {wallet?.label} conectada via {PROVIDER_LABEL[activeProvider]}
                </span>
                <button type="button" onClick={doDisconnect} className="flex items-center gap-1 text-highlight hover:underline">
                  <Unplug className="size-4" aria-hidden /> Desconectar
                </button>
              </p>
            ) : connection.state === 'rejected' ? (
              <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-danger">
                {connection.message}
              </p>
            ) : null}
          </div>

          {connection.state === 'connected' ? (
            <Button type="submit" disabled={!!networkError || !quote.data} loading={create.isPending} className="h-12 text-base max-md:rounded-full">
              Revisar e confirmar compra
            </Button>
          ) : (
            <Button type="button" onClick={doConnect} disabled={connection.state === 'connecting' || !!networkError} className="h-12 text-base max-md:rounded-full">
              {connection.state === 'connecting' ? <Loader2 className="animate-spin" aria-hidden /> : <PlugZap aria-hidden />}
              {connection.state === 'connecting' ? 'Conectando…' : `Conectar ${PROVIDER_LABEL[activeProvider]}`}
            </Button>
          )}
          <p className="text-center text-xs text-sand">Nenhum valor é cobrado de verdade: carteira e pagamento são simulados.</p>
          <div className="max-lg:hidden">
            <WalletPicker wallets={wallets} selected={wallet?.id} onSelect={selectWallet} />
          </div>
        </aside>
      </form>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        quote={quote.data}
        reviewedVersion={reviewedVersion}
        wallet={wallet}
        network={activeNetwork}
        buyer={form.getValues()}
        onConfirm={confirm}
        pending={create.isPending}
        error={orderError}
      />
    </div>
  )
}
