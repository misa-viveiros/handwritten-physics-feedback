type ReferenceLine = {
  id: string
  order?: number
  text?: string
  confirmedText?: string
  region?: {
    x: number
    y: number
    width: number
    height: number
  }
  workStatus?: string
}

export type LineGutterItem = {
  id: string
  number: number
  y: number
  workStatus?: string
}

export function sortLinesByOrder<T extends ReferenceLine>(lines: T[]): T[] {
  return [...lines].sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
      (b.order ?? Number.MAX_SAFE_INTEGER),
  )
}

export function createLineGutterItems(
  lines: ReferenceLine[],
): LineGutterItem[] {
  const sorted = sortLinesByOrder(lines)
  const items = sorted.flatMap((line, index) =>
    line.region
      ? [
          {
            id: line.id,
            number: index + 1,
            y: clamp(
              line.region.y + line.region.height / 2,
              0.018,
              0.982,
            ),
            workStatus: line.workStatus,
          },
        ]
      : [],
  )

  const minimumGap = 0.032
  items.sort((first, second) => first.y - second.y)
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1]
    const current = items[index]
    if (current.y - previous.y < minimumGap) {
      current.y = Math.min(0.982, previous.y + minimumGap)
    }
  }

  return items
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
