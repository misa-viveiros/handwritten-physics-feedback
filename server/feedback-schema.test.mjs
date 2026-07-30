import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeFeedbackResult,
  validateFeedbackResult,
} from './feedback-schema.mjs'

const baseFeedback = (suggestedMarkup) => ({
  transcription: {
    lines: [
      {
        id: 'line-1',
        text: 'N up, mg down, v right',
        confidence: 0.96,
        uncertainSymbols: [],
      },
    ],
    overallConfidence: 0.96,
  },
  overallStatus: 'partially_correct',
  strengths: ['The existing vectors have clear labels.'],
  firstIssue: null,
  secondaryIssues: [],
  nextStepHint: 'Add the force that opposes the relative motion.',
  analysisConfidence: 0.91,
  suggestedMarkup,
})

test('accepts a leftward missing-friction vector with an endpoint', () => {
  const normalized = normalizeFeedbackResult(
    baseFeedback([
      {
        type: 'physics_vector',
        vectorKind: 'force',
        origin: { x: 0.52, y: 0.58 },
        endpoint: { x: 0.34, y: 0.58 },
        label: 'f_k',
        noteText: 'What force is slowing the box?',
        targetDescription: 'Missing friction vector on the box',
        targetLineId: 'line-1',
        category: 'question',
        confidence: 0.91,
      },
    ]),
  )
  const feedback = validateFeedbackResult(normalized)
  const vector = feedback.suggestedMarkup[0]

  assert.equal(vector.id, 'markup-1')
  assert.equal(vector.type, 'physics_vector')
  assert.equal(vector.vectorKind, 'force')
  assert.deepEqual(vector.origin, { x: 0.52, y: 0.58 })
  assert.deepEqual(vector.endpoint, { x: 0.34, y: 0.58 })
  assert.equal(vector.label, 'f_k')
  assert.equal(vector.noteText, 'What force is slowing the box?')
})

test('accepts direction plus relativeLength vector geometry', () => {
  const normalized = normalizeFeedbackResult(
    baseFeedback([
      {
        type: 'physics_vector',
        vectorKind: 'acceleration',
        origin: { x: 0.4, y: 0.4 },
        direction: { x: -2, y: 0 },
        relativeLength: 0.16,
        targetDescription: 'Leftward acceleration',
        confidence: 0.87,
      },
    ]),
  )
  const vector = validateFeedbackResult(normalized).suggestedMarkup[0]

  assert.deepEqual(vector.direction, { x: -1, y: 0 })
  assert.equal(vector.relativeLength, 0.16)
})

test('preserves invalid vector geometry as text-only feedback', () => {
  const reports = []
  const normalized = normalizeFeedbackResult(
    baseFeedback([
      {
        type: 'physics_vector',
        vectorKind: 'force',
        origin: { x: 0.52, y: 0.58 },
        noteText: 'Add friction opposite the motion.',
        targetDescription: 'Exact friction-vector placement is uncertain',
        confidence: 0.48,
      },
    ]),
    (index, reason) => reports.push({ index, reason }),
  )
  const markup = validateFeedbackResult(normalized).suggestedMarkup[0]

  assert.equal(markup.type, 'note_only')
  assert.equal(markup.noteText, 'Add friction opposite the motion.')
  assert.match(reports[0].reason, /preserved as text-only feedback/)
})
