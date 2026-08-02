import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'
import { AnnotatedImageView } from './AnnotatedImageView'
import { InterpretationImageView } from './InterpretationImageView'
import type {
  ErrorType,
  FeedbackResult,
  OverallStatus,
} from './feedback'
import { validateFeedbackResult } from './feedbackValidation'
import type {
  ConfirmedLine,
  HandwritingWorkStatus,
  InterpretedLine,
  InterpretedSolution,
  InterpretationRegion,
  LineReviewStatus,
} from './interpretation'
import {
  createInitialLineStatuses,
  lineNeedsConfirmation,
} from './interpretation'
import { validateInterpretedSolution } from './interpretationValidation'
import {
  clampInterpretationRegion,
  createManualInterpretationLine,
  mergeInterpretationLines,
  reanchorFeedbackToInterpretation,
  sortInterpretationLines,
} from './interpretationEditing'
import {
  createLineNumberMap,
  resolveLineReference,
  sortLinesByOrder,
} from './lineReferences'
import {
  compareRevisions,
  type RevisionComparison,
} from './revisionComparison'
import {
  getRequestedFeedbackLevel,
  initialAssistanceState,
  updateAssistanceState,
  type AssistanceState,
} from './assistance'
import {
  validateWorkedSolution,
  type WorkedSolution,
} from './workedSolution'
import {
  addStudyEvent,
  createStudySessionLog,
  downloadStudyLog,
  getVectorMetrics,
  studyModeEnabled,
} from './studyLog'
import {
  problemBank,
  type PracticeProblem,
} from './problems/problemBank'
import type {
  PdfImportSession,
  UploadSource,
} from './pdfImport'

type WorkflowStage = 'input' | 'interpretation' | 'feedback'

type SolutionAttempt = {
  id: string
  attemptNumber: number
  imageUrl?: string
  imageFile?: File
  imageFileName?: string
  imageFingerprint?: string
  uploadSource?: UploadSource
  interpretation?: InterpretedSolution
  lineStatuses: Record<string, LineReviewStatus | undefined>
  confirmedLines?: ConfirmedLine[]
  diagnosis?: FeedbackResult
  assistanceState?: AssistanceState
  workedSolution?: WorkedSolution
  confirmedSnapshot?: string
  contentDirty: boolean
  geometryDirty: boolean
  stage: WorkflowStage
  createdAt: string
  completedAt?: string
}

type ProblemSession = {
  problemId?: string
  problemTitle?: string
  problemStatement: string
  attempts: SolutionAttempt[]
  activeAttemptId: string | null
}

const maxImageBytes = 8 * 1024 * 1024
const maxPdfBytes = 20 * 1024 * 1024
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const apiKeyStorageKey = 'handwritten-physics-feedback:openai-api-key'

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

const workStatusLabels: Record<HandwritingWorkStatus, string> = {
  active: 'Active',
  crossed_out: 'Crossed out',
  partially_crossed_out: 'Partially crossed out',
  unclear: 'Cross-out unclear',
}

function App() {
  const previewUrlsRef = useRef<Set<string>>(new Set())
  const problemInputRef = useRef<HTMLTextAreaElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const pendingUploadSourceRef = useRef<'camera' | 'image'>('image')
  const pdfImportSessionRef = useRef<PdfImportSession | null>(null)
  const apiKeyMenuRef = useRef<HTMLDivElement | null>(null)
  const studyLogRef = useRef(createStudySessionLog())
  const studyEditedLinesRef = useRef<Set<string>>(new Set())
  const [studyTaskId, setStudyTaskId] = useState('')
  const [apiKey, setApiKey] = useState(readSessionApiKey)
  const [apiKeyDraft, setApiKeyDraft] = useState(apiKey)
  const [apiKeyMenuOpen, setApiKeyMenuOpen] = useState(false)
  const [session, setSession] = useState<ProblemSession>(() =>
    createProblemSession(problemBank[0]),
  )
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [activeRequest, setActiveRequest] = useState<
    | 'importing-pdf'
    | 'interpreting'
    | 'diagnosing'
    | 'worked-solution'
    | null
  >(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null)
  const [pendingProblemChange, setPendingProblemChange] = useState<
    PracticeProblem | 'blank' | null
  >(null)
  const [workedSolutionConfirmationOpen, setWorkedSolutionConfirmationOpen] =
    useState(false)

  const activeAttempt =
    session.attempts.find(
      (attempt) => attempt.id === session.activeAttemptId,
    ) ?? session.attempts[0]
  const activeAttemptIndex = session.attempts.findIndex(
    (attempt) => attempt.id === activeAttempt?.id,
  )
  const previousAttempt =
    activeAttemptIndex > 0 ? session.attempts[activeAttemptIndex - 1] : undefined
  const problemStatement = session.problemStatement
  const attemptNumber = activeAttempt?.attemptNumber ?? 1
  const imagePreviewUrl = activeAttempt?.imageUrl ?? null
  const imageFile = activeAttempt?.imageFile ?? null
  const imageName = activeAttempt?.imageFileName ?? ''
  const uploadSource = activeAttempt?.uploadSource
  const interpretation = activeAttempt?.interpretation
  const lineStatuses = activeAttempt?.lineStatuses ?? {}
  const confirmedLines = activeAttempt?.confirmedLines ?? []
  const feedback = activeAttempt?.diagnosis
  const assistanceState =
    activeAttempt?.assistanceState ?? initialAssistanceState
  const workedSolution = activeAttempt?.workedSolution
  const diagnosedTranscriptionSnapshot = activeAttempt?.confirmedSnapshot
  const stage = activeAttempt?.stage ?? 'input'
  const hasAnalyzedAttempts = session.attempts.some(
    (attempt) => attempt.diagnosis,
  )
  const problemLocked = session.attempts.some(
    (attempt) => attempt.interpretation,
  )
  useEffect(() => {
    const previewUrls = previewUrlsRef.current
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      previewUrls.clear()
    }
  }, [])

  useEffect(
    () => () => {
      const pdfSession = pdfImportSessionRef.current
      if (pdfSession) {
        void import('./pdfImport').then(({ closePdfImport }) =>
          closePdfImport(pdfSession),
        )
      }
      pdfImportSessionRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (!apiKeyMenuOpen) {
      return
    }

    function closeMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !apiKeyMenuRef.current?.contains(event.target)
      ) {
        setApiKeyMenuOpen(false)
      }
    }

    function closeMenuWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setApiKeyMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeMenuWithEscape)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeMenuWithEscape)
    }
  }, [apiKeyMenuOpen])

  function saveApiKey() {
    const nextApiKey = apiKeyDraft.trim()
    setApiKey(nextApiKey)
    writeSessionApiKey(nextApiKey)
    setApiKeyMenuOpen(false)
    setNoticeMessage(
      nextApiKey
        ? 'API key saved for this browser tab.'
        : 'This browser tab will use the server API key, if configured.',
    )
  }

  function removeApiKey() {
    setApiKey('')
    setApiKeyDraft('')
    writeSessionApiKey('')
    setApiKeyMenuOpen(false)
    setNoticeMessage(
      'Browser API key removed. The server API key will be used if configured.',
    )
  }

  function recordStudyEvent(
    type: string,
    details?: Record<string, string | number | boolean>,
  ) {
    if (studyModeEnabled) {
      addStudyEvent(studyLogRef.current, type, details)
    }
  }

  function exportStudyLog() {
    studyLogRef.current.taskId = studyTaskId.trim() || session.problemId
    downloadStudyLog(
      studyLogRef.current,
      confirmedLines.map((line) => line.confirmedText),
    )
  }

  function updateAttemptById(
    attemptId: string,
    updater: (attempt: SolutionAttempt) => SolutionAttempt,
  ) {
    setSession((current) => ({
      ...current,
      attempts: current.attempts.map((attempt) =>
        attempt.id === attemptId ? updater(attempt) : attempt,
      ),
    }))
  }

  function openImagePicker(mode: 'camera' | 'upload') {
    const input = imageInputRef.current
    if (!input || activeRequest !== null || stage !== 'input') {
      return
    }
    input.value = ''
    pendingUploadSourceRef.current = mode === 'camera' ? 'camera' : 'image'
    if (mode === 'camera') {
      input.setAttribute('accept', 'image/*')
      input.setAttribute('capture', 'environment')
    } else {
      input.setAttribute('accept', 'image/*,application/pdf')
      input.removeAttribute('capture')
    }
    input.click()
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    setErrorMessage(null)
    setNoticeMessage(null)

    if (!selectedFile) {
      clearImage()
      return
    }

    const file = normalizeSelectedFile(selectedFile)

    const uploadError = validateUploadFile(file)
    if (uploadError) {
      clearImage()
      event.target.value = ''
      setErrorMessage(uploadError)
      return
    }

    if (!activeAttempt) {
      return
    }

    if (isPdfFile(file)) {
      await importPdf(file, activeAttempt.id)
      return
    }

    await replacePdfImportSession(null)
    await applyImportedImage(
      activeAttempt.id,
      file,
      {
        sourceType: pendingUploadSourceRef.current,
        originalFileName: file.name,
      },
      file.name,
    )
  }

  async function importPdf(file: File, attemptId: string) {
    setActiveRequest('importing-pdf')
    try {
      const { openPdfImport, renderPdfPageToImage } = await import(
        './pdfImport'
      )
      const pdfSession = await openPdfImport(file)
      await replacePdfImportSession(pdfSession)
      const renderedPage = await renderPdfPageToImage(pdfSession, 1)
      await applyImportedImage(
        attemptId,
        renderedPage.imageFile,
        {
          sourceType: 'pdf',
          originalFileName: file.name,
          pdfPageNumber: 1,
          pdfPageCount: pdfSession.pageCount,
        },
        formatPdfUploadName(file.name, 1, pdfSession.pageCount),
      )
      recordStudyEvent('pdf_imported', {
        attemptNumber,
        pdfPageNumber: 1,
        pdfPageCount: pdfSession.pageCount,
        renderedWidth: renderedPage.renderedWidth,
        renderedHeight: renderedPage.renderedHeight,
      })
    } catch {
      await replacePdfImportSession(null)
      clearImage()
      setErrorMessage(
        "We couldn't read this PDF. Try exporting the note as an image instead.",
      )
    } finally {
      setActiveRequest(null)
    }
  }

  async function handlePdfPageChange(pageNumber: number) {
    const pdfSession = pdfImportSessionRef.current
    if (
      !activeAttempt ||
      !pdfSession ||
      stage !== 'input' ||
      activeRequest !== null
    ) {
      return
    }

    setErrorMessage(null)
    setNoticeMessage(null)
    setActiveRequest('importing-pdf')
    try {
      const { renderPdfPageToImage } = await import('./pdfImport')
      const renderedPage = await renderPdfPageToImage(pdfSession, pageNumber)
      await applyImportedImage(
        activeAttempt.id,
        renderedPage.imageFile,
        {
          sourceType: 'pdf',
          originalFileName: pdfSession.originalFileName,
          pdfPageNumber: pageNumber,
          pdfPageCount: pdfSession.pageCount,
        },
        formatPdfUploadName(
          pdfSession.originalFileName,
          pageNumber,
          pdfSession.pageCount,
        ),
      )
      recordStudyEvent('pdf_page_selected', {
        attemptNumber,
        pdfPageNumber: pageNumber,
        pdfPageCount: pdfSession.pageCount,
      })
    } catch {
      setErrorMessage(
        "We couldn't render this PDF page. Try another page or export the note as an image.",
      )
    } finally {
      setActiveRequest(null)
    }
  }

  async function applyImportedImage(
    attemptId: string,
    file: File,
    source: UploadSource,
    displayName: string,
  ) {
    const currentAttempt = session.attempts.find(
      (attempt) => attempt.id === attemptId,
    )
    revokePreviewUrl(currentAttempt?.imageUrl ?? null)
    const nextPreviewUrl = URL.createObjectURL(file)
    previewUrlsRef.current.add(nextPreviewUrl)
    const nextFingerprint = await createImageFingerprint(file)
    updateAttemptById(attemptId, (attempt) => ({
      ...attempt,
      imageUrl: nextPreviewUrl,
      imageFile: file,
      imageFileName: displayName,
      imageFingerprint: nextFingerprint,
      uploadSource: source,
      interpretation: undefined,
      lineStatuses: {},
      confirmedLines: undefined,
      diagnosis: undefined,
      assistanceState: undefined,
      workedSolution: undefined,
      confirmedSnapshot: undefined,
      contentDirty: false,
      geometryDirty: false,
      completedAt: undefined,
      stage: 'input',
    }))
    const uploadTimestamp = new Date().toISOString()
    studyLogRef.current.metrics.imageUploadTimestamp = uploadTimestamp
    studyLogRef.current.metrics.uploadSource = {
      sourceType: source.sourceType,
      ...(source.pdfPageNumber
        ? { pdfPageNumber: source.pdfPageNumber }
        : {}),
      ...(source.pdfPageCount ? { pdfPageCount: source.pdfPageCount } : {}),
    }
    recordStudyEvent('image_uploaded', {
      attemptNumber,
      timestamp: uploadTimestamp,
      sourceType: source.sourceType,
      ...(source.pdfPageNumber
        ? { pdfPageNumber: source.pdfPageNumber }
        : {}),
      ...(source.pdfPageCount ? { pdfPageCount: source.pdfPageCount } : {}),
    })
    setActiveLineId(null)

    if (previousAttempt?.imageFingerprint === nextFingerprint) {
      setNoticeMessage(
        `This appears to be the same image as Attempt ${previousAttempt.attemptNumber}. You can continue, but the comparison may find no meaningful change.`,
      )
    }
  }

  function clearImage() {
    if (!activeAttempt) {
      return
    }
    void replacePdfImportSession(null)
    revokePreviewUrl(activeAttempt.imageUrl ?? null)
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...createAttempt(attempt.attemptNumber, attempt.id),
      createdAt: attempt.createdAt,
    }))
    setActiveLineId(null)
    setErrorMessage(null)
  }

  async function replacePdfImportSession(next: PdfImportSession | null) {
    const previous = pdfImportSessionRef.current
    pdfImportSessionRef.current = next
    if (previous && previous !== next) {
      const { closePdfImport } = await import('./pdfImport')
      await closePdfImport(previous)
    }
  }

  function revokePreviewUrl(url: string | null) {
    if (!url || !previewUrlsRef.current.has(url)) {
      return
    }

    URL.revokeObjectURL(url)
    previewUrlsRef.current.delete(url)
  }

  function applyProblemChange(problem: PracticeProblem | 'blank') {
    studyLogRef.current.metrics.resetActions += 1
    recordStudyEvent('problem_reset')
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
    void replacePdfImportSession(null)
    setSession(
      createProblemSession(typeof problem === 'object' ? problem : undefined),
    )
    setPendingProblemChange(null)
    setActiveLineId(null)
    setErrorMessage(null)
    setNoticeMessage(null)
    requestAnimationFrame(() => problemInputRef.current?.focus())
  }

  function requestProblemChange(problem: PracticeProblem | 'blank') {
    if (hasAnalyzedAttempts) {
      setPendingProblemChange(problem)
      return
    }
    applyProblemChange(problem)
  }

  function handleProblemSelection(problemId: string) {
    if (problemId === 'custom') {
      requestProblemChange('blank')
      return
    }

    const problem = problemBank.find((candidate) => candidate.id === problemId)
    if (problem) {
      requestProblemChange(problem)
    }
  }

  function pickAnotherProblem() {
    const choices = problemBank.filter(
      (problem) => problem.id !== session.problemId,
    )
    if (choices.length === 0) {
      setNoticeMessage('No other reviewed practice problem is available.')
      return
    }
    const nextProblem = choices[Math.floor(Math.random() * choices.length)]
    requestProblemChange(nextProblem)
  }

  function updateProblemStatement(statement: string) {
    setSession((current) => ({
      ...current,
      problemStatement: statement,
    }))
    setErrorMessage(null)
  }

  function startActiveAttemptOver() {
    if (!activeAttempt) {
      return
    }
    revokePreviewUrl(activeAttempt.imageUrl ?? null)
    void replacePdfImportSession(null)
    studyLogRef.current.metrics.resetActions += 1
    recordStudyEvent('attempt_reset', { attemptNumber })
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...createAttempt(attempt.attemptNumber, attempt.id),
      createdAt: attempt.createdAt,
    }))
    setActiveLineId(null)
    setErrorMessage(null)
    setNoticeMessage(null)
  }

  function tryAgain() {
    if (!feedback) {
      return
    }
    const nextAttempt = createAttempt(session.attempts.length + 1)
    void replacePdfImportSession(null)
    studyLogRef.current.metrics.revisions += 1
    recordStudyEvent('revision_started', {
      attemptNumber: nextAttempt.attemptNumber,
    })
    setSession((current) => ({
      ...current,
      attempts: [...current.attempts, nextAttempt],
      activeAttemptId: nextAttempt.id,
    }))
    setActiveLineId(null)
    setErrorMessage(null)
    setNoticeMessage(
      `Upload revised handwritten work for Attempt ${nextAttempt.attemptNumber}.`,
    )
  }

  function selectAttempt(attemptId: string) {
    if (activeRequest) {
      return
    }
    setSession((current) => ({
      ...current,
      activeAttemptId: attemptId,
    }))
    setActiveLineId(null)
    setErrorMessage(null)
    setNoticeMessage(null)
  }

  async function handleInterpret() {
    setErrorMessage(null)

    if (!problemStatement.trim()) {
      setErrorMessage('Add a physics problem statement before interpreting.')
      return
    }

    if (!activeAttempt || !imageFile) {
      setErrorMessage('Upload an image or PDF before interpreting.')
      return
    }

    const imageError = validateUploadFile(imageFile)
    if (imageError) {
      setErrorMessage(imageError)
      return
    }

    const attemptId = activeAttempt.id
    const interpretationStartedAt = performance.now()
    setActiveRequest('interpreting')

    try {
      const imageBase64 = await readFileAsBase64(imageFile)
      const response = await fetch('/api/interpret-solution', {
        method: 'POST',
        headers: createApiHeaders(apiKey),
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
        isRecord(payload) && 'interpretation' in payload
          ? payload.interpretation
          : payload
      const nextInterpretation = validateInterpretedSolution(responseData)
      const interpretationDurationMs = Math.round(
        performance.now() - interpretationStartedAt,
      )
      const uncertainLineCount =
        nextInterpretation.lines.filter(lineNeedsConfirmation).length
      studyLogRef.current.metrics.interpretationDurationMs +=
        interpretationDurationMs
      studyLogRef.current.metrics.interpretedLines =
        nextInterpretation.lines.length
      studyLogRef.current.metrics.uncertainLines = uncertainLineCount
      recordStudyEvent('interpretation_completed', {
        durationMs: interpretationDurationMs,
        lines: nextInterpretation.lines.length,
        uncertainLines: uncertainLineCount,
      })

      updateAttemptById(attemptId, (attempt) => ({
        ...attempt,
        interpretation: nextInterpretation,
        lineStatuses: createInitialLineStatuses(nextInterpretation),
        confirmedLines: undefined,
        diagnosis: undefined,
        assistanceState: undefined,
        workedSolution: undefined,
        confirmedSnapshot: undefined,
        contentDirty: false,
        geometryDirty: false,
        completedAt: undefined,
        stage: 'interpretation',
      }))
    } catch (error) {
      studyLogRef.current.metrics.apiFailures += 1
      recordStudyEvent('api_failure', { stage: 'interpretation' })
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'AI analysis failed. Please try again.',
      )
    } finally {
      setActiveRequest(null)
    }
  }

  function updateInterpretationLine(lineId: string, confirmedText: string) {
    if (!activeAttempt) {
      return
    }
    const studyEditKey = `${activeAttempt.id}:${lineId}`
    if (!studyEditedLinesRef.current.has(studyEditKey)) {
      studyEditedLinesRef.current.add(studyEditKey)
      studyLogRef.current.metrics.transcriptionEdits += 1
      recordStudyEvent('transcription_edited')
    }
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...attempt,
      interpretation: attempt.interpretation
        ? {
            ...attempt.interpretation,
            lines: attempt.interpretation.lines.map((line) =>
              line.id === lineId ? { ...line, confirmedText } : line,
            ),
          }
        : undefined,
      lineStatuses: {
        ...attempt.lineStatuses,
        [lineId]: 'needs_correction',
      },
      contentDirty: true,
    }))
  }

  function updateInterpretationWorkStatus(
    lineId: string,
    workStatus: Exclude<HandwritingWorkStatus, 'unclear'>,
  ) {
    if (!activeAttempt) {
      return
    }
    studyLogRef.current.metrics.crossedOutStatusCorrections += 1
    recordStudyEvent('crossed_out_status_corrected')
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...attempt,
      interpretation: attempt.interpretation
        ? {
            ...attempt.interpretation,
            lines: attempt.interpretation.lines.map((line) =>
              line.id === lineId
                ? {
                    ...line,
                    workStatus,
                    workStatusConfidence: 1,
                    crossedOutEvidence:
                      workStatus === 'active'
                        ? undefined
                        : 'Status confirmed by the student.',
                  }
                : line,
            ),
          }
        : undefined,
      lineStatuses: {
        ...attempt.lineStatuses,
        [lineId]: 'needs_correction',
      },
      contentDirty: true,
    }))
  }

  function resetInterpretationEdits() {
    if (!activeAttempt || !interpretation) {
      return
    }
    studyLogRef.current.metrics.resetActions += 1
    recordStudyEvent('interpretation_edits_reset')
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...attempt,
      interpretation: attempt.interpretation
        ? {
            ...attempt.interpretation,
            lines: attempt.interpretation.lines.map((line) => ({
              ...line,
              confirmedText: line.rawText,
            })),
          }
        : undefined,
      lineStatuses: createInitialLineStatuses(interpretation),
      contentDirty: true,
    }))
  }

  function updateInterpretationRegion(
    lineId: string,
    region: InterpretationRegion,
    commit: boolean,
  ) {
    if (!activeAttempt) {
      return
    }
    updateAttemptById(activeAttempt.id, (attempt) => {
      if (!attempt.interpretation) {
        return attempt
      }
      const updatedLines = attempt.interpretation.lines.map((line) =>
        line.id === lineId
          ? { ...line, region: clampInterpretationRegion(region) }
          : line,
      )
      const nextLines = commit
        ? sortInterpretationLines(updatedLines)
        : updatedLines
      const orderChanged = nextLines.some(
        (line, index) => line.id !== attempt.interpretation?.lines[index]?.id,
      )

      return {
        ...attempt,
        interpretation: {
          ...attempt.interpretation,
          lines: nextLines,
        },
        contentDirty: attempt.contentDirty || orderChanged,
        geometryDirty: true,
      }
    })
  }

  function addInterpretationRegion(region: InterpretationRegion) {
    if (!activeAttempt || !interpretation) {
      return
    }
    const line = createManualInterpretationLine(
      region,
      crypto.randomUUID(),
      interpretation.lines.length + 1,
    )
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...attempt,
      interpretation: attempt.interpretation
        ? {
            ...attempt.interpretation,
            lines: sortInterpretationLines([
              ...attempt.interpretation.lines,
              line,
            ]),
          }
        : undefined,
      lineStatuses: {
        ...attempt.lineStatuses,
        [line.id]: 'needs_correction',
      },
      contentDirty: true,
      geometryDirty: true,
    }))
    setActiveLineId(line.id)
  }

  function deleteInterpretationLine(lineId: string) {
    if (!activeAttempt) {
      return
    }
    updateAttemptById(activeAttempt.id, (attempt) => {
      if (!attempt.interpretation) {
        return attempt
      }
      const nextStatuses = { ...attempt.lineStatuses }
      delete nextStatuses[lineId]
      return {
        ...attempt,
        interpretation: {
          ...attempt.interpretation,
          lines: sortInterpretationLines(
            attempt.interpretation.lines.filter((line) => line.id !== lineId),
          ),
        },
        lineStatuses: nextStatuses,
        contentDirty: true,
        geometryDirty: true,
      }
    })
    setActiveLineId((current) => (current === lineId ? null : current))
  }

  function restoreInterpretationLine(
    line: InterpretedLine,
    status: LineReviewStatus | undefined,
  ) {
    if (!activeAttempt) {
      return
    }
    updateAttemptById(activeAttempt.id, (attempt) => ({
      ...attempt,
      interpretation: attempt.interpretation
        ? {
            ...attempt.interpretation,
            lines: sortInterpretationLines([
              ...attempt.interpretation.lines,
              line,
            ]),
          }
        : undefined,
      lineStatuses: {
        ...attempt.lineStatuses,
        [line.id]: status,
      },
      contentDirty: true,
      geometryDirty: true,
    }))
    setActiveLineId(line.id)
  }

  function mergeInterpretationRegion(lineId: string, otherLineId: string) {
    if (!activeAttempt || !interpretation) {
      return
    }
    const merged = mergeInterpretationLines(
      interpretation.lines,
      lineId,
      otherLineId,
      crypto.randomUUID(),
    )
    if (!merged) {
      return
    }
    updateAttemptById(activeAttempt.id, (attempt) => {
      const nextStatuses = { ...attempt.lineStatuses }
      delete nextStatuses[lineId]
      delete nextStatuses[otherLineId]
      nextStatuses[merged.mergedLine.id] = 'needs_correction'
      return {
        ...attempt,
        interpretation: attempt.interpretation
          ? { ...attempt.interpretation, lines: merged.lines }
          : undefined,
        lineStatuses: nextStatuses,
        contentDirty: true,
        geometryDirty: true,
      }
    })
    setActiveLineId(merged.mergedLine.id)
  }

  async function handleContinueToFeedback() {
    if (!activeAttempt || !interpretation) {
      return
    }

    if (interpretation.lines.length === 0) {
      setErrorMessage('At least one interpreted step is required.')
      return
    }

    const orderedLines = sortInterpretationLines(interpretation.lines)
    const unresolvedLine = orderedLines.find(
      (line) =>
        !lineStatuses[line.id] || line.confirmedText.trim().length === 0,
    )
    if (unresolvedLine) {
      setErrorMessage(
        `Review line ${unresolvedLine.order} before continuing to feedback.`,
      )
      return
    }

    const nextConfirmedLines = orderedLines.map((line) => ({
      ...line,
      rawText: line.rawText.trim() ? line.rawText : line.confirmedText,
      status: lineStatuses[line.id] as LineReviewStatus,
    }))
    const nextSnapshot =
      createConfirmedTranscriptionSnapshot(nextConfirmedLines)
    const attemptId = activeAttempt.id
    updateAttemptById(attemptId, (attempt) => ({
      ...attempt,
      confirmedLines: nextConfirmedLines,
    }))
    setErrorMessage(null)

    if (feedback && diagnosedTranscriptionSnapshot === nextSnapshot) {
      updateAttemptById(attemptId, (attempt) => ({
        ...attempt,
        confirmedLines: nextConfirmedLines,
        diagnosis: attempt.geometryDirty
          ? reanchorFeedbackToInterpretation(feedback, orderedLines)
          : feedback,
        confirmedSnapshot: nextSnapshot,
        contentDirty: false,
        geometryDirty: false,
        stage: 'feedback',
      }))
      return
    }

    const isNewRevisionAttempt = Boolean(
      !feedback &&
        previousAttempt?.diagnosis &&
        previousAttempt.confirmedSnapshot,
    )
    const meaningfulRevision = Boolean(
      isNewRevisionAttempt &&
        previousAttempt?.confirmedSnapshot !== nextSnapshot,
    )
    const priorAssistance = isNewRevisionAttempt
      ? previousAttempt?.assistanceState ??
        (previousAttempt?.diagnosis
          ? updateAssistanceState({
              feedback: previousAttempt.diagnosis,
              meaningfulRevision: false,
            })
          : undefined)
      : activeAttempt.assistanceState
    const requestedFeedbackLevel = getRequestedFeedbackLevel(
      priorAssistance,
      meaningfulRevision,
    )

    const diagnosisStartedAt = performance.now()
    setActiveRequest('diagnosing')

    try {
      if (!imageFile) {
        throw new Error('The original image is no longer available.')
      }

      const imageBase64 = await readFileAsBase64(imageFile)
      const response = await fetch('/api/diagnose-solution', {
        method: 'POST',
        headers: createApiHeaders(apiKey),
        body: JSON.stringify({
          problemStatement,
          image: {
            base64: imageBase64,
            mimeType: imageFile.type,
            filename: imageFile.name,
          },
          confirmedLines: nextConfirmedLines,
          feedbackLevel: requestedFeedbackLevel,
        }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : 'Physics feedback could not be prepared. Please try again.'
        throw new Error(message)
      }

      const responseData =
        isRecord(payload) && 'feedback' in payload ? payload.feedback : payload
      const nextFeedback = validateFeedbackResult(responseData)
      const assistanceComparison =
        isNewRevisionAttempt &&
        previousAttempt?.diagnosis &&
        previousAttempt.confirmedLines
          ? compareRevisions(
              previousAttempt.diagnosis,
              nextFeedback,
              previousAttempt.confirmedLines,
              nextConfirmedLines,
            )
          : null
      const nextAssistanceState = {
        ...updateAssistanceState({
          previous: priorAssistance,
          feedback: nextFeedback,
          comparison: assistanceComparison,
          meaningfulRevision,
        }),
        workedSolutionRevealed: false,
      }
      const diagnosisDurationMs = Math.round(
        performance.now() - diagnosisStartedAt,
      )
      const vectorMetrics = getVectorMetrics(nextFeedback)
      studyLogRef.current.metrics.diagnosisDurationMs += diagnosisDurationMs
      studyLogRef.current.metrics.feedbackLevelShown =
        nextAssistanceState.feedbackLevel
      studyLogRef.current.metrics.coreIssueResolved =
        assistanceComparison?.originalIssueResolved === 'yes'
      studyLogRef.current.metrics.workedSolutionUnlocked =
        nextAssistanceState.workedSolutionUnlocked
      studyLogRef.current.metrics.vectorAnnotationsProposed +=
        vectorMetrics.proposed
      studyLogRef.current.metrics.vectorAnnotationsRendered +=
        vectorMetrics.rendered
      studyLogRef.current.metrics.textOnlyVectorFallbacks +=
        vectorMetrics.textOnlyFallbacks
      recordStudyEvent('diagnosis_completed', {
        durationMs: diagnosisDurationMs,
        feedbackLevel: nextAssistanceState.feedbackLevel,
        workedSolutionUnlocked:
          nextAssistanceState.workedSolutionUnlocked,
        vectorsProposed: vectorMetrics.proposed,
        vectorsRendered: vectorMetrics.rendered,
      })
      updateAttemptById(attemptId, (attempt) => ({
        ...attempt,
        confirmedLines: nextConfirmedLines,
        diagnosis: nextFeedback,
        assistanceState: nextAssistanceState,
        workedSolution: undefined,
        confirmedSnapshot: nextSnapshot,
        contentDirty: false,
        geometryDirty: false,
        stage: 'feedback',
        completedAt: new Date().toISOString(),
      }))
    } catch (error) {
      studyLogRef.current.metrics.apiFailures += 1
      recordStudyEvent('api_failure', { stage: 'diagnosis' })
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Physics feedback could not be prepared. Please try again.',
      )
    } finally {
      setActiveRequest(null)
    }
  }

  async function handleGenerateWorkedSolution() {
    if (
      !activeAttempt ||
      !feedback ||
      confirmedLines.length === 0 ||
      !assistanceState.workedSolutionUnlocked
    ) {
      return
    }

    setWorkedSolutionConfirmationOpen(false)
    setErrorMessage(null)
    setActiveRequest('worked-solution')

    try {
      const response = await fetch('/api/generate-worked-solution', {
        method: 'POST',
        headers: createApiHeaders(apiKey),
        body: JSON.stringify({
          problemStatement,
          confirmedLines,
          currentDiagnosis: feedback,
          revisionHistorySummary: createRevisionHistorySummary(
            session.attempts,
          ),
          diagramInterpretation: createDiagramInterpretation(feedback),
          attemptsForCurrentIssue:
            assistanceState.attemptsForCurrentIssue,
          workedSolutionUnlocked:
            assistanceState.workedSolutionUnlocked,
        }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : 'The worked solution could not be prepared. Please try again.'
        throw new Error(message)
      }

      const responseData =
        isRecord(payload) && 'workedSolution' in payload
          ? payload.workedSolution
          : payload
      const nextWorkedSolution = validateWorkedSolution(responseData)
      studyLogRef.current.metrics.workedSolutionRevealed = true
      recordStudyEvent('worked_solution_revealed')
      updateAttemptById(activeAttempt.id, (attempt) => ({
        ...attempt,
        workedSolution: nextWorkedSolution,
        assistanceState: {
          ...(attempt.assistanceState ?? assistanceState),
          workedSolutionRevealed: true,
        },
      }))
    } catch (error) {
      studyLogRef.current.metrics.apiFailures += 1
      recordStudyEvent('api_failure', { stage: 'worked_solution' })
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The worked solution could not be prepared. Please try again.',
      )
    } finally {
      setActiveRequest(null)
    }
  }

  const revisionComparison =
    previousAttempt?.diagnosis &&
    previousAttempt.confirmedLines &&
    feedback
      ? compareRevisions(
          previousAttempt.diagnosis,
          feedback,
          previousAttempt.confirmedLines,
          confirmedLines,
        )
      : null

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-title">
          <h1>Handwritten Physics Feedback</h1>
          <p className="subtitle">
            Upload a handwritten solution and get revision-oriented feedback.
          </p>
        </div>
        <div className="api-key-menu" ref={apiKeyMenuRef}>
          <button
            aria-expanded={apiKeyMenuOpen}
            aria-haspopup="dialog"
            aria-label="Open settings menu"
            className="menu-button"
            onClick={() => {
              setApiKeyDraft(apiKey)
              setApiKeyMenuOpen((open) => !open)
            }}
            title="Settings"
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          {apiKeyMenuOpen && (
            <section
              aria-label="API key settings"
              className="api-key-panel"
              role="dialog"
            >
              <div className="api-key-panel-heading">
                <div>
                  <h2>API key</h2>
                  <p>{apiKey ? 'A browser key is set.' : 'No browser key set.'}</p>
                </div>
                <button
                  aria-label="Close settings"
                  className="close-menu-button"
                  onClick={() => setApiKeyMenuOpen(false)}
                  type="button"
                >
                  &times;
                </button>
              </div>
              <label htmlFor="openai-api-key">OpenAI API key</label>
              <input
                autoComplete="off"
                id="openai-api-key"
                onChange={(event) => setApiKeyDraft(event.target.value)}
                placeholder="sk-..."
                spellCheck={false}
                type="password"
                value={apiKeyDraft}
              />
              <p className="api-key-safety">
                Stored only for this browser tab and sent to this app's
                backend when you analyze work. Use only on a trusted copy of
                the project.
              </p>
              <div className="api-key-actions">
                {apiKey && (
                  <button
                    className="remove-api-key-button"
                    onClick={removeApiKey}
                    type="button"
                  >
                    Remove key
                  </button>
                )}
                <button
                  className="save-api-key-button"
                  onClick={saveApiKey}
                  type="button"
                >
                  Save for this tab
                </button>
              </div>
              {studyModeEnabled && (
                <button
                  className="export-study-log-button"
                  onClick={exportStudyLog}
                  type="button"
                >
                  Export session log
                </button>
              )}
            </section>
          )}
        </div>
      </header>

      <section className="workspace" aria-label="Physics feedback workspace">
        <section className="input-panel" aria-labelledby="input-heading">
          <div className="panel-heading">
            <p className="section-kicker">
              Attempt {attemptNumber} | Student work
            </p>
            <h2 id="input-heading">Problem and upload</h2>
          </div>

          <div className="problem-picker">
            <label htmlFor="practice-problem">Choose a practice problem</label>
            <select
              id="practice-problem"
              value={session.problemId ?? 'custom'}
              onChange={(event) => handleProblemSelection(event.target.value)}
              disabled={activeRequest !== null}
            >
              <option value="custom">Custom problem</option>
              {problemBank.map((problem) => (
                <option key={problem.id} value={problem.id}>
                  {problem.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={pickAnotherProblem}
              disabled={activeRequest !== null}
            >
              Pick another
            </button>
          </div>

          {studyModeEnabled && (
            <label className="study-task-field" htmlFor="study-task-id">
              Study task ID
              <input
                id="study-task-id"
                onChange={(event) => setStudyTaskId(event.target.value)}
                placeholder={session.problemId ?? 'task-id'}
                value={studyTaskId}
              />
            </label>
          )}

          <label className="field-label" htmlFor="problem-statement">
            Problem statement
          </label>
          <textarea
            id="problem-statement"
            value={problemStatement}
            onChange={(event) => updateProblemStatement(event.target.value)}
            disabled={problemLocked || activeRequest !== null}
            ref={problemInputRef}
            rows={7}
          />

          <div className="image-source-picker">
            <span className="upload-title">
              {attemptNumber > 1
                ? 'Upload revised handwritten solution'
                : 'Add handwritten solution'}
            </span>
            <span className="upload-detail">
              {imageName || 'Choose a JPG, PNG, WEBP, or PDF file'}
            </span>
            <div className="image-source-actions">
              <button
                disabled={stage !== 'input' || activeRequest !== null}
                onClick={() => openImagePicker('camera')}
                type="button"
              >
                Take photo
              </button>
              <button
                disabled={stage !== 'input' || activeRequest !== null}
                onClick={() => openImagePicker('upload')}
                type="button"
              >
                Upload image or PDF
              </button>
            </div>
            <span className="upload-app-hint">
              From Samsung Notes, export your handwritten page as an image or
              PDF, then upload it here.
            </span>
            {uploadSource?.sourceType === 'pdf' &&
              uploadSource.pdfPageCount !== undefined &&
              uploadSource.pdfPageCount > 1 && (
                <label className="pdf-page-picker" htmlFor="pdf-page-number">
                  Which page contains your solution?
                  <select
                    disabled={stage !== 'input' || activeRequest !== null}
                    id="pdf-page-number"
                    onChange={(event) =>
                      void handlePdfPageChange(Number(event.target.value))
                    }
                    value={uploadSource.pdfPageNumber ?? 1}
                  >
                    {Array.from(
                      { length: uploadSource.pdfPageCount },
                      (_, index) => index + 1,
                    ).map((pageNumber) => (
                      <option key={pageNumber} value={pageNumber}>
                        Page {pageNumber}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            <input
              aria-label="Choose handwritten solution image or PDF"
              className="image-file-input"
              id="solution-image"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleImageChange}
              disabled={stage !== 'input' || activeRequest !== null}
              ref={imageInputRef}
            />
          </div>

          <p className="privacy-notice">
            This research prototype sends the selected image page and problem
            statement to an external AI service for analysis. PDFs are rendered
            in your browser first. Do not upload sensitive or personally
            identifying information.
          </p>

          {errorMessage && (
            <div className="error-message" role="alert">
              {errorMessage}
            </div>
          )}

          {noticeMessage && (
            <div className="notice-message" role="status">
              {noticeMessage}
            </div>
          )}

          <button
            className="analyze-button"
            type="button"
            onClick={handleInterpret}
            disabled={
              activeRequest !== null ||
              stage !== 'input' ||
              !problemStatement.trim()
            }
          >
            {activeRequest === 'interpreting'
              ? 'Interpreting handwriting...'
              : 'Interpret handwriting'}
          </button>

          {!feedback && (
            <button
              className="reset-session-button"
              type="button"
              onClick={startActiveAttemptOver}
              disabled={activeRequest !== null}
            >
              Start this attempt over
            </button>
          )}

          <button
            className="different-problem-button"
            type="button"
            onClick={() => requestProblemChange('blank')}
            disabled={activeRequest !== null}
          >
            Try a different problem
          </button>

          <div
            aria-hidden={!activeRequest}
            aria-live="polite"
            className={`loading-message ${activeRequest ? '' : 'idle'}`}
          >
            {activeRequest === 'interpreting'
              ? 'Reading your handwriting...'
              : activeRequest === 'importing-pdf'
                ? 'Preparing the selected PDF page...'
              : activeRequest === 'worked-solution'
                ? 'Preparing a worked solution...'
                : activeRequest === 'diagnosing' && attemptNumber > 1
                  ? 'Comparing your revision...'
                  : activeRequest === 'diagnosing'
                    ? 'Checking the physics reasoning...'
                    : 'Analysis status'}
          </div>

          <div className="preview-area">
            <div className="preview-frame">
              {imagePreviewUrl ? (
                <>
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded handwritten solution"
                  />
                  <div
                    aria-hidden="true"
                    className="preview-bottom-space"
                  />
                </>
              ) : (
                <div className="empty-preview">Image preview will appear here</div>
              )}
            </div>
          </div>
        </section>

        <section className="feedback-panel" aria-labelledby="feedback-heading">
          <div className="panel-heading">
            <p className="section-kicker">Feedback</p>
            <h2 id="feedback-heading">Revision notes</h2>
          </div>

          <div className="workflow-progress" aria-label="Analysis progress">
            <span className={stage === 'input' ? 'current' : 'complete'}>
              1 Interpret
            </span>
            <span
              className={
                stage === 'interpretation'
                  ? 'current'
                  : stage === 'feedback'
                    ? 'complete'
                    : ''
              }
            >
              2 Confirm
            </span>
            <span className={stage === 'feedback' ? 'current' : ''}>
              3 Feedback
            </span>
          </div>

          <AttemptHistory
            activeAttemptId={activeAttempt?.id ?? null}
            attempts={session.attempts}
            disabled={activeRequest !== null}
            onSelect={selectAttempt}
          />

          {stage === 'feedback' && feedback && interpretation ? (
            <FeedbackPanel
              activeLineId={activeLineId}
              assistanceState={assistanceState}
              key={activeAttempt?.id}
              comparison={revisionComparison}
              feedback={feedback}
              imagePreviewUrl={imagePreviewUrl}
              isAnalyzing={activeRequest !== null}
              isPreparingWorkedSolution={
                activeRequest === 'worked-solution'
              }
              interpretation={interpretation}
              confirmedLines={confirmedLines}
              originalFeedback={previousAttempt?.diagnosis}
              workedSolution={workedSolution}
              onRequestWorkedSolution={() =>
                setWorkedSolutionConfirmationOpen(true)
              }
              onTryAgain={tryAgain}
              onTryDifferentProblem={() => requestProblemChange('blank')}
              onReviewInterpretation={() => {
                setErrorMessage(null)
                if (activeAttempt) {
                  updateAttemptById(activeAttempt.id, (attempt) => ({
                    ...attempt,
                    stage: 'interpretation',
                  }))
                }
              }}
              onSelectedLineChange={setActiveLineId}
            />
          ) : stage === 'interpretation' && interpretation ? (
            <ConfirmationWorkspace
              key={activeAttempt?.id}
              activeLineId={activeLineId}
              imagePreviewUrl={imagePreviewUrl}
              interpretation={interpretation}
              isDiagnosing={activeRequest === 'diagnosing'}
              lineStatuses={lineStatuses}
              onAddRegion={addInterpretationRegion}
              onActiveLineChange={setActiveLineId}
              onContinue={handleContinueToFeedback}
              onDeleteLine={deleteInterpretationLine}
              onEditLine={updateInterpretationLine}
              onMergeLine={mergeInterpretationRegion}
              onRegionChange={updateInterpretationRegion}
              onReset={resetInterpretationEdits}
              onRestoreLine={restoreInterpretationLine}
              onStatusChange={(lineId, status) =>
                activeAttempt &&
                updateAttemptById(activeAttempt.id, (attempt) => ({
                  ...attempt,
                  lineStatuses: {
                    ...attempt.lineStatuses,
                    [lineId]: status,
                  },
                  contentDirty: true,
                }))
              }
              onWorkStatusChange={updateInterpretationWorkStatus}
            />
          ) : (
            <div className="feedback-empty">
              Interpret the handwriting first. You will check the transcription
              before any physics feedback appears.
            </div>
          )}
        </section>
      </section>
      {pendingProblemChange && (
        <div className="confirmation-backdrop">
          <section
            aria-labelledby="different-problem-title"
            aria-modal="true"
            className="confirmation-dialog"
            role="dialog"
          >
            <h2 id="different-problem-title">Start a different problem?</h2>
            <p>
              This will clear the current problem and all attempt history.
            </p>
            <div>
              <button
                type="button"
                onClick={() => {
                  studyLogRef.current.metrics.cancelActions += 1
                  recordStudyEvent('problem_change_cancelled')
                  setPendingProblemChange(null)
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-clear-button"
                type="button"
                onClick={() => applyProblemChange(pendingProblemChange)}
              >
                Start different problem
              </button>
            </div>
          </section>
        </div>
      )}
      {workedSolutionConfirmationOpen && (
        <div className="confirmation-backdrop">
          <section
            aria-labelledby="worked-solution-confirmation-title"
            aria-modal="true"
            className="confirmation-dialog"
            role="dialog"
          >
            <h2 id="worked-solution-confirmation-title">
              View the worked solution?
            </h2>
            <p>This will show the complete reasoning and answer.</p>
            <div>
              <button
                onClick={() => {
                  studyLogRef.current.metrics.cancelActions += 1
                  recordStudyEvent('worked_solution_cancelled')
                  setWorkedSolutionConfirmationOpen(false)
                }}
                type="button"
              >
                Keep revising
              </button>
              <button
                className="confirm-worked-solution-button"
                onClick={handleGenerateWorkedSolution}
                type="button"
              >
                Show complete solution
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function ConfirmationWorkspace({
  interpretation,
  imagePreviewUrl,
  lineStatuses,
  activeLineId,
  isDiagnosing,
  onEditLine,
  onAddRegion,
  onDeleteLine,
  onMergeLine,
  onRegionChange,
  onRestoreLine,
  onStatusChange,
  onWorkStatusChange,
  onActiveLineChange,
  onReset,
  onContinue,
}: {
  interpretation: InterpretedSolution
  imagePreviewUrl: string | null
  lineStatuses: Record<string, LineReviewStatus | undefined>
  activeLineId: string | null
  isDiagnosing: boolean
  onEditLine: (lineId: string, text: string) => void
  onAddRegion: (region: InterpretationRegion) => void
  onDeleteLine: (lineId: string) => void
  onMergeLine: (lineId: string, otherLineId: string) => void
  onRegionChange: (
    lineId: string,
    region: InterpretationRegion,
    commit: boolean,
  ) => void
  onRestoreLine: (
    line: InterpretedLine,
    status: LineReviewStatus | undefined,
  ) => void
  onStatusChange: (lineId: string, status: LineReviewStatus) => void
  onWorkStatusChange: (
    lineId: string,
    status: Exclude<HandwritingWorkStatus, 'unclear'>,
  ) => void
  onActiveLineChange: (lineId: string | null) => void
  onReset: () => void
  onContinue: () => void
}) {
  const [reviewAllLines, setReviewAllLines] = useState(false)
  const [manualReviewIds, setManualReviewIds] = useState<Set<string>>(
    () => new Set(),
  )
  const lineElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const lineInputsRef = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const undoTimerRef = useRef<number | null>(null)
  const [deletedLine, setDeletedLine] = useState<{
    line: InterpretedLine
    status: LineReviewStatus | undefined
  } | null>(null)
  const sortedLines = sortLinesByOrder(interpretation.lines)
  const linesNeedingReview = sortedLines.filter(lineNeedsConfirmation)
  const unresolvedLines = linesNeedingReview.filter(
    (line) => !lineStatuses[line.id],
  )
  const automaticallyAccepted =
    sortedLines.length - linesNeedingReview.length
  const allReviewed =
    sortedLines.length > 0 &&
    unresolvedLines.length === 0 &&
    sortedLines.every((line) => line.confirmedText.trim().length > 0)
  const activeLine = activeLineId
    ? sortedLines.find((line) => line.id === activeLineId)
    : undefined
  const activeLineExists = Boolean(activeLine)
  const activeLineHasEditor = Boolean(
    activeLine &&
      (reviewAllLines ||
        lineNeedsConfirmation(activeLine) ||
        manualReviewIds.has(activeLine.id)),
  )

  function selectLineForEditing(lineId: string) {
    setManualReviewIds((current) => {
      if (current.has(lineId)) {
        return current
      }
      const next = new Set(current)
      next.add(lineId)
      return next
    })
    onActiveLineChange(lineId)
  }

  useEffect(() => {
    if (!activeLineId || !activeLineExists || !activeLineHasEditor) {
      return
    }

    const frame = requestAnimationFrame(() => {
      lineElementsRef.current
        .get(activeLineId)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      const input = lineInputsRef.current.get(activeLineId)
      input?.focus({ preventScroll: true })
      if (input) {
        input.setSelectionRange(input.value.length, input.value.length)
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [activeLineExists, activeLineHasEditor, activeLineId])

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current)
      }
    },
    [],
  )

  function deleteLine(line: InterpretedLine) {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current)
    }
    setDeletedLine({ line, status: lineStatuses[line.id] })
    onDeleteLine(line.id)
    undoTimerRef.current = window.setTimeout(() => {
      setDeletedLine(null)
      undoTimerRef.current = null
    }, 7000)
  }

  function undoDelete() {
    if (!deletedLine) {
      return
    }
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    onRestoreLine(deletedLine.line, deletedLine.status)
    setDeletedLine(null)
  }

  return (
    <div className="confirmation-workspace">
      <InterpretationImageView
        activeLineId={activeLineId}
        imageUrl={imagePreviewUrl}
        lines={sortedLines}
        onAddRegion={onAddRegion}
        onActiveLineChange={(lineId) =>
          lineId ? selectLineForEditing(lineId) : onActiveLineChange(null)
        }
        onRegionChange={onRegionChange}
      />

      <section className="confirmation-panel" aria-labelledby="confirmation-title">
        <div className="confirmation-heading">
          <div>
            <p className="section-kicker">Interpretation only</p>
            <h2 id="confirmation-title">Check what the AI read</h2>
          </div>
          <span>{formatPercent(interpretation.overallConfidence)} overall</span>
        </div>

        <div className="confirmation-summary">
          <span>
            <strong>{sortedLines.length}</strong> lines interpreted
          </span>
          <span className={unresolvedLines.length > 0 ? 'needs-review' : ''}>
            <strong>{unresolvedLines.length}</strong> need your review
          </span>
          <span>
            <strong>{automaticallyAccepted}</strong> accepted automatically
          </span>
        </div>

        <div className="confirmation-toolbar">
          <button
            type="button"
            onClick={() => {
              setReviewAllLines(false)
              onActiveLineChange(unresolvedLines[0]?.id ?? null)
            }}
          >
            Review uncertain lines
          </button>
          <button type="button" onClick={() => setReviewAllLines(true)}>
            Edit any line
          </button>
          <button
            className={reviewAllLines ? 'active' : ''}
            type="button"
            onClick={() => setReviewAllLines((value) => !value)}
          >
            {reviewAllLines ? 'Review all: on' : 'Review all lines'}
          </button>
        </div>

        <div className="confirmation-lines">
          {sortedLines.map((line, index) => {
            const showConfidence =
              line.confidence < 0.85 ||
              (line.uncertainSymbols?.length ?? 0) > 0
            const status = lineStatuses[line.id]
            const requiresReview = lineNeedsConfirmation(line)
            const requiresCrossOutReview =
              line.workStatus === 'unclear' ||
              line.workStatusConfidence < 0.8
            const showControls =
              reviewAllLines ||
              requiresReview ||
              manualReviewIds.has(line.id)
            const previousLine = sortedLines[index - 1]
            const nextLine = sortedLines[index + 1]

            return (
              <article
                className={`confirmation-line ${
                  activeLineId === line.id ? 'active' : ''
                } ${requiresReview ? 'requires-review' : 'auto-accepted'} work-status-${
                  line.workStatus
                }`}
                key={line.id}
                onClick={() => selectLineForEditing(line.id)}
                ref={(element) => {
                  if (element) {
                    lineElementsRef.current.set(line.id, element)
                  } else {
                    lineElementsRef.current.delete(line.id)
                  }
                }}
              >
                <div className="confirmation-line-meta">
                  <span className="interpretation-line-number">
                    {index + 1}
                  </span>
                  <span
                    className={`work-status-chip status-${line.workStatus}`}
                  >
                    {workStatusLabels[line.workStatus]}
                  </span>
                  {showConfidence && (
                    <span className="interpretation-confidence">
                      {formatPercent(line.confidence)} read confidence
                    </span>
                  )}
                  {!line.region && (
                    <span className="unlocated-chip">Location uncertain</span>
                  )}
                  {!requiresReview && (
                    <span className="auto-accepted-chip">
                      Accepted automatically
                    </span>
                  )}
                </div>

                {showControls ? (
                  <>
                    <label htmlFor={`confirmed-${line.id}`}>
                      What this line says
                    </label>
                    <textarea
                      id={`confirmed-${line.id}`}
                      rows={2}
                      value={line.confirmedText}
                      onChange={(event) =>
                        onEditLine(line.id, event.target.value)
                      }
                      onFocus={() => onActiveLineChange(line.id)}
                      ref={(element) => {
                        if (element) {
                          lineInputsRef.current.set(line.id, element)
                        } else {
                          lineInputsRef.current.delete(line.id)
                        }
                      }}
                    />
                  </>
                ) : (
                  <div className="accepted-line-text">
                    <p>{line.confirmedText}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setManualReviewIds((current) =>
                          new Set(current).add(line.id),
                        )
                      }
                    >
                      Edit
                    </button>
                  </div>
                )}

                {line.uncertainSymbols &&
                  line.uncertainSymbols.length > 0 && (
                    <p className="uncertain-symbols">
                      Unclear symbols: {line.uncertainSymbols.join(', ')}
                    </p>
                  )}

                {requiresCrossOutReview && (
                  <fieldset className="crossed-out-review">
                    <legend>Did you cross this out?</legend>
                    <div>
                      <button
                        onClick={() =>
                          onWorkStatusChange(line.id, 'crossed_out')
                        }
                        type="button"
                      >
                        Yes, crossed out
                      </button>
                      <button
                        onClick={() => onWorkStatusChange(line.id, 'active')}
                        type="button"
                      >
                        No, keep it
                      </button>
                      <button
                        onClick={() =>
                          onWorkStatusChange(
                            line.id,
                            'partially_crossed_out',
                          )
                        }
                        type="button"
                      >
                        Partially crossed out
                      </button>
                      <button
                        onClick={() => selectLineForEditing(line.id)}
                        type="button"
                      >
                        Edit text
                      </button>
                    </div>
                    {line.crossedOutEvidence && (
                      <p>{line.crossedOutEvidence}</p>
                    )}
                  </fieldset>
                )}

                {showControls && (
                  <div
                    className="line-review-control"
                    aria-label={`Review status for line ${index + 1}`}
                  >
                    {(
                      [
                        ['correct', 'Confirm'],
                        ['needs_correction', 'Edit and confirm'],
                        ['not_sure', 'Not sure'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        className={status === value ? 'active' : ''}
                        key={value}
                        type="button"
                        onClick={() => onStatusChange(line.id, value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {activeLineId === line.id && (
                  <div className="region-editor-actions">
                    <p>Drag the box to move it. Use the corner handles to resize.</p>
                    <div>
                      <button
                        disabled={!previousLine}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (previousLine) {
                            onMergeLine(line.id, previousLine.id)
                          }
                        }}
                        type="button"
                      >
                        Merge with previous
                      </button>
                      <button
                        disabled={!nextLine}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (nextLine) {
                            onMergeLine(line.id, nextLine.id)
                          }
                        }}
                        type="button"
                      >
                        Merge with next
                      </button>
                      <button
                        className="delete-region-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          deleteLine(line)
                        }}
                        type="button"
                      >
                        Delete region
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {interpretation.interpretationNotes &&
          interpretation.interpretationNotes.length > 0 && (
            <details className="interpretation-notes">
              <summary>Interpretation notes</summary>
              <ul>
                {interpretation.interpretationNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          )}

        <div className="confirmation-actions">
          <button
            type="button"
            onClick={() => {
              onReset()
              setReviewAllLines(false)
              setManualReviewIds(new Set())
            }}
          >
            Reset edits
          </button>
          <button
            className="continue-button"
            type="button"
            disabled={!allReviewed || isDiagnosing}
            onClick={onContinue}
          >
            {isDiagnosing
              ? 'Checking the physics reasoning...'
              : 'Continue to feedback'}
          </button>
        </div>
        {sortedLines.length === 0 && (
          <p className="continuation-message" role="alert">
            At least one interpreted step is required.
          </p>
        )}
        {deletedLine && (
          <div className="undo-region-message" role="status">
            <span>Region deleted.</span>
            <button onClick={undoDelete} type="button">
              Undo
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function AttemptHistory({
  attempts,
  activeAttemptId,
  disabled,
  onSelect,
}: {
  attempts: SolutionAttempt[]
  activeAttemptId: string | null
  disabled: boolean
  onSelect: (attemptId: string) => void
}) {
  return (
    <nav className="attempt-history" aria-label="Attempt history">
      {attempts.map((attempt) => {
        const status = attempt.diagnosis
          ? statusLabels[attempt.diagnosis.overallStatus]
          : attempt.stage === 'interpretation'
            ? 'Transcription review'
            : attempt.imageFile
              ? 'Ready to interpret'
              : 'Not started'

        return (
          <button
            aria-current={attempt.id === activeAttemptId ? 'step' : undefined}
            className={attempt.id === activeAttemptId ? 'active' : ''}
            disabled={disabled}
            key={attempt.id}
            onClick={() => onSelect(attempt.id)}
            type="button"
          >
            <strong>Attempt {attempt.attemptNumber}</strong>
            <span>{status}</span>
          </button>
        )
      })}
    </nav>
  )
}

function FeedbackPanel({
  activeLineId,
  assistanceState,
  comparison,
  feedback,
  imagePreviewUrl,
  isAnalyzing,
  isPreparingWorkedSolution,
  interpretation,
  confirmedLines,
  originalFeedback,
  workedSolution,
  onRequestWorkedSolution,
  onTryAgain,
  onTryDifferentProblem,
  onReviewInterpretation,
  onSelectedLineChange,
}: {
  activeLineId: string | null
  assistanceState: AssistanceState
  comparison: RevisionComparison | null
  feedback: FeedbackResult
  imagePreviewUrl: string | null
  isAnalyzing: boolean
  isPreparingWorkedSolution: boolean
  interpretation: InterpretedSolution
  confirmedLines: ConfirmedLine[]
  originalFeedback?: FeedbackResult
  workedSolution?: WorkedSolution
  onRequestWorkedSolution: () => void
  onTryAgain: () => void
  onTryDifferentProblem: () => void
  onReviewInterpretation: () => void
  onSelectedLineChange: (lineId: string | null) => void
}) {
  const secondaryIssues = feedback.secondaryIssues ?? []
  const uncertainLines = feedback.transcription.lines.filter(
    (line) =>
      line.confidence < 0.75 ||
      (line.uncertainSymbols && line.uncertainSymbols.length > 0),
  )
  const summary = getFeedbackSummary(feedback)
  const sortedConfirmedLines = sortLinesByOrder(confirmedLines)
  const lineNumbers = createLineNumberMap(sortedConfirmedLines)
  const visibleLineIds = new Set(
    sortedConfirmedLines
      .filter((line) => line.region)
      .map((line) => line.id),
  )

  return (
    <div className="feedback-sections">
      {comparison && originalFeedback && (
        <RevisionProgress
          comparison={comparison}
          originalFeedback={originalFeedback}
          revisedFeedback={feedback}
        />
      )}

      <section className="summary-bar">
        <div>
          <span className={`status-pill status-${feedback.overallStatus}`}>
            {feedback.overallStatus.replace('_', ' ')}
          </span>
          <span className="confidence-chip">
            {formatPercent(feedback.analysisConfidence)} confidence
          </span>
        </div>
        <p>{summary}</p>
        <div className="summary-actions">
          <button
            type="button"
            onClick={onReviewInterpretation}
            disabled={isAnalyzing}
          >
            Review transcription
          </button>
          <button
            className="revise-button"
            type="button"
            onClick={onTryAgain}
            disabled={isAnalyzing}
          >
            Try again
          </button>
          <button
            className={
              feedback.overallStatus === 'correct'
                ? 'different-problem-primary'
                : ''
            }
            type="button"
            onClick={onTryDifferentProblem}
            disabled={isAnalyzing}
          >
            Try a different problem
          </button>
        </div>
      </section>

      <AnnotatedImageView
        activeLineId={activeLineId}
        annotations={feedback.suggestedMarkup}
        avoidRegions={interpretation.lines.flatMap((line) =>
          line.region ? [line.region] : [],
        )}
        imageUrl={imagePreviewUrl}
        key={feedback.suggestedMarkup.map((markup) => markup.id).join('|')}
        lines={sortedConfirmedLines}
        onLineSelect={onSelectedLineChange}
        primaryLineId={feedback.firstIssue?.lineId}
      />

      <section className="feedback-section issue-section primary-card">
        <h3>First thing to revise</h3>
        {feedback.firstIssue ? (
          <>
            <div className="issue-meta">
              <span>{issueTypeLabels[feedback.firstIssue.errorType]}</span>
              <span>
                {resolveLineReference(
                  feedback.firstIssue,
                  lineNumbers,
                  visibleLineIds,
                )}
              </span>
              <span>{feedback.firstIssue.locationDescription}</span>
            </div>
            <blockquote>{feedback.firstIssue.quotedWork}</blockquote>
            <h4>Why this matters</h4>
            <p>{feedback.firstIssue.explanation}</p>
            {feedback.firstIssue.likelyMisconception && (
              <div className="misconception-box">
                <h4>Likely misconception</h4>
                <p>{feedback.firstIssue.likelyMisconception}</p>
              </div>
            )}
          </>
        ) : (
          <p>No first issue stands out in this review.</p>
        )}
      </section>

      <section className="feedback-section hint-card">
        <h3>Hint</h3>
        <h4>Try this</h4>
        <p>
          {feedback.firstIssue
            ? feedback.firstIssue.hint
            : feedback.nextStepHint}
        </p>
      </section>

      <section className="feedback-section compact-card strengths-card">
        <h3>What you did well</h3>
        <ul className="strength-list">
          {feedback.strengths.slice(0, 3).map((strength) => (
            <li key={strength}>{strength}</li>
          ))}
        </ul>
      </section>

      <section className="feedback-section compact-card next-step-card">
        <h3>Suggested next step</h3>
        <p>{feedback.nextStepHint}</p>
      </section>

      <div className="detail-row">
        <details className="feedback-section detail-section confirmed-provenance">
          <summary>Confirmed interpretation</summary>
          <ol className="provenance-lines">
            {sortedConfirmedLines.map((line, index) => {
              const originalLine = interpretation.lines.find(
                (candidate) => candidate.id === line.id,
              )
              const changed = originalLine?.rawText !== line.confirmedText

              return (
                <li
                  className={`${activeLineId === line.id ? 'active' : ''} ${
                    line.workStatus === 'crossed_out' ? 'crossed-out' : ''
                  }`}
                  key={line.id}
                  onClick={() => onSelectedLineChange(line.id)}
                >
                  <div>
                    <span className="line-id">{index + 1}</span>
                    <span
                      className={`work-status-chip status-${line.workStatus}`}
                    >
                      {workStatusLabels[line.workStatus]}
                    </span>
                    {changed && <span className="changed-chip">Edited</span>}
                    {line.status === 'not_sure' && (
                      <span className="unsure-chip">Not sure</span>
                    )}
                  </div>
                  <p>{line.confirmedText}</p>
                  {changed && originalLine && (
                    <small>AI originally read: {originalLine.rawText}</small>
                  )}
                </li>
              )
            })}
          </ol>
        </details>

        <details className="feedback-section detail-section">
          <summary>Transcription</summary>
          <ol className="transcription-lines">
            {feedback.transcription.lines.map((line, index) => (
              <li
                className={`transcription-line ${
                  activeLineId === line.id ? 'active' : ''
                }`}
                key={line.id}
                onClick={() => onSelectedLineChange(line.id)}
              >
                <span className="line-id">
                  {lineNumbers[line.id] ?? index + 1}
                </span>
                <p>{line.text}</p>
                {(line.confidence < 0.75 ||
                  (line.uncertainSymbols && line.uncertainSymbols.length > 0)) && (
                  <small>
                    {formatPercent(line.confidence)}
                    {line.uncertainSymbols && line.uncertainSymbols.length > 0
                      ? `, unclear: ${line.uncertainSymbols.join(', ')}`
                      : ''}
                  </small>
                )}
              </li>
            ))}
          </ol>
          <p className="confidence-footnote">
            Transcription confidence:{' '}
            {formatPercent(feedback.transcription.overallConfidence)}
          </p>
        </details>

        {secondaryIssues.length > 0 && (
          <details className="feedback-section detail-section secondary-issues">
            <summary>Secondary issues</summary>
            <div className="secondary-list">
              {secondaryIssues.map((issue, index) => (
                <article key={`${issue.errorType}-${issue.quotedWork ?? index}`}>
                  <div className="secondary-issue-meta">
                    <span>{issueTypeLabels[issue.errorType]}</span>
                    <span>
                      {resolveLineReference(
                        issue,
                        lineNumbers,
                        visibleLineIds,
                      )}
                    </span>
                  </div>
                  {issue.quotedWork && <strong>{issue.quotedWork}</strong>}
                  <p>{issue.explanation}</p>
                </article>
              ))}
            </div>
          </details>
        )}

        <details className="feedback-section detail-section">
          <summary>Model and uncertainty notes</summary>
          <p>
            Analysis confidence: {formatPercent(feedback.analysisConfidence)}.
            {uncertainLines.length > 0
              ? ` Low-confidence lines: ${uncertainLines
                  .map(
                    (line, index) =>
                      `Line ${lineNumbers[line.id] ?? index + 1}`,
                  )
                  .join(', ')}.`
              : ' No low-confidence transcription lines were flagged.'}
          </p>
        </details>
      </div>

      <section className="feedback-section assistance-card">
        <div className="assistance-heading">
          <div>
            <p className="section-kicker">Progressive assistance</p>
            <h3>Feedback level {assistanceState.feedbackLevel}</h3>
          </div>
          <span>
            {assistanceState.attemptsForCurrentIssue} issue revision
            {assistanceState.attemptsForCurrentIssue === 1 ? '' : 's'}
          </span>
        </div>

        {workedSolution && assistanceState.workedSolutionRevealed ? (
          <WorkedSolutionView solution={workedSolution} />
        ) : assistanceState.workedSolutionUnlocked ? (
          <div className="worked-solution-unlocked">
            <p>
              You have revised this same issue twice. A complete worked
              solution is now available, but it will stay hidden until you
              choose to view it.
            </p>
            <button
              disabled={isAnalyzing}
              onClick={onRequestWorkedSolution}
              type="button"
            >
              {isPreparingWorkedSolution
                ? 'Preparing a worked solution...'
                : 'View worked solution'}
            </button>
          </div>
        ) : (
          <p>
            {assistanceState.feedbackLevel === 1
              ? 'Start with the conceptual hint, then revise your own work.'
              : 'This guidance is more explicit, but the complete solution remains hidden.'}
          </p>
        )}
      </section>
    </div>
  )
}

function WorkedSolutionView({ solution }: { solution: WorkedSolution }) {
  return (
    <div className="worked-solution" aria-label="Worked solution">
      <p className="worked-solution-separation">
        Worked example, separate from your uploaded work
      </p>
      <ol>
        {solution.steps.map((step, index) => (
          <li key={`${step.title}-${index}`}>
            <h4>{step.title}</h4>
            <p>{step.explanation}</p>
            {step.equation && <code>{step.equation}</code>}
            {step.substitution && <code>{step.substitution}</code>}
            {step.units && <small>Units: {step.units}</small>}
          </li>
        ))}
      </ol>
      {solution.diagramExplanation && (
        <div className="worked-diagram-explanation">
          <h4>Diagram reasoning</h4>
          <p>{solution.diagramExplanation}</p>
        </div>
      )}
      <p className="worked-final-answer">
        <strong>Final answer:</strong> {solution.finalAnswer}
      </p>
      {solution.limitations.length > 0 && (
        <small>{solution.limitations.join(' ')}</small>
      )}
    </div>
  )
}

function RevisionProgress({
  comparison,
  originalFeedback,
  revisedFeedback,
}: {
  comparison: RevisionComparison
  originalFeedback: FeedbackResult
  revisedFeedback: FeedbackResult
}) {
  return (
    <section className="revision-progress" aria-labelledby="revision-progress-title">
      <div className="revision-progress-heading">
        <div>
          <p className="section-kicker">Attempt comparison</p>
          <h3 id="revision-progress-title">Revision progress</h3>
        </div>
        <span
          className={`resolution-chip resolution-${comparison.originalIssueResolved}`}
        >
          {comparison.originalIssueResolved === 'yes'
            ? 'Original issue resolved'
            : comparison.originalIssueResolved === 'partially'
              ? 'Partly resolved'
              : comparison.originalIssueResolved === 'no'
                ? 'Still present'
                : 'Resolution unclear'}
        </span>
      </div>

      <div className="attempt-status-row">
        <span>
          Previous attempt
          <strong>{statusLabels[originalFeedback.overallStatus]}</strong>
        </span>
        <span>
          Current attempt
          <strong>{statusLabels[revisedFeedback.overallStatus]}</strong>
        </span>
        <span>
          Comparison confidence
          <strong>{formatPercent(comparison.confidence)}</strong>
        </span>
      </div>

      <p className="progress-summary">{comparison.progressSummary}</p>
      <div className="revision-issue-summary">
        <p>
          <strong>Original first issue:</strong>{' '}
          {originalFeedback.firstIssue?.explanation ??
            'No original issue was identified.'}
        </p>
        {comparison.remainingIssue && (
          <p>
            <strong>Remaining issue:</strong> {comparison.remainingIssue}
          </p>
        )}
        {comparison.newIssue && (
          <p>
            <strong>New first issue:</strong> {comparison.newIssue}
          </p>
        )}
      </div>
    </section>
  )
}

function createRevisionHistorySummary(attempts: SolutionAttempt[]): string {
  return attempts
    .filter((attempt) => attempt.diagnosis)
    .map(
      (attempt) =>
        `Attempt ${attempt.attemptNumber}: ${
          attempt.diagnosis?.overallStatus
        }; first issue: ${
          attempt.diagnosis?.firstIssue?.explanation ?? 'none'
        }; assistance level: ${
          attempt.assistanceState?.feedbackLevel ?? 1
        }`,
    )
    .join('\n')
}

function createDiagramInterpretation(feedback: FeedbackResult): string {
  const diagramMarkup = feedback.suggestedMarkup
    .filter(
      (markup) =>
        markup.type === 'physics_vector' ||
        markup.vectorIssue ||
        markup.targetObject,
    )
    .map((markup) => ({
      type: markup.type,
      vectorKind: markup.vectorKind,
      vectorIssue: markup.vectorIssue,
      targetObject: markup.targetObject,
      label: markup.label,
      targetDescription: markup.targetDescription,
      noteText: markup.noteText,
      confidence: markup.confidence,
    }))

  return diagramMarkup.length > 0
    ? JSON.stringify(diagramMarkup)
    : 'No localized free-body-diagram interpretation was available.'
}

function createAttempt(
  attemptNumber: number,
  id: string = crypto.randomUUID(),
): SolutionAttempt {
  return {
    id,
    attemptNumber,
    lineStatuses: {},
    contentDirty: false,
    geometryDirty: false,
    stage: 'input',
    createdAt: new Date().toISOString(),
  }
}

function createProblemSession(problem?: PracticeProblem): ProblemSession {
  const firstAttempt = createAttempt(1)
  return {
    problemId: problem?.id,
    problemTitle: problem?.title,
    problemStatement: problem?.statement ?? '',
    attempts: [firstAttempt],
    activeAttemptId: firstAttempt.id,
  }
}

function validateUploadFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()

  if (isPdfFile(file)) {
    return file.size > maxPdfBytes
      ? 'PDF is too large. Please upload a PDF smaller than 20 MB.'
      : null
  }

  if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
    return 'Please upload an image or PDF.'
  }

  if (!supportedImageTypes.has(file.type)) {
    return 'Please upload an image or PDF.'
  }

  if (file.size > maxImageBytes) {
    return 'Image is too large. Please upload an image smaller than 8 MB.'
  }

  return null
}

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

function normalizeSelectedFile(file: File): File {
  if (file.type && file.type !== 'application/octet-stream') {
    return file
  }

  const extension = file.name.toLowerCase().split('.').pop()
  const inferredType =
    extension === 'pdf'
      ? 'application/pdf'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : undefined

  return inferredType
    ? new File([file], file.name, {
        type: inferredType,
        lastModified: file.lastModified,
      })
    : file
}

function formatPdfUploadName(
  fileName: string,
  pageNumber: number,
  pageCount: number,
): string {
  return `${fileName} | Page ${pageNumber} of ${pageCount}`
}

function createApiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-OpenAI-API-Key': apiKey } : {}),
  }
}

function readSessionApiKey(): string {
  try {
    return window.sessionStorage.getItem(apiKeyStorageKey)?.trim() ?? ''
  } catch {
    return ''
  }
}

function writeSessionApiKey(apiKey: string) {
  try {
    if (apiKey) {
      window.sessionStorage.setItem(apiKeyStorageKey, apiKey)
    } else {
      window.sessionStorage.removeItem(apiKeyStorageKey)
    }
  } catch {
    // Analysis still works with the in-memory value when storage is blocked.
  }
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

async function createImageFingerprint(file: File): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    return `${file.name}:${file.type}:${file.size}:${file.lastModified}`
  }
}

function createConfirmedTranscriptionSnapshot(lines: ConfirmedLine[]): string {
  return JSON.stringify(
    sortLinesByOrder(lines).map((line) => ({
      id: line.id.trim(),
      order: line.order,
      status: line.status,
      workStatus: line.workStatus,
      text: line.confirmedText.trim().replace(/\s+/g, ' '),
    })),
  )
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function getFeedbackSummary(feedback: FeedbackResult): string {
  if (feedback.firstIssue) {
    return `Start with ${feedback.firstIssue.locationDescription.toLowerCase()}.`
  }

  return statusLabels[feedback.overallStatus]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default App
