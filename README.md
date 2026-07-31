# Handwritten Physics Feedback

A React, TypeScript, and Node prototype that interprets a photo of a student's
handwritten physics solution, lets the student confirm the transcription, and
returns progressive revision-oriented feedback with non-destructive
annotations. The evaluated scope is introductory mechanics, with bounded
free-body-diagram feedback.

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5174`.

Use the three-line menu in the top-right corner to enter an OpenAI API key.
The key is kept in browser `sessionStorage` for the current tab and sent to the
local backend only when an analysis request is made.

Alternatively, create `.env.local`:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
VITE_STUDY_MODE=false
VITE_STUDY_INCLUDE_TRANSCRIPTION=false
```

Never commit a real API key. Only enter a browser key when running a trusted
copy of the project.

## Hosting Note

The OpenAI request is made by the included Node backend, not directly by the
React application. Static GitHub Pages hosting is therefore not sufficient;
deploy the frontend and backend together or clone the repository and run
`npm.cmd run dev`.

For a production-style local run or a single Render web service:

```powershell
npm.cmd run build
npm.cmd start
```

`npm start` serves the built Vite application from `dist/` and all `/api/*`
routes from the same Node process. The server binds to `0.0.0.0` and reads
Render's `PORT` automatically. A Render Blueprint is provided in `render.yaml`;
enter `OPENAI_API_KEY` as a secret in Render rather than committing it.

On supported mobile devices, `Take photo` opens the rear-camera capture flow
through the same file input used by `Upload image`. Study mode adds a task-ID
field and metadata-only session-log export.

See `PROJECT_NOTES.md` for the workflow, schema, privacy notes, and current
limitations.
