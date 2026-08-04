import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addStudyEvent,
  createStudyExportFilename,
  createStudyExportValue,
  createStudySessionLog,
  endStudySession,
  nextStudyExportStatus,
  recordAnnotationsRendered,
  recordApiError,
  recordAssistanceLevel,
  recordDiagnosisShown,
  recordReset,
  recordRevisionResult,
  recordRevisionSubmitted,
  recordSourceSelected,
  recordTranscriptionLineEdited,
  recordTranscriptionReviewCompleted,
  recordTranscriptionReviewOpened,
  recordWorkedSolutionUnlocked,
  recordWorkedSolutionViewed,
} from '../src/studyLog.ts'

const start = new Date('2026-08-04T06:01:14.000Z')
const later = (seconds) => new Date(start.getTime() + seconds * 1000)

const feedback = {
  transcription: { lines: [], overallConfidence: 0.94 },
  overallStatus: 'partially_correct',
  strengths: [],
  firstIssue: {
    lineId: 'line-1',
    quotedWork: 'student work',
    locationDescription: 'At the force diagram',
    errorType: 'diagram',
    explanation: 'Friction is missing.',
    hint: 'Consider the force opposing motion.',
  },
  nextStepHint: 'Revise the force diagram.',
  analysisConfidence: 0.94,
  suggestedMarkup: [
    {
      id: 'markup-1',
      kind: 'physics_vector',
      type: 'physics_vector',
      targetDescription: 'Missing friction',
      issueId: 'issue-1',
      isPrimaryIssue: true,
      confidence: 0.94,
      origin: { x: 0.5, y: 0.5 },
      endpoint: { x: 0.3, y: 0.5 },
    },
    {
      id: 'markup-2',
      kind: 'question_note',
      type: 'question_note',
      targetDescription: 'Friction prompt',
      confidence: 0.94,
      anchor: { x: 0.5, y: 0.5 },
    },
  ],
}

test('session start creates a clean log and a valid first event', () => {
  const log = createStudySessionLog(
    { participantId: 'P01', taskId: 'T01' },
    start,
  )
  assert.equal(log.schemaVersion, '1.0')
  assert.equal(log.events.length, 1)
  assert.equal(log.events[0].type, 'session_started')
  assert.equal(log.events[0].elapsedSeconds, 0)
  assert.equal(log.transcription.editedLineCount, 0)
})

test('timestamps and elapsed time are valid', () => {
  const log = createStudySessionLog({}, start)
  addStudyEvent(log, 'analysis_started', undefined, later(17))
  assert.equal(log.events[1].timestamp, later(17).toISOString())
  assert.equal(log.events[1].elapsedSeconds, 17)
  endStudySession(log, later(214))
  assert.equal(log.durationSeconds, 214)
})

test('source selection updates summary and event metadata', () => {
  const log = createStudySessionLog({}, start)
  recordSourceSelected(
    log,
    { sourceType: 'pdf', pdfPageNumber: 2, pdfPageCount: 3 },
    later(2),
  )
  assert.equal(log.sourceType, 'pdf')
  assert.equal(log.pdfPageNumber, 2)
  assert.equal(log.events.at(-1).type, 'source_selected')
})

test('transcription review and distinct line edits aggregate correctly', () => {
  const log = createStudySessionLog({}, start)
  recordTranscriptionReviewOpened(log, 2)
  recordTranscriptionLineEdited(log, 'line-1', 0.62)
  recordTranscriptionLineEdited(log, 'line-1', 0.62)
  recordTranscriptionReviewCompleted(log)
  assert.equal(log.transcription.reviewRequiredCount, 2)
  assert.equal(log.transcription.editedLineCount, 1)
  assert.equal(log.transcription.reviewOpened, true)
  assert.equal(log.transcription.reviewCompleted, true)
})

test('diagnosis stores the primary issue without raw model output', () => {
  const log = createStudySessionLog({}, start)
  recordDiagnosisShown(log, feedback)
  assert.equal(log.diagnosis.primaryIssueType, 'diagram')
  assert.equal(log.diagnosis.primaryIssueId, 'issue-1')
  assert.equal(log.diagnosis.firstIncorrectStep, 'At the force diagram')
})

test('annotation kinds and physics vectors aggregate from markup objects', () => {
  const log = createStudySessionLog({}, start)
  recordAnnotationsRendered(log, feedback)
  assert.deepEqual(log.annotations.kindsShown, [
    'physics_vector',
    'question_note',
  ])
  assert.equal(log.annotations.totalShown, 2)
  assert.equal(log.annotations.physicsVectorCount, 1)
})

test('revision submission and unsuccessful result update counts', () => {
  const log = createStudySessionLog({}, start)
  recordRevisionSubmitted(log)
  recordRevisionResult(log, 'same_issue')
  assert.equal(log.revision.revisionCount, 1)
  assert.equal(log.revision.unsuccessfulRevisionCount, 1)
})

test('issue resolution is retained', () => {
  const log = createStudySessionLog({}, start)
  recordRevisionResult(log, 'resolved')
  assert.equal(log.revision.issueResolved, true)
})

test('assistance level tracks only the maximum reached', () => {
  const log = createStudySessionLog({}, start)
  recordAssistanceLevel(log, 2)
  recordAssistanceLevel(log, 1)
  recordAssistanceLevel(log, 3)
  assert.equal(log.revision.highestAssistanceLevel, 3)
  assert.equal(
    log.events.filter((event) => event.type === 'assistance_level_changed').length,
    2,
  )
})

test('worked solution unlock and view state are tracked', () => {
  const log = createStudySessionLog({}, start)
  recordWorkedSolutionUnlocked(log)
  recordWorkedSolutionViewed(log)
  assert.deepEqual(log.workedSolution, { unlocked: true, viewed: true })
})

test('reset logs an event without deleting the session', () => {
  const log = createStudySessionLog({}, start)
  const sessionId = log.sessionId
  recordReset(log, 'attempt-1')
  assert.equal(log.sessionId, sessionId)
  assert.equal(log.events.at(-1).type, 'reset_clicked')
})

test('API errors increment safely without accepting a payload', () => {
  const log = createStudySessionLog({}, start)
  recordApiError(log, 'diagnose-solution', 500)
  assert.equal(log.errors.apiFailureCount, 1)
  assert.deepEqual(log.events.at(-1).data, {
    endpoint: 'diagnose-solution',
    status: 500,
  })
})

test('export excludes transcription unless explicitly enabled', () => {
  const log = createStudySessionLog({}, start)
  const hidden = createStudyExportValue(log, ['F = ma'], false, later(5))
  const included = createStudyExportValue(log, ['F = ma'], true, later(5))
  assert.equal('confirmedTranscription' in hidden, false)
  assert.deepEqual(included.confirmedTranscription, ['F = ma'])
})

test('export contains no image, base64, key, path, or raw response fields', () => {
  const log = createStudySessionLog({}, start)
  recordSourceSelected(log, { sourceType: 'image' })
  const serialized = JSON.stringify(createStudyExportValue(log, undefined, false))
  assert.doesNotMatch(serialized, /api.?key|base64|blob:|file.?path|raw.?response/i)
  assert.doesNotMatch(serialized, /image(File|Url|Bytes|Contents)/i)
})

test('export filename is sanitized and has the requested shape', () => {
  const log = createStudySessionLog(
    { participantId: 'P:01 / test', taskId: 'T*02' },
    start,
  )
  const filename = createStudyExportFilename(log, start)
  assert.equal(
    filename,
    'physics-feedback_P-01-test_T-02_20260804T060114Z.json',
  )
  assert.doesNotMatch(filename, /[/:*?"<>|]/)
})

test('blank IDs use a short session ID filename', () => {
  const log = createStudySessionLog({}, start)
  assert.match(
    createStudyExportFilename(log, start),
    /^physics-feedback_session-[a-z0-9-]{8}_20260804T060114Z\.json$/i,
  )
})

test('export status moves from not exported to exported to modified', () => {
  let status = 'not_exported'
  status = 'exported'
  status = nextStudyExportStatus(status)
  assert.equal(status, 'modified_since_export')
})

test('simulated pilot produces ordered, privacy-safe summary JSON', () => {
  const log = createStudySessionLog(
    {
      participantId: 'PTEST',
      taskId: 'T01',
      problemStatement: 'A box slides right on a rough floor.',
    },
    start,
  )
  recordSourceSelected(log, { sourceType: 'image' }, later(5))
  recordTranscriptionReviewOpened(log, 1, later(12))
  recordTranscriptionLineEdited(log, 'line-1', 0.61, undefined, later(20))
  recordTranscriptionReviewCompleted(log, later(30))
  recordDiagnosisShown(log, feedback, later(45))
  recordAnnotationsRendered(log, feedback, later(46))
  recordRevisionSubmitted(log, later(80))
  recordRevisionResult(log, 'same_issue', later(90))
  recordAssistanceLevel(log, 2, later(91))
  recordRevisionSubmitted(log, later(150))
  recordRevisionResult(log, 'resolved', later(165))
  endStudySession(log, later(180))
  const exported = createStudyExportValue(log, ['private text'], false, later(180))
  const serialized = JSON.stringify(exported)

  assert.equal(exported.durationSeconds, 180)
  assert.equal(exported.revision.revisionCount, 2)
  assert.equal(exported.revision.unsuccessfulRevisionCount, 1)
  assert.equal(exported.revision.issueResolved, true)
  assert.equal(exported.annotations.physicsVectorCount, 1)
  assert.ok(
    exported.events.every(
      (event, index) => index === 0 || event.elapsedSeconds >= exported.events[index - 1].elapsedSeconds,
    ),
  )
  assert.doesNotMatch(serialized, /private text|base64|api.?key|blob:|file.?path/i)
})
