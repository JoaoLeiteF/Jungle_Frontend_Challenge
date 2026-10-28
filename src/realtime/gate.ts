import type { RealtimeEvent } from '@/api/contracts'

/**
 * Accepts each event at most once and only if it is newer than anything seen for its resource.
 * Duplicates (same eventId) and stale versions are dropped, so effects never re-apply or regress.
 */
export function createEventGate() {
  const seen = new Set<string>()
  const versions = new Map<string, number>()
  return {
    accept(event: RealtimeEvent, knownVersion = 0): boolean {
      if (seen.has(event.eventId)) return false
      seen.add(event.eventId)
      const key = `${event.resource.type}:${event.resource.id}`
      if (event.version <= Math.max(versions.get(key) ?? 0, knownVersion)) return false
      versions.set(key, event.version)
      return true
    },
    reset() {
      seen.clear()
      versions.clear()
    },
  }
}
