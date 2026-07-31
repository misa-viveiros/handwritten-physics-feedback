import assert from 'node:assert/strict'
import test from 'node:test'
import { validateWorkedSolution } from './worked-solution-schema.mjs'

test('accepts a concise mechanics worked solution', () => {
  const solution = validateWorkedSolution({
    steps: [
      {
        title: 'Choose the relationship',
        explanation: 'Constant acceleration connects velocity and time.',
        equation: 'v_f = v_i + at',
        substitution: 'v_f = 0 + (2.0 m/s^2)(6.0 s)',
        units: 'm/s',
      },
    ],
    finalAnswer: 'v_f = 12 m/s',
    diagramExplanation: null,
    confidence: 0.98,
    limitations: [],
  })

  assert.equal(solution.steps.length, 1)
  assert.equal(solution.finalAnswer, 'v_f = 12 m/s')
  assert.equal(solution.diagramExplanation, undefined)
})

test('preserves a bounded free-body-diagram explanation', () => {
  const solution = validateWorkedSolution({
    steps: [
      {
        title: 'Identify interactions',
        explanation: 'List only forces acting on the box.',
        equation: null,
        substitution: null,
        units: null,
      },
    ],
    finalAnswer: 'N upward, mg downward, and kinetic friction leftward.',
    diagramExplanation:
      'Friction points left because it opposes the box sliding right.',
    confidence: 0.92,
    limitations: ['Arrow lengths are qualitative.'],
  })

  assert.match(solution.diagramExplanation, /Friction points left/)
  assert.equal(solution.limitations.length, 1)
})

test('rejects an empty worked solution', () => {
  assert.throws(
    () =>
      validateWorkedSolution({
        steps: [],
        finalAnswer: 'Unknown',
        diagramExplanation: null,
        confidence: 0.5,
        limitations: [],
      }),
    /1 to 8 steps/,
  )
})
