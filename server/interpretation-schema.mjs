export const interpretationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['lines', 'overallConfidence', 'interpretationNotes'],
  properties: {
    lines: {
      type: 'array',
      minItems: 1,
      description:
        'Ordered handwritten lines without application IDs or confirmed text.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'order',
          'rawText',
          'confidence',
          'locationConfidence',
          'needsConfirmation',
          'uncertainSymbols',
          'workStatus',
          'workStatusConfidence',
          'crossedOutEvidence',
          'region',
        ],
        properties: {
          order: { type: 'integer', minimum: 1 },
          rawText: { type: 'string', minLength: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          locationConfidence: {
            anyOf: [
              { type: 'number', minimum: 0, maximum: 1 },
              { type: 'null' },
            ],
          },
          needsConfirmation: { type: 'boolean' },
          workStatus: {
            type: 'string',
            enum: [
              'active',
              'crossed_out',
              'partially_crossed_out',
              'unclear',
            ],
          },
          workStatusConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          crossedOutEvidence: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
          uncertainSymbols: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
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
        },
      },
    },
    overallConfidence: { type: 'number', minimum: 0, maximum: 1 },
    interpretationNotes: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
}

export function normalizeAndValidateInterpretation(value) {
  const interpretation = readRecord(value, 'interpretation')
  const sourceLines = readArray(interpretation.lines, 'interpretation.lines')
    .map((lineValue, index) => {
      const line = readRecord(lineValue, `interpretation.lines[${index}]`)
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
        sourceIndex: index,
        order: readPositiveInteger(
          line.order,
          `interpretation.lines[${index}].order`,
        ),
        rawText: readString(
          line.rawText,
          `interpretation.lines[${index}].rawText`,
        ),
        confidence,
        locationConfidence,
        needsConfirmation:
          typeof line.needsConfirmation === 'boolean'
            ? line.needsConfirmation
            : false,
        workStatus: readEnum(
          line.workStatus,
          new Set([
            'active',
            'crossed_out',
            'partially_crossed_out',
            'unclear',
          ]),
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
        uncertainSymbols:
          line.uncertainSymbols === undefined ||
          line.uncertainSymbols === null
            ? []
            : readStringArray(
                line.uncertainSymbols,
                `interpretation.lines[${index}].uncertainSymbols`,
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
    })
    .sort((a, b) => a.order - b.order || a.sourceIndex - b.sourceIndex)

  if (sourceLines.length === 0) {
    throw new Error('interpretation.lines must contain at least one line.')
  }

  return {
    lines: sourceLines.map((line, index) => ({
      id: `line-${index + 1}`,
      order: index + 1,
      rawText: line.rawText,
      confirmedText: line.rawText,
      confidence: line.confidence,
      locationConfidence: line.locationConfidence,
      needsConfirmation: line.needsConfirmation,
      workStatus: line.workStatus,
      workStatusConfidence: line.workStatusConfidence,
      crossedOutEvidence: line.crossedOutEvidence,
      uncertainSymbols:
        line.uncertainSymbols.length > 0 ? line.uncertainSymbols : undefined,
      region: line.region,
    })),
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

export function validateConfirmedLines(value) {
  const statuses = new Set(['correct', 'needs_correction', 'not_sure'])
  const lines = readArray(value, 'confirmedLines').map((lineValue, index) => {
    const line = readRecord(lineValue, `confirmedLines[${index}]`)
    const status = readString(
      line.status,
      `confirmedLines[${index}].status`,
    )

    if (!statuses.has(status)) {
      throw new Error(`confirmedLines[${index}].status is unsupported.`)
    }

    return {
      id: readString(line.id, `confirmedLines[${index}].id`).trim(),
      order: readPositiveInteger(
        line.order,
        `confirmedLines[${index}].order`,
      ),
      rawText: readString(
        line.rawText,
        `confirmedLines[${index}].rawText`,
      ),
      confirmedText: readString(
        line.confirmedText,
        `confirmedLines[${index}].confirmedText`,
      ),
      confidence: readConfidence(
        line.confidence,
        `confirmedLines[${index}].confidence`,
      ),
      uncertainSymbols:
        line.uncertainSymbols === undefined || line.uncertainSymbols === null
          ? undefined
          : readStringArray(
              line.uncertainSymbols,
              `confirmedLines[${index}].uncertainSymbols`,
            ),
      workStatus: readEnum(
        line.workStatus,
        new Set([
          'active',
          'crossed_out',
          'partially_crossed_out',
          'unclear',
        ]),
        `confirmedLines[${index}].workStatus`,
      ),
      workStatusConfidence: readConfidence(
        line.workStatusConfidence,
        `confirmedLines[${index}].workStatusConfidence`,
      ),
      crossedOutEvidence:
        line.crossedOutEvidence === undefined ||
        line.crossedOutEvidence === null
          ? undefined
          : readString(
              line.crossedOutEvidence,
              `confirmedLines[${index}].crossedOutEvidence`,
            ),
      region: readOptionalRegion(
        line.region,
        `confirmedLines[${index}].region`,
      ),
      status,
    }
  })

  if (lines.length === 0) {
    throw new Error('confirmedLines must contain at least one line.')
  }

  return lines.sort((a, b) => a.order - b.order)
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

function readEnum(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new Error(`${path} is unsupported.`)
  }
  return value
}

function readPositiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${path} must be a positive integer.`)
  }

  return value
}

function readConfidence(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`)
  }

  return clamp(value)
}

function readOptionalRegion(value, path) {
  if (value === undefined || value === null || !isRecord(value)) {
    return undefined
  }

  let x
  let y
  let width
  let height

  try {
    x = readCoordinate(value.x, `${path}.x`)
    y = readCoordinate(value.y, `${path}.y`)
    width = readCoordinate(value.width, `${path}.width`)
    height = readCoordinate(value.height, `${path}.height`)
  } catch {
    return undefined
  }
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
}

function readCoordinate(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number.`)
  }

  return value
}

function clamp(value) {
  return Math.min(1, Math.max(0, value))
}
