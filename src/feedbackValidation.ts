import type { ErrorType, FeedbackResult, OverallStatus } from './feedback'

type SuggestedMarkup = FeedbackResult['suggestedMarkup'][number]
type MarkupType = FeedbackResult['suggestedMarkup'][number]['type']

const overallStatuses = new Set<OverallStatus>([
  'correct',
  'partially_correct',
  'incorrect',
  'insufficient_work',
  'unclear',
])

const errorTypes = new Set<ErrorType>([
  'conceptual',
  'equation_selection',
  'algebra',
  'sign',
  'unit',
  'diagram',
  'missing_reasoning',
  'unclear_handwriting',
])

const markupTypes = new Set<MarkupType>([
  'check',
  'circle',
  'underline',
  'arrow',
  'note',
  'dashed_box',
  'question_mark',
  'note_only',
  'physics_vector',
])
const vectorKinds = new Set([
  'force',
  'weight',
  'normal',
  'friction',
  'tension',
  'applied_force',
  'net_inward_force',
  'component',
  'velocity',
  'acceleration',
  'displacement',
  'momentum',
  'other',
] as const)
const vectorIssues = new Set([
  'missing',
  'extra',
  'reversed',
  'mislabeled',
  'wrong_object',
  'not_a_force',
] as const)
const noteStyles = new Set<NonNullable<SuggestedMarkup['noteStyle']>>([
  'handwritten',
  'compact',
  'emphasis',
])
const notePlacements = new Set<NonNullable<SuggestedMarkup['notePlacement']>>([
  'auto',
  'above',
  'below',
  'left',
  'right',
])
const markupCategories = new Set<NonNullable<SuggestedMarkup['category']>>([
  'issue',
  'hint',
  'praise',
  'question',
])

export function validateFeedbackResult(value: unknown): FeedbackResult {
  if (!isRecord(value)) {
    throw new Error('Feedback response was not an object.')
  }

  const transcription = readRecord(value.transcription, 'transcription')
  const linesValue = readArray(transcription.lines, 'transcription.lines')
  const lines = linesValue.map((lineValue, index) => {
    const line = readRecord(lineValue, `transcription.lines[${index}]`)
    return {
      id: readString(line.id, `transcription.lines[${index}].id`),
      text: readString(line.text, `transcription.lines[${index}].text`),
      confidence: readConfidence(
        line.confidence,
        `transcription.lines[${index}].confidence`,
      ),
      uncertainSymbols:
        line.uncertainSymbols === undefined || line.uncertainSymbols === null
          ? undefined
          : readStringArray(
              line.uncertainSymbols,
              `transcription.lines[${index}].uncertainSymbols`,
            ),
    }
  })

  const overallStatus = readEnum(
    value.overallStatus,
    overallStatuses,
    'overallStatus',
  )

  const result: FeedbackResult = {
    transcription: {
      lines,
      overallConfidence: readConfidence(
        transcription.overallConfidence,
        'transcription.overallConfidence',
      ),
    },
    overallStatus,
    strengths: readStringArray(value.strengths, 'strengths'),
    nextStepHint: readString(value.nextStepHint, 'nextStepHint'),
    analysisConfidence: readConfidence(
      value.analysisConfidence,
      'analysisConfidence',
    ),
    suggestedMarkup: normalizeSuggestedMarkup(value.suggestedMarkup),
  }

  if (value.firstIssue !== undefined && value.firstIssue !== null) {
    const firstIssue = readRecord(value.firstIssue, 'firstIssue')
    result.firstIssue = {
      lineId: readString(firstIssue.lineId, 'firstIssue.lineId'),
      quotedWork: readString(firstIssue.quotedWork, 'firstIssue.quotedWork'),
      locationDescription: readString(
        firstIssue.locationDescription,
        'firstIssue.locationDescription',
      ),
      errorType: readEnum(firstIssue.errorType, errorTypes, 'firstIssue.errorType'),
      explanation: readString(firstIssue.explanation, 'firstIssue.explanation'),
      likelyMisconception:
        firstIssue.likelyMisconception === undefined ||
        firstIssue.likelyMisconception === null
          ? undefined
          : readString(
              firstIssue.likelyMisconception,
              'firstIssue.likelyMisconception',
            ),
      hint: readString(firstIssue.hint, 'firstIssue.hint'),
    }
  }

  if (value.secondaryIssues !== undefined && value.secondaryIssues !== null) {
    result.secondaryIssues = readArray(
      value.secondaryIssues,
      'secondaryIssues',
    ).map((issueValue, index) => {
      const issue = readRecord(issueValue, `secondaryIssues[${index}]`)
      return {
        lineId:
          issue.lineId === undefined || issue.lineId === null
            ? undefined
            : readString(issue.lineId, `secondaryIssues[${index}].lineId`),
        quotedWork:
          issue.quotedWork === undefined || issue.quotedWork === null
            ? undefined
            : readString(issue.quotedWork, `secondaryIssues[${index}].quotedWork`),
        errorType: readEnum(
          issue.errorType,
          errorTypes,
          `secondaryIssues[${index}].errorType`,
        ),
        explanation: readString(
          issue.explanation,
          `secondaryIssues[${index}].explanation`,
        ),
      }
    })
  }

  return result
}

function normalizeSuggestedMarkup(value: unknown): SuggestedMarkup[] {
  const markupValues = readArray(value, 'suggestedMarkup')
  const usedIds = new Set<string>()
  const suggestedMarkup: SuggestedMarkup[] = []

  markupValues.forEach((markupValue, index) => {
    if (!isRecord(markupValue)) {
      console.warn(`Dropped suggestedMarkup[${index}]: item must be an object.`)
      return
    }

    const trimmedId =
      typeof markupValue.id === 'string' ? markupValue.id.trim() : ''
    const id =
      trimmedId && !usedIds.has(trimmedId)
        ? trimmedId
        : createFallbackMarkupId(index, usedIds)

    try {
      const markup = readSuggestedMarkup({ ...markupValue, id }, index)
      usedIds.add(markup.id)
      suggestedMarkup.push(markup)
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'item was invalid.'
      console.warn(`Dropped suggestedMarkup[${index}]: ${reason}`)
    }
  })

  return suggestedMarkup
}

function readSuggestedMarkup(
  markupValue: unknown,
  index: number,
): SuggestedMarkup {
  const markup = readRecord(markupValue, `suggestedMarkup[${index}]`)
  const path = `suggestedMarkup[${index}]`
  const type = readEnum(markup.type, markupTypes, `${path}.type`)

  const result: SuggestedMarkup = {
    id: readString(markup.id, `${path}.id`),
    lineId:
      markup.lineId === undefined || markup.lineId === null
        ? undefined
        : readString(markup.lineId, `${path}.lineId`),
    targetLineId:
      markup.targetLineId === undefined || markup.targetLineId === null
        ? undefined
        : readString(markup.targetLineId, `${path}.targetLineId`),
    type,
    targetDescription: readString(
      markup.targetDescription,
      `${path}.targetDescription`,
    ),
    noteText:
      markup.noteText === undefined || markup.noteText === null
        ? undefined
        : readString(markup.noteText, `${path}.noteText`),
    noteStyle:
      markup.noteStyle === undefined || markup.noteStyle === null
        ? undefined
        : readEnum(
            markup.noteStyle,
            noteStyles,
            `${path}.noteStyle`,
          ),
    notePlacement:
      markup.notePlacement === undefined || markup.notePlacement === null
        ? undefined
        : readEnum(
            markup.notePlacement,
            notePlacements,
            `${path}.notePlacement`,
          ),
    notePosition: readOptionalAnchor(
      markup.notePosition,
      `${path}.notePosition`,
    ),
    showLeader:
      markup.showLeader === undefined || markup.showLeader === null
        ? undefined
        : readBoolean(
            markup.showLeader,
            `${path}.showLeader`,
          ),
    leaderAnchor: readOptionalAnchor(
      markup.leaderAnchor,
      `${path}.leaderAnchor`,
    ),
    category:
      markup.category === undefined || markup.category === null
        ? undefined
        : readEnum(
            markup.category,
            markupCategories,
            `${path}.category`,
          ),
    region: readOptionalRegion(
      markup.region,
      `${path}.region`,
    ),
    anchor: readOptionalAnchor(
      markup.anchor,
      `${path}.anchor`,
    ),
    confidence:
      markup.confidence === undefined || markup.confidence === null
        ? undefined
        : clampNumber(
            readFiniteNumber(
              markup.confidence,
              `${path}.confidence`,
            ),
          ),
    targetObject:
      markup.targetObject === undefined || markup.targetObject === null
        ? undefined
        : readString(markup.targetObject, `${path}.targetObject`),
    vectorIssue:
      markup.vectorIssue === undefined || markup.vectorIssue === null
        ? undefined
        : readEnum(
            markup.vectorIssue,
            vectorIssues,
            `${path}.vectorIssue`,
          ),
    replacementFor:
      markup.replacementFor === undefined || markup.replacementFor === null
        ? undefined
        : readString(markup.replacementFor, `${path}.replacementFor`),
    vectorKind:
      markup.vectorKind === undefined || markup.vectorKind === null
        ? undefined
        : readEnum(markup.vectorKind, vectorKinds, `${path}.vectorKind`),
  }

  if (type !== 'physics_vector') {
    return result
  }

  result.vectorKind = readEnum(
    markup.vectorKind,
    vectorKinds,
    `${path}.vectorKind`,
  )
  result.origin = readRequiredPoint(markup.origin, `${path}.origin`)
  result.endpoint = readOptionalPoint(markup.endpoint, `${path}.endpoint`)
  result.direction = readOptionalDirection(
    markup.direction,
    `${path}.direction`,
  )
  result.relativeLength =
    markup.relativeLength === undefined || markup.relativeLength === null
      ? undefined
      : readRelativeLength(markup.relativeLength, `${path}.relativeLength`)
  result.label =
    markup.label === undefined || markup.label === null
      ? undefined
      : readString(markup.label, `${path}.label`)
  result.confidence = readConfidence(markup.confidence, `${path}.confidence`)

  const hasEndpoint = Boolean(result.endpoint)
  const hasDirectionForm = Boolean(
    result.direction && result.relativeLength !== undefined,
  )
  if (!hasEndpoint && !hasDirectionForm) {
    throw new Error(
      `${path} requires endpoint or direction with relativeLength.`,
    )
  }
  if (
    result.endpoint &&
    result.endpoint.x === result.origin.x &&
    result.endpoint.y === result.origin.y
  ) {
    throw new Error(`${path}.endpoint must differ from origin.`)
  }

  return result
}

function createFallbackMarkupId(index: number, usedIds: Set<string>): string {
  const baseId = `markup-${index + 1}`
  let id = baseId
  let suffix = 2

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return id
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

function readConfidence(value: unknown, path: string): number {
  const number = readFiniteNumber(value, path)

  if (number < 0 || number > 1) {
    throw new Error(`${path} must be a number from 0 to 1.`)
  }

  return number
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${path} must be a boolean.`)
  }

  return value
}

function readEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  path: string,
): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`${path} has an unsupported value.`)
  }

  return value as T
}

function readOptionalRegion(value: unknown, path: string) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  let x: number
  let y: number
  let width: number
  let height: number

  try {
    x = readFiniteNumber(value.x, `${path}.x`)
    y = readFiniteNumber(value.y, `${path}.y`)
    width = readFiniteNumber(value.width, `${path}.width`)
    height = readFiniteNumber(value.height, `${path}.height`)
  } catch {
    return undefined
  }

  if (width <= 0 || height <= 0) {
    return undefined
  }

  const clampedX = clampNumber(x)
  const clampedY = clampNumber(y)
  const clampedWidth = Math.min(clampNumber(width), 1 - clampedX)
  const clampedHeight = Math.min(clampNumber(height), 1 - clampedY)

  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return undefined
  }

  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  }
}

function readOptionalAnchor(value: unknown, path: string) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  try {
    return {
      x: clampNumber(readFiniteNumber(value.x, `${path}.x`)),
      y: clampNumber(readFiniteNumber(value.y, `${path}.y`)),
    }
  } catch {
    return undefined
  }
}

function readRequiredPoint(value: unknown, path: string) {
  const point = readOptionalPoint(value, path)
  if (!point) {
    throw new Error(`${path} must contain normalized x and y coordinates.`)
  }
  return point
}

function readOptionalPoint(value: unknown, path: string) {
  if (value === undefined || value === null) {
    return undefined
  }
  const point = readRecord(value, path)
  const x = readFiniteNumber(point.x, `${path}.x`)
  const y = readFiniteNumber(point.y, `${path}.y`)
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    throw new Error(`${path} coordinates must be from 0 to 1.`)
  }
  return { x, y }
}

function readOptionalDirection(value: unknown, path: string) {
  if (value === undefined || value === null) {
    return undefined
  }
  const direction = readRecord(value, path)
  const x = readFiniteNumber(direction.x, `${path}.x`)
  const y = readFiniteNumber(direction.y, `${path}.y`)
  const magnitude = Math.hypot(x, y)
  if (magnitude === 0) {
    throw new Error(`${path} must not be a zero vector.`)
  }
  return { x: x / magnitude, y: y / magnitude }
}

function readRelativeLength(value: unknown, path: string) {
  const length = readFiniteNumber(value, path)
  if (length <= 0 || length > 1) {
    throw new Error(`${path} must be greater than 0 and no more than 1.`)
  }
  return length
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`)
  }

  return value
}

function clampNumber(value: number) {
  return Math.min(1, Math.max(0, value))
}
