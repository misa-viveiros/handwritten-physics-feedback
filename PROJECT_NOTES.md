# Project Notes

This file records implementation and research decisions that are useful for a
future maintainer. Setup and deployment instructions belong in
`README.md`.

## Current Research Focus

The prototype studies localized graphical feedback on handwritten
introductory-physics work, with particular emphasis on free-body diagrams.

Primary research question:

> How does placing graphical annotations directly on handwritten free-body
> diagrams affect students' ability to identify where their reasoning needs
> attention?

The interface supports revision rather than grading or immediate answer
generation. The outstanding research task is a full user study.

## Completed Implementation

- Combined React/TypeScript frontend and Node API service
- Camera, image, and PDF-page input
- Two-stage OpenAI Responses API workflow:
  1. handwriting/diagram interpretation
  2. diagnosis from user-confirmed text plus image context
- Selective confirmation for ambiguous lines and crossed-out work
- Localized non-destructive annotation overlays
- Semantic physics vectors distinct from note leader lines
- Confidence-gated fallback to text when geometry is unreliable
- Zoom controls, wheel/pinch zoom, and responsive coordinate alignment
- Resizable/collapsible problem panel and compact feedback sidebar
- Multiple in-session revisions with prior-attempt preservation/comparison
- Three levels of progressive assistance
- Separate worked-solution request after repeated unsuccessful revisions
- Optional in-memory study logging and JSON export
- Single-service Render deployment with a health endpoint

## Core Workflow and Routes

The primary path is:

`interpret -> verify -> diagnose -> annotate -> revise -> escalate`

- `POST /api/interpret-solution` transcribes and localizes work without
  judging correctness.
- `POST /api/diagnose-solution` treats confirmed text and work-status fields
  as authoritative, then returns structured feedback and markup.
- `POST /api/generate-worked-solution` is a deliberate progressive-assistance
  endpoint, not the default response.
- `GET /api/health` returns `{"ok":true}`.

`POST /api/analyze-solution` is retained as a legacy one-stage compatibility
route. The current frontend does not call it. Remove it only after confirming no
external test or research client depends on it.

All frontend requests use same-origin relative URLs. Images are base64-encoded
for the request and handled in memory. PDFs are rendered to a selected JPEG page
in the browser before analysis; the original PDF is not uploaded.

## Important Design Decisions

### Confirmation

Automatically accepted lines remain automatically accepted when opened.
User-confirmed review cards collapse after confirmation and can be reopened
deliberately. Counts derive from line state rather than click history.

### Diagnosis

The earliest causal incorrect or unsupported step is prioritized. Crossed-out
work is retained as provenance but not treated as the submitted reasoning.
Explanations are intentionally concise and avoid repeating the same point in the
issue card, hint, and image note.

For an equation-selection error, level-one feedback states the relevant equation
and one brief reason it applies. It does not continue through substitution,
derivation, or the final answer.

### Annotation

The source image is never modified. Image and SVG overlays share one normalized
coordinate system, so resizing and zoom transform them together.

Physics vectors represent physical quantities and have semantic kinds, origins,
directions/endpoints, labels, and confidence. They are solid, compact arrows
drawn from the relevant physical object. Note leaders are separate, thin
connectors between a localized target and a teacher note.

Vector generation is bounded to recognizable horizontal-surface, incline,
hanging-mass, connected-block, and basic circular-motion diagrams. Low-confidence
geometry is not drawn; the student receives a short textual cue instead.

### Student UI

The pilot-derived hierarchy is intentionally preserved:

- Resizable/collapsible problem and file-preview panel
- Annotated work as the primary visual area
- First issue and hint in a compact right-side feedback panel
- Collapsed positive feedback below
- Technical transcription, secondary-issue, and model notes hidden from normal
  student view
- Suggested next step merged into the hint

### Progressive Assistance

Level 1 provides concise revision guidance. Level 2 names the relevant principle
more explicitly without solving the problem. Level 3 can unlock a separate
worked-solution action after repeated unsuccessful revisions. A worked solution
is never embedded in the ordinary diagnosis response.

## Study Logging and Privacy

Study controls are compiled into the frontend only when
`VITE_STUDY_MODE=true`. Confirmed transcription is added to exports only when
`VITE_STUDY_INCLUDE_TRANSCRIPTION=true` as well.

Logs remain in browser memory until explicit JSON download. They include task
metadata, problem statement, optional researcher note, timing/events, review
counts, diagnosis metadata, annotation counts, revision outcomes, assistance
level, worked-solution state, and safe error categories.

Exports do not contain the uploaded image/PDF, base64 payload, file name, API
key, raw model request/response, device path, IP address, cookies, or device
fingerprint. The browser's in-memory log can be lost before export. The intended
research convention is one export per participant task/session.

## API Key Handling

`OPENAI_API_KEY` is loaded only by the Node server from local environment
files or the deployment environment. It is not exposed through a `VITE_*`
variable or the production bundle.

The settings menu also permits a tester to enter a personal key. This is a
separate bring-your-own-key path: the value is stored only in the current tab's
`sessionStorage` and sent in `X-OpenAI-API-Key` to the same-origin backend.
It should be used only on a trusted deployment. The server-managed deployment
key remains server-side.

## Deployment Notes

- Development: `npm run dev`; default `http://127.0.0.1:5174`
- Production build: `npm ci --include=dev && npm run build`
- Production start: `npm start`
- Bind address: `0.0.0.0`
- Port: `process.env.PORT || 5174`
- Model: `OPENAI_MODEL || gpt-5.6-luna`
- Health check: `/api/health`

The production Node server serves `dist/`, provides SPA fallback for non-API
GET routes, and returns JSON 404 responses for unknown API routes.
`render.yaml` supplies nonsecret defaults and leaves `OPENAI_API_KEY` for
manual secret entry. Luna is the cost-efficient development default; Terra can
be selected for final evaluation or difficult cases.

## Pilot Status

An exploratory pilot with two participants was used for interaction and
usability refinement. It was not designed to estimate learning effects. Do not
make efficacy claims from this pilot or include sensitive participant details in
the repository.

## Known Limitations

- Introductory mechanics scope; bounded FBD configurations only
- Dependence on VLM transcription, reasoning, and spatial localization
- Ambiguous/crossed-out handwriting can still require confirmation
- Confidence thresholds reduce but do not eliminate misplaced annotations
- No formal symbolic or simulation verification of every model claim
- No causal learning evaluation or longitudinal deployment
- No certification for sensitive classroom or student data
- No teacher rubric input or full general diagram editor

## Future Work

Primary:

- Conduct the full user study.
- Compare localized graphical annotations against detached textual feedback.

Secondary:

- Optional upload/photo/screenshot of the problem statement
- Similar-practice problem generation from a supplied problem
- Physics animation or simulation-grounded feedback
- Broader physics topics and richer diagram structures
- Optional teacher/rubric input if a later study requires it

These secondary features are not dependencies for the current research question.

## Handoff Priorities

1. Reproduce all automated checks and manually exercise the full workflow.
2. Verify the OpenAI model/key configuration on a private test deployment.
3. Freeze and record the commit/build used for each study participant.
4. Preserve the current pilot-derived behavior while preparing the full study.
5. Keep API keys and participant data outside version control.
