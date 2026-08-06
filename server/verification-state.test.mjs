import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialLineStatuses,
  getVerificationSummary,
} from '../src/interpretation.ts'

function createLine(id, overrides = {}) {
  return {
    id,
    order: 1,
    rawText: 'F = ma',
    confirmedText: 'F = ma',
    confidence: 0.96,
    needsConfirmation: false,
    uncertainSymbols: [],
    workStatus: 'active',
    workStatusConfidence: 0.96,
    ...overrides,
  }
}

test('automatic acceptance is derived from line status, not opened-card history', () => {
  const lines = [createLine('line-1'), createLine('line-2')]
  const statuses = createInitialLineStatuses({
    lines,
    overallConfidence: 0.96,
  })

  assert.deepEqual(getVerificationSummary(lines, statuses), {
    total: 2,
    needsReview: 0,
    acceptedAutomatically: 2,
  })
})

test('a confirmed uncertain line leaves review without becoming automatic', () => {
  const lines = [
    createLine('line-1'),
    createLine('line-2', {
      confidence: 0.62,
      needsConfirmation: true,
      uncertainSymbols: ['a'],
    }),
  ]
  const statuses = createInitialLineStatuses({
    lines,
    overallConfidence: 0.78,
  })

  assert.deepEqual(getVerificationSummary(lines, statuses), {
    total: 2,
    needsReview: 1,
    acceptedAutomatically: 1,
  })

  statuses['line-2'] = 'correct'
  assert.deepEqual(getVerificationSummary(lines, statuses), {
    total: 2,
    needsReview: 0,
    acceptedAutomatically: 1,
  })
})

test('editing an automatic line changes counts only after its status changes', () => {
  const lines = [createLine('line-1')]
  const statuses = createInitialLineStatuses({
    lines,
    overallConfidence: 0.96,
  })

  assert.equal(getVerificationSummary(lines, statuses).acceptedAutomatically, 1)

  statuses['line-1'] = undefined
  assert.deepEqual(getVerificationSummary(lines, statuses), {
    total: 1,
    needsReview: 1,
    acceptedAutomatically: 0,
  })
})
