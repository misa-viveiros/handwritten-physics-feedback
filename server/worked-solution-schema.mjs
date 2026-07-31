export const workedSolutionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'steps',
    'finalAnswer',
    'diagramExplanation',
    'confidence',
    'limitations',
  ],
  properties: {
    steps: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'explanation',
          'equation',
          'substitution',
          'units',
        ],
        properties: {
          title: { type: 'string', minLength: 1 },
          explanation: { type: 'string', minLength: 1 },
          equation: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
          substitution: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
          units: {
            anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
          },
        },
      },
    },
    finalAnswer: { type: 'string', minLength: 1 },
    diagramExplanation: {
      anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    limitations: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
}

export function validateWorkedSolution(value) {
  const solution = readRecord(value, 'workedSolution')
  const steps = readArray(solution.steps, 'workedSolution.steps').map(
    (stepValue, index) => {
      const step = readRecord(stepValue, `workedSolution.steps[${index}]`)
      return {
        title: readString(step.title, `workedSolution.steps[${index}].title`),
        explanation: readString(
          step.explanation,
          `workedSolution.steps[${index}].explanation`,
        ),
        equation: readOptionalString(
          step.equation,
          `workedSolution.steps[${index}].equation`,
        ),
        substitution: readOptionalString(
          step.substitution,
          `workedSolution.steps[${index}].substitution`,
        ),
        units: readOptionalString(
          step.units,
          `workedSolution.steps[${index}].units`,
        ),
      }
    },
  )

  if (steps.length === 0 || steps.length > 8) {
    throw new Error('workedSolution.steps must contain 1 to 8 steps.')
  }

  return {
    steps,
    finalAnswer: readString(
      solution.finalAnswer,
      'workedSolution.finalAnswer',
    ),
    diagramExplanation: readOptionalString(
      solution.diagramExplanation,
      'workedSolution.diagramExplanation',
    ),
    confidence: readConfidence(
      solution.confidence,
      'workedSolution.confidence',
    ),
    limitations: readArray(
      solution.limitations,
      'workedSolution.limitations',
    ).map((item, index) =>
      readString(item, `workedSolution.limitations[${index}]`),
    ),
  }
}

function readRecord(value, path) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
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
  return value.trim()
}

function readOptionalString(value, path) {
  return value === undefined || value === null
    ? undefined
    : readString(value, path)
}

function readConfidence(value, path) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(`${path} must be a number from 0 to 1.`)
  }
  return value
}
