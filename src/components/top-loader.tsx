import { useIsFetching } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'

export function TopLoader() {
  const fetching = useIsFetching() > 0
  const routing = useRouterState({ select: (s) => s.status === 'pending' })
  if (!fetching && !routing) return null
  return <div aria-hidden className="top-loader pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-brand/15" style={{ animation: 'loader-in 200ms 250ms both' }} />
}
