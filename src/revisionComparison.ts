import type { ErrorType, FeedbackResult } from './feedback'
import type { ConfirmedLine } from './interpretation'

export type RevisionComparison = {
  originalIssueResolved: 'yes' | 'partially' | 'no' | 'unclear'
  progressSummary: string
  remainingIssue?: string
  newIssue?: string
  confidence: number
}

const issueLabels: Record<ErrorType, string> = {
  conceptual: 'conceptual',
  equation_selection: 'equation-selection',
  algebra: 'algebra',
  sign: 'sign',
  unit: 'unit',
  diagram: 'diagram',
  missing_reasoning: 'missing-reasoning',
  unclear_handwriting: 'handwriting-clarity',
}

export function compareRevisions(
  original: FeedbackResult,
  revised: FeedbackResult,
  originalLines: ConfirmedLine[],
  revisedLines: ConfirmedLine[],
): RevisionComparison {
  const confidence = clamp(
    Math.min(original.analysisConfidence, revised.analysisConfidence),
  )
  const originalIssue = original.firstIssue
  const revisedIssue = revised.firstIssue
  const sameWork =
    normalizedWork(originalLines) === normalizedWork(revisedLines) ||
    tokenSimilarity(originalLines, revisedLines) >= 0.96

  if (
    revised.overallStatus === 'unclear' ||
    revised.transcription.overallConfidence < 0.55 ||
    revised.analysisConfidence < 0.45
  ) {
    return {
      originalIssueResolved: 'unclear',
      progressSummary:
        'The revised handwriting is too unclear to determine whether the original issue was resolved.',
      remainingIssue: revisedIssue?.explanation,
      confidence: clamp(confidence * 0.75),
    }
  }

  if (!originalIssue || original.overallStatus === 'correct') {
    if (revised.overallStatus === 'correct' && !revisedIssue) {
      return {
        originalIssueResolved: 'yes',
        progressSummary: sameWork
          ? 'The original solution was already correct, and no meaningful reasoning change was detected.'
          : 'The original solution was already correct, and the revision remains consistent.',
        confidence,
      }
    }

    return {
      originalIssueResolved: 'yes',
      progressSummary:
        'The original solution was already correct, but the revision introduces a new issue to check.',
      newIssue: describeIssue(revisedIssue),
      confidence: clamp(confidence * 0.85),
    }
  }

  if (revised.overallStatus === 'correct' && !revisedIssue) {
    return {
      originalIssueResolved: 'yes',
      progressSummary: 'The revised solution is now correct.',
      confidence,
    }
  }

  if (!revisedIssue) {
    return {
      originalIssueResolved: 'unclear',
      progressSummary:
        'The revision changed, but there is not enough diagnosed work to determine whether the original issue was resolved.',
      confidence: clamp(confidence * 0.7),
    }
  }

  const sameIssueType = revisedIssue.errorType === originalIssue.errorType
  const originalStepStillPresent = normalizedWork(revisedLines).includes(
    normalizeText(originalIssue.quotedWork),
  )

  if (sameWork && sameIssueType) {
    return {
      originalIssueResolved: 'no',
      progressSummary:
        'No meaningful reasoning change was detected, and the original issue still needs revision.',
      remainingIssue: describeIssue(revisedIssue),
      confidence: clamp(confidence * 0.9),
    }
  }

  if (sameIssueType && originalStepStillPresent) {
    return {
      originalIssueResolved: 'no',
      progressSummary: `The original ${issueLabels[originalIssue.errorType]} issue still appears in the revised work.`,
      remainingIssue: describeIssue(revisedIssue),
      confidence: clamp(confidence * 0.85),
    }
  }

  if (sameIssueType) {
    return {
      originalIssueResolved: 'partially',
      progressSummary: `The original step changed, but a ${issueLabels[revisedIssue.errorType]} issue still needs revision.`,
      remainingIssue: describeIssue(revisedIssue),
      confidence: clamp(confidence * 0.75),
    }
  }

  return {
    originalIssueResolved: 'yes',
    progressSummary: `The original ${issueLabels[originalIssue.errorType]} issue appears to be resolved, but a new ${issueLabels[revisedIssue.errorType]} issue needs revision.`,
    newIssue: describeIssue(revisedIssue),
    confidence: clamp(confidence * 0.85),
  }
}

function describeIssue(issue: FeedbackResult['firstIssue']): string | undefined {
  if (!issue) {
    return undefined
  }

  return `${issueLabels[issue.errorType]}: ${issue.explanation}`
}

function normalizedWork(lines: ConfirmedLine[]): string {
  return lines
    .map((line) => normalizeText(line.confirmedText))
    .filter(Boolean)
    .join(' ')
}

function tokenSimilarity(
  originalLines: ConfirmedLine[],
  revisedLines: ConfirmedLine[],
): number {
  const originalTokens = new Set(tokenizeWork(originalLines))
  const revisedTokens = new Set(tokenizeWork(revisedLines))

  if (originalTokens.size === 0 && revisedTokens.size === 0) {
    return 1
  }

  const shared = [...originalTokens].filter((token) =>
    revisedTokens.has(token),
  ).length
  const union = new Set([...originalTokens, ...revisedTokens]).size
  return union === 0 ? 0 : shared / union
}

function tokenizeWork(lines: ConfirmedLine[]): string[] {
  return (
    lines
      .map((line) => line.confirmedText)
      .join(' ')
      .toLowerCase()
      .replace(/[×·]/g, '*')
      .match(/[a-z0-9.]+|[=+\-*/^]/g) ?? []
  )
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[×·]/g, '*')
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
