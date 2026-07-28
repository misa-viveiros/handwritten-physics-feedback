import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'
import { feedbackJsonSchema, validateFeedbackResult } from './feedback-schema.mjs'

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

async function analyzeWithOpenAI({ problemStatement, imageBase64, mimeType }) {
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

  let completion

  try {
    completion = await client.responses.create({
      model,
      instructions: tutorInstructions,
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
          name: 'handwritten_physics_feedback',
          strict: true,
          schema: feedbackJsonSchema,
        },
      },
    })
  } catch {
    throw createHttpError(
      502,
      'The OpenAI request failed. Check the API key, model access, and network connection.',
    )
  }

  const rawOutput = completion.output_text
  if (!rawOutput) {
    throw createHttpError(502, 'The model returned an empty response.')
  }

  let parsed
  try {
    parsed = JSON.parse(rawOutput)
  } catch {
    throw createHttpError(502, 'The model response was not valid JSON.')
  }

  try {
    return validateFeedbackResult(parsed)
  } catch {
    throw createHttpError(
      502,
      'The model response did not match the expected feedback schema.',
    )
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
      // Local env files are optional because mock mode should work without credentials.
    }
  }
}

const tutorInstructions = `You are a physics tutor analyzing a student's handwritten solution.

Your purpose is to help the student revise their own reasoning, not to replace their work with a full solution.

Transcribe the work faithfully. Do not silently correct equations, signs, units, numbers, or symbols during transcription.

Identify the earliest incorrect, unsupported, or unclear step. Later errors caused by that step may be mentioned as secondary issues, but should not replace the first issue.

Distinguish among conceptual errors, incorrect equation selection, algebra errors, sign errors, unit errors, diagram errors, missing reasoning, and unclear handwriting.

Give one targeted hint that helps the student revise the first issue. Do not provide the full worked solution by default.

If the written work is insufficient to evaluate the reasoning, say so. Do not infer correct reasoning from a final answer alone.

When handwriting is ambiguous, report uncertainty instead of inventing a confident transcription.`
