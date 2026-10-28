// ETH values travel as decimal strings ("1.19") and are computed in wei (BigInt, 18 decimals),
// so sums, discounts and quantities never touch floating point.
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const ETH_RE = /^\d+(\.\d{1,18})?$/

export function isEth(value: string): boolean {
  return ETH_RE.test(value)
}

export function toWei(eth: string): bigint {
  if (!isEth(eth)) throw new Error(`Invalid ETH amount: ${eth}`)
  const [int = '0', frac = ''] = eth.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

/** Canonical decimal string, trimmed of trailing zeros (minimum 2 decimals for display stability). */
export function fromWei(wei: bigint, minDecimals = 2): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  let frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export const addEth = (...values: string[]) => fromWei(values.reduce((sum, v) => sum + toWei(v), 0n))
export const subEth = (a: string, b: string) => fromWei(toWei(a) - toWei(b))
export const mulEth = (eth: string, qty: number) => fromWei(toWei(eth) * BigInt(qty))
/** Percentage with basis points precision, rounded down to the wei. */
export const pctEth = (eth: string, percent: number) => fromWei((toWei(eth) * BigInt(Math.round(percent * 100))) / 10_000n)
export const cmpEth = (a: string, b: string) => {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}

/** Display formatter: never rounds silently beyond `maxDecimals`; truncates toward zero. */
export function formatEth(eth: string, maxDecimals = 4): string {
  const [int, frac = ''] = fromWei(toWei(eth)).split('.')
  const shown = frac.slice(0, maxDecimals).replace(/0+$/, '').padEnd(2, '0')
  return `${int}.${shown} ETH`
}
