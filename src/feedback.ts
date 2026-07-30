export type OverallStatus =
  | 'correct'
  | 'partially_correct'
  | 'incorrect'
  | 'insufficient_work'
  | 'unclear'

export type ErrorType =
  | 'conceptual'
  | 'equation_selection'
  | 'algebra'
  | 'sign'
  | 'unit'
  | 'diagram'
  | 'missing_reasoning'
  | 'unclear_handwriting'

export type FeedbackResult = {
  transcription: {
    lines: {
      id: string
      text: string
      confidence: number
      uncertainSymbols?: string[]
    }[]
    overallConfidence: number
  }
  overallStatus: OverallStatus
  strengths: string[]
  firstIssue?: {
    lineId: string
    quotedWork: string
    locationDescription: string
    errorType: ErrorType
    explanation: string
    likelyMisconception?: string
    hint: string
  }
  secondaryIssues?: {
    lineId?: string
    quotedWork?: string
    errorType: ErrorType
    explanation: string
  }[]
  nextStepHint: string
  analysisConfidence: number
  suggestedMarkup: SuggestedMarkup[]
}

export type PhysicsVectorKind =
  | 'force'
  | 'velocity'
  | 'acceleration'
  | 'displacement'
  | 'momentum'
  | 'other'

export type PhysicsVectorMarkup = SuggestedMarkup & {
  type: 'physics_vector'
  vectorKind: PhysicsVectorKind
  origin: {
    x: number
    y: number
  }
  endpoint?: {
    x: number
    y: number
  }
  direction?: {
    x: number
    y: number
  }
  relativeLength?: number
  confidence: number
}

export type SuggestedMarkup = {
  id: string
  lineId?: string
  targetLineId?: string
  type:
    | 'check'
    | 'circle'
    | 'underline'
    | 'arrow'
    | 'note'
    | 'dashed_box'
    | 'question_mark'
    | 'note_only'
    | 'physics_vector'
  targetDescription: string
  noteText?: string
  noteStyle?: 'handwritten' | 'compact' | 'emphasis'
  notePlacement?: 'auto' | 'above' | 'below' | 'left' | 'right'
  notePosition?: {
    x: number
    y: number
  }
  showLeader?: boolean
  leaderAnchor?: {
    x: number
    y: number
  }
  category?: 'issue' | 'hint' | 'praise' | 'question'
  region?: {
    x: number
    y: number
    width: number
    height: number
  }
  anchor?: {
    x: number
    y: number
  }
  confidence?: number
  vectorKind?: PhysicsVectorKind
  origin?: {
    x: number
    y: number
  }
  endpoint?: {
    x: number
    y: number
  }
  direction?: {
    x: number
    y: number
  }
  relativeLength?: number
  label?: string
}
