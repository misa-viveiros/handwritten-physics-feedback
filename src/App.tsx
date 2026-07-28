import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import type { ErrorType, FeedbackResult, MockCaseId, OverallStatus } from './feedback'
import { mockFeedbackCases } from './feedback'
import { validateFeedbackResult } from './feedbackValidation'

type AnalysisMode = 'mock' | 'ai'

const maxImageBytes = 8 * 1024 * 1024

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const statusLabels: Record<OverallStatus, string> = {
  correct: 'Looks consistent',
  partially_correct: 'Partially on track',
  incorrect: 'Needs revision',
  insufficient_work: 'Needs more work shown',
  unclear: 'Needs a clearer photo',
}

const issueTypeLabels: Record<ErrorType, string> = {
  conceptual: 'Conceptual',
  equation_selection: 'Equation choice',
  algebra: 'Algebra',
  sign: 'Sign',
  unit: 'Unit',
  diagram: 'Diagram',
  missing_reasoning: 'Missing reasoning',
  unclear_handwriting: 'Unclear handwriting',
}

function App() {
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('mock')
  const [selectedCaseId, setSelectedCaseId] = useState<MockCaseId>(
    mockFeedbackCases[0].id,
  )
  const selectedCase = mockFeedbackCases.find(
    (mockCase) => mockCase.id === selectedCaseId,
  )

  const [problemStatement, setProblemStatement] = useState(
    selectedCase?.problemStatement ?? '',
  )
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setErrorMessage(null)

    if (!file) {
      clearImage()
      return
    }

    const imageError = validateImageFile(file)
    if (imageError) {
      clearImage()
      event.target.value = ''
      setErrorMessage(imageError)
      return
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setImageName(file.name)
    setFeedback(null)
  }

  function clearImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setImageFile(null)
    setImagePreviewUrl(null)
    setImageName('')
  }

  function handleCaseChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextCaseId = event.target.value as MockCaseId
    const nextCase = mockFeedbackCases.find(
      (mockCase) => mockCase.id === nextCaseId,
    )

    setSelectedCaseId(nextCaseId)
    setProblemStatement(nextCase?.problemStatement ?? '')
    setFeedback(null)
    setErrorMessage(null)
  }

  async function handleAnalyze() {
    setErrorMessage(null)

    if (!problemStatement.trim()) {
      setErrorMessage('Add a physics problem statement before analyzing.')
      return
    }

    if (analysisMode === 'mock') {
      if (selectedCase) {
        setFeedback(selectedCase.feedback)
      }
      return
    }

    if (!imageFile) {
      setErrorMessage('Upload a JPG, PNG, or WEBP image before using AI analysis.')
      return
    }

    const imageError = validateImageFile(imageFile)
    if (imageError) {
      setErrorMessage(imageError)
      return
    }

    setIsAnalyzing(true)

    try {
      const imageBase64 = await readFileAsBase64(imageFile)
      const response = await fetch('/api/analyze-solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemStatement,
          image: {
            base64: imageBase64,
            mimeType: imageFile.type,
            filename: imageFile.name,
          },
        }),
      })

      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : 'AI analysis failed. Please try again.'
        throw new Error(message)
      }

      const responseData =
        isRecord(payload) && 'feedback' in payload ? payload.feedback : payload

      setFeedback(validateFeedbackResult(responseData))
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'AI analysis failed. Please try again.',
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const markupNotes = feedback?.suggestedMarkup ?? []

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Research prototype</p>
        <h1>Handwritten Physics Feedback</h1>
        <p className="subtitle">
          Upload a handwritten solution and get revision-oriented feedback.
        </p>
      </header>

      <section className="workspace" aria-label="Physics feedback workspace">
        <section className="input-panel" aria-labelledby="input-heading">
          <div className="panel-heading">
            <p className="section-kicker">Student work</p>
            <h2 id="input-heading">Problem and upload</h2>
          </div>

          <fieldset className="mode-toggle">
            <legend>Analysis mode</legend>
            <label>
              <input
                type="radio"
                name="analysis-mode"
                value="mock"
                checked={analysisMode === 'mock'}
                onChange={() => {
                  setAnalysisMode('mock')
                  setFeedback(null)
                  setErrorMessage(null)
                }}
              />
              Mock feedback
            </label>
            <label>
              <input
                type="radio"
                name="analysis-mode"
                value="ai"
                checked={analysisMode === 'ai'}
                onChange={() => {
                  setAnalysisMode('ai')
                  setFeedback(null)
                  setErrorMessage(null)
                }}
              />
              Analyze with AI
            </label>
          </fieldset>

          {analysisMode === 'mock' && (
            <>
              <label className="field-label" htmlFor="mock-case">
                Mock case
              </label>
              <select
                id="mock-case"
                className="mock-case-select"
                value={selectedCaseId}
                onChange={handleCaseChange}
              >
                {mockFeedbackCases.map((mockCase) => (
                  <option key={mockCase.id} value={mockCase.id}>
                    {mockCase.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="field-label" htmlFor="problem-statement">
            Problem statement
          </label>
          <textarea
            id="problem-statement"
            value={problemStatement}
            onChange={(event) => setProblemStatement(event.target.value)}
            rows={7}
          />

          <label className="upload-box" htmlFor="solution-image">
            <span className="upload-title">Upload handwritten solution</span>
            <span className="upload-detail">
              {imageName || 'Choose a JPG, PNG, or WEBP image'}
            </span>
            <input
              id="solution-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
            />
          </label>

          <p className="privacy-notice">
            This research prototype sends the uploaded image and problem
            statement to an external AI service for analysis. Do not upload
            sensitive or personally identifying information.
          </p>

          {errorMessage && (
            <div className="error-message" role="alert">
              {errorMessage}
            </div>
          )}

          <button
            className="analyze-button"
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !problemStatement.trim()}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </button>

          {isAnalyzing && (
            <div className="loading-message" aria-live="polite">
              Reading the handwritten work and preparing tutor feedback.
            </div>
          )}

          <div className="preview-area">
            <div className="preview-frame">
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Uploaded handwritten solution" />
              ) : (
                <div className="empty-preview">Image preview will appear here</div>
              )}
            </div>

            {markupNotes.length > 0 && (
              <div className="markup-list" aria-label="Suggested markup notes">
                <h3>Suggested markup notes</h3>
                {markupNotes.map((markup) => (
                  <article
                    className="markup-note"
                    key={`${markup.type}-${markup.targetDescription}-${markup.noteText}`}
                  >
                    <span className="markup-type">{markup.type}</span>
                    <p>{markup.targetDescription}</p>
                    <strong>{markup.noteText}</strong>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="feedback-panel" aria-labelledby="feedback-heading">
          <div className="panel-heading">
            <p className="section-kicker">Feedback</p>
            <h2 id="feedback-heading">Revision notes</h2>
          </div>

          {feedback ? (
            <FeedbackPanel feedback={feedback} />
          ) : (
            <div className="feedback-empty">
              Add the problem and a photo, then analyze when you are ready to
              review the reasoning.
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

function FeedbackPanel({ feedback }: { feedback: FeedbackResult }) {
  const secondaryIssues = feedback.secondaryIssues ?? []

  return (
    <div className="feedback-sections">
      <section className="feedback-section">
        <h3>Faithful transcription</h3>
        <div className="transcription-lines">
          {feedback.transcription.lines.map((line) => (
            <article className="transcription-line" key={line.id}>
              <span className="line-id">{line.id}</span>
              <p>{line.text}</p>
              <span className="line-confidence">
                {formatPercent(line.confidence)}
              </span>
              {line.uncertainSymbols && line.uncertainSymbols.length > 0 && (
                <small>Unclear: {line.uncertainSymbols.join(', ')}</small>
              )}
            </article>
          ))}
        </div>
        <p className="confidence-footnote">
          Transcription confidence: {formatPercent(feedback.transcription.overallConfidence)}
        </p>
      </section>

      <section className="feedback-section status-row">
        <div>
          <h3>Overall status</h3>
          <p>{statusLabels[feedback.overallStatus]}</p>
        </div>
        <span className={`status-pill status-${feedback.overallStatus}`}>
          {feedback.overallStatus.replace('_', ' ')}
        </span>
      </section>

      <section className="feedback-section">
        <h3>What you did well</h3>
        <ul className="strength-list">
          {feedback.strengths.map((strength) => (
            <li key={strength}>{strength}</li>
          ))}
        </ul>
      </section>

      <section className="feedback-section issue-section">
        <h3>First thing to check</h3>
        {feedback.firstIssue ? (
          <>
            <div className="issue-meta">
              <span>{issueTypeLabels[feedback.firstIssue.errorType]}</span>
              <span>{feedback.firstIssue.locationDescription}</span>
            </div>
            <blockquote>{feedback.firstIssue.quotedWork}</blockquote>
            <p>{feedback.firstIssue.explanation}</p>
            {feedback.firstIssue.likelyMisconception && (
              <div className="misconception-box">
                <h4>Likely misconception</h4>
                <p>{feedback.firstIssue.likelyMisconception}</p>
              </div>
            )}
            <div className="hint-box">
              <h4>Targeted hint</h4>
              <p>{feedback.firstIssue.hint}</p>
            </div>
          </>
        ) : (
          <p>No first issue stands out in this review.</p>
        )}
      </section>

      {secondaryIssues.length > 0 && (
        <details className="feedback-section secondary-issues">
          <summary>Secondary issues to revisit later</summary>
          <div className="secondary-list">
            {secondaryIssues.map((issue, index) => (
              <article key={`${issue.errorType}-${issue.quotedWork ?? index}`}>
                <span>{issueTypeLabels[issue.errorType]}</span>
                {issue.quotedWork && <strong>{issue.quotedWork}</strong>}
                <p>{issue.explanation}</p>
              </article>
            ))}
          </div>
        </details>
      )}

      <section className="feedback-section">
        <h3>Suggested next step</h3>
        <p>{feedback.nextStepHint}</p>
      </section>

      <section className="feedback-section confidence-section">
        <h3>Analysis confidence</h3>
        <p>{formatPercent(feedback.analysisConfidence)}</p>
      </section>

      <section className="feedback-section">
        <h3>Suggested markup notes</h3>
        <ul className="markup-summary">
          {feedback.suggestedMarkup.map((markup) => (
            <li key={`${markup.type}-${markup.targetDescription}`}>
              <strong>{markup.type}:</strong> {markup.noteText}
            </li>
          ))}
        </ul>
      </section>

      <section className="feedback-section full-solution-placeholder">
        <h3>Show full solution</h3>
        <p>
          Full solutions are intentionally paused in this prototype. The system
          should prioritize targeted hints and revision steps before revealing a
          worked solution.
        </p>
      </section>
    </div>
  )
}

function validateImageFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
    return 'HEIC images are not supported yet. Please upload a JPG, PNG, or WEBP image.'
  }

  if (!supportedImageTypes.has(file.type)) {
    return 'Unsupported image format. Please upload a JPG, PNG, or WEBP image.'
  }

  if (file.size > maxImageBytes) {
    return 'Image is too large. Please upload an image smaller than 8 MB.'
  }

  return null
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the uploaded image.'))
        return
      }

      const base64 = reader.result.split(',')[1]
      if (!base64) {
        reject(new Error('Could not encode the uploaded image.'))
        return
      }

      resolve(base64)
    }

    reader.onerror = () => reject(new Error('Could not read the uploaded image.'))
    reader.readAsDataURL(file)
  })
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default App
