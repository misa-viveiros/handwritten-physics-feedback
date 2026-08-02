# Handwritten Physics Feedback Project Notes

## Current Scope

This prototype is a local React + TypeScript + Vite app for exploring
handwritten introductory-mechanics feedback. It supports handwritten equations
and bounded free-body diagrams as the main evaluated contribution. A student
selects a problem, uploads or photographs handwritten work, confirms what the
system read, and receives progressive revision-oriented feedback.

The tool is designed to analyze the student's own reasoning. It does not assign
a grade, train or fine-tune a model, include teacher rubric input, reconstruct
arbitrary diagrams, or run a physics simulation.

## Two-Stage Workflow

The pilot workflow deliberately separates handwriting interpretation from physics diagnosis:

1. `POST /api/interpret-solution` sends the problem statement and original image to the vision-language model. It returns only ordered transcription lines, reading confidence, uncertain symbols, interpretation notes, and optional normalized image regions. It does not return correctness feedback.
2. The student reviews every line, edits text when needed, and marks each line `Correct`, `Needs correction`, or `Not sure`.
3. `POST /api/diagnose-solution` sends the problem statement, original image, and confirmed lines to the model. The confirmed text is authoritative. The image is used for diagrams, layout, and unresolved regions.

Student confirmation makes recognition errors visible and contestable before they can be mistaken for physics errors. The initial line confidence describes interpretation uncertainty. The later analysis confidence describes uncertainty in the physics diagnosis. These are separate signals.

The confirmation model is intentionally line-based. It is not yet a general `StudentSolutionGraph`, equation graph, or diagram editor.

## Editable Interpretation Regions

Located interpretation lines appear as normalized rectangular regions over the
original image. Selecting a region reveals four corner handles. Regions can be
dragged, resized, nudged with the arrow keys, or deselected with Escape. All
coordinates remain normalized from 0 to 1, are clamped to the displayed image,
and never alter the uploaded pixels.

The interpretation panel supports deleting a line with a temporary Undo,
merging with the previous or next line, and drawing an optional missing region.
A merge creates a new stable internal line ID, uses the bounding rectangle of
the source regions, combines their text and uncertain symbols in reading order,
and requires review. A newly drawn region starts with blank text and must be
completed or deleted before feedback can continue. Display numbers are
regenerated from visual top-to-bottom, then left-to-right order; they are not
stable IDs.

Each attempt tracks `contentDirty` separately from `geometryDirty`. Text,
status, line membership, merge, add, delete, or reading-order changes make the
confirmed content stale and trigger diagnosis when its normalized snapshot
changes. Moving or resizing a region without changing order is geometry-only:
the cached diagnosis is reused and line-linked overlay geometry is re-anchored
where possible. No VLM request occurs during direct manipulation.

Region editing currently supports rectangular bounding boxes only. It does not
provide polygonal outlines, rotation, or freehand selections.

## Unlimited Revision Workflow

The frontend stores a `ProblemSession` containing the authoritative problem
statement, optional reviewed-problem ID/title, an array of `SolutionAttempt`
records, and the active attempt ID. Each attempt owns its uploaded image,
interpretation, line-review statuses, confirmed transcription and normalized
snapshot, diagnosis, annotations, timestamps, and workflow stage.

After feedback, `Try again` appends a new empty attempt and makes it active.
There is no frontend attempt limit. The compact attempt-history control shows
the status of every attempt; selecting an earlier attempt restores its image,
confirmed interpretation, feedback, and annotations from memory without an API
call. Only one full attempt workspace is displayed at a time.

Each diagnosed attempt is compared deterministically with the immediately
previous attempt using confirmed text and structured diagnoses. Returning from
transcription review restores cached feedback immediately when the normalized
confirmed snapshot is unchanged. Editing confirmed text makes only that
attempt's diagnosis stale and triggers a replacement diagnosis when the student
continues.

`Start this attempt over` clears only the active attempt. `Try a different
problem` clears the problem and all attempt history; analyzed sessions require
confirmation first.

## Progressive Feedback

Each diagnosed attempt stores an `AssistanceState` with a feedback level, the
number of meaningful revisions for the current core issue, an issue key, and
worked-solution lock/reveal state.

- Level 1 gives a conceptual teacher-like question and avoids the correct
  equation or answer.
- Level 2 follows the first unsuccessful meaningful revision of the same issue
  and may name the relevant principle or relationship.
- Level 3 follows the second unsuccessful meaningful revision of the same
  issue and unlocks `View worked solution`.

The complete solution is never generated during diagnosis. The student must
click the unlocked button and confirm that complete reasoning and the answer
will be shown. Only then does `POST /api/generate-worked-solution` request a
structured sequence of steps, equations, substitutions, units, final answer,
optional diagram explanation, confidence, and limitations.

Attempts increment only when a newly diagnosed attempt has meaningfully changed
confirmed text and the comparison says the same issue remains. Reopening or
accepting unchanged transcription reuses the cached diagnosis. API failures do
not update assistance state. A resolved or genuinely different issue resets the
counter and returns assistance to Level 1.

## Reviewed Problem Bank

`src/problems/problemBank.ts` contains 10 concise, human-reviewable practice
problems across kinematics, projectile motion, Newton's laws, friction, and
energy. Each entry has an ID, title, topic, difficulty, statement, optional
assumptions, expected concepts, common errors, and a `studyRecommended` flag.
Expected concepts and common errors are development metadata and are not shown
to students or sent to the diagnosis API.

The compact picker lists every reviewed problem by short title and supports
custom problem text plus `Pick another` without immediately repeating the
selected problem. Topic, difficulty, study approval, expected concepts, and
common errors remain internal metadata and do not appear in the normal
interface. Pilot studies should use reviewed problems for consistent wording
and conditions.

AI-generated practice problems are future work only. If added, they must use
structured output, remain editable, be labeled as unreviewed, and must never be
added automatically to the reviewed study bank.

## Environment Variables

Create a local `.env.local` file. The local backend loads `.env.local` first and then `.env`.

Optional server-wide credential:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_MODEL`, defaults to `gpt-5.6-luna`
- `PORT`, defaults to `5174`
- `VITE_STUDY_MODE`, defaults to `false`
- `VITE_STUDY_INCLUDE_TRANSCRIPTION`, defaults to `false`

Luna is the cost-efficient default for development and routine testing. Set
`OPENAI_MODEL=gpt-5.6-terra` for final evaluation or especially difficult
handwriting and reasoning cases.

Do not put a real API key in committed files. Frontend code cannot read
`OPENAI_API_KEY` or `OPENAI_MODEL`; only the Node backend reads those
environment variables.

## Browser API Key

The top-right menu allows a tester to provide their own OpenAI API key without
editing `.env.local`. The key is stored in `sessionStorage`, is removed when
the browser-tab session ends, and is sent to the same-origin backend only in
the `X-OpenAI-API-Key` request header. It is not included in analysis JSON,
attempt history, URLs, Vite environment variables, or repository files.

For each request, a browser-supplied key takes precedence. When no browser key
is supplied, the backend falls back to `OPENAI_API_KEY`. Testers should enter a
key only when running a trusted copy of this project.

Sharing the GitHub repository does not create a static deployment: testers
must clone the project and run the included Node backend with `npm.cmd run
dev`, or deploy both the frontend and backend together. GitHub Pages alone
cannot run the analysis endpoints.

## How To Run

Install dependencies:

```powershell
npm.cmd install
```

Start the combined local frontend and backend:

```powershell
npm.cmd run dev
```

This serves the Vite app and the backend endpoint from the same local origin.

Production-style startup serves the compiled frontend and API from one Node
process:

```powershell
npm.cmd run build
npm.cmd start
```

The production server resolves `dist/` relative to its own module, binds to
`0.0.0.0`, uses `PORT` with a `5174` fallback, and returns `dist/index.html`
for unknown non-API GET routes. Unknown `/api/*` routes remain JSON 404s. The
Render health check is `GET /api/health`. Images are decoded and processed in
memory only; the server does not write uploads to disk.

Optional frontend-only Vite server:

```powershell
npm.cmd run dev:vite
```

Frontend-only mode is useful for UI work, but AI analysis will not work because the interpretation and diagnosis API endpoints are unavailable.

## AI Workflow

The app requires:

- a non-empty physics problem statement
- a JPG, PNG, or WEBP uploaded image
- an API key entered from the top-right menu or `OPENAI_API_KEY` in `.env.local`
- the combined dev server running with `npm.cmd run dev`

The browser converts the selected image to base64 and sends it with the problem statement to `POST /api/interpret-solution`. After confirmation, it sends the same image plus the confirmed transcription to `POST /api/diagnose-solution`. The Node backend validates both requests, reconstructs a data URL, and uses the OpenAI Responses API through the official JavaScript SDK. Environment keys remain server-side; a session key entered in the menu is transmitted to that backend for the request.

The interpretation and diagnosis endpoints request and validate structured JSON. Interpretation coordinates are normalized from 0 to 1 and clamped; missing or unreliable locations fall back to text-only confirmation. Diagnosis responses use the existing `FeedbackResult` schema. Worked solutions use a separate endpoint and schema and are generated only after explicit reveal confirmation. The legacy `POST /api/analyze-solution` route remains available for compatibility but is not used by the two-stage interface.

## Worksheet Annotations

Diagnosis markup can combine a target shape (`dashed_box`, `underline`, `check`, `question_mark`, or note-only), a short note, a category (`issue`, `hint`, `praise`, or `question`), preferred note placement, and an optional leader endpoint. Legacy `circle`, `arrow`, and `note` values remain supported.

The browser places callout notes rather than trusting the model to choose exact note coordinates. It tries multiple sides of the target, clamps notes to the image, avoids interpreted handwriting regions and existing notes, and staggers nearby callouts. The primary non-praise annotation receives one intentional leader when its note is separated from the target. When useful feedback cannot be localized reliably, Annotated work shows one brief placement notice instead of exposing internal markup records.

On-page notes are intentionally brief revision cues, not worked solutions. The diagnosis prompt asks for short questions, hints, or praise such as `Is this the right equation?`, `Acceleration, not velocity.`, and `Good equation choice.`

## Free-Body Diagrams

Bounded semantic FBD support covers five introductory-mechanics families:

1. Object on a horizontal surface
2. Object on an incline
3. Hanging mass
4. Two objects connected by one rope
5. Basic circular-motion force diagram

Corrections identify the target object, semantic vector kind, and whether the
student vector is missing, extra, reversed, mislabeled, on the wrong object, or
not a force. Bounded kinds include weight, normal, friction, tension, applied
force, net inward force, components, velocity, and acceleration.

Physics vectors are drawn only above the geometry confidence threshold. A
replacement vector is offset slightly from the student's existing vector, and
labels are placed against interpreted writing regions to reduce collisions.
Extra forces, wrong-object arrows, swapped component labels, and centripetal
force used as an extra interaction normally receive a mark or text note rather
than another vector. Low-confidence geometry remains text-only and triggers the
brief placement warning in Annotated work.

Deterministic fixtures cover missing friction, an extra third-law force,
incorrect incline normal, swapped gravity components, missing hanging-mass
tension, object-specific rope tension, and an extra centripetal force.

## Camera Capture

The sidebar uses one file input with two compact actions. `Upload image or PDF`
opens the general file picker with `image/*,application/pdf`. `Take photo`
temporarily applies
`capture="environment"` and `accept="image/*"` so supported mobile browsers can
open the rear camera. Captured files use the same validation, preview,
interpretation, and diagnosis workflow. The original file and orientation
metadata are preserved; there is no persistent camera permission, live preview,
video, WebRTC, or custom camera interface.

PDF import uses Mozilla PDF.js in the browser. A single-page PDF renders page 1
automatically. A multi-page PDF shows a page selector and renders only the
selected page to JPEG at up to 2x scale, 2600 pixels on the longest edge, and 6
megapixels. The rendered image then uses the same preview, coordinate mapping,
interpretation, diagnosis, and annotation pipeline as an uploaded photo. The
original PDF is not sent to the analysis API. There is no direct Samsung Notes
integration; students export a note as an image or PDF first.

## Pilot Study Logging

Set `VITE_STUDY_MODE=true` to show a task-ID field and the developer-only
`Export session log` action. Logging remains in memory and downloads one JSON
file containing the session ID, problem/task ID, timestamps and durations,
interpretation uncertainty, distinct transcription edits, crossed-out-status
corrections, feedback level, revisions, issue resolution, worked-solution
state, vector proposal/render/fallback counts, API failures, and reset/cancel
actions.

Upload instrumentation may include `sourceType`, `pdfPageNumber`, and
`pdfPageCount`. It excludes original filenames, local paths, image bytes, PDF
bytes, and device metadata.

The log never includes image bytes, image contents, or API keys. Confirmed
transcription is excluded by default and is included only when both study mode
and `VITE_STUDY_INCLUDE_TRANSCRIPTION=true` are explicitly configured.

## Demo Path

Choose the reviewed practice problem `Box slowing on a rough floor`, then upload
or photograph a diagram with weight downward, normal upward, velocity rightward,
and no friction force. The intended flow is interpretation review, a
missing-friction diagnosis, a leftward `f_k` overlay, and the teacher-like
question "What force is slowing the box?" A revised upload then demonstrates
issue resolution or stronger guidance. After two meaningful unsuccessful
revisions of the same issue, the worked-solution action becomes available but
remains collapsed until the student explicitly confirms it.

## Crossed-Out Work

Each interpreted line carries an independent work status: `active`,
`crossed_out`, `partially_crossed_out`, or `unclear`. The interpretation model
also supplies a status confidence and brief visible evidence when cancellation
marks are present. Transcription confidence and crossed-out confidence are
separate so an equation can be read clearly while its cancellation status is
uncertain.

Uncertain cancellation is included in selective confirmation. The student can
mark the line as crossed out, active, or partially crossed out, and that choice
becomes authoritative. Diagnosis receives every confirmed line for provenance,
but treats only active uncrossed lines as the submitted reasoning. Crossed-out
work may support a concise teaching observation and cannot receive a positive
check annotation.

Original work and Annotated work share one order-based line-number map. Located
lines appear in a 5% left gutter aligned to the vertical center of their image
regions; close labels are staggered. The Annotated work stage reserves 68% for
the unchanged student page and 23% for teacher notes. Normalized model
coordinates remain relative to the page itself, so the gutter is excluded from
all interpretation and annotation geometry.

## Input Limits

Supported image formats:

- JPG/JPEG
- PNG
- WEBP
- PDF exported from a note-taking app

HEIC/HEIF is not supported yet. The image size limit is 8 MB and the source PDF
limit is 20 MB. Only one PDF page is rendered and analyzed at a time.

## Current Limitations

- This is a research prototype, not a classroom deployment-ready system.
- Uploaded image and problem text are sent to an external AI service.
- No teacher rubric input is implemented. Teacher/rubric support remains a possible future improvement, not a dependency for the initial system.
- Worked solutions are delayed but still model-generated and require manual
  feasibility review.
- Interpretation highlights and feedback annotations are non-destructive overlays; they do not modify the uploaded image.
- Student confirmation is an ordered line list, not a full solution graph.
- Crossed-out detection is model-assisted and still requires student review
  when the visual evidence is uncertain.
- Diagnosis receives the student-confirmed transcription directly.
- Attempts exist only in frontend memory for the current page session. There is
  no account, database, long-term storage, or image persistence after refresh.
- Revision comparison is a lightweight heuristic over confirmed text and structured diagnoses, not simulation-grounded diagnosis.
- Structured output validation catches malformed responses, but the analysis quality still needs manual feasibility testing with representative handwritten submissions.
- Evaluated scope is introductory mechanics only; electromagnetism is excluded.
- There is no arbitrary FBD reconstruction, digital-ink editor, or
  physics-simulator integration.
- Pilot instrumentation is suitable only for a small exploratory study.

## Future Work

- Direct tablet or stylus writing
- Animation of the physics implied by student work
- Integration with the existing PBD simulator
- Broader physics-domain support after mechanics evaluation
