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

const markupTypes = new Set([
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
  'velocity',
  'acceleration',
  'displacement',
  'momentum',
  'other',
])
const noteStyles = new Set(['handwritten', 'compact', 'emphasis'])
const notePlacements = new Set(['auto', 'above', 'below', 'left', 'right'])
const markupCategories = new Set(['issue', 'hint', 'praise', 'question'])

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
      description:
        'Visual feedback annotations without IDs; the application assigns stable IDs after parsing.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'lineId',
          'targetLineId',
          'type',
          'targetDescription',
          'noteText',
          'noteStyle',
          'notePlacement',
          'notePosition',
          'showLeader',
          'leaderAnchor',
          'category',
          'region',
          'anchor',
          'confidence',
          'vectorKind',
          'origin',
          'endpoint',
          'direction',
          'relativeLength',
          'label',
        ],
        properties: {
          lineId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          targetLineId: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          type: { type: 'string', enum: [...markupTypes] },
          targetDescription: { type: 'string', minLength: 1 },
          noteText: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
          noteStyle: {
            anyOf: [
              { type: 'string', enum: [...noteStyles] },
              { type: 'null' },
            ],
          },
          notePlacement: {
            anyOf: [
              { type: 'string', enum: [...notePlacements] },
              { type: 'null' },
            ],
          },
          notePosition: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
              },
              { type: 'null' },
            ],
          },
          showLeader: {
            anyOf: [{ type: 'boolean' }, { type: 'null' }],
          },
          leaderAnchor: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
              },
              { type: 'null' },
            ],
          },
          category: {
            anyOf: [
              { type: 'string', enum: [...markupCategories] },
              { type: 'null' },
            ],
          },
          region: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y', 'width', 'height'],
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' },
                },
              },
              { type: 'null' },
            ],
          },
          anchor: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                },
              },
              { type: 'null' },
            ],
          },
          confidence: {
            anyOf: [{ type: 'number' }, { type: 'null' }],
          },
          vectorKind: {
            anyOf: [
              { type: 'string', enum: [...vectorKinds] },
              { type: 'null' },
            ],
          },
          origin: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number', minimum: 0, maximum: 1 },
                  y: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
              { type: 'null' },
            ],
          },
          endpoint: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number', minimum: 0, maximum: 1 },
                  y: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
              { type: 'null' },
            ],
          },
          direction: {
            anyOf: [
              {
                type: 'object',
                additionalProperties: false,
                required: ['x', 'y'],
                properties: {
                  x: { type: 'number', minimum: -1, maximum: 1 },
                  y: { type: 'number', minimum: -1, maximum: 1 },
                },
              },
              { type: 'null' },
            ],
          },
          relativeLength: {
            anyOf: [
              { type: 'number', minimum: 0, maximum: 1 },
              { type: 'null' },
            ],
          },
          label: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
        },
      },
    },
  },
}

export function normalizeFeedbackResult(value, onDroppedMarkup = () => {}) {
  if (!isRecord(value) || !Array.isArray(value.suggestedMarkup)) {
    return value
  }

  const usedIds = new Set()
  const suggestedMarkup = []

  value.suggestedMarkup.forEach((markupValue, index) => {
    if (!isRecord(markupValue)) {
      onDroppedMarkup(index, `suggestedMarkup[${index}] must be an object.`)
      return
    }

    const trimmedId =
      typeof markupValue.id === 'string' ? markupValue.id.trim() : ''
    const id =
      trimmedId && !usedIds.has(trimmedId)
        ? trimmedId
        : createFallbackMarkupId(index, usedIds)
    const candidate = { ...markupValue, id }

    try {
      const normalizedMarkup = readSuggestedMarkup(candidate, index)
      usedIds.add(normalizedMarkup.id)
      suggestedMarkup.push(normalizedMarkup)
    } catch (error) {
      if (candidate.type === 'physics_vector') {
        try {
          const fallback = readSuggestedMarkup(
            {
              ...candidate,
              type: 'note_only',
              noteText:
                typeof candidate.noteText === 'string' &&
                candidate.noteText.trim()
                  ? candidate.noteText
                  : candidate.targetDescription,
            },
            index,
          )
          usedIds.add(fallback.id)
          suggestedMarkup.push(fallback)
          onDroppedMarkup(
            index,
            `Physics vector geometry was invalid; preserved as text-only feedback.`,
          )
          return
        } catch {
          // Fall through to the normal invalid-entry report.
        }
      }
      onDroppedMarkup(
        index,
        error instanceof Error
          ? error.message
          : `suggestedMarkup[${index}] was invalid.`,
      )
    }
  })

  return { ...value, suggestedMarkup }
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
    suggestedMarkup: readArray(
      value.suggestedMarkup,
      'suggestedMarkup',
    ).map(readSuggestedMarkup),
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

function readSuggestedMarkup(markupValue, index) {
  const markup = readRecord(markupValue, `suggestedMarkup[${index}]`)
  const path = `suggestedMarkup[${index}]`
  const type = readEnum(markup.type, markupTypes, `${path}.type`)
  const result = {
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

  if (
    !result.endpoint &&
    !(result.direction && result.relativeLength !== undefined)
  ) {
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

function createFallbackMarkupId(index, usedIds) {
  const baseId = `markup-${index + 1}`
  let id = baseId
  let suffix = 2

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  return id
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

function readBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new Error(`${path} must be a boolean.`)
  }

  return value
}

function readConfidence(value, path) {
  const number = readFiniteNumber(value, path)

  if (number < 0 || number > 1) {
    throw new Error(`${path} must be a number from 0 to 1.`)
  }

  return number
}

function readEnum(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${path} has an unsupported value.`)
  }

  return value
}

function readOptionalRegion(value, path) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  let x
  let y
  let width
  let height

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

function readOptionalAnchor(value, path) {
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

function readRequiredPoint(value, path) {
  const point = readOptionalPoint(value, path)
  if (!point) {
    throw new Error(`${path} must contain normalized x and y coordinates.`)
  }
  return point
}

function readOptionalPoint(value, path) {
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

function readOptionalDirection(value, path) {
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

function readRelativeLength(value, path) {
  const length = readFiniteNumber(value, path)
  if (length <= 0 || length > 1) {
    throw new Error(`${path} must be greater than 0 and no more than 1.`)
  }
  return length
}

function readFiniteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`)
  }

  return value
}

function clampNumber(value) {
  return Math.min(1, Math.max(0, value))
}
