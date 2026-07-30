import type { FeedbackResult } from './feedback'
import type {
  InterpretedLine,
  InterpretationRegion,
} from './interpretation'

export const minimumRegionWidth = 0.025
export const minimumRegionHeight = 0.02

export function clampInterpretationRegion(
  region: InterpretationRegion,
): InterpretationRegion {
  const width = clamp(region.width, minimumRegionWidth, 1)
  const height = clamp(region.height, minimumRegionHeight, 1)

  return {
    x: clamp(region.x, 0, 1 - width),
    y: clamp(region.y, 0, 1 - height),
    width,
    height,
  }
}

export function sortInterpretationLines(
  lines: InterpretedLine[],
): InterpretedLine[] {
  return [...lines]
    .sort((first, second) => {
      if (!first.region || !second.region) {
        return first.order - second.order
      }

      const verticalDifference = first.region.y - second.region.y
      if (Math.abs(verticalDifference) > 0.012) {
        return verticalDifference
      }

      const horizontalDifference = first.region.x - second.region.x
      if (Math.abs(horizontalDifference) > 0.012) {
        return horizontalDifference
      }

      return first.order - second.order
    })
    .map((line, index) => ({ ...line, order: index + 1 }))
}

export function mergeInterpretationLines(
  lines: InterpretedLine[],
  firstId: string,
  secondId: string,
  mergedId: string,
): { lines: InterpretedLine[]; mergedLine: InterpretedLine } | null {
  const first = lines.find((line) => line.id === firstId)
  const second = lines.find((line) => line.id === secondId)
  if (!first || !second || first.id === second.id) {
    return null
  }

  const ordered = [first, second].sort((a, b) => a.order - b.order)
  const combinedText = ordered
    .map((line) => line.confirmedText.trim())
    .filter(Boolean)
    .join(' ')
  const combinedRawText = ordered
    .map((line) => line.rawText.trim())
    .filter(Boolean)
    .join(' ')
  const uncertainSymbols = Array.from(
    new Set(ordered.flatMap((line) => line.uncertainSymbols ?? [])),
  )
  const regions = ordered.flatMap((line) => (line.region ? [line.region] : []))
  const workStatus = mergeWorkStatus(first, second)

  const mergedLine: InterpretedLine = {
    id: mergedId,
    order: Math.min(first.order, second.order),
    rawText: combinedRawText,
    confirmedText: combinedText,
    confidence: Math.min(first.confidence, second.confidence),
    locationConfidence: Math.min(
      first.locationConfidence ?? 1,
      second.locationConfidence ?? 1,
    ),
    needsConfirmation: true,
    uncertainSymbols,
    workStatus,
    workStatusConfidence: Math.min(
      first.workStatusConfidence,
      second.workStatusConfidence,
    ),
    crossedOutEvidence: [first.crossedOutEvidence, second.crossedOutEvidence]
      .filter(Boolean)
      .join(' ') || undefined,
    region: regions.length > 0 ? getBoundingRegion(regions) : undefined,
  }

  return {
    lines: sortInterpretationLines([
      ...lines.filter((line) => line.id !== firstId && line.id !== secondId),
      mergedLine,
    ]),
    mergedLine,
  }
}

export function createManualInterpretationLine(
  region: InterpretationRegion,
  id: string,
  order: number,
): InterpretedLine {
  return {
    id,
    order,
    rawText: '',
    confirmedText: '',
    confidence: 1,
    locationConfidence: 1,
    needsConfirmation: true,
    uncertainSymbols: [],
    workStatus: 'active',
    workStatusConfidence: 1,
    region: clampInterpretationRegion(region),
  }
}

function mergeWorkStatus(
  first: InterpretedLine,
  second: InterpretedLine,
): InterpretedLine['workStatus'] {
  if (first.workStatus === second.workStatus) {
    return first.workStatus
  }
  if (first.workStatus === 'unclear' || second.workStatus === 'unclear') {
    return 'unclear'
  }
  return 'partially_crossed_out'
}

export function reanchorFeedbackToInterpretation(
  feedback: FeedbackResult,
  lines: InterpretedLine[],
): FeedbackResult {
  const regionsByLineId = new Map(
    lines.flatMap((line) => (line.region ? [[line.id, line.region] as const] : [])),
  )

  return {
    ...feedback,
    suggestedMarkup: feedback.suggestedMarkup.map((markup) => {
      if (markup.type === 'physics_vector') {
        return markup
      }

      const lineId = markup.lineId ?? markup.targetLineId
      const region = lineId ? regionsByLineId.get(lineId) : undefined
      if (!region) {
        return markup
      }

      return {
        ...markup,
        region,
        anchor: {
          x: region.x + region.width / 2,
          y: region.y + region.height / 2,
        },
      }
    }),
  }
}

function getBoundingRegion(regions: InterpretationRegion[]): InterpretationRegion {
  const left = Math.min(...regions.map((region) => region.x))
  const top = Math.min(...regions.map((region) => region.y))
  const right = Math.max(...regions.map((region) => region.x + region.width))
  const bottom = Math.max(...regions.map((region) => region.y + region.height))

  return clampInterpretationRegion({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  })
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
