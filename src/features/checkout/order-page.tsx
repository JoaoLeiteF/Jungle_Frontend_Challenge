import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Loader2, XCircle } from 'lucide-react'
import { isApiError } from '@/api/client'
import type { Order } from '@/api/contracts'
import { qk } from '@/app/query'
import { useScope } from '@/app/session'
import { Icon } from '@/components/icon'
import { NftImage } from '@/components/nft-image'
import { ErrorState, Skeleton } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NotFoundPage } from '@/features/misc/not-found'
import { realtimeStatus } from '@/realtime/bridge'
import { formatEth } from '@/lib/eth'
import { attempts, draft } from './attempt'
import { NETWORK_LABEL, PROVIDER_LABEL } from './checkout-page'
import { useOrder } from './queries'

const route = getRouteApi('/orders/$orderId')
const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const date = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`
}

function Receipt({ order }: { order: Order }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-brand px-6 py-3 text-xs sm:grid-cols-4 sm:divide-x sm:divide-brand">
        <div className="sm:pr-3">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand">{order.txHash ? short(order.txHash) : short(order.id.padEnd(10, '·'))}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{date(order.createdAt)}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.totalEth)}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand">{PROVIDER_LABEL[order.wallet.provider]}</dd>
        </div>
      </dl>
      <div className="px-6 py-5 sm:px-11">
        <h3 className="text-sm font-bold">Detalhes da transação</h3>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 font-bold">NFTs</th>
              <th className="py-2 text-center font-bold">Edições</th>
              <th className="py-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.itemId}>
                <td className="py-2">
                  <span className="flex items-center gap-3">
                    <NftImage image={i.image} alt="" sizes="70px" className="size-[66px] shrink-0 rounded-[4px]" />
                    <span>
                      <span className="block font-bold">{i.name}</span>
                      <span className="block text-xs text-sand">Edição {i.editionLabel}</span>
                    </span>
                  </span>
                </td>
                <td className="text-center text-xs text-sand">(x {i.quantity})</td>
                <td className="text-right font-bold text-highlight">{formatEth(i.lineTotalEth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 ml-auto grid w-full max-w-[320px] grid-cols-2 gap-y-2 text-sm">
          {order.discountEth !== '0.00' && (
            <>
              <dt>Desconto {order.couponCode && `(${order.couponCode})`}</dt>
              <dd className="text-right">(-) {formatEth(order.discountEth)}</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right">{formatEth(order.networkFeeEth)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-right text-base font-bold text-highlight">{formatEth(order.totalEth)}</dd>
        </dl>
      </div>
    </>
  )
}

function OrderCard({ order }: { order: Order }) {
  const network = NETWORK_LABEL[order.network]
  if (order.status === 'pending')
    return (
      <>
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4 text-center">
          <Loader2 className="size-14 animate-spin text-brand" aria-hidden />
          <DialogTitle className="text-base font-bold text-sand">Aguardando confirmação na {network}</DialogTitle>
          <DialogDescription className="text-xs text-sand">Seu pedido foi registrado. Você pode recarregar ou fechar a página: o status será recuperado sem criar outra compra.</DialogDescription>
        </div>
        <Receipt order={order} />
      </>
    )
  if (order.status === 'rejected')
    return (
      <>
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4 text-center">
          <XCircle className="size-14 text-danger" aria-hidden />
          <DialogTitle className="text-base font-bold">Pagamento recusado</DialogTitle>
          <DialogDescription className="text-sm text-sand">{order.rejectionReason ?? 'A transação não foi concluída.'} Seus itens continuam no carrinho.</DialogDescription>
        </div>
        <Receipt order={order} />
        <div className="flex justify-center gap-3 px-6 pb-8">
          <Button asChild variant="outline">
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
          <Button asChild>
            <Link to="/checkout">Tentar novamente</Link>
          </Button>
        </div>
      </>
    )
  return (
    <>
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-center">
        <Icon name="thank-you" className="size-20 text-brand" />
        <DialogTitle className="text-base font-bold text-sand">Seus NFTs agora estão na sua carteira</DialogTitle>
        <DialogDescription className="sr-only">Pedido confirmado. Recibo da transação a seguir.</DialogDescription>
      </div>
      <Receipt order={order} />
      <p className="px-10 text-center text-sm leading-[22px] text-sand">Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.</p>
      <div className="flex flex-col items-center gap-1 px-6 pt-5 pb-8">
        {order.explorerUrl && (
          <Button asChild className="h-12 px-4 text-base">
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
              Ver no Etherscan
            </a>
          </Button>
        )}
        <span className="text-[11px] text-sand-muted">Hash e link de explorador simulados.</span>
      </div>
    </>
  )
}

export function OrderPage() {
  const { orderId } = route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const scope = useScope()
  const order = useOrder(orderId)
  const status = order.data?.status

  useEffect(() => {
    if (status === 'confirmed' || status === 'rejected') {
      attempts.clear()
      if (status === 'confirmed') draft.clear()
      qc.invalidateQueries({ queryKey: qk.cart(scope) })
    }
  }, [status, qc, scope])

  useEffect(() => {
    const unsubscribe = realtimeStatus.subscribe((s) => {
      if (s === 'connected' && status === 'pending') order.refetch()
    })
    return () => {
      unsubscribe()
    }
  }, [status, order])

  if (order.isError && isApiError(order.error) && order.error.status === 404) return <NotFoundPage title="Pedido não encontrado" message="Não existe um pedido com este identificador." />
  if (order.isError && isApiError(order.error) && order.error.status === 403) return <NotFoundPage title="Acesso negado" message="Este pedido pertence a outra conta." />
  if (order.isError && !order.data) return <ErrorState className="mt-10" onRetry={() => order.refetch()} retrying={order.isFetching} />

  return (
    <>
      {!order.data && (
        <div className="mx-auto mt-24 max-w-[578px]" role="status" aria-label="Carregando pedido">
          <Skeleton className="h-[600px]" />
        </div>
      )}
      {order.data && (
        <Dialog open onOpenChange={(o) => !o && navigate({ to: '/' })}>
          <DialogContent aria-live="polite" className="max-h-[92dvh] w-[578px] max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto border-0 border-b-[10px] border-b-brand bg-surface-card p-0 sm:max-w-[578px]">
            <OrderCard order={order.data} />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
