import type { FeedbackResult } from './feedback'

export type StudyMetrics = {
  imageUploadTimestamp?: string
  interpretationDurationMs: number
  interpretedLines: number
  uncertainLines: number
  transcriptionEdits: number
  crossedOutStatusCorrections: number
  diagnosisDurationMs: number
  feedbackLevelShown: number
  revisions: number
  coreIssueResolved?: boolean
  workedSolutionUnlocked: boolean
  workedSolutionRevealed: boolean
  vectorAnnotationsProposed: number
  vectorAnnotationsRendered: number
  textOnlyVectorFallbacks: number
  apiFailures: number
  resetActions: number
  cancelActions: number
}

export type StudyEvent = {
  timestamp: string
  type: string
  details?: Record<string, string | number | boolean>
}

export type StudySessionLog = {
  sessionId: string
  startedAt: string
  taskId?: string
  metrics: StudyMetrics
  events: StudyEvent[]
}

export const studyModeEnabled =
  import.meta.env?.VITE_STUDY_MODE === 'true'
export const studyTranscriptionEnabled =
  studyModeEnabled &&
  import.meta.env?.VITE_STUDY_INCLUDE_TRANSCRIPTION === 'true'

export function createStudySessionLog(): StudySessionLog {
  return {
    sessionId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    metrics: {
      interpretationDurationMs: 0,
      interpretedLines: 0,
      uncertainLines: 0,
      transcriptionEdits: 0,
      crossedOutStatusCorrections: 0,
      diagnosisDurationMs: 0,
      feedbackLevelShown: 1,
      revisions: 0,
      workedSolutionUnlocked: false,
      workedSolutionRevealed: false,
      vectorAnnotationsProposed: 0,
      vectorAnnotationsRendered: 0,
      textOnlyVectorFallbacks: 0,
      apiFailures: 0,
      resetActions: 0,
      cancelActions: 0,
    },
    events: [],
  }
}

export function addStudyEvent(
  log: StudySessionLog,
  type: string,
  details?: Record<string, string | number | boolean>,
) {
  log.events.push({
    timestamp: new Date().toISOString(),
    type,
    details,
  })
}

export function getVectorMetrics(feedback: FeedbackResult) {
  const vectors = feedback.suggestedMarkup.filter(
    (markup) => markup.type === 'physics_vector',
  )
  const rendered = vectors.filter(
    (markup) =>
      (markup.confidence ?? 1) >= 0.72 &&
      Boolean(
        markup.origin &&
          (markup.endpoint ||
            (markup.direction && markup.relativeLength !== undefined)),
      ),
  )
  const textOnlyFallbacks = feedback.suggestedMarkup.filter(
    (markup) =>
      markup.type === 'note_only' &&
      /vector|placement|direction|force/i.test(
        `${markup.targetDescription} ${markup.noteText ?? ''}`,
      ),
  )

  return {
    proposed: vectors.length,
    rendered: rendered.length,
    textOnlyFallbacks: textOnlyFallbacks.length,
  }
}

export function downloadStudyLog(
  log: StudySessionLog,
  confirmedTranscription?: string[],
) {
  const exportValue = createStudyExportValue(
    log,
    confirmedTranscription,
    studyTranscriptionEnabled,
  )
  const blob = new Blob([JSON.stringify(exportValue, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `physics-feedback-session-${log.sessionId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function createStudyExportValue(
  log: StudySessionLog,
  confirmedTranscription?: string[],
  includeTranscription = false,
) {
  return {
    ...log,
    ...(includeTranscription && confirmedTranscription
      ? { confirmedTranscription }
      : {}),
  }
}
