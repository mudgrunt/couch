// Module-level cache: id → in-flight or resolved Promise
// Intentionally kept outside Vue reactivity — this is a plain request cache.
const cache = new Map<number, Promise<Record<string, unknown>>>()

export function prefetchGame(id: number): void {
  if (cache.has(id)) return
  cache.set(
    id,
    fetch(`/api/games/${id}`).then((r) => {
      if (!r.ok) {
        cache.delete(id) // don't cache errors
        throw new Error(`${r.status} ${r.statusText}`)
      }
      return r.json()
    }),
  )
}

export function getGameFromCache(id: number): Promise<Record<string, unknown>> | undefined {
  return cache.get(id)
}
