# Handwritten Physics Feedback Project Notes

## Current Scope

This prototype is a local React + TypeScript + Vite app for exploring handwritten physics solution feedback. A student can enter a physics problem statement, upload a photo of handwritten work, preview that image, and request revision-oriented feedback.

The tool is designed to analyze the student's own reasoning. It does not generate a full solution, assign a grade, train a model, fine-tune a model, add image overlays, or include teacher rubric input.

## Environment Variables

Create a local `.env.local` file. The local backend loads `.env.local` first and then `.env`.

Required for AI mode:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_MODEL`, defaults to `gpt-5.6-luna`
- `PORT`, defaults to `5174`

Do not put a real API key in committed files. The browser does not read `OPENAI_API_KEY`; only the local Node backend reads it.

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

Optional frontend-only Vite server:

```powershell
npm.cmd run dev:vite
```

Frontend-only mode is useful for UI work, but AI analysis will not work because `/api/analyze-solution` is not available.

## Mock Mode

Mock feedback mode uses static TypeScript feedback examples and does not require an API key. The mock case selector switches among representative physics solution reviews, including wrong free-fall equation choice, projectile axis mixing, ramp/friction force-direction errors, a correct solution, and unclear handwriting.

## AI Mode

AI mode requires:

- a non-empty physics problem statement
- a JPG, PNG, or WEBP uploaded image
- `OPENAI_API_KEY` set in `.env`
- the combined dev server running with `npm.cmd run dev`

The browser converts the selected image to base64 and sends it with the problem statement to `POST /api/analyze-solution`. The Node backend validates the request, reconstructs a data URL, and sends the problem statement plus image to the OpenAI Responses API using the official JavaScript SDK. The API key stays server-side.

The endpoint requests structured JSON compatible with the app's `FeedbackResult` schema and validates the model response before returning it. The frontend validates the returned feedback again before rendering.

## Image Limits

Supported image formats:

- JPG/JPEG
- PNG
- WEBP

HEIC/HEIF is not supported yet. The current image size limit is 8 MB.

## Current Limitations

- This is a research prototype, not a classroom deployment-ready system.
- Uploaded image and problem text are sent to an external AI service in AI mode.
- No teacher rubric input is implemented. Teacher/rubric support remains a possible future improvement, not a dependency for the initial system.
- No full-solution generation is implemented.
- No visual annotation overlays are implemented yet.
- Structured output validation catches malformed responses, but the analysis quality still needs manual feasibility testing with representative handwritten submissions.
