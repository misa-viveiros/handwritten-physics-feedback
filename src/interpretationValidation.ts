import type {
  HandwritingWorkStatus,
  InterpretedLine,
  InterpretedSolution,
  InterpretationRegion,
} from './interpretation'

const workStatuses = new Set<HandwritingWorkStatus>([
  'active',
  'crossed_out',
  'partially_crossed_out',
  'unclear',
])

export function validateInterpretedSolution(value: unknown): InterpretedSolution {
  const interpretation = readRecord(value, 'interpretation')
  const lines = readArray(interpretation.lines, 'interpretation.lines')
    .map((lineValue, index) => readLine(lineValue, index))
    .sort((a, b) => a.order - b.order)
    .map((line, index) => ({ ...line, order: index + 1 }))

  if (lines.length === 0) {
    throw new Error('The AI did not return any transcription lines.')
  }

  return {
    lines,
    overallConfidence: readConfidence(
      interpretation.overallConfidence,
      'interpretation.overallConfidence',
    ),
    interpretationNotes:
      interpretation.interpretationNotes === undefined ||
      interpretation.interpretationNotes === null
        ? undefined
        : readStringArray(
            interpretation.interpretationNotes,
            'interpretation.interpretationNotes',
          ),
  }
}

function readLine(value: unknown, index: number): InterpretedLine {
  const line = readRecord(value, `interpretation.lines[${index}]`)
  const rawText = readString(
    line.rawText,
    `interpretation.lines[${index}].rawText`,
  )
  const confidence = readConfidence(
    line.confidence,
    `interpretation.lines[${index}].confidence`,
  )
  const locationConfidence =
    line.locationConfidence === undefined ||
    line.locationConfidence === null
      ? undefined
      : readConfidence(
          line.locationConfidence,
          `interpretation.lines[${index}].locationConfidence`,
        )

  return {
    id: readString(line.id, `interpretation.lines[${index}].id`).trim(),
    order: readPositiveInteger(
      line.order,
      `interpretation.lines[${index}].order`,
    ),
    rawText,
    confirmedText:
      line.confirmedText === undefined || line.confirmedText === null
        ? rawText
        : readString(
            line.confirmedText,
            `interpretation.lines[${index}].confirmedText`,
          ),
    confidence,
    locationConfidence,
    needsConfirmation:
      typeof line.needsConfirmation === 'boolean'
        ? line.needsConfirmation
        : undefined,
    uncertainSymbols:
      line.uncertainSymbols === undefined || line.uncertainSymbols === null
        ? undefined
        : readStringArray(
            line.uncertainSymbols,
            `interpretation.lines[${index}].uncertainSymbols`,
          ),
    workStatus: readWorkStatus(
      line.workStatus,
      `interpretation.lines[${index}].workStatus`,
    ),
    workStatusConfidence: readConfidence(
      line.workStatusConfidence,
      `interpretation.lines[${index}].workStatusConfidence`,
    ),
    crossedOutEvidence:
      line.crossedOutEvidence === undefined ||
      line.crossedOutEvidence === null
        ? undefined
        : readString(
            line.crossedOutEvidence,
            `interpretation.lines[${index}].crossedOutEvidence`,
          ),
    region:
      confidence < 0.5 ||
      (locationConfidence !== undefined && locationConfidence < 0.6)
        ? undefined
        : readOptionalRegion(
            line.region,
            `interpretation.lines[${index}].region`,
          ),
  }
}

function readWorkStatus(
  value: unknown,
  path: string,
): HandwritingWorkStatus {
  if (typeof value !== 'string' || !workStatuses.has(value as HandwritingWorkStatus)) {
    throw new Error(`${path} is unsupported.`)
  }
  return value as HandwritingWorkStatus
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`)
  }

  return value
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`)
  }

  return value
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`)
  }

  return value
}

function readStringArray(value: unknown, path: string): string[] {
  return readArray(value, path).map((item, index) =>
    readString(item, `${path}[${index}]`),
  )
}

function readPositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`${path} must be a positive integer.`)
  }

  return value as number
}

function readConfidence(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`)
  }

  return clamp(value)
}

function readOptionalRegion(
  value: unknown,
  path: string,
): InterpretationRegion | undefined {
  if (value === undefined || value === null || !isRecord(value)) {
    return undefined
  }

  try {
    const x = readNumber(value.x, `${path}.x`)
    const y = readNumber(value.y, `${path}.y`)
    const width = readNumber(value.width, `${path}.width`)
    const height = readNumber(value.height, `${path}.height`)
    const clampedX = clamp(x)
    const clampedY = clamp(y)
    const clampedWidth = Math.min(clamp(width), 1 - clampedX)
    const clampedHeight = Math.min(clamp(height), 1 - clampedY)

    if (clampedWidth <= 0 || clampedHeight <= 0) {
      return undefined
    }

    return {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
    }
  } catch {
    return undefined
  }
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`)
  }

  return value
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}
