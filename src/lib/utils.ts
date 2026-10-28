import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 0x8A3f…7F80: first 6 and last 4 characters of an address or hash. */
export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`
