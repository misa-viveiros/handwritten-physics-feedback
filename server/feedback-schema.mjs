const overallStatuses = new Set([
  'correct',
  'partially_correct',
  'incorrect',
  'insufficient_work',
  'unclear',
])

const errorTypes = new Set([
  'conceptual',
  'equation_selection',
  'algebra',
  'sign',
  'unit',
  'diagram',
  'missing_reasoning',
  'unclear_handwriting',
])

const markupTypes = new Set(['check', 'circle', 'underline', 'arrow', 'note'])

const errorTypeEnum = [...errorTypes]

export const feedbackJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'transcription',
    'overallStatus',
    'strengths',
    'firstIssue',
    'secondaryIssues',
    'nextStepHint',
    'analysisConfidence',
    'suggestedMarkup',
  ],
  properties: {
    transcription: {
      type: 'object',
      additionalProperties: false,
      required: ['lines', 'overallConfidence'],
      properties: {
        lines: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'text', 'confidence', 'uncertainSymbols'],
            properties: {
              id: { type: 'string', minLength: 1 },
              text: { type: 'string', minLength: 1 },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              uncertainSymbols: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        overallConfidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    overallStatus: {
      type: 'string',
      enum: [...overallStatuses],
    },
    strengths: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
    firstIssue: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'lineId',
            'quotedWork',
            'locationDescription',
            'errorType',
            'explanation',
            'likelyMisconception',
            'hint',
          ],
          properties: {
            lineId: { type: 'string', minLength: 1 },
            quotedWork: { type: 'string', minLength: 1 },
            locationDescription: { type: 'string', minLength: 1 },
            errorType: { type: 'string', enum: errorTypeEnum },
            explanation: { type: 'string', minLength: 1 },
            likelyMisconception: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            hint: { type: 'string', minLength: 1 },
          },
        },
        { type: 'null' },
      ],
    },
    secondaryIssues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lineId', 'quotedWork', 'errorType', 'explanation'],
        properties: {
          lineId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          quotedWork: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          errorType: { type: 'string', enum: errorTypeEnum },
          explanation: { type: 'string', minLength: 1 },
        },
      },
    },
    nextStepHint: { type: 'string', minLength: 1 },
    analysisConfidence: { type: 'number', minimum: 0, maximum: 1 },
    suggestedMarkup: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lineId', 'type', 'targetDescription', 'noteText'],
        properties: {
          lineId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          type: { type: 'string', enum: [...markupTypes] },
          targetDescription: { type: 'string', minLength: 1 },
          noteText: { type: 'string', minLength: 1 },
        },
      },
    },
  },
}

export function validateFeedbackResult(value) {
  if (!isRecord(value)) {
    throw new Error('Feedback response was not an object.')
  }

  const transcription = readRecord(value.transcription, 'transcription')
  const lines = readArray(transcription.lines, 'transcription.lines').map(
    (lineValue, index) => {
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
    },
  )

  const result = {
    transcription: {
      lines,
      overallConfidence: readConfidence(
        transcription.overallConfidence,
        'transcription.overallConfidence',
      ),
    },
    overallStatus: readEnum(value.overallStatus, overallStatuses, 'overallStatus'),
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
            markup.lineId === undefined || markup.lineId === null
              ? undefined
              : readString(markup.lineId, `suggestedMarkup[${index}].lineId`),
          type: readEnum(markup.type, markupTypes, `suggestedMarkup[${index}].type`),
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

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value, path) {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`)
  }

  return value
}

function readArray(value, path) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`)
  }

  return value
}

function readString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`)
  }

  return value
}

function readStringArray(value, path) {
  return readArray(value, path).map((item, index) =>
    readString(item, `${path}[${index}]`),
  )
}

function readConfidence(value, path) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be a number from 0 to 1.`)
  }

  return value
}

function readEnum(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${path} has an unsupported value.`)
  }

  return value
}
