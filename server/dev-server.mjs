import { Buffer } from 'node:buffer'
import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
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
import {
  validateWorkedSolution,
  workedSolutionJsonSchema,
} from './worked-solution-schema.mjs'

const maxImageBytes = 8 * 1024 * 1024
const maxJsonBytes = 12 * 1024 * 1024
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const defaultModel = 'gpt-5.6-luna'
const serverDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(serverDirectory, '..')
const distDirectory = resolve(projectRoot, 'dist')
const developmentMode = process.argv.includes('--dev')
const staticMimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

await loadLocalEnv()

const port = Number(process.env.PORT) || 5174
const vite = developmentMode
  ? await createDevelopmentViteServer()
  : undefined

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

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

  if (
    request.method === 'POST' &&
    url.pathname === '/api/generate-worked-solution'
  ) {
    await handleGenerateWorkedSolution(request, response)
    return
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Not found.' })
    return
  }

  if (vite) {
    vite.middlewares(request, response, () => {
      sendJson(response, 404, { error: 'Not found.' })
    })
    return
  }

  await serveProductionFrontend(request, response, url.pathname)
})

server.listen(port, '0.0.0.0', () => {
  const mode = developmentMode ? 'development' : 'production'
  console.log(
    `Handwritten Physics Feedback (${mode}) listening on http://0.0.0.0:${port}`,
  )
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    console.log(`${signal} received; closing the web service.`)
    server.close(async (error) => {
      if (vite) {
        await vite.close()
      }
      if (error) {
        console.error('Server shutdown failed:', formatError(error))
        process.exitCode = 1
      }
    })
  })
}

async function createDevelopmentViteServer() {
  const { createServer: createViteServer } = await import('vite')
  return createViteServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'spa',
  })
}

async function serveProductionFrontend(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 404, { error: 'Not found.' })
    return
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    sendJson(response, 400, { error: 'Invalid URL path.' })
    return
  }

  const requestedPath = resolve(distDirectory, `.${decodedPath}`)
  if (!isPathInsideDist(requestedPath)) {
    sendJson(response, 403, { error: 'Forbidden path.' })
    return
  }

  if (decodedPath !== '/') {
    try {
      const fileStats = await stat(requestedPath)
      if (fileStats.isFile()) {
        await sendStaticFile(request, response, requestedPath, fileStats.size)
        return
      }
    } catch {
      // Client-side routes fall through to the SPA entry point.
    }
  }

  const indexPath = resolve(distDirectory, 'index.html')
  try {
    const indexStats = await stat(indexPath)
    await sendStaticFile(request, response, indexPath, indexStats.size, true)
  } catch {
    sendJson(response, 503, {
      error: 'Frontend build not found. Run npm run build before npm start.',
    })
  }
}

function isPathInsideDist(filePath) {
  const normalizedDist = `${distDirectory.toLowerCase()}${sep}`
  const normalizedFile = filePath.toLowerCase()
  return (
    normalizedFile === distDirectory.toLowerCase() ||
    normalizedFile.startsWith(normalizedDist)
  )
}

async function sendStaticFile(
  request,
  response,
  filePath,
  fileSize,
  isSpaEntry = false,
) {
  response.writeHead(200, {
    'Cache-Control': isSpaEntry
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
    'Content-Length': fileSize,
    'Content-Type':
      staticMimeTypes.get(extname(filePath).toLowerCase()) ??
      'application/octet-stream',
  })

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  createReadStream(filePath).pipe(response)
}

async function handleAnalyzeSolution(request, response) {
  try {
    const apiKey = requireApiKey(request)
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
      apiKey,
    })

    sendJson(response, 200, { feedback })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function handleInterpretSolution(request, response) {
  try {
    const apiKey = requireApiKey(request)
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
      apiKey,
    })

    sendJson(response, 200, { interpretation })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function handleDiagnoseSolution(request, response) {
  try {
    const apiKey = requireApiKey(request)
    const body = await readJsonBody(request)
    const problemStatement = readRequiredString(
      body.problemStatement,
      'problemStatement',
    )
    const image = readImagePayload(body.image)
    const confirmedLines = validateConfirmedLines(body.confirmedLines)
    const feedbackLevel = readFeedbackLevel(body.feedbackLevel)
    const feedback = await analyzeWithOpenAI({
      problemStatement,
      imageBase64: image.base64,
      mimeType: image.mimeType,
      confirmedLines,
      apiKey,
      feedbackLevel,
    })

    sendJson(response, 200, { feedback })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function handleGenerateWorkedSolution(request, response) {
  try {
    const apiKey = requireApiKey(request)
    const body = await readJsonBody(request)
    const problemStatement = readRequiredString(
      body.problemStatement,
      'problemStatement',
    )
    const confirmedLines = validateConfirmedLines(body.confirmedLines)
    const currentDiagnosis = validateFeedbackResult(
      normalizeFeedbackResult(body.currentDiagnosis),
    )
    const revisionHistorySummary = readRequiredString(
      body.revisionHistorySummary,
      'revisionHistorySummary',
    )
    const diagramInterpretation = readRequiredString(
      body.diagramInterpretation,
      'diagramInterpretation',
    )
    const attemptsForCurrentIssue = readNonNegativeInteger(
      body.attemptsForCurrentIssue,
      'attemptsForCurrentIssue',
    )

    if (attemptsForCurrentIssue < 2 || body.workedSolutionUnlocked !== true) {
      throw createHttpError(
        403,
        'A worked solution is available only after two unsuccessful revisions of the same issue.',
      )
    }

    const workedSolution = await generateWorkedSolutionWithOpenAI({
      apiKey,
      problemStatement,
      confirmedLines,
      currentDiagnosis,
      revisionHistorySummary,
      diagramInterpretation,
    })
    sendJson(response, 200, { workedSolution })
  } catch (error) {
    const apiError = normalizeError(error)
    sendJson(response, apiError.status, { error: apiError.message })
  }
}

async function interpretWithOpenAI({
  problemStatement,
  imageBase64,
  mimeType,
  apiKey,
}) {
  const completion = await requestStructuredOutput({
    instructions: interpretationInstructions,
    schema: interpretationJsonSchema,
    schemaName: 'handwritten_solution_interpretation',
    problemStatement,
    imageBase64,
    mimeType,
    apiKey,
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
  apiKey,
  feedbackLevel = 1,
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
    instructions: `${diagnosisInstructions}\n\n${getAssistanceInstructions(
      feedbackLevel,
    )}`,
    schema: feedbackJsonSchema,
    schemaName: 'handwritten_physics_feedback',
    problemStatement: `${problemStatement}${confirmedText}`,
    imageBase64,
    mimeType,
    apiKey,
  })
  const parsed = parseModelJson(completion)

  try {
    const normalized = normalizeFeedbackResult(parsed, (index, reason) => {
      console.warn(`Adjusted suggestedMarkup[${index}]: ${reason}`)
    })
    const feedback = suppressUnreliableMarkup(
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

async function generateWorkedSolutionWithOpenAI({
  apiKey,
  problemStatement,
  confirmedLines,
  currentDiagnosis,
  revisionHistorySummary,
  diagramInterpretation,
}) {
  const completion = await requestTextStructuredOutput({
    apiKey,
    instructions: workedSolutionInstructions,
    schema: workedSolutionJsonSchema,
    schemaName: 'worked_physics_solution',
    inputText: `Physics problem:
${problemStatement}

Student-confirmed work:
${confirmedLines
  .map(
    (line) =>
      `Line ${line.order} [${line.workStatus}]: ${line.confirmedText}`,
  )
  .join('\n')}

Current diagnosis:
${JSON.stringify(currentDiagnosis)}

Revision history:
${revisionHistorySummary}

Relevant diagram interpretation:
${diagramInterpretation}`,
  })

  try {
    return validateWorkedSolution(parseModelJson(completion))
  } catch (error) {
    console.error('Invalid worked-solution response:', formatError(error))
    throw createHttpError(
      502,
      'The worked solution did not match the expected schema.',
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
  apiKey,
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

  const client = new OpenAI({ apiKey })
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

async function requestTextStructuredOutput({
  apiKey,
  instructions,
  schema,
  schemaName,
  inputText,
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

  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_MODEL || defaultModel

  try {
    return await client.responses.create({
      model,
      instructions,
      input: [{ role: 'user', content: inputText }],
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

function suppressUnreliableMarkup(feedback, confirmedLines) {
  const crossedOutIds = new Set(
    (confirmedLines ?? [])
      .filter((line) => line.workStatus === 'crossed_out')
      .map((line) => line.id),
  )
  const unresolvedIds = new Set(
    (confirmedLines ?? [])
      .filter(
        (line) => line.status === 'not_sure' || line.workStatus === 'unclear',
      )
      .map((line) => line.id),
  )

  return {
    ...feedback,
    suggestedMarkup: feedback.suggestedMarkup.filter((markup) => {
      const lineId = markup.lineId ?? markup.targetLineId
      const isPraise =
        markup.category === 'praise' || markup.type === 'check'
      if (lineId && unresolvedIds.has(lineId)) {
        return false
      }
      return !(lineId && crossedOutIds.has(lineId) && isPraise)
    }),
  }
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers['content-length'])
  if (Number.isFinite(contentLength) && contentLength > maxJsonBytes) {
    throw createHttpError(
      413,
      'Request is too large. Upload an image smaller than 8 MB.',
    )
  }

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

function readFeedbackLevel(value) {
  return value === 2 || value === 3 ? value : 1
}

function readNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw createHttpError(400, `${fieldName} must be a non-negative integer.`)
  }
  return value
}

function requireApiKey(request) {
  const headerValue = request.headers['x-openai-api-key']
  const browserApiKey = (
    Array.isArray(headerValue) ? headerValue[0] : headerValue
  )?.trim()

  if (browserApiKey && browserApiKey.length > 512) {
    throw createHttpError(400, 'The supplied API key is too long.')
  }

  const apiKey = browserApiKey || process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw createHttpError(
      401,
      'OpenAI API key is missing. Add one from the top-right menu or set OPENAI_API_KEY in .env.local.',
    )
  }

  return apiKey
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
      const envText = await readFile(resolve(projectRoot, filename), 'utf8')

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

Identify the earliest causal incorrect, unsupported, or unclear step. If one upstream error causes later wrong results, make the upstream error the primary issue. Later consequences may be mentioned in the side-panel secondary issues, but normally leave them unmarked on the page.

Distinguish among conceptual errors, incorrect equation selection, algebra errors, sign errors, unit errors, diagram errors, missing reasoning, and unclear handwriting.

Give one targeted hint that helps the student revise the first issue. Keep firstIssue.explanation to one or two short sentences and firstIssue.hint to one direct action. Keep nextStepHint to one short, nonredundant action. Do not restate essentially the same idea across firstIssue.explanation, firstIssue.hint, nextStepHint, likelyMisconception, and suggestedMarkup. Do not provide the full worked solution by default.

When the student's chosen equation or physical relationship is wrong, show the correct relevant equation directly in firstIssue.hint, followed by one brief conceptual sentence explaining why it applies. Put the equation before the prose, for example "F = ma" followed by why net force and acceleration are related. Do not describe the equation indirectly in a long paragraph, and do not continue into substitutions, calculations, a derivation, or the final answer.

If the written work is insufficient to evaluate the reasoning, say so. Do not infer correct reasoning from a final answer alone.

When a line is marked not_sure, acknowledge the unresolved interpretation where it affects diagnosis.

When referring to work in prose, use the human-readable order as "Line 3" or "Lines 3-5", and include a short quote when practical, such as "Line 6, F = m/a". Never expose application line IDs. Do not rely only on a line number for an unlocalized line; quote its text.

For suggestedMarkup, return 0 to 3 sparse annotations that resemble restrained formative markup from a physics instructor. Do not generate an id field; the application assigns annotation IDs after receiving your response. Set issueId to a short shared identifier when two marks address one issue, and set isPrimaryIssue true only for the earliest causal issue. Prioritize that issue, then optionally one lightweight supporting mark or one meaningful positive check. A mostly correct page should remain mostly unchanged.

Do not place a positive check or praise annotation on a crossed_out line. A question or note may refer to abandoned correct work when useful, for example "You had the right operation here - why did you replace it?"

Each annotation must use kind check, underline, circle, cross, question_note, correction_note, or physics_vector. Choose the least intrusive annotation that clearly communicates the issue. The priority is: no annotation; then check/underline/circle/cross; then a short localized question or correction; then semantic physics-vector feedback; longer explanation belongs only in the side panel. Do not create a note when a simple local mark is enough. Choose category issue, hint, praise, or question. Use noteStyle handwritten by default or compact for dense areas; avoid large emphasis cards.

Use question_note for conceptual or reasoning errors, including wrong models, missing interactions, equation-choice misconceptions, wrong objects, and conceptually meaningful directions or signs. Do not immediately state the answer. Use correction_note only for a small local mechanical issue such as a missing unit, arithmetic slip, notation typo, isolated algebra transcription error, or sign formatting error when the concept is otherwise sound. If the distinction is uncertain, prefer a question.

On-image noteText should normally be 8 words or fewer, has a soft maximum of 12 words, and must never exceed 15 words or one sentence. Never write generic AI prose such as "There appears to be an issue" or "Consider revisiting your calculation." Prefer compact teacher language such as "Why?", "Check the sign.", "Units?", "Is acceleration zero here?", and "Should N be perpendicular?" Keep side-panel explanation and hint fields concise, and do not duplicate those sentences in noteText.

A physics_vector is a physical quantity, not a connector from a note. Use it only when the problem or student work contains a recognizable physical diagram and a specific vector is missing, reversed, or mislabeled. The vector must begin at the relevant object or physical point in the diagram. Never start a physics vector in the annotation margin.

For every free-body-diagram correction, provide targetObject, vectorIssue (missing, extra, reversed, mislabeled, wrong_object, or not_a_force), and the bounded semantic vectorKind. Supported vector kinds are force, weight, normal, friction, tension, applied_force, net_inward_force, component, velocity, acceleration, displacement, momentum, and other. Use replacementFor to briefly identify an existing student vector when proposing an offset correction; otherwise use null.

For physics_vector, provide normalized-image origin, confidence, and either endpoint or both direction and relativeLength. Direction components may be negative; relativeLength is from 0 to 1. Add a concise label when useful, such as "mg", "N", "f_k", "T", "F_app", "v_x", or "v_y". Use targetLineId when the vector corresponds to a confirmed line. Physics vector geometry must have confidence of at least 0.72. If the object location, origin, or direction is less certain, return a question_note instead, keep the teacher cue in noteText, and explain in targetDescription that exact vector placement is uncertain.

Bounded FBD support covers only: an object on a horizontal surface, an object on an incline, a hanging mass, two objects connected by one rope, and a basic circular-motion force diagram. Within those families, check missing or extra forces, wrong direction or label, force assigned to the wrong object, velocity or acceleration confused with force, a non-perpendicular normal, reversed friction, swapped gravity components, incorrect tension, a Newton-third-law partner placed on the same object's FBD, and "centripetal force" treated as an extra interaction instead of the net inward force. Do not reconstruct arbitrary diagrams or add every possible vector.

For a missing force, prefer a semantic physics_vector plus a short conceptual question only when geometry is reliable. For an extra, nonexistent, wrong-object, or not-a-force arrow, use a tight cross or circle on the student's existing vector and ask what interaction produces it; do not add a misleading replacement vector. For a wrong direction, mark the existing vector and add a corrected candidate vector only when geometry is reliable. For a wrong label, underline or circle the label. Before proposing a missing vector, inspect the visible student arrows and do not place the new shaft directly over one. For a reversed vector, set replacementFor and offset the corrected origin slightly so it does not cover the student's arrow. For two-object diagrams, identify the specific target object and do not collapse the objects into one system unless the student explicitly chose a system boundary.

For a box sliding right on a rough horizontal floor with N upward, mg downward, velocity rightward, and friction missing, identify the missing friction and propose one leftward force physics_vector beginning at the box, labeled "f_k". A separate question_note may ask "What force slows the box?" Do not use the physics-vector arrow as the note leader.

For a book on a table with an extra downward "force of book on table" on the book's FBD, mark that existing arrow as wrong_object and ask "Does this force act on the book or the table?" Do not add a replacement vector. On an incline, normal is perpendicular to the visible surface and the downhill gravity component is mg sin theta while the perpendicular component is mg cos theta; prefer label annotations over redrawing the whole diagram. For a hanging mass missing tension, add an upward tension vector only when the mass center is clear and ask "What supports the mass?" In circular motion, do not add a separate centripetal interaction when tension or another real force already supplies the inward net force; ask "Which real force provides the inward net force?"

Write noteText like a teacher marking a student's page: short, specific, conversational, and revision-oriented. Praise sparingly, never check every line, and name only a meaningful successful choice or a resolved revision.

Good examples include "Is this the right equation?", "What does g represent here?", "This fraction is backwards.", "Check the sign here.", "Are these units consistent?", "Good equation choice.", "Nice setup.", "What changes with time?", "Try separating horizontal and vertical motion.", "Can you explain this step?", "You're close - check the algebra.", "This assumes constant velocity.", "Acceleration, not velocity.", and "Which quantity should be divided by 4.9?".

For vector feedback, concise examples include "What force is slowing the box?", "Add friction opposite the motion.", "Gravity points downward.", "Velocity is tangent to the path.", "Acceleration points toward the center.", and "These two forces act on different objects."

Do not use detached grading language such as "The student demonstrates", "This step is mathematically invalid", or "Likely misconception detected." Do not repeat the side-panel explanation on the image. Never put a worked solution, replacement derivation, final answer, or paragraph-style explanation in an on-page note.

When you can localize the handwritten work, include normalized coordinates relative to the full original uploaded image. Use targetRegion for a bounded target expression and anchor for a point target. Coordinates x, y, width, and height must be numbers from 0 to 1.

Use notePlacement above, below, left, right, or auto. Set notePosition null and let the application first try nearby whitespace to the right, above-right, below-right, above, and below. It will use the right-side annotation margin only when local space is crowded. Set showLeader true only when a separated margin note needs a connection. When showLeader is true, leaderAnchor should identify the precise endpoint on the expression. A leader must belong to that annotation and must not cross unrelated work.

Examples: for h = vt in free fall, circle or underline the equation and optionally add question_note "Constant velocity here?" For a wrong sign in an otherwise sound calculation, underline the sign and optionally add correction_note "Check the sign." For a missing unit, underline the value and add a short unit correction. For a correct h = 1/2 gt^2 step, either leave it untouched or use one small check with no note.

Locate the exact handwritten step associated with the first issue. Keep marks tight and avoid covering large areas of the student's work. If localization is uncertain, set low confidence and use null for targetRegion, anchor, notePosition, and leaderAnchor rather than inventing a location; the side panel will retain the text feedback.`

function getAssistanceInstructions(feedbackLevel) {
  if (feedbackLevel === 2) {
    return `Assistance level 2: give more explicit guidance about the first issue. Name the relevant principle or relationship and explain the key concept directly, but do not provide a complete derivation, numerical answer, or worked solution.`
  }
  if (feedbackLevel === 3) {
    return `Assistance level 3: the separate worked-solution action may now be available. In this diagnosis, still provide concise explicit guidance only. Do not include the complete derivation or final answer here.`
  }
  return `Assistance level 1: give a short conceptual hint. When equation selection is the diagnosed error, state the correct relevant equation and one brief reason it applies, but do not substitute values, derive the result, or reveal the final answer. For other issue types, prefer a short teacher-like question.`
}

const workedSolutionInstructions = `You are preparing a concise worked solution after a student explicitly requested it and already made at least two unsuccessful revisions of the same core issue.

Return a complete but focused introductory-mechanics solution. Clearly separate this solution from the student's submitted work. Include step-by-step reasoning, equations, substitutions, units, and a final answer. When a free-body diagram is relevant, explain which real interactions produce each force and their directions. Do not invent diagram details that are not supported by the problem statement or confirmed diagnosis.

Use 1 to 8 short steps. Each step has a title and explanation; equation, substitution, and units may be null when not applicable. Keep finalAnswer concise. Use diagramExplanation only when a diagram materially helps. Report uncertainty or assumptions in limitations rather than hiding them.`
