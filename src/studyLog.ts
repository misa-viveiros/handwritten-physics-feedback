import type { FeedbackResult } from './feedback'

export type StudyEventData = Record<
  string,
  string | number | boolean | null
>

export type StudyEvent = {
  timestamp: string
  elapsedSeconds: number
  type: string
  data?: StudyEventData
}

export type StudySessionLog = {
  schemaVersion: '1.0'
  sessionId: string
  participantId?: string
  taskId?: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number
  explicitlyEnded: boolean
  sourceType?: 'camera' | 'image' | 'pdf'
  pdfPageNumber?: number
  pdfPageCount?: number
  problemStatement?: string
  transcription: {
    reviewRequiredCount: number
    editedLineCount: number
    reviewOpened: boolean
    reviewCompleted: boolean
  }
  diagnosis: {
    primaryIssueType?: string
    primaryIssueId?: string
    firstIncorrectStep?: string
    overallStatus?: string
    confidence?: number
  }
  annotations: {
    kindsShown: string[]
    totalShown: number
    physicsVectorCount: number
  }
  revision: {
    revisionCount: number
    unsuccessfulRevisionCount: number
    issueResolved: boolean
    highestAssistanceLevel: number
  }
  workedSolution: {
    unlocked: boolean
    viewed: boolean
  }
  errors: {
    apiFailureCount: number
    clientErrorCount: number
  }
  researcherNote?: string
  events: StudyEvent[]
}

export type StudyExportStatus =
  | 'not_exported'
  | 'exported'
  | 'modified_since_export'

type StartStudySessionOptions = {
  participantId?: string
  taskId?: string
  problemStatement?: string
}

export const studyModeEnabled =
  import.meta.env?.VITE_STUDY_MODE === 'true'
export const studyTranscriptionEnabled =
  studyModeEnabled &&
  import.meta.env?.VITE_STUDY_INCLUDE_TRANSCRIPTION === 'true'

export function createStudySessionLog(
  options: StartStudySessionOptions = {},
  now: Date = new Date(),
): StudySessionLog {
  const log: StudySessionLog = {
    schemaVersion: '1.0',
    sessionId: crypto.randomUUID(),
    participantId: cleanOptionalText(options.participantId),
    taskId: cleanOptionalText(options.taskId),
    startedAt: now.toISOString(),
    explicitlyEnded: false,
    problemStatement: cleanOptionalText(options.problemStatement),
    transcription: {
      reviewRequiredCount: 0,
      editedLineCount: 0,
      reviewOpened: false,
      reviewCompleted: false,
    },
    diagnosis: {},
    annotations: {
      kindsShown: [],
      totalShown: 0,
      physicsVectorCount: 0,
    },
    revision: {
      revisionCount: 0,
      unsuccessfulRevisionCount: 0,
      issueResolved: false,
      highestAssistanceLevel: 1,
    },
    workedSolution: {
      unlocked: false,
      viewed: false,
    },
    errors: {
      apiFailureCount: 0,
      clientErrorCount: 0,
    },
    researcherNote: '',
    events: [],
  }
  addStudyEvent(log, 'session_started', undefined, now)
  return log
}

export function addStudyEvent(
  log: StudySessionLog,
  type: string,
  data?: StudyEventData,
  now: Date = new Date(),
) {
  const event: StudyEvent = {
    timestamp: now.toISOString(),
    elapsedSeconds: getStudyDurationSeconds(log, now),
    type,
  }
  if (data && Object.keys(data).length > 0) {
    event.data = data
  }
  log.events.push(event)
}

export function endStudySession(
  log: StudySessionLog,
  now: Date = new Date(),
) {
  if (log.explicitlyEnded) return
  addStudyEvent(log, 'session_ended', undefined, now)
  log.endedAt = now.toISOString()
  log.durationSeconds = getStudyDurationSeconds(log, now)
  log.explicitlyEnded = true
}

export function recordSourceSelected(
  log: StudySessionLog,
  source: {
    sourceType: 'camera' | 'image' | 'pdf'
    pdfPageNumber?: number
    pdfPageCount?: number
  },
  now?: Date,
) {
  log.sourceType = source.sourceType
  log.pdfPageNumber = source.pdfPageNumber
  log.pdfPageCount = source.pdfPageCount
  addStudyEvent(
    log,
    'source_selected',
    {
      sourceType: source.sourceType,
      ...(source.pdfPageNumber !== undefined
        ? { pdfPageNumber: source.pdfPageNumber }
        : {}),
      ...(source.pdfPageCount !== undefined
        ? { pdfPageCount: source.pdfPageCount }
        : {}),
    },
    now,
  )
}

export function recordTranscriptionReviewOpened(
  log: StudySessionLog,
  reviewRequiredCount: number,
  now?: Date,
) {
  log.transcription.reviewOpened = true
  log.transcription.reviewRequiredCount = Math.max(
    log.transcription.reviewRequiredCount,
    reviewRequiredCount,
  )
  addStudyEvent(
    log,
    'transcription_review_opened',
    { reviewRequiredCount },
    now,
  )
}

export function recordTranscriptionLineEdited(
  log: StudySessionLog,
  lineId: string,
  confidenceBefore?: number,
  confidenceAfter?: number,
  now?: Date,
) {
  const priorEdits = log.events.filter(
    (event) =>
      event.type === 'transcription_line_edited' &&
      event.data?.lineId === lineId,
  ).length
  if (priorEdits === 0) {
    log.transcription.editedLineCount += 1
  }
  addStudyEvent(
    log,
    'transcription_line_edited',
    {
      lineId,
      edited: true,
      editNumber: priorEdits + 1,
      ...(confidenceBefore !== undefined ? { confidenceBefore } : {}),
      ...(confidenceAfter !== undefined ? { confidenceAfter } : {}),
    },
    now,
  )
}

export function recordTranscriptionReviewCompleted(
  log: StudySessionLog,
  now?: Date,
) {
  log.transcription.reviewCompleted = true
  addStudyEvent(log, 'transcription_review_completed', undefined, now)
}

export function recordDiagnosisShown(
  log: StudySessionLog,
  feedback: FeedbackResult,
  now?: Date,
) {
  const primaryMarkup = feedback.suggestedMarkup.find(
    (markup) => markup.isPrimaryIssue,
  )
  log.diagnosis = {
    primaryIssueType: feedback.firstIssue?.errorType,
    primaryIssueId: primaryMarkup?.issueId,
    firstIncorrectStep: feedback.firstIssue?.locationDescription,
    overallStatus: feedback.overallStatus,
    confidence: feedback.analysisConfidence,
  }
  addStudyEvent(
    log,
    'diagnosis_shown',
    {
      ...(feedback.firstIssue?.errorType
        ? { primaryIssueType: feedback.firstIssue.errorType }
        : {}),
      overallStatus: feedback.overallStatus,
      confidence: feedback.analysisConfidence,
    },
    now,
  )
}

export function recordAnnotationsRendered(
  log: StudySessionLog,
  feedback: FeedbackResult,
  now?: Date,
) {
  const shown = feedback.suggestedMarkup.filter(isRenderableMarkup).slice(0, 3)
  const kinds = [...new Set(shown.map((markup) => markup.kind ?? markup.type))]
  const physicsVectorCount = shown.filter(
    (markup) => (markup.kind ?? markup.type) === 'physics_vector',
  ).length
  log.annotations.kindsShown = [
    ...new Set([...log.annotations.kindsShown, ...kinds]),
  ]
  log.annotations.totalShown += shown.length
  log.annotations.physicsVectorCount += physicsVectorCount
  addStudyEvent(
    log,
    'annotations_rendered',
    { totalShown: shown.length, physicsVectorCount },
    now,
  )
}

export function recordRevisionSubmitted(log: StudySessionLog, now?: Date) {
  log.revision.revisionCount += 1
  addStudyEvent(
    log,
    'revision_submitted',
    { revisionCount: log.revision.revisionCount },
    now,
  )
}

export function recordRevisionResult(
  log: StudySessionLog,
  result: 'same_issue' | 'new_issue' | 'resolved' | 'unchanged' | 'unclear',
  now?: Date,
) {
  if (result === 'same_issue' || result === 'unchanged') {
    log.revision.unsuccessfulRevisionCount += 1
  }
  if (result === 'resolved') {
    log.revision.issueResolved = true
  }
  addStudyEvent(log, 'revision_result', { result }, now)
}

export function recordAssistanceLevel(
  log: StudySessionLog,
  level: number,
  now?: Date,
) {
  const boundedLevel = Math.max(1, Math.min(3, Math.round(level)))
  const hasRecordedLevel = log.events.some(
    (event) => event.type === 'assistance_level_changed',
  )
  if (
    hasRecordedLevel &&
    boundedLevel <= log.revision.highestAssistanceLevel
  ) {
    return
  }
  log.revision.highestAssistanceLevel = Math.max(
    log.revision.highestAssistanceLevel,
    boundedLevel,
  )
  addStudyEvent(
    log,
    'assistance_level_changed',
    { level: boundedLevel },
    now,
  )
}

export function recordWorkedSolutionUnlocked(
  log: StudySessionLog,
  now?: Date,
) {
  if (log.workedSolution.unlocked) return
  log.workedSolution.unlocked = true
  addStudyEvent(log, 'worked_solution_unlocked', undefined, now)
}

export function recordWorkedSolutionViewed(
  log: StudySessionLog,
  now?: Date,
) {
  log.workedSolution.unlocked = true
  log.workedSolution.viewed = true
  addStudyEvent(log, 'worked_solution_viewed', undefined, now)
}

export function recordReset(log: StudySessionLog, scope: string, now?: Date) {
  addStudyEvent(log, 'reset_clicked', { scope }, now)
}

export function recordApiError(
  log: StudySessionLog,
  endpoint: string,
  status: number | null,
  now?: Date,
) {
  log.errors.apiFailureCount += 1
  addStudyEvent(log, 'api_error', { endpoint, status }, now)
}

export function recordClientError(
  log: StudySessionLog,
  category: string,
  now?: Date,
) {
  log.errors.clientErrorCount += 1
  addStudyEvent(log, 'client_error', { category }, now)
}

export function getStudyDurationSeconds(
  log: StudySessionLog,
  now: Date = new Date(),
): number {
  const end = log.endedAt ? new Date(log.endedAt) : now
  return Math.max(
    0,
    Math.round((end.getTime() - new Date(log.startedAt).getTime()) / 1000),
  )
}

export function nextStudyExportStatus(
  current: StudyExportStatus,
): StudyExportStatus {
  return current === 'exported' ? 'modified_since_export' : current
}

export function createStudyExportValue(
  log: StudySessionLog,
  confirmedTranscription?: string[],
  includeTranscription = false,
  now: Date = new Date(),
) {
  return {
    ...log,
    durationSeconds: getStudyDurationSeconds(log, now),
    ...(includeTranscription && confirmedTranscription
      ? { confirmedTranscription }
      : {}),
  }
}

export function createStudyExportFilename(
  log: StudySessionLog,
  now: Date = new Date(),
): string {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const participant = sanitizeFilenamePart(log.participantId)
  const task = sanitizeFilenamePart(log.taskId)
  if (participant || task) {
    return `physics-feedback_${participant || 'participant'}_${task || 'task'}_${timestamp}.json`
  }
  return `physics-feedback_session-${log.sessionId.slice(0, 8)}_${timestamp}.json`
}

export function downloadStudyLog(
  log: StudySessionLog,
  confirmedTranscription?: string[],
  includeTranscription = studyTranscriptionEnabled,
): string {
  const now = new Date()
  const exportValue = createStudyExportValue(
    log,
    confirmedTranscription,
    includeTranscription,
    now,
  )
  const blob = new Blob([JSON.stringify(exportValue, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = createStudyExportFilename(log, now)
  anchor.click()
  URL.revokeObjectURL(url)
  return anchor.download
}

function cleanOptionalText(value?: string): string | undefined {
  const cleaned = value?.trim()
  return cleaned || undefined
}

function isRenderableMarkup(
  markup: FeedbackResult['suggestedMarkup'][number],
): boolean {
  const kind = markup.kind ?? markup.type
  if (kind === 'physics_vector') {
    return Boolean(
      (markup.confidence ?? 1) >= 0.72 &&
        markup.origin &&
        (markup.endpoint ||
          (markup.direction && markup.relativeLength !== undefined)),
    )
  }
  return Boolean(
    (markup.confidence ?? 1) >= 0.55 &&
      (markup.targetRegion ??
        markup.region ??
        markup.anchor ??
        markup.leaderAnchor ??
        markup.notePosition),
  )
}

function sanitizeFilenamePart(value?: string): string {
  return (value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
