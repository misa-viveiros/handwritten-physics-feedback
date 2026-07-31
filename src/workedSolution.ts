export type WorkedSolutionStep = {
  title: string
  explanation: string
  equation?: string
  substitution?: string
  units?: string
}

export type WorkedSolution = {
  steps: WorkedSolutionStep[]
  finalAnswer: string
  diagramExplanation?: string
  confidence: number
  limitations: string[]
}

export function validateWorkedSolution(value: unknown): WorkedSolution {
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

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`)
  }
  return value as Record<string, unknown>
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
  return value.trim()
}

function readOptionalString(
  value: unknown,
  path: string,
): string | undefined {
  return value === undefined || value === null
    ? undefined
    : readString(value, path)
}

function readConfidence(value: unknown, path: string): number {
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
