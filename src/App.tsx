import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import type { FeedbackResult } from './feedback'
import { mockFeedbackExamples } from './feedback'

const statusLabels: Record<FeedbackResult['overallStatus'], string> = {
  correct: 'Looks consistent',
  partially_correct: 'Partially on track',
  incorrect: 'Needs revision',
  unclear: 'Needs a clearer photo',
}

const issueTypeLabels: Record<
  NonNullable<FeedbackResult['firstIssue']>['errorType'],
  string
> = {
  conceptual: 'Conceptual',
  equation_selection: 'Equation choice',
  algebra: 'Algebra',
  sign: 'Sign',
  unit: 'Unit',
  diagram: 'Diagram',
  missing_step: 'Missing step',
  unclear_handwriting: 'Unclear handwriting',
}

function App() {
  const [problemStatement, setProblemStatement] = useState(
    'A ball is dropped from rest from a height of 20 m. Estimate its speed just before it reaches the ground. Ignore air resistance.',
  )
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null)

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      setImagePreviewUrl(null)
      setImageName('')
      return
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setImagePreviewUrl(URL.createObjectURL(file))
    setImageName(file.name)
    setFeedback(null)
  }

  function handleAnalyze() {
    setFeedback(mockFeedbackExamples.partiallyCorrectFreeFall)
  }

  const markupNotes = feedback?.suggestedMarkup ?? []

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Mock mode prototype</p>
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
              {imageName || 'Choose a photo from your device'}
            </span>
            <input
              id="solution-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
          </label>

          <button
            className="analyze-button"
            type="button"
            onClick={handleAnalyze}
            disabled={!problemStatement.trim()}
          >
            Analyze
          </button>

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
                  <article className="markup-note" key={markup.noteText}>
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
  return (
    <div className="feedback-sections">
      <section className="feedback-section">
        <h3>Transcription</h3>
        <p className="transcription">{feedback.transcription}</p>
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
            <p>{feedback.firstIssue.explanation}</p>
            <div className="hint-box">
              <h4>Hint</h4>
              <p>{feedback.firstIssue.hint}</p>
            </div>
          </>
        ) : (
          <p>No first issue stands out in this mock review.</p>
        )}
      </section>

      <section className="feedback-section">
        <h3>Suggested next step</h3>
        <p>{feedback.nextStepHint}</p>
      </section>

      <section className="feedback-section confidence-section">
        <h3>Confidence</h3>
        <p>
          {feedback.confidence === 'low'
            ? "I'm not fully sure about this part."
            : `Confidence: ${feedback.confidence}`}
        </p>
      </section>

      {feedback.suggestedMarkup && feedback.suggestedMarkup.length > 0 && (
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
      )}
    </div>
  )
}

export default App
