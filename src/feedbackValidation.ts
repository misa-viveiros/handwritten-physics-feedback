import type { ErrorType, FeedbackResult, OverallStatus } from './feedback'

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
        line.uncertainSymbols === undefined
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
    suggestedMarkup: readArray(value.suggestedMarkup, 'suggestedMarkup').map(
      (markupValue, index) => {
        const markup = readRecord(markupValue, `suggestedMarkup[${index}]`)
        return {
          lineId:
            markup.lineId === undefined
              ? undefined
              : readString(markup.lineId, `suggestedMarkup[${index}].lineId`),
          type: readEnum(
            markup.type,
            markupTypes,
            `suggestedMarkup[${index}].type`,
          ),
          targetDescription: readString(
            markup.targetDescription,
            `suggestedMarkup[${index}].targetDescription`,
          ),
          noteText: readString(markup.noteText, `suggestedMarkup[${index}].noteText`),
        }
      },
    ),
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
        firstIssue.likelyMisconception === undefined
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
          issue.lineId === undefined
            ? undefined
            : readString(issue.lineId, `secondaryIssues[${index}].lineId`),
        quotedWork:
          issue.quotedWork === undefined
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
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be a number from 0 to 1.`)
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
