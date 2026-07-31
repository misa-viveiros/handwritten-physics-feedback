import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRequestedFeedbackLevel,
  updateAssistanceState,
} from '../src/assistance.ts'

const issueFeedback = {
  overallStatus: 'partially_correct',
  firstIssue: {
    errorType: 'diagram',
    locationDescription: 'At the box diagram',
    likelyMisconception: 'Friction was omitted.',
  },
}
const unresolvedComparison = {
  originalIssueResolved: 'no',
}

test('advances only meaningful unsuccessful revisions of the same issue', () => {
  const initial = updateAssistanceState({
    feedback: issueFeedback,
    meaningfulRevision: false,
  })
  const firstRevision = updateAssistanceState({
    previous: initial,
    feedback: issueFeedback,
    comparison: unresolvedComparison,
    meaningfulRevision: true,
  })
  const secondRevision = updateAssistanceState({
    previous: firstRevision,
    feedback: issueFeedback,
    comparison: unresolvedComparison,
    meaningfulRevision: true,
  })

  assert.equal(initial.feedbackLevel, 1)
  assert.equal(firstRevision.feedbackLevel, 2)
  assert.equal(firstRevision.attemptsForCurrentIssue, 1)
  assert.equal(secondRevision.feedbackLevel, 3)
  assert.equal(secondRevision.attemptsForCurrentIssue, 2)
  assert.equal(secondRevision.workedSolutionUnlocked, true)
})

test('does not advance when confirmed work is unchanged', () => {
  const initial = updateAssistanceState({
    feedback: issueFeedback,
    meaningfulRevision: false,
  })
  const unchanged = updateAssistanceState({
    previous: initial,
    feedback: issueFeedback,
    comparison: unresolvedComparison,
    meaningfulRevision: false,
  })

  assert.equal(getRequestedFeedbackLevel(initial, false), 1)
  assert.equal(unchanged.attemptsForCurrentIssue, 0)
  assert.equal(unchanged.feedbackLevel, 1)
})

test('resets after the issue is resolved', () => {
  const unlocked = {
    feedbackLevel: 3,
    attemptsForCurrentIssue: 2,
    currentIssueKey: 'diagram:friction was omitted',
    workedSolutionUnlocked: true,
    workedSolutionRevealed: false,
  }
  const resolved = updateAssistanceState({
    previous: unlocked,
    feedback: {
      overallStatus: 'correct',
    },
    comparison: { originalIssueResolved: 'yes' },
    meaningfulRevision: true,
  })

  assert.equal(resolved.feedbackLevel, 1)
  assert.equal(resolved.attemptsForCurrentIssue, 0)
  assert.equal(resolved.workedSolutionUnlocked, false)
})
