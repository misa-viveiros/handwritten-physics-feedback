import type { FeedbackResult } from './feedback'
import type { RevisionComparison } from './revisionComparison'

export type FeedbackLevel = 1 | 2 | 3

export type AssistanceState = {
  feedbackLevel: FeedbackLevel
  attemptsForCurrentIssue: number
  currentIssueKey?: string
  workedSolutionUnlocked: boolean
  workedSolutionRevealed: boolean
}

export const initialAssistanceState: AssistanceState = {
  feedbackLevel: 1,
  attemptsForCurrentIssue: 0,
  workedSolutionUnlocked: false,
  workedSolutionRevealed: false,
}

export function getRequestedFeedbackLevel(
  previous: AssistanceState | undefined,
  meaningfulRevision: boolean,
): FeedbackLevel {
  if (!previous || !meaningfulRevision || !previous.currentIssueKey) {
    return previous?.feedbackLevel ?? 1
  }
  return clampLevel(previous.feedbackLevel + 1)
}

export function updateAssistanceState({
  previous,
  feedback,
  comparison,
  meaningfulRevision,
}: {
  previous?: AssistanceState
  feedback: FeedbackResult
  comparison?: RevisionComparison | null
  meaningfulRevision: boolean
}): AssistanceState {
  const issueKey = createIssueKey(feedback)

  if (!issueKey || feedback.overallStatus === 'correct') {
    return { ...initialAssistanceState }
  }

  const comparisonKeepsIssue =
    comparison?.originalIssueResolved === 'no' ||
    comparison?.originalIssueResolved === 'partially'

  if (
    !previous?.currentIssueKey ||
    (previous.currentIssueKey !== issueKey && !comparisonKeepsIssue)
  ) {
    return {
      ...initialAssistanceState,
      currentIssueKey: issueKey,
    }
  }

  const issueStillPresent = comparisonKeepsIssue
  const attemptsForCurrentIssue =
    meaningfulRevision && issueStillPresent
      ? previous.attemptsForCurrentIssue + 1
      : previous.attemptsForCurrentIssue
  const workedSolutionUnlocked = attemptsForCurrentIssue >= 2

  return {
    feedbackLevel: workedSolutionUnlocked
      ? 3
      : attemptsForCurrentIssue >= 1
        ? 2
        : 1,
    attemptsForCurrentIssue,
    currentIssueKey: issueKey,
    workedSolutionUnlocked,
    workedSolutionRevealed:
      workedSolutionUnlocked && previous.workedSolutionRevealed,
  }
}

export function createIssueKey(feedback: FeedbackResult): string | undefined {
  const issue = feedback.firstIssue
  if (!issue) {
    return undefined
  }
  return `${issue.errorType}:${normalizeIssueText(
    issue.likelyMisconception ?? issue.locationDescription,
  )}`
}

function normalizeIssueText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bline\s+\d+\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function clampLevel(value: number): FeedbackLevel {
  return Math.max(1, Math.min(3, value)) as FeedbackLevel
}
