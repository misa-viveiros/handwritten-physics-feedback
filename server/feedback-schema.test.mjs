import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeFeedbackResult,
  validateFeedbackResult,
} from './feedback-schema.mjs'
import { fbdFixtures } from './fbd-fixtures.mjs'

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
        vectorKind: 'friction',
        vectorIssue: 'missing',
        targetObject: 'box',
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
  assert.equal(vector.vectorKind, 'friction')
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
        vectorKind: 'friction',
        vectorIssue: 'missing',
        targetObject: 'box',
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
  assert.equal(markup.vectorKind, 'friction')
  assert.equal(markup.vectorIssue, 'missing')
  assert.equal(markup.targetObject, 'box')
  assert.match(reports[0].reason, /preserved as text-only feedback/)
})

test('validates all bounded FBD fixtures', () => {
  for (const fixture of Object.values(fbdFixtures)) {
    const feedback = validateFeedbackResult(
      normalizeFeedbackResult(fixture.feedback),
    )
    assert.equal(feedback.firstIssue.errorType, 'diagram')
    assert.equal(feedback.suggestedMarkup.length, 1)
    assert.ok(feedback.suggestedMarkup[0].targetObject)
    assert.ok(feedback.suggestedMarkup[0].vectorIssue)
  }
})

test('keeps extra-force and wrong-object feedback non-vector', () => {
  for (const fixture of [
    fbdFixtures.extraThirdLawForce,
    fbdFixtures.twoBlocksOneRope,
    fbdFixtures.circularExtraForce,
  ]) {
    const markup = validateFeedbackResult(
      normalizeFeedbackResult(fixture.feedback),
    ).suggestedMarkup[0]
    assert.notEqual(markup.type, 'physics_vector')
  }
})

test('preserves object-specific metadata in multiple-object diagrams', () => {
  const markup = validateFeedbackResult(
    normalizeFeedbackResult(fbdFixtures.twoBlocksOneRope.feedback),
  ).suggestedMarkup[0]

  assert.equal(markup.vectorKind, 'tension')
  assert.equal(markup.vectorIssue, 'wrong_object')
  assert.equal(markup.targetObject, 'right block')
})

test('offset replacement metadata is required by the incline fixture', () => {
  const markup = validateFeedbackResult(
    normalizeFeedbackResult(fbdFixtures.inclineNormal.feedback),
  ).suggestedMarkup[0]

  assert.equal(markup.type, 'physics_vector')
  assert.equal(markup.vectorKind, 'normal')
  assert.equal(markup.vectorIssue, 'reversed')
  assert.match(markup.replacementFor, /student normal/)
})

test('maps legacy markup types into semantic annotation kinds', () => {
  const feedback = validateFeedbackResult(
    normalizeFeedbackResult(
      baseFeedback([
        {
          type: 'dashed_box',
          targetDescription: 'Legacy boxed equation',
          region: { x: 0.2, y: 0.3, width: 0.2, height: 0.08 },
          category: 'question',
          confidence: 0.9,
        },
      ]),
    ),
  )

  assert.equal(feedback.suggestedMarkup[0].kind, 'circle')
  assert.equal(feedback.suggestedMarkup[0].type, 'dashed_box')
  assert.deepEqual(feedback.suggestedMarkup[0].targetRegion, {
    x: 0.2,
    y: 0.3,
    width: 0.2,
    height: 0.08,
  })
})

test('limits on-image notes to one sentence and fifteen words', () => {
  const noteText =
    'This note contains far too many words for restrained teacher markup and should be shortened before it reaches the page. A second sentence must disappear.'
  const feedback = validateFeedbackResult(
    normalizeFeedbackResult(
      baseFeedback([
        {
          kind: 'question_note',
          targetDescription: 'Long conceptual prompt',
          noteText,
          anchor: { x: 0.5, y: 0.5 },
          category: 'question',
          confidence: 0.9,
        },
      ]),
    ),
  )
  const normalizedText = feedback.suggestedMarkup[0].noteText

  assert.equal(normalizedText.trim().split(/\s+/u).length, 15)
  assert.doesNotMatch(normalizedText, /second sentence/i)
})
