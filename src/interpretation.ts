export type LineReviewStatus = 'correct' | 'needs_correction' | 'not_sure'

export type HandwritingWorkStatus =
  | 'active'
  | 'crossed_out'
  | 'partially_crossed_out'
  | 'unclear'

export type InterpretationRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type InterpretedLine = {
  id: string
  order: number
  rawText: string
  confirmedText: string
  confidence: number
  locationConfidence?: number
  needsConfirmation?: boolean
  uncertainSymbols?: string[]
  workStatus: HandwritingWorkStatus
  workStatusConfidence: number
  crossedOutEvidence?: string
  region?: InterpretationRegion
}

export type InterpretedSolution = {
  lines: InterpretedLine[]
  overallConfidence: number
  interpretationNotes?: string[]
}

export type ConfirmedLine = InterpretedLine & {
  status: LineReviewStatus
}

export const interpretationConfidenceThreshold = 0.8
export const locationConfidenceThreshold = 0.6

export function lineNeedsConfirmation(line: InterpretedLine): boolean {
  return Boolean(
    line.needsConfirmation ||
      line.confidence < interpretationConfidenceThreshold ||
      (line.uncertainSymbols?.length ?? 0) > 0 ||
      line.workStatus === 'unclear' ||
      line.workStatusConfidence < interpretationConfidenceThreshold ||
      (line.locationConfidence !== undefined &&
        line.locationConfidence < locationConfidenceThreshold),
  )
}

export function createInitialLineStatuses(
  interpretation: InterpretedSolution,
): Record<string, LineReviewStatus | undefined> {
  return Object.fromEntries(
    interpretation.lines.map((line) => [
      line.id,
      lineNeedsConfirmation(line) ? undefined : 'correct',
    ]),
  )
}

export function getVerificationSummary(
  lines: InterpretedLine[],
  lineStatuses: Record<string, LineReviewStatus | undefined>,
) {
  return {
    total: lines.length,
    needsReview: lines.filter((line) => !lineStatuses[line.id]).length,
    acceptedAutomatically: lines.filter(
      (line) =>
        !lineNeedsConfirmation(line) && lineStatuses[line.id] === 'correct',
    ).length,
  }
}
