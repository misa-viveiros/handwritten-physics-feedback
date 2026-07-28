export type FeedbackResult = {
  transcription: string
  overallStatus: 'correct' | 'partially_correct' | 'incorrect' | 'unclear'
  strengths: string[]
  firstIssue?: {
    locationDescription: string
    errorType:
      | 'conceptual'
      | 'equation_selection'
      | 'algebra'
      | 'sign'
      | 'unit'
      | 'diagram'
      | 'missing_step'
      | 'unclear_handwriting'
    explanation: string
    hint: string
  }
  nextStepHint: string
  confidence: 'high' | 'medium' | 'low'
  shouldShowFullSolution: boolean
  suggestedMarkup?: {
    type: 'circle' | 'underline' | 'arrow' | 'note'
    targetDescription: string
    noteText: string
  }[]
}

export const mockFeedbackExamples = {
  partiallyCorrectFreeFall: {
    transcription:
      'Student writes: h = 20 m, v0 = 0, g = 9.8 m/s^2. Then uses x = vt and substitutes 20 = v(9.8), giving v = 2.04 m/s.',
    overallStatus: 'partially_correct',
    strengths: [
      'You identified the height and gravitational acceleration clearly.',
      'You recognized that the motion starts from rest.',
      'Your work is organized enough to follow the main idea.',
    ],
    firstIssue: {
      locationDescription: 'Line where 20 = v(9.8) is written',
      errorType: 'equation_selection',
      explanation:
        'Try revising this step: the number 9.8 is an acceleration, not the time of the fall. The equation x = vt only works when velocity is constant, but this object is speeding up.',
      hint: 'Choose a constant-acceleration relationship that connects distance, acceleration, initial speed, and final speed without needing time first.',
    },
    nextStepHint:
      'Rewrite the setup using the known quantities h, v0, and g, then check which kinematics equation contains the unknown final speed.',
    confidence: 'high',
    shouldShowFullSolution: false,
    suggestedMarkup: [
      {
        type: 'circle',
        targetDescription: 'The substitution 20 = v(9.8)',
        noteText: 'First thing to check: 9.8 is acceleration, not elapsed time.',
      },
      {
        type: 'underline',
        targetDescription: 'The equation x = vt',
        noteText: 'This assumes constant velocity, but free fall has acceleration.',
      },
      {
        type: 'note',
        targetDescription: 'Known values list',
        noteText: 'Good start: h, v0, and g are the useful quantities here.',
      },
    ],
  },
  correctFreeFall: {
    transcription:
      'Student writes: v0 = 0, a = 9.8 m/s^2, delta y = 20 m. Uses v^2 = v0^2 + 2a delta y, so v = sqrt(2(9.8)(20)) = 19.8 m/s.',
    overallStatus: 'correct',
    strengths: [
      'You selected a kinematics equation that matches the known values.',
      'You kept the units attached to the physical quantities.',
      'Your final speed is reasonable for a 20 m drop.',
    ],
    nextStepHint:
      'Add a short sentence explaining why the final velocity points downward, even though the reported speed is positive.',
    confidence: 'high',
    shouldShowFullSolution: false,
    suggestedMarkup: [
      {
        type: 'underline',
        targetDescription: 'The equation v^2 = v0^2 + 2a delta y',
        noteText: 'Strong equation choice for this set of givens.',
      },
      {
        type: 'note',
        targetDescription: 'Final answer line',
        noteText: 'Mention direction if the question asks for velocity.',
      },
    ],
  },
  unclearHandwriting: {
    transcription:
      'I can make out h = 20 m and something like v^2 = 2gh, but the final substitution and units are hard to read.',
    overallStatus: 'unclear',
    strengths: [
      'The visible setup appears to use a relevant free-fall relationship.',
      'The givens are separated from the calculation, which helps review.',
    ],
    firstIssue: {
      locationDescription: 'Final two calculation lines',
      errorType: 'unclear_handwriting',
      explanation:
        "I'm not fully sure about this part because the numbers and units overlap near the final answer.",
      hint: 'Retake the photo with the final answer centered, or rewrite the last two lines with more spacing between symbols.',
    },
    nextStepHint:
      'Make the last substitution and unit line easier to read, then rerun the review.',
    confidence: 'low',
    shouldShowFullSolution: false,
    suggestedMarkup: [
      {
        type: 'circle',
        targetDescription: 'Bottom-right calculation area',
        noteText: 'I need a clearer view before judging this step.',
      },
      {
        type: 'note',
        targetDescription: 'Final answer',
        noteText: 'Separate the number from the unit so the result is checkable.',
      },
    ],
  },
} satisfies Record<string, FeedbackResult>
