export type RangeWindow = { from: number | null; to: number | null }

export function parseRangeFromSearch(searchParams: {
  range?: string
  from?: string
  to?: string
}): RangeWindow {
  const range = searchParams.range
  if (range === "all") return { from: null, to: null }
  if (range === "custom") {
    const fromTs = searchParams.from ? new Date(searchParams.from).getTime() : null
    const toTs = searchParams.to ? new Date(searchParams.to).getTime() + 86_400_000 - 1 : null
    return {
      from: Number.isFinite(fromTs as number) ? (fromTs as number) : null,
      to: Number.isFinite(toTs as number) ? (toTs as number) : null,
    }
  }
  const days = range === "7d" ? 7 : 30
  return { from: Date.now() - days * 86_400_000, to: null }
}

export function prevWindow(win: RangeWindow): RangeWindow {
  if (win.from === null) return { from: null, to: null }
  const span = (win.to ?? Date.now()) - win.from
  return { from: win.from - span, to: win.from - 1 }
}

export function inWindow(ts: string | null | undefined, win: RangeWindow): boolean {
  if (!ts) return false
  const t = new Date(ts).getTime()
  if (win.from !== null && t < win.from) return false
  if (win.to !== null && t > win.to) return false
  return true
}
