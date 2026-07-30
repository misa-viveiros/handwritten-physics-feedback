import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'
import {
  feedbackJsonSchema,
  normalizeFeedbackResult,
  validateFeedbackResult,
} from './feedback-schema.mjs'
import {
  interpretationJsonSchema,
  normalizeAndValidateInterpretation,
  validateConfirmedLines,
} from './interpretation-schema.mjs'

const maxImageBytes = 8 * 1024 * 1024
const maxJsonBytes = 12 * 1024 * 1024
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const defaultModel = 'gpt-5.6-luna'

await loadLocalEnv()

const port = Number(process.env.PORT) || 5174

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'POST' && url.pathname === '/api/analyze-solution') {
    await handleAnalyzeSolution(request, response)
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/interpret-solution') {
    await handleInterpretSolution(request, response)
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/diagnose-solution') {
    await handleDiagnoseSolution(request, response)
    return
  }

  vite.middlewares(request, response, () => {
    sendJson(response, 404, { error: 'Not found.' })
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Local app and API: http://127.0.0.1:${port}`)
})

async function handleAnalyzeSolution(request, response) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      sendJson(response, 500, {
        error:
          'OpenAI API key is missing. Add OPENAI_API_KEY to .env, then restart the dev server.',
      })
      return
    }

    const body = await readJsonBody(request)
    const problemStatement = readRequiredString(
      body.problemStatement,
      'problemStatement',
    )
    const image = readImagePayload(body.image)

    const feedback = await analyzeWithOpenAI({
      problemStatement,
      imageBase64: image.base64,
      mimeType: image.mimeType,
    })

    sendJson(response, 200, { feedback })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function handleInterpretSolution(request, response) {
  try {
    requireApiKey()
    const body = await readJsonBody(request)
    const problemStatement = readRequiredString(
      body.problemStatement,
      'problemStatement',
    )
    const image = readImagePayload(body.image)
    const interpretation = await interpretWithOpenAI({
      problemStatement,
      imageBase64: image.base64,
      mimeType: image.mimeType,
    })

    sendJson(response, 200, { interpretation })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function handleDiagnoseSolution(request, response) {
  try {
    requireApiKey()
    const body = await readJsonBody(request)
    const problemStatement = readRequiredString(
      body.problemStatement,
      'problemStatement',
    )
    const image = readImagePayload(body.image)
    const confirmedLines = validateConfirmedLines(body.confirmedLines)
    const feedback = await analyzeWithOpenAI({
      problemStatement,
      imageBase64: image.base64,
      mimeType: image.mimeType,
      confirmedLines,
    })

    sendJson(response, 200, { feedback })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function interpretWithOpenAI({
  problemStatement,
  imageBase64,
  mimeType,
}) {
  const completion = await requestStructuredOutput({
    instructions: interpretationInstructions,
    schema: interpretationJsonSchema,
    schemaName: 'handwritten_solution_interpretation',
    problemStatement,
    imageBase64,
    mimeType,
  })

  const parsed = parseModelJson(completion)

  try {
    return normalizeAndValidateInterpretation(parsed)
  } catch (error) {
    console.error('Invalid interpretation response:', formatError(error))
    throw createHttpError(
      502,
      'The handwriting interpretation did not match the expected schema.',
    )
  }
}

async function analyzeWithOpenAI({
  problemStatement,
  imageBase64,
  mimeType,
  confirmedLines,
}) {
  const confirmedText = confirmedLines
    ? `\n\nStudent-confirmed transcription (authoritative):\n${confirmedLines
        .map(
          (line) =>
            `${line.id} (Line ${line.order}) [review: ${line.status}; work: ${
              line.workStatus
            }]: ${line.confirmedText}${
              line.workStatus === 'crossed_out'
                ? ' (discarded by the student; provenance only)'
                : line.workStatus === 'partially_crossed_out'
                  ? ' (partially discarded; use cautiously)'
                  : line.workStatus === 'unclear'
                    ? ' (student intent remains unclear)'
                    : ''
            }${line.status === 'not_sure' ? ' (student remains unsure)' : ''}`,
        )
        .join('\n')}`
    : ''
  const completion = await requestStructuredOutput({
    instructions: diagnosisInstructions,
    schema: feedbackJsonSchema,
    schemaName: 'handwritten_physics_feedback',
    problemStatement: `${problemStatement}${confirmedText}`,
    imageBase64,
    mimeType,
  })
  const parsed = parseModelJson(completion)

  try {
    const normalized = normalizeFeedbackResult(parsed, (index, reason) => {
      console.warn(`Adjusted suggestedMarkup[${index}]: ${reason}`)
    })
    const feedback = suppressCrossedOutPraise(
      validateFeedbackResult(normalized),
      confirmedLines,
    )

    if (!confirmedLines) {
      return feedback
    }

    return {
      ...feedback,
      transcription: createConfirmedTranscription(confirmedLines),
    }
  } catch (error) {
    console.error('Invalid diagnosis response:', formatError(error))
    throw createHttpError(
      502,
      'The physics diagnosis did not match the expected feedback schema.',
    )
  }
}

async function requestStructuredOutput({
  instructions,
  schema,
  schemaName,
  problemStatement,
  imageBase64,
  mimeType,
}) {
  let OpenAI

  try {
    OpenAI = (await import('openai')).default
  } catch {
    throw createHttpError(
      500,
      'The OpenAI SDK is not installed. Run npm.cmd install before using AI analysis.',
    )
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.OPENAI_MODEL || defaultModel
  const imageUrl = `data:${mimeType};base64,${imageBase64}`

  try {
    return await client.responses.create({
      model,
      instructions,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Physics problem statement:\n${problemStatement}`,
            },
            {
              type: 'input_image',
              image_url: imageUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    })
  } catch (error) {
    console.error('OpenAI request failed:', formatError(error))
    throw createHttpError(
      502,
      'The OpenAI request failed. Check the API key, model access, and network connection.',
    )
  }
}

function parseModelJson(completion) {
  const rawOutput = completion.output_text
  if (!rawOutput) {
    throw createHttpError(502, 'The model returned an empty response.')
  }

  try {
    return JSON.parse(rawOutput)
  } catch {
    throw createHttpError(502, 'The model response was not valid JSON.')
  }
}

function createConfirmedTranscription(confirmedLines) {
  const overallConfidence =
    confirmedLines.reduce((sum, line) => sum + line.confidence, 0) /
    confirmedLines.length

  return {
    lines: confirmedLines.map((line) => ({
      id: line.id,
      text: line.confirmedText,
      confidence:
        line.status === 'not_sure'
          ? Math.min(line.confidence, 0.5)
          : line.confidence,
      uncertainSymbols: line.uncertainSymbols,
    })),
    overallConfidence,
  }
}

function suppressCrossedOutPraise(feedback, confirmedLines) {
  const crossedOutIds = new Set(
    (confirmedLines ?? [])
      .filter((line) => line.workStatus === 'crossed_out')
      .map((line) => line.id),
  )
  if (crossedOutIds.size === 0) {
    return feedback
  }

  return {
    ...feedback,
    suggestedMarkup: feedback.suggestedMarkup.filter((markup) => {
      const lineId = markup.lineId ?? markup.targetLineId
      const isPraise =
        markup.category === 'praise' || markup.type === 'check'
      return !(lineId && crossedOutIds.has(lineId) && isPraise)
    }),
  }
}

async function readJsonBody(request) {
  const chunks = []
  let receivedBytes = 0

  for await (const chunk of request) {
    receivedBytes += chunk.length

    if (receivedBytes > maxJsonBytes) {
      throw createHttpError(
        413,
        'Request is too large. Upload an image smaller than 8 MB.',
      )
    }

    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.')
  }
}

function readImagePayload(value) {
  if (!isRecord(value)) {
    throw createHttpError(400, 'Image payload is missing.')
  }

  const base64 = readRequiredString(value.base64, 'image.base64')
  const mimeType = readRequiredString(value.mimeType, 'image.mimeType')

  if (!supportedMimeTypes.has(mimeType)) {
    throw createHttpError(
      415,
      'Unsupported image format. Upload a JPG, PNG, or WEBP image. HEIC is not supported yet.',
    )
  }

  const imageBytes = Buffer.byteLength(base64, 'base64')
  if (imageBytes > maxImageBytes) {
    throw createHttpError(
      413,
      'Image is too large. Please upload an image smaller than 8 MB.',
    )
  }

  return { base64, mimeType }
}

function readRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createHttpError(400, `${fieldName} is required.`)
  }

  return value
}

function requireApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw createHttpError(
      500,
      'OpenAI API key is missing. Add OPENAI_API_KEY to .env.local, then restart the dev server.',
    )
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(payload))
}

function createHttpError(status, message) {
  return { status, message }
}

function normalizeError(error) {
  if (
    isRecord(error) &&
    typeof error.status === 'number' &&
    typeof error.message === 'string'
  ) {
    return error
  }

  return {
    status: 500,
    message: 'Unexpected server error while analyzing the solution.',
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error)
}

async function loadLocalEnv() {
  for (const filename of ['.env.local', '.env']) {
    try {
      const envText = await readFile(resolve(process.cwd(), filename), 'utf8')

      for (const line of envText.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
          continue
        }

        const equalsIndex = trimmed.indexOf('=')
        if (equalsIndex === -1) {
          continue
        }

        const key = trimmed.slice(0, equalsIndex).trim()
        const value = trimmed.slice(equalsIndex + 1).trim().replace(/^"|"$/g, '')

        if (key && process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    } catch {
      // Local env files are optional so startup can report missing credentials clearly.
    }
  }
}

const interpretationInstructions = `You interpret a student's handwritten physics work.

Return only a faithful, ordered transcription. Do not judge correctness, diagnose physics, give hints, repair equations, or provide a solution.

Treat each written step as a separate line. Preserve equations, signs, numbers, units, subscripts, and apparent mistakes exactly as written.

For each line, give its reading order, confidence from 0 to 1, any uncertain symbols, and needsConfirmation. Set needsConfirmation true when a symbol, line boundary, or reading is genuinely ambiguous. Use an empty uncertainSymbols array when none are uncertain.

For every line, classify workStatus as active, crossed_out, partially_crossed_out, or unclear. Detect strike-through marks, heavy scribbles, cancellation strokes, and deliberate X marks. Preserve crossed-out text in rawText instead of omitting it. Use crossedOutEvidence to briefly describe the visible evidence, or null when the line is active and there is no cancellation evidence. Give workStatusConfidence from 0 to 1, independently of transcription confidence. Set needsConfirmation true when the crossed-out status is uncertain.

Do not mistake underlining, fraction bars, radical bars, vector arrows, diagram lines, equals signs, or ordinary pen strokes for cancellation. A single corrected symbol can make a line partially_crossed_out while the replacement line remains active.

Example: a student writes F = ma, F = (2.0)(3.0), and F = 6.0 N, crosses out the last two lines, then writes F = m / a and F = 0.67 N. Keep every line in the transcription. Mark the two visibly cancelled calculation lines crossed_out and the later uncrossed lines active. The crossed-out lines are provenance, while the later active lines represent the submitted reasoning.

When a line can be localized, include a tight normalized region relative to the full original image and a locationConfidence from 0 to 1. Coordinates x, y, width, and height range from 0 to 1. Use null for both region and locationConfidence when the location is uncertain; do not guess.

Use interpretationNotes only for handwriting, ordering, overlap, cropping, diagrams, or image-quality observations. Do not include physics evaluation.

Do not generate line IDs or confirmed text. The application owns those fields.`

const diagnosisInstructions = `You are a physics tutor analyzing a student's handwritten solution after the student reviewed the transcription.

Your purpose is to help the student revise their own reasoning, not to replace their work with a full solution.

Treat the student-confirmed transcription in the request as authoritative for equations, numbers, signs, units, and written steps. Copy those lines and their IDs exactly into the response transcription. Do not silently override a student correction based on the image.

Treat workStatus as authoritative. Diagnose the ordered active lines as the student's submitted solution. Preserve crossed_out lines as discarded provenance, but never use an abandoned correct equation to conclude that the final active reasoning is correct. Use partially_crossed_out or unclear lines cautiously. Mention abandoned work only when it offers a concise, pedagogically useful observation, such as "You initially used F = ma correctly, but crossed it out and replaced it with F = m/a."

Consult the image only for diagrams, spatial layout, and lines explicitly marked not_sure. If the confirmed text conflicts with the image, keep the confirmed text and report uncertainty rather than replacing it.

Identify the earliest incorrect, unsupported, or unclear step. Later errors caused by that step may be mentioned as secondary issues, but should not replace the first issue.

Distinguish among conceptual errors, incorrect equation selection, algebra errors, sign errors, unit errors, diagram errors, missing reasoning, and unclear handwriting.

Give one targeted hint that helps the student revise the first issue. Do not provide the full worked solution by default.

If the written work is insufficient to evaluate the reasoning, say so. Do not infer correct reasoning from a final answer alone.

When a line is marked not_sure, acknowledge the unresolved interpretation where it affects diagnosis.

When referring to work in prose, use the human-readable order as "Line 3" or "Lines 3-5", and include a short quote when practical, such as "Line 6, F = m/a". Never expose application line IDs. Do not rely only on a line number for an unlocalized line; quote its text.

For suggestedMarkup, return approximately 1 to 3 sparse teacher-style annotations. Do not generate an id field; the application assigns annotation IDs after receiving your response. Prioritize the earliest important issue, then optionally one high-value supporting comment or one praise annotation.

Do not place a positive check or praise annotation on a crossed_out line. A question or note may refer to abandoned correct work when useful, for example "You had the right operation here - why did you replace it?"

Each annotation may use type check, circle, underline, arrow, note, dashed_box, question_mark, note_only, or physics_vector. Choose category issue, hint, praise, or question. Use noteStyle handwritten by default, compact for dense areas, or emphasis only for the first important issue.

A physics_vector is a physical quantity, not a connector from a note. Use it only when the problem or student work contains a recognizable physical diagram and a specific vector is missing, reversed, or mislabeled. The vector must begin at the relevant object or physical point in the diagram. Never start a physics vector in the annotation margin.

For physics_vector, provide vectorKind (force, velocity, acceleration, displacement, momentum, or other), normalized-image origin, confidence, and either endpoint or both direction and relativeLength. Direction components may be negative; relativeLength is from 0 to 1. Add a concise label when useful, such as "mg", "N", "f_k", "v_x", or "v_y". Use targetLineId when the vector corresponds to a confirmed line. Physics vector geometry must have confidence of at least 0.72. If the object location, origin, or direction is less certain, return a note_only annotation instead, keep the teacher cue in noteText, and explain in targetDescription that exact vector placement is uncertain.

Initial physics-vector support is limited to: weight downward; normal force perpendicular to a visible surface; friction opposite visible relative motion; velocity in the visible direction of motion; acceleration in simple one-dimensional motion; and horizontal or vertical projectile velocity components. Do not reconstruct an arbitrary free-body diagram or add every possible vector.

For a box sliding right on a rough horizontal floor with N upward, mg downward, velocity rightward, and friction missing, identify the missing friction and propose one leftward force physics_vector beginning at the box, labeled "f_k". A separate right-margin note may ask "What force is slowing the box?" and may use its own note leader. Do not use the physics-vector arrow as the note leader.

Write noteText like a teacher marking a student's page: short, specific, conversational, and revision-oriented. Use a question when it can prompt the student to inspect their own reasoning. Use a direct correction only for a simple algebra, sign, or unit issue. Keep notes under roughly 8 to 12 words whenever possible and never more than one short sentence. Praise sparingly and name the specific successful choice.

Good examples include "Is this the right equation?", "What does g represent here?", "This fraction is backwards.", "Check the sign here.", "Are these units consistent?", "Good equation choice.", "Nice setup.", "What changes with time?", "Try separating horizontal and vertical motion.", "Can you explain this step?", "You're close - check the algebra.", "This assumes constant velocity.", "Acceleration, not velocity.", and "Which quantity should be divided by 4.9?".

For vector feedback, concise examples include "What force is slowing the box?", "Add friction opposite the motion.", "Gravity points downward.", "Velocity is tangent to the path.", "Acceleration points toward the center.", and "These two forces act on different objects."

Do not use detached grading language such as "The student demonstrates", "This step is mathematically invalid", or "Likely misconception detected." Do not repeat the side-panel explanation on the image. Never put a worked solution, replacement derivation, final answer, or paragraph-style explanation in an on-page note.

When you can localize the handwritten work, include normalized coordinates relative to the full original uploaded image. Use region for a bounded target expression and anchor for a point target. Coordinates x, y, width, and height must be numbers from 0 to 1.

Use notePlacement above, below, left, right, or auto. Usually set notePosition null and let the application place notes in a right-side annotation margin. For the primary issue annotation, normally set showLeader true so the note has one intentional arrow approaching the marked expression from the right; supporting notes and praise marks should omit leaders. When showLeader is true, leaderAnchor should identify the precise endpoint on the expression. A leader must belong to that annotation and must not cross unrelated work.

Examples: for h = vt in free fall, use a dashed_box with "Is this the right equation?", category question, and one leader to the boxed equation; near a misuse of 9.8, use "Acceleration, not velocity." For a reversed algebraic ratio, underline it and write "This fraction is backwards." For a correct h = 1/2 gt^2 step, use a green praise check with "Good equation choice."

Locate the exact handwritten step associated with the first issue. Keep marks tight and avoid covering large areas of the student's work. If localization is uncertain, set low confidence and use null for region, anchor, notePosition, and leaderAnchor rather than inventing a location; the side panel will retain the text feedback.`
