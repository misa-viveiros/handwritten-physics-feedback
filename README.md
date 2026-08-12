# Localized AI Feedback for Handwritten Physics Solutions

## Overview

This repository contains a research prototype that interprets handwritten
introductory physics work and returns revision-oriented feedback. Its primary
focus is localized graphical feedback on free-body diagrams (FBDs): concise
teacher-style marks and semantic force vectors are placed directly beside the
student's unchanged work.

The system is designed to help a student locate and revise their own reasoning.
It does not reveal a worked solution by default, and it is not intended to act
as an automatic grader or general-purpose physics solver.

## Research Focus

The current primary research question is:

> How does placing graphical annotations directly on handwritten free-body
> diagrams affect students' ability to identify where their reasoning needs
> attention?

An exploratory pilot has informed the interaction design. A full user study
addressing this question remains future work.

## Key Features

- Camera capture, image upload, and PDF page import
- Faithful handwriting interpretation with selective user verification
- Physics diagnosis based on the user-confirmed transcription
- Localized checks, underlines, circles, crosses, and teacher-style notes
- Semantic force-vector annotations for bounded FBD configurations
- Zoomable annotated work with synchronized image and overlays
- Multiple revision attempts with prior-attempt preservation and comparison
- Progressive assistance, with an optional worked solution only after repeated
  unsuccessful revisions
- Optional study-mode interaction logging with one-click JSON export
- Responsive UI tested during development on desktop and Android tablet/mobile

## Interaction Workflow

**Interpret -> Verify -> Diagnose -> Annotate -> Revise -> Escalate**

1. **Interpret:** The model transcribes the uploaded handwriting and locates
   visible lines or diagram elements.
2. **Verify:** The student confirms or edits only interpretations that need
   review; automatically accepted lines remain available for deliberate edits.
3. **Diagnose:** The model uses the confirmed text and image context to identify
   the earliest causal reasoning issue.
4. **Annotate:** Sparse feedback is drawn non-destructively over the displayed
   work while concise explanation and hint cards remain alongside it.
5. **Revise:** The student can upload another attempt without losing earlier
   attempts in the current browser session.
6. **Escalate:** Assistance becomes more explicit after unsuccessful revisions;
   a worked solution is a separate, deliberate final action.

## Supported Physics Scope

The prototype targets introductory mechanics. Its bounded FBD handling covers:

- Objects on horizontal surfaces
- Objects on inclines
- Hanging masses
- Two objects connected by one rope
- Basic circular-motion force diagrams

Representative FBD checks include missing or extraneous forces, reversed
directions, incorrect labels, forces assigned to the wrong object,
velocity/acceleration drawn as forces, non-perpendicular normal forces,
friction direction, gravity components, tension, Newton's third-law
relationships, and centripetal force treated as an extra interaction.

Other introductory mechanics calculations can receive equation, algebra, sign,
unit, diagram, and missing-reasoning feedback. The model is intentionally
conservative about diagram geometry and falls back to text when placement is
uncertain. This is not a general-purpose or formally verified physics solver.

## Tech Stack

- React 19 and TypeScript
- Vite 8
- Node.js HTTP server
- OpenAI JavaScript SDK and Responses API
- PDF.js for client-side PDF page rendering
- Render for single-service deployment

## Repository Structure

```text
src/
  App.tsx                       Main workflow and session state
  AnnotatedImageView.tsx        Non-destructive feedback overlays and zoom
  InterpretationImageView.tsx   Interpretation review over the original work
  feedback*.ts                  Feedback types and client validation
  interpretation*.ts            Interpretation types, editing, and validation
  studyLog.ts                   In-memory study log and JSON export
  problems/problemBank.ts       Reviewed practice-problem data
server/
  dev-server.mjs                Development/production server and API prompts
  *-schema.mjs                  Server validation and normalization
  *.test.mjs                    Node test suite and annotation fixtures
public/
  favicon.svg
render.yaml                     Render Web Service configuration
.env.example                    Safe environment-variable template
PROJECT_NOTES.md                Design decisions and research handoff notes
```

## Local Setup

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8)
- npm
- An OpenAI API key for AI analysis

### Install and run

```powershell
git clone <repository-url>
cd handwritten-physics-feedback
npm.cmd ci --include=dev
Copy-Item .env.example .env.local
```

Edit `.env.local` and replace the placeholder `OPENAI_API_KEY`. Then run:

```powershell
npm.cmd run dev
```

Open [http://127.0.0.1:5174](http://127.0.0.1:5174). The one development
command starts the Node API server and Vite middleware. To use another port:

```powershell
$env:PORT=5180; npm.cmd run dev
```

The top-right settings menu also supports a user-supplied key for testing a
trusted copy. That key is stored in `sessionStorage` for the current browser
tab and sent only to this app's same-origin backend. It is not built into the
frontend and does not replace secure server configuration for deployment.

## Environment Variables

| Variable | Required | Scope | Description |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Yes for normal deployment | Server | OpenAI credential used by API routes. Keep it in `.env.local` or a deployment secret store. A tab-scoped user key can be supplied explicitly for trusted local/test copies. |
| `OPENAI_MODEL` | No | Server | Model name. Defaults to `gpt-5.6-luna`; `gpt-5.6-terra` remains compatible for difficult cases or final evaluation. |
| `PORT` | No | Server | Listening port. Defaults to `5174`; Render supplies this automatically. |
| `VITE_STUDY_MODE` | No | Build/client | Set to `true` to include study-session controls. Defaults to `false`. |
| `VITE_STUDY_INCLUDE_TRANSCRIPTION` | No | Build/client | Includes confirmed transcription text in study exports only when study mode is also enabled. Defaults to `false`. |

`VITE_*` values are public and compiled into the frontend. Never place a
secret in them.

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the combined Node/Vite development server |
| `npm.cmd run dev:vite` | Start Vite alone; API requests require another server |
| `npm.cmd run lint` | Run ESLint |
| `npm.cmd test` | Run the Node test suite |
| `npm.cmd run check:server` | Syntax-check the Node server |
| `npm.cmd run build` | Type-check and build the production frontend |
| `npm.cmd start` | Serve `dist/` and the API in production mode |
| `npm.cmd run preview` | Preview only the Vite build |

There is no separate type-check script; `npm.cmd run build` runs `tsc -b`
before `vite build`.

## Production Build

```powershell
npm.cmd ci --include=dev
npm.cmd run build
npm.cmd start
```

The production Node process serves static files from `dist/`, falls back to
`dist/index.html` for non-API browser routes, and handles the same-origin API.
The server listens on `0.0.0.0` and reads `process.env.PORT`.

## Deploying to Render

The checked-in `render.yaml` defines one Node Web Service.

1. Connect this GitHub repository to a new Render Web Service, or apply the
   Blueprint from `render.yaml`.
2. Use the Node.js runtime.
3. Use build command `npm ci --include=dev && npm run build`.
4. Use start command `npm start`.
5. Add `OPENAI_API_KEY` as a manually entered secret.
6. Keep `OPENAI_MODEL=gpt-5.6-luna`, or use `gpt-5.6-terra` for selected
   evaluation/difficult cases.
7. Set the two `VITE_*` variables for the intended study build.
8. Use `/api/health` as the health-check path.

Render supplies `PORT`; do not set `NODE_ENV` or a fixed port manually.
Changing a `VITE_*` value requires a rebuild/redeploy because those settings
are compiled into the frontend.

In production, the Node service serves both the built Vite app and
`/api/interpret-solution`, `/api/diagnose-solution`, and
`/api/generate-worked-solution`. Browser requests use relative `/api/...`
URLs. The deployment's `OPENAI_API_KEY` is read only by Node and is never
included in `dist/`.

### Render troubleshooting

- **Build cannot find Vite or TypeScript types:** confirm the build command is
  `npm ci --include=dev && npm run build` and remove settings that omit
  development dependencies.
- **Missing key or HTTP 401:** add `OPENAI_API_KEY` in Render's Environment
  settings, then restart/redeploy.
- **API returns 5xx:** inspect Render logs for the sanitized upstream error;
  verify the model name, key permissions, request size, and OpenAI availability.
- **Study controls are stale:** update the `VITE_*` value and trigger a full
  rebuild, not only a process restart.
- **Frontend loads but API does not:** verify the service uses `npm start`,
  check [`/api/health`](http://127.0.0.1:5174/api/health) on the deployed
  domain, and confirm requests remain relative.
- **Camera/upload choices differ by device:** browser and Android file pickers
  control the available camera, gallery, and files options. Use the dedicated
  camera action or export from the notes app and choose image/PDF upload.

## Study Mode

Set `VITE_STUDY_MODE=true` before building to show study controls. Set
`VITE_STUDY_INCLUDE_TRANSCRIPTION=true` as well only when the approved study
protocol permits confirmed transcription text in exports.

The log exists in browser memory for the current app session and is downloaded
only when the researcher clicks **Export JSON**. It records:

- Session/task identifiers, timestamps, duration, and upload source category
- The problem statement and optional researcher note
- Interpretation review counts and interaction events
- Diagnosis status/type/confidence metadata
- Annotation kinds/counts, revision outcomes, assistance level, and safe error
  categories
- Confirmed transcription only under the explicit two-variable opt-in above

Exports intentionally omit uploaded image/PDF content, base64 data, file names,
API keys, raw model requests/responses, device paths, IP addresses, cookies,
and fingerprinting metadata. Export one JSON file per participant task/session
and store it according to the approved research protocol. Refreshing or closing
the page before export can lose the in-memory log.

## Pilot Study / Current Research Status

An exploratory pilot with two participants was completed to refine interaction
and usability. It was not a learning-effect evaluation and contains no basis
for claims that the prototype improves learning. The outstanding research task
is a full user study centered on localized FBD feedback.

## Known Limitations

- Scope is limited to introductory mechanics and bounded FBD configurations.
- Output quality depends on a vision-language model and may vary.
- Ambiguous handwriting, crossed-out work, cropping, and dense diagrams can
  still require user confirmation or text-only fallback.
- Annotation placement is confidence-gated but not infallible.
- The system does not formally verify every symbolic, numerical, or physical
  claim with a computer algebra system or simulation.
- There has been no causal learning evaluation or longitudinal deployment.
- Uploaded work is sent to the configured OpenAI service for analysis; this
  prototype has not been certified for sensitive classroom data.

## Future Work

- Conduct the full user study.
- Compare localized graphical annotations with detached textual feedback.
- Add optional photo/screenshot input for the problem statement.
- Generate similar practice problems from a supplied problem.
- Explore simulation-grounded feedback and visualization.
- Extend coverage to broader physics domains and richer diagrams.

The latter convenience features are not central to the current research
contribution and should not displace the full study.

## Handoff / Continuing the Project

Start by reproducing the local checks and a complete interpret/verify/diagnose/
annotate/revise flow. Verify API configuration, then deploy a private test
instance if needed. Preserve the current pilot-derived interaction behavior when
preparing the full study, and record the exact commit and deployment build used
for each participant. Never commit, log, or expose API keys.

The recommended next research task is the full user study, not another feature
expansion.

## Citation / Research Use

If you use or extend this prototype in research, please cite the associated
paper or project report once available.

## License

No license has currently been specified.
