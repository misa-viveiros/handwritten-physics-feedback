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
  suggestedMarkup: {
    lineId?: string
    type: 'check' | 'circle' | 'underline' | 'arrow' | 'note'
    targetDescription: string
    noteText: string
  }[]
}

export type MockCaseId =
  | 'freeFallWrongEquation'
  | 'projectileMixedAxes'
  | 'rampFrictionDirection'
  | 'correctSolution'
  | 'unclearHandwriting'

export type MockFeedbackCase = {
  id: MockCaseId
  label: string
  problemStatement: string
  feedback: FeedbackResult
}

export const mockFeedbackCases: MockFeedbackCase[] = [
  {
    id: 'freeFallWrongEquation',
    label: 'Free fall: wrong equation choice',
    problemStatement:
      'A ball is dropped from rest from a height of 20 m. Estimate its speed just before it reaches the ground. Ignore air resistance.',
    feedback: {
      transcription: {
        lines: [
          {
            id: 'ff-1',
            text: 'h = 20 m, v0 = 0, g = 9.8 m/s^2',
            confidence: 0.96,
          },
          {
            id: 'ff-2',
            text: 'x = vt',
            confidence: 0.94,
          },
          {
            id: 'ff-3',
            text: '20 = v(9.8), so v = 2.04 m/s',
            confidence: 0.91,
          },
        ],
        overallConfidence: 0.94,
      },
      overallStatus: 'partially_correct',
      strengths: [
        'This part looks good: you identified the height and gravitational acceleration clearly.',
        'You noticed that the motion starts from rest, which is useful for choosing an equation.',
        'Your givens are organized enough that the reasoning can be reviewed step by step.',
      ],
      firstIssue: {
        lineId: 'ff-2',
        quotedWork: 'x = vt',
        locationDescription: 'Second line, where the constant-velocity equation is selected',
        errorType: 'equation_selection',
        explanation:
          'Try revising this step: x = vt assumes constant velocity, but a dropped object speeds up as it falls.',
        likelyMisconception:
          'You may be treating free fall as if the object already has one fixed speed during the whole motion.',
        hint: 'Look for a constant-acceleration relationship that connects distance, acceleration, initial speed, and final speed without finding time first.',
      },
      secondaryIssues: [
        {
          lineId: 'ff-3',
          quotedWork: '20 = v(9.8)',
          errorType: 'unit',
          explanation:
            'This later substitution treats 9.8 m/s^2 like a time value, so the units do not match the equation.',
        },
      ],
      nextStepHint:
        'Rewrite the setup using h, v0, and g, then check which kinematics equation contains the unknown final speed.',
      analysisConfidence: 0.9,
      suggestedMarkup: [
        {
          lineId: 'ff-2',
          type: 'underline',
          targetDescription: 'The equation x = vt',
          noteText: 'First thing to check: this equation assumes constant velocity.',
        },
        {
          lineId: 'ff-3',
          type: 'circle',
          targetDescription: 'The substitution 20 = v(9.8)',
          noteText: '9.8 is acceleration, not elapsed time.',
        },
        {
          lineId: 'ff-1',
          type: 'check',
          targetDescription: 'Known values list',
          noteText: 'This part looks good: h, v0, and g are useful quantities here.',
        },
      ],
    },
  },
  {
    id: 'projectileMixedAxes',
    label: 'Horizontal projectile: mixes x/y motion',
    problemStatement:
      'A marble rolls horizontally off a 1.2 m high table at 3.0 m/s. How far from the table does it land? Ignore air resistance.',
    feedback: {
      transcription: {
        lines: [
          {
            id: 'proj-1',
            text: 'vx = 3.0 m/s, y = 1.2 m, a = 9.8 m/s^2',
            confidence: 0.95,
          },
          {
            id: 'proj-2',
            text: 'x = 1/2at^2',
            confidence: 0.93,
          },
          {
            id: 'proj-3',
            text: 'x = 1/2(9.8)(3.0)^2 = 44.1 m',
            confidence: 0.91,
          },
        ],
        overallConfidence: 0.93,
      },
      overallStatus: 'partially_correct',
      strengths: [
        'This part looks good: you listed the horizontal speed and the vertical drop height separately.',
        'You remembered that gravity affects the vertical motion.',
        'You are trying to use a kinematics relationship instead of guessing the distance.',
      ],
      firstIssue: {
        lineId: 'proj-2',
        quotedWork: 'x = 1/2at^2',
        locationDescription: 'Second line, where vertical acceleration is used for horizontal distance',
        errorType: 'conceptual',
        explanation:
          'First thing to check: horizontal and vertical motion need separate equations. Gravity determines the fall time vertically, but it does not provide the horizontal acceleration here.',
        likelyMisconception:
          'You may be mixing the vertical acceleration due to gravity into the horizontal distance equation.',
        hint: 'Use the vertical drop to find time first, then use the horizontal relationship x = vx t.',
      },
      secondaryIssues: [
        {
          lineId: 'proj-3',
          quotedWork: '(3.0)^2',
          errorType: 'unit',
          explanation:
            'The 3.0 m/s value is horizontal speed, not time, so substituting it for t changes the meaning of the equation.',
        },
      ],
      nextStepHint:
        'Try revising by labeling one line vertical motion and one line horizontal motion before substituting numbers.',
      analysisConfidence: 0.89,
      suggestedMarkup: [
        {
          lineId: 'proj-2',
          type: 'underline',
          targetDescription: 'The equation x = 1/2at^2',
          noteText: 'First thing to check: this is not the horizontal range equation for this setup.',
        },
        {
          lineId: 'proj-3',
          type: 'circle',
          targetDescription: 'The 3.0 inserted into the time slot',
          noteText: '3.0 m/s is horizontal speed, not time.',
        },
        {
          lineId: 'proj-1',
          type: 'arrow',
          targetDescription: 'The vertical givens y and a',
          noteText: 'Use these to find the fall time.',
        },
      ],
    },
  },
  {
    id: 'rampFrictionDirection',
    label: 'Ramp/friction: wrong force component or friction direction',
    problemStatement:
      'A 4.0 kg block slides down a 25 degree incline with coefficient of kinetic friction 0.20. Find its acceleration down the ramp.',
    feedback: {
      transcription: {
        lines: [
          {
            id: 'ramp-1',
            text: 'Fnet = mg cos(theta) + friction',
            confidence: 0.9,
          },
          {
            id: 'ramp-2',
            text: 'friction = mu mg sin(theta)',
            confidence: 0.88,
          },
          {
            id: 'ramp-3',
            text: 'a = 9.8 cos(25) + 0.20(9.8 sin(25))',
            confidence: 0.86,
          },
        ],
        overallConfidence: 0.88,
      },
      overallStatus: 'partially_correct',
      strengths: [
        'This part looks good: you included friction instead of treating the ramp as frictionless.',
        'You are trying to sum forces along the ramp, which is the right overall strategy.',
        'The diagram appears to separate weight and normal force.',
      ],
      firstIssue: {
        lineId: 'ramp-1',
        quotedWork: 'Fnet = mg cos(theta) + friction',
        locationDescription: 'First force-sum line along the ramp',
        errorType: 'sign',
        explanation:
          'Try revising this step: the downslope component of gravity should use mg sin(theta), and kinetic friction should point up the ramp because the block slides down.',
        likelyMisconception:
          'You may be swapping the parallel and perpendicular components, then adding friction in the same direction as motion.',
        hint: 'Draw one arrow down the ramp for gravity parallel and one arrow up the ramp for kinetic friction, then write the net force using those directions.',
      },
      secondaryIssues: [
        {
          lineId: 'ramp-2',
          quotedWork: 'friction = mu mg sin(theta)',
          errorType: 'equation_selection',
          explanation:
            'Friction depends on the normal force, so this line should use the perpendicular component of weight.',
        },
      ],
      nextStepHint:
        'Rewrite the force sum along the incline only, using down the ramp as positive, and check each term against its arrow direction.',
      analysisConfidence: 0.82,
      suggestedMarkup: [
        {
          lineId: 'ramp-1',
          type: 'circle',
          targetDescription: 'The plus sign before friction',
          noteText: 'First thing to check: friction points up the ramp here.',
        },
        {
          lineId: 'ramp-1',
          type: 'underline',
          targetDescription: 'mg cos(theta) in the downslope force line',
          noteText: 'Try checking whether this component belongs along or perpendicular to the ramp.',
        },
        {
          type: 'arrow',
          targetDescription: 'Ramp diagram',
          noteText: 'Add arrows along the ramp to make the force directions clear.',
        },
      ],
    },
  },
  {
    id: 'correctSolution',
    label: 'Correct solution',
    problemStatement:
      'A ball is dropped from rest from a height of 20 m. Estimate its speed just before it reaches the ground. Ignore air resistance.',
    feedback: {
      transcription: {
        lines: [
          {
            id: 'correct-1',
            text: 'v0 = 0, a = 9.8 m/s^2, delta y = 20 m',
            confidence: 0.97,
          },
          {
            id: 'correct-2',
            text: 'v^2 = v0^2 + 2a delta y',
            confidence: 0.96,
          },
          {
            id: 'correct-3',
            text: 'v = sqrt(2(9.8)(20)) = 19.8 m/s',
            confidence: 0.95,
          },
        ],
        overallConfidence: 0.96,
      },
      overallStatus: 'correct',
      strengths: [
        'This part looks good: you selected a kinematics equation that matches the known values.',
        'You kept the units attached to the physical quantities.',
        'Your final speed is reasonable for a 20 m drop.',
      ],
      secondaryIssues: [],
      nextStepHint:
        'Add a short sentence explaining why the final velocity points downward, even though the reported speed is positive.',
      analysisConfidence: 0.94,
      suggestedMarkup: [
        {
          lineId: 'correct-2',
          type: 'check',
          targetDescription: 'The equation v^2 = v0^2 + 2a delta y',
          noteText: 'This part looks good: strong equation choice for this set of givens.',
        },
        {
          lineId: 'correct-3',
          type: 'note',
          targetDescription: 'Final answer line',
          noteText: 'Mention direction if the question asks for velocity.',
        },
      ],
    },
  },
  {
    id: 'unclearHandwriting',
    label: 'Unclear handwriting',
    problemStatement:
      'A ball is dropped from rest from a height of 20 m. Estimate its speed just before it reaches the ground. Ignore air resistance.',
    feedback: {
      transcription: {
        lines: [
          {
            id: 'unclear-1',
            text: 'h = 20 m',
            confidence: 0.9,
          },
          {
            id: 'unclear-2',
            text: 'v^2 = 2g?',
            confidence: 0.55,
            uncertainSymbols: ['final distance term', 'last unit'],
          },
          {
            id: 'unclear-3',
            text: 'final answer unreadable',
            confidence: 0.32,
            uncertainSymbols: ['answer value', 'unit'],
          },
        ],
        overallConfidence: 0.55,
      },
      overallStatus: 'unclear',
      strengths: [
        'The visible setup appears to use a relevant free-fall relationship.',
        'The givens are separated from the calculation, which helps review.',
      ],
      firstIssue: {
        lineId: 'unclear-2',
        quotedWork: 'v^2 = 2g?',
        locationDescription: 'Middle and lower calculation lines',
        errorType: 'unclear_handwriting',
        explanation:
          "I'm not fully sure because the handwriting is unclear near the final substitution and answer. The numbers and units overlap, so this step should be clarified before giving stronger feedback.",
        hint: 'Retake the photo with the final answer centered, or rewrite the last two lines with more spacing between symbols.',
      },
      secondaryIssues: [],
      nextStepHint:
        'Make the last substitution and unit line easier to read, then rerun the review.',
      analysisConfidence: 0.46,
      suggestedMarkup: [
        {
          lineId: 'unclear-2',
          type: 'circle',
          targetDescription: 'Bottom-right calculation area',
          noteText: "I'm not fully sure because this part is hard to read.",
        },
        {
          lineId: 'unclear-3',
          type: 'note',
          targetDescription: 'Final answer',
          noteText: 'Separate the number from the unit so the result is checkable.',
        },
      ],
    },
  },
]
