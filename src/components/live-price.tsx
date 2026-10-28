import { useState } from 'react'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** ETH amount that briefly glows when a realtime update changes it (never on first render). */
export function LivePrice({ value, className }: { value: string; className?: string }) {
  const [prev, setPrev] = useState(value)
  const [flashes, setFlashes] = useState(0)
  if (prev !== value) {
    setPrev(value)
    setFlashes((n) => n + 1)
  }
  return (
    <span key={flashes} className={cn(flashes > 0 && 'price-flash', className)}>
      {formatEth(value)}
    </span>
  )
}
