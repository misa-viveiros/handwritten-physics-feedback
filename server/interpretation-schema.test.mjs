import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeAndValidateInterpretation,
  validateConfirmedLines,
} from './interpretation-schema.mjs'

test('preserves crossed-out lines and evidence during interpretation', () => {
  const interpretation = normalizeAndValidateInterpretation({
    lines: [
      createLine(1, 'F = ma', 'active'),
      createLine(
        2,
        'F = (2.0)(3.0)',
        'crossed_out',
        'Two diagonal cancellation strokes cover the equation.',
      ),
      createLine(
        3,
        'F = 6.0 N',
        'crossed_out',
        'A heavy horizontal scribble crosses the result.',
      ),
      createLine(4, 'F = m/a', 'active'),
    ],
    overallConfidence: 0.93,
    interpretationNotes: [],
  })

  assert.equal(interpretation.lines.length, 4)
  assert.equal(interpretation.lines[1].workStatus, 'crossed_out')
  assert.match(interpretation.lines[1].crossedOutEvidence, /cancellation/)
  assert.equal(interpretation.lines[3].workStatus, 'active')
})

test('keeps student-confirmed crossed-out status in diagnosis input', () => {
  const confirmed = validateConfirmedLines([
    {
      ...createLine(
        1,
        'F = 6.0 N',
        'crossed_out',
        'Student confirmed the cancellation.',
      ),
      id: 'line-1',
      confirmedText: 'F = 6.0 N',
      status: 'correct',
    },
    {
      ...createLine(2, 'F = m/a', 'active'),
      id: 'line-2',
      confirmedText: 'F = m/a',
      status: 'needs_correction',
    },
  ])

  assert.equal(confirmed[0].workStatus, 'crossed_out')
  assert.equal(confirmed[1].workStatus, 'active')
})

test('supports partial cancellation without lowering transcription confidence', () => {
  const interpretation = normalizeAndValidateInterpretation({
    lines: [
      {
        ...createLine(
          1,
          'v = 3 + 4',
          'partially_crossed_out',
          'Only the 3 is crossed out and replaced.',
        ),
        confidence: 0.98,
        workStatusConfidence: 0.91,
      },
    ],
    overallConfidence: 0.98,
    interpretationNotes: [],
  })

  assert.equal(interpretation.lines[0].confidence, 0.98)
  assert.equal(interpretation.lines[0].workStatus, 'partially_crossed_out')
})

test('keeps underline, fraction bar, and vector notation active', () => {
  const interpretation = normalizeAndValidateInterpretation({
    lines: [
      createLine(1, 'F = ma', 'active'),
      createLine(2, 't^2 = 5.0 / 4.9', 'active'),
      createLine(3, 'v -> right', 'active'),
    ],
    overallConfidence: 0.95,
    interpretationNotes: [],
  })

  assert.deepEqual(
    interpretation.lines.map((line) => line.workStatus),
    ['active', 'active', 'active'],
  )
  assert.ok(
    interpretation.lines.every((line) => line.crossedOutEvidence == null),
  )
})

function createLine(order, rawText, workStatus, crossedOutEvidence = null) {
  return {
    order,
    rawText,
    confidence: 0.95,
    locationConfidence: 0.95,
    needsConfirmation: false,
    uncertainSymbols: [],
    workStatus,
    workStatusConfidence: 0.94,
    crossedOutEvidence,
    region: {
      x: 0.1,
      y: 0.08 + order * 0.1,
      width: 0.3,
      height: 0.07,
    },
  }
}
