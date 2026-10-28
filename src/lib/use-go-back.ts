import { useRef } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'

/** Previous page when there is one in this tab, the home otherwise. Runs at most once. */
export function useGoBack() {
  const router = useRouter()
  const navigate = useNavigate()
  const left = useRef(false)
  return () => {
    if (left.current) return
    left.current = true
    if (router.history.canGoBack()) router.history.back()
    else navigate({ to: '/' })
  }
}
