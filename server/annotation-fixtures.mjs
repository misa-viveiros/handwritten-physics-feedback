function feedbackFixture({
  name,
  status = 'partially_correct',
  lineText,
  errorType = 'conceptual',
  markups = [],
  expectedKinds,
  confirmationOnly = false,
}) {
  return {
    name,
    expectedKinds,
    confirmationOnly,
    feedback: {
      transcription: {
        lines: [
          {
            id: 'line-1',
            text: lineText,
            confidence: confirmationOnly ? 0.42 : 0.96,
            uncertainSymbols: confirmationOnly ? ['?'] : [],
          },
        ],
        overallConfidence: confirmationOnly ? 0.42 : 0.96,
      },
      overallStatus: status,
      strengths: status === 'correct' ? ['The reasoning is physically consistent.'] : [],
      firstIssue:
        status === 'correct'
          ? null
          : {
              lineId: 'line-1',
              quotedWork: lineText,
              locationDescription: 'At the first relevant step',
              errorType,
              explanation: confirmationOnly
                ? 'The handwriting needs confirmation before diagnosis.'
                : 'This is the earliest step to revise.',
              likelyMisconception: null,
              hint: confirmationOnly ? 'Confirm this line first.' : 'Reconsider this step.',
            },
      secondaryIssues: [],
      nextStepHint: confirmationOnly ? 'Confirm the interpretation.' : 'Revise the marked step.',
      analysisConfidence: confirmationOnly ? 0.42 : 0.92,
      suggestedMarkup: markups,
    },
  }
}

const region = { x: 0.32, y: 0.34, width: 0.24, height: 0.08 }

export const annotationFixtures = [
  feedbackFixture({
    name: 'correct equation step',
    status: 'correct',
    lineText: 'h = 1/2 gt^2',
    expectedKinds: ['check'],
    markups: [{ kind: 'check', targetDescription: 'Correct model', region, confidence: 0.96, category: 'praise', isPrimaryIssue: false }],
  }),
  feedbackFixture({
    name: 'missing unit',
    lineText: 'a = 2.0',
    errorType: 'unit',
    expectedKinds: ['underline', 'correction_note'],
    markups: [
      { kind: 'underline', targetDescription: 'Final value without units', region, confidence: 0.97, issueId: 'unit', isPrimaryIssue: true },
      { kind: 'correction_note', targetDescription: 'Missing acceleration unit', noteText: 'm/s^2', anchor: { x: 0.58, y: 0.38 }, confidence: 0.96, issueId: 'unit', category: 'issue', isPrimaryIssue: false },
    ],
  }),
  feedbackFixture({
    name: 'conceptual equation choice',
    lineText: 'h = vt',
    errorType: 'equation_selection',
    expectedKinds: ['circle', 'question_note'],
    markups: [
      { kind: 'circle', targetDescription: 'Constant-velocity equation', region, confidence: 0.95, issueId: 'model', isPrimaryIssue: true },
      { kind: 'question_note', targetDescription: 'Equation assumes constant velocity', noteText: 'Is velocity constant here?', anchor: { x: 0.58, y: 0.38 }, confidence: 0.95, issueId: 'model', category: 'question', isPrimaryIssue: false },
    ],
  }),
  feedbackFixture({
    name: 'missing friction',
    lineText: 'N up, mg down, v right',
    errorType: 'diagram',
    expectedKinds: ['physics_vector', 'question_note'],
    markups: [
      { kind: 'physics_vector', targetDescription: 'Missing friction', vectorKind: 'friction', vectorIssue: 'missing', targetObject: 'box', origin: { x: 0.5, y: 0.55 }, endpoint: { x: 0.34, y: 0.55 }, label: 'f_k', confidence: 0.93, issueId: 'friction', isPrimaryIssue: true },
      { kind: 'question_note', targetDescription: 'Missing interaction', noteText: 'What force slows the box?', anchor: { x: 0.5, y: 0.55 }, confidence: 0.93, issueId: 'friction', category: 'question', isPrimaryIssue: false },
    ],
  }),
  feedbackFixture({
    name: 'extra third-law force',
    lineText: 'Extra force of book on table',
    errorType: 'diagram',
    expectedKinds: ['cross', 'question_note'],
    markups: [
      { kind: 'cross', targetDescription: 'Force on wrong object', region, confidence: 0.94, issueId: 'object', isPrimaryIssue: true, vectorKind: 'normal', vectorIssue: 'wrong_object', targetObject: 'book' },
      { kind: 'question_note', targetDescription: 'Wrong-object force', noteText: 'Which object feels this force?', anchor: { x: 0.58, y: 0.38 }, confidence: 0.94, issueId: 'object', category: 'question', isPrimaryIssue: false },
    ],
  }),
  feedbackFixture({
    name: 'wrong normal direction',
    lineText: 'N points vertically on an incline',
    errorType: 'diagram',
    expectedKinds: ['circle', 'physics_vector', 'question_note'],
    markups: [
      { kind: 'circle', targetDescription: 'Student normal vector', region, confidence: 0.92, issueId: 'normal', isPrimaryIssue: true },
      { kind: 'physics_vector', targetDescription: 'Candidate perpendicular normal', vectorKind: 'normal', vectorIssue: 'reversed', targetObject: 'block', replacementFor: 'student normal', origin: { x: 0.5, y: 0.55 }, direction: { x: -0.5, y: -0.86 }, relativeLength: 0.16, label: 'N', confidence: 0.88, issueId: 'normal', isPrimaryIssue: false },
      { kind: 'question_note', targetDescription: 'Normal direction', noteText: 'Should N be perpendicular?', anchor: { x: 0.56, y: 0.42 }, confidence: 0.91, issueId: 'normal', category: 'question', isPrimaryIssue: false },
    ],
  }),
  feedbackFixture({
    name: 'downstream chain',
    lineText: 'N = mg cos(theta) drawn vertically',
    errorType: 'diagram',
    expectedKinds: ['circle', 'question_note'],
    markups: [
      { kind: 'circle', targetDescription: 'Upstream normal-force error', region, confidence: 0.93, issueId: 'normal', isPrimaryIssue: true },
      { kind: 'question_note', targetDescription: 'Normal direction causes later errors', noteText: 'Should N be perpendicular?', anchor: { x: 0.58, y: 0.38 }, confidence: 0.93, issueId: 'normal', category: 'question', isPrimaryIssue: false },
    ],
  }),
  feedbackFixture({ name: 'correct FBD', status: 'correct', lineText: 'N up, mg down', expectedKinds: [], markups: [] }),
  feedbackFixture({ name: 'low-confidence handwriting', status: 'unclear', lineText: '? = ma', errorType: 'unclear_handwriting', expectedKinds: [], markups: [], confirmationOnly: true }),
  feedbackFixture({
    name: 'resolved revision',
    status: 'correct',
    lineText: 'h = 1/2 gt^2',
    expectedKinds: ['check'],
    markups: [{ kind: 'check', targetDescription: 'Resolved model choice', region, confidence: 0.98, category: 'praise', issueId: 'model', isPrimaryIssue: false }],
  }),
]
