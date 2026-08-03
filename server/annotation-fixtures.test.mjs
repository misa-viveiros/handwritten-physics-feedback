import assert from 'node:assert/strict'
import test from 'node:test'
import { annotationFixtures } from './annotation-fixtures.mjs'
import { normalizeFeedbackResult, validateFeedbackResult } from './feedback-schema.mjs'

test('annotation fixtures use the expected restrained semantic vocabulary', () => {
  assert.equal(annotationFixtures.length, 10)

  for (const fixture of annotationFixtures) {
    const feedback = validateFeedbackResult(normalizeFeedbackResult(fixture.feedback))
    assert.deepEqual(
      feedback.suggestedMarkup.map((markup) => markup.kind),
      fixture.expectedKinds,
      fixture.name,
    )
    assert.ok(feedback.suggestedMarkup.length <= 3, fixture.name)
    assert.ok(
      feedback.suggestedMarkup.every(
        (markup) => !markup.noteText || markup.noteText.trim().split(/\s+/u).length <= 15,
      ),
      fixture.name,
    )
  }
})

test('conceptual and mechanical fixtures choose different note intents', () => {
  const conceptual = annotationFixtures.find((fixture) => fixture.name === 'conceptual equation choice')
  const mechanical = annotationFixtures.find((fixture) => fixture.name === 'missing unit')

  assert.ok(conceptual.expectedKinds.includes('question_note'))
  assert.ok(mechanical.expectedKinds.includes('correction_note'))
})

test('the downstream fixture marks only the upstream issue', () => {
  const fixture = annotationFixtures.find((item) => item.name === 'downstream chain')
  const feedback = validateFeedbackResult(normalizeFeedbackResult(fixture.feedback))

  assert.equal(feedback.suggestedMarkup.filter((markup) => markup.isPrimaryIssue).length, 1)
  assert.ok(feedback.suggestedMarkup.every((markup) => markup.issueId === 'normal'))
})

test('uncertain handwriting requests confirmation without physics markup', () => {
  const fixture = annotationFixtures.find((item) => item.confirmationOnly)
  const feedback = validateFeedbackResult(normalizeFeedbackResult(fixture.feedback))

  assert.equal(feedback.overallStatus, 'unclear')
  assert.deepEqual(feedback.suggestedMarkup, [])
})
