import { useEffect, useMemo, useRef, useState } from 'react'
import type { PhysicsVectorMarkup, SuggestedMarkup } from './feedback'
import type { InterpretedLine } from './interpretation'
import { createLineGutterItems } from './lineReferences'

type Point = { x: number; y: number }
type Rect = Point & { width: number; height: number }
type ViewportSize = { width: number; height: number }
type AnnotationCategory = NonNullable<SuggestedMarkup['category']>

type AnnotationLayout = {
  annotation: SuggestedMarkup
  category: AnnotationCategory
  color: string
  target: Point
  noteBox?: Rect
  showLeader: boolean
  vectorLabelPoint?: Point
}

type AnnotatedImageViewProps = {
  imageUrl: string | null
  annotations: SuggestedMarkup[]
  avoidRegions?: Rect[]
  primaryLineId?: string
  lines: InterpretedLine[]
  activeLineId?: string | null
  onLineSelect?: (lineId: string) => void
}

const pageStart = 0.05
const pageWidth = 0.68
const pageEnd = pageStart + pageWidth
const marginStart = 0.75
const marginWidth = 0.23
const localizationConfidenceFloor = 0.55
const vectorConfidenceFloor = 0.72
const categoryColors: Record<AnnotationCategory, string> = {
  issue: '#c43c32',
  hint: '#2878a8',
  praise: '#238357',
  question: '#2878a8',
}

export function AnnotatedImageView({
  imageUrl,
  annotations,
  avoidRegions = [],
  primaryLineId,
  lines,
  activeLineId,
  onLineSelect,
}: AnnotatedImageViewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [showFeedback, setShowFeedback] = useState(true)
  const [stageSize, setStageSize] = useState<ViewportSize>({
    width: 900,
    height: 700,
  })
  const crossedOutLineIds = useMemo(
    () =>
      new Set(
        lines
          .filter((line) => line.workStatus === 'crossed_out')
          .map((line) => line.id),
      ),
    [lines],
  )
  const displayAnnotations = useMemo(
    () =>
      annotations.filter((annotation) => {
        const lineId = annotation.lineId ?? annotation.targetLineId
        const isPraise =
          annotation.category === 'praise' || annotation.type === 'check'
        return !(lineId && crossedOutLineIds.has(lineId) && isPraise)
      }),
    [annotations, crossedOutLineIds],
  )
  const gutterItems = useMemo(() => createLineGutterItems(lines), [lines])
  const visualAnnotations = useMemo(
    () =>
      displayAnnotations.filter(
        (annotation) =>
          isLocalized(annotation) &&
          (annotation.confidence ?? 1) >=
            (annotation.type === 'physics_vector'
              ? vectorConfidenceFloor
              : localizationConfidenceFloor),
      ),
    [displayAnnotations],
  )
  const visibleAnnotations = useMemo(
    () => prioritizeAnnotations(visualAnnotations, primaryLineId),
    [primaryLineId, visualAnnotations],
  )
  const layouts = useMemo(
    () => layoutAnnotations(visibleAnnotations, avoidRegions),
    [avoidRegions, visibleAnnotations],
  )
  const textOnlyFallbacks = displayAnnotations.filter(
    (annotation) =>
      Boolean(annotation.noteText?.trim() || annotation.targetDescription.trim()) &&
      (!isLocalized(annotation) ||
        (annotation.confidence ?? 1) <
          (annotation.type === 'physics_vector'
            ? vectorConfidenceFloor
            : localizationConfidenceFloor)),
  )

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return
      }
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setStageSize({ width, height })
      }
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="annotated-work-card" aria-labelledby="annotated-work-heading">
      <div className="annotated-work-header">
        <div>
          <h3 id="annotated-work-heading">Annotated work</h3>
          <p>Brief notes sit beside the unchanged image.</p>
        </div>
        <div className="annotation-controls" aria-label="Annotation controls">
          <button type="button" onClick={() => setShowFeedback((value) => !value)}>
            {showFeedback ? 'Hide feedback' : 'Show feedback'}
          </button>
        </div>
      </div>

      {textOnlyFallbacks.length > 0 && (
        <p className="localization-notice">
          Some feedback could not be placed precisely on the page.
        </p>
      )}

      <div className="annotated-image-scroll">
        <div className="annotated-image-stage" ref={stageRef}>
          <div className="line-number-gutter annotated-line-gutter">
            {gutterItems.map((item) => (
              <button
                aria-label={`Select line ${item.number}`}
                className={`${item.id === activeLineId ? 'active' : ''} ${
                  item.workStatus === 'crossed_out' ? 'crossed-out' : ''
                }`}
                key={item.id}
                onClick={() => onLineSelect?.(item.id)}
                style={{ top: `${item.y * 100}%` }}
                type="button"
              >
                {item.number}
              </button>
            ))}
          </div>
          <div className="annotated-image-page">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Uploaded handwritten solution with feedback overlay"
              />
            ) : (
              <p className="image-unavailable">Original image unavailable.</p>
            )}
          </div>
          <div className="annotation-margin" aria-hidden="true" />

          {imageUrl && showFeedback && layouts.length > 0 && (
            <>
              <svg
                className="annotation-overlay"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                role="img"
                aria-label="Teacher-style feedback annotations"
              >
                <AnnotationMarkers />
                {layouts.map((layout) => (
                  <AnnotationShape
                    key={layout.annotation.id}
                    layout={layout}
                    viewportSize={stageSize}
                  />
                ))}
              </svg>
              <div className="annotation-note-layer">
                {layouts.map(
                  ({ annotation, category, noteBox }) =>
                    annotation.noteText &&
                    noteBox && (
                      <div
                        aria-label={annotation.noteText}
                        className={`annotation-note category-${category} note-style-${
                          annotation.noteStyle ?? 'handwritten'
                        }`}
                        key={`${annotation.id}-note`}
                        style={{
                          left: `${noteBox.x * 100}%`,
                          top: `${noteBox.y * 100}%`,
                          width: `${noteBox.width * 100}%`,
                          height: `${noteBox.height * 100}%`,
                        }}
                      >
                        {annotation.noteText}
                      </div>
                    ),
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function AnnotationMarkers() {
  return (
    <defs>
      {Object.entries(categoryColors).map(([category, color]) => (
        <marker
          id={`teacher-arrow-${category}`}
          key={category}
          markerHeight="7"
          markerUnits="strokeWidth"
          markerWidth="7"
          orient="auto"
          refX="6"
          refY="3.5"
          viewBox="0 0 7 7"
        >
          <path d="M0,0 L7,3.5 L0,7 Z" fill={color} />
        </marker>
      ))}
    </defs>
  )
}

function AnnotationShape({
  layout,
  viewportSize,
}: {
  layout: AnnotationLayout
  viewportSize: ViewportSize
}) {
  const { annotation, category, color, noteBox, target } = layout
  const region = annotation.region
    ? mapRectToPage(annotation.region)
    : undefined
  const type = annotation.type

  return (
    <g
      className={`annotation annotation-${type} category-${category}`}
      style={{ color }}
      aria-label={
        annotation.noteText?.trim() || `${category} feedback annotation`
      }
    >
      {isPhysicsVector(annotation) && (
        <PhysicsVectorShape
          annotation={annotation}
          labelPoint={layout.vectorLabelPoint}
          viewportSize={viewportSize}
        />
      )}

      {region && (type === 'circle' || type === 'dashed_box') && (
        <rect
          className="annotation-box"
          x={region.x}
          y={region.y}
          width={region.width}
          height={region.height}
          rx="0.012"
        />
      )}

      {region && type === 'underline' && (
        <path
          className="annotation-underline-mark"
          d={`M ${region.x} ${clamp(region.y + region.height + 0.012)} C ${clamp(
            region.x + region.width * 0.35,
          )} ${clamp(region.y + region.height + 0.02)} ${clamp(
            region.x + region.width * 0.7,
          )} ${clamp(region.y + region.height + 0.004)} ${clamp(
            region.x + region.width,
          )} ${clamp(region.y + region.height + 0.012)}`}
        />
      )}

      {type === 'check' && (
        <path
          className="annotation-check-mark"
          d={`M ${target.x - 0.014} ${target.y} L ${target.x - 0.003} ${
            target.y + 0.02
          } L ${target.x + 0.03} ${target.y - 0.028}`}
        />
      )}

      {type === 'question_mark' && (
        <foreignObject
          x={target.x - 0.02}
          y={target.y - 0.032}
          width="0.05"
          height="0.065"
        >
          <div className="annotation-question-mark">?</div>
        </foreignObject>
      )}

      {region && type === 'note' && (
        <rect
          className="annotation-note-region"
          x={region.x}
          y={region.y}
          width={region.width}
          height={region.height}
          rx="0.008"
        />
      )}

      {layout.showLeader && noteBox && (
        <path
          className="annotation-leader"
          d={createLeaderPath(noteBox, target)}
          markerEnd={`url(#teacher-arrow-${category})`}
        />
      )}
    </g>
  )
}

function PhysicsVectorShape({
  annotation,
  labelPoint,
  viewportSize,
}: {
  annotation: PhysicsVectorMarkup
  labelPoint?: Point
  viewportSize: ViewportSize
}) {
  const points = getPhysicsVectorPoints(annotation)
  if (!points) {
    return null
  }
  const resolvedLabelPoint =
    labelPoint ?? getVectorLabelCandidates(points.origin, points.endpoint)[0]
  const metrics = getVectorRenderMetrics(points, viewportSize)
  const markerId = createPhysicsVectorMarkerId(annotation.id)

  return (
    <g
      className={`physics-vector vector-${annotation.vectorKind}`}
      aria-label={`${annotation.vectorKind} vector${
        annotation.label ? ` labeled ${annotation.label}` : ''
      }`}
    >
      <defs>
        <marker
          id={markerId}
          markerHeight={metrics.markerHeight}
          markerUnits="userSpaceOnUse"
          markerWidth={metrics.markerWidth}
          orient="auto-start-reverse"
          refX="9"
          refY="5"
          viewBox="0 0 10 10"
        >
          <path
            className="physics-vector-arrowhead"
            d="M 0 0 L 10 5 L 0 10 Z"
          />
        </marker>
      </defs>
      <path
        className="physics-vector-line"
        d={`M ${points.origin.x} ${points.origin.y} L ${points.endpoint.x} ${points.endpoint.y}`}
        markerEnd={`url(#${markerId})`}
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        className="physics-vector-origin"
        cx={points.origin.x}
        cy={points.origin.y}
        rx={metrics.originRadiusX}
        ry={metrics.originRadiusY}
        vectorEffect="non-scaling-stroke"
      />
      {annotation.label && (
        <text
          className="physics-vector-label"
          x={resolvedLabelPoint.x}
          y={resolvedLabelPoint.y}
        >
          {annotation.label}
        </text>
      )}
    </g>
  )
}

function getVectorRenderMetrics(
  points: { origin: Point; endpoint: Point },
  viewportSize: ViewportSize,
) {
  const width = Math.max(1, viewportSize.width)
  const height = Math.max(1, viewportSize.height)
  const vectorLengthPx = Math.hypot(
    (points.endpoint.x - points.origin.x) * width,
    (points.endpoint.y - points.origin.y) * height,
  )
  const arrowheadSizePx = getPhysicsVectorArrowheadSize(vectorLengthPx)
  const originRadiusPx = 2.25

  return {
    vectorLengthPx,
    arrowheadSizePx,
    markerWidth: arrowheadSizePx / width,
    markerHeight: arrowheadSizePx / height,
    originRadiusX: originRadiusPx / width,
    originRadiusY: originRadiusPx / height,
  }
}

function getPhysicsVectorArrowheadSize(vectorLengthPx: number): number {
  return clamp(vectorLengthPx * 0.14, 7, 12)
}

function createPhysicsVectorMarkerId(annotationId: string): string {
  let hash = 0
  for (const character of annotationId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return `physics-vector-arrowhead-${hash.toString(36)}`
}

function prioritizeAnnotations(
  annotations: SuggestedMarkup[],
  primaryLineId?: string,
) {
  const selected: SuggestedMarkup[] = []
  const primary =
    annotations.find(
      (annotation) =>
        annotation.lineId === primaryLineId &&
        getCategory(annotation) !== 'praise',
    ) ??
    annotations.find((annotation) => getCategory(annotation) === 'issue') ??
    annotations.find((annotation) => getCategory(annotation) === 'question')

  if (primary) {
    selected.push(primary)
  }

  const hint = annotations.find(
    (annotation) =>
      !selected.includes(annotation) &&
      (getCategory(annotation) === 'hint' ||
        getCategory(annotation) === 'question'),
  )
  if (hint) {
    selected.push(hint)
  }

  const praise = annotations.find(
    (annotation) =>
      !selected.includes(annotation) &&
      (annotation.type === 'check' || getCategory(annotation) === 'praise'),
  )
  if (praise) {
    selected.push(praise)
  }

  for (const annotation of annotations) {
    if (selected.length >= 3) {
      break
    }
    const alreadyHasPraise = selected.some(
      (item) => item.type === 'check' || getCategory(item) === 'praise',
    )
    if (
      alreadyHasPraise &&
      (annotation.type === 'check' || getCategory(annotation) === 'praise')
    ) {
      continue
    }
    if (!selected.includes(annotation)) {
      selected.push(annotation)
    }
  }

  return selected.slice(0, 3)
}

function layoutAnnotations(
  annotations: SuggestedMarkup[],
  avoidRegions: Rect[],
): AnnotationLayout[] {
  const occupiedNotes: Rect[] = []
  const occupiedChecks: Rect[] = []
  const mappedWriting = avoidRegions.map(mapRectToPage)
  let hasLeader = false

  return annotations.map((annotation) => {
    const category = getCategory(annotation)
    const target = getDisplayTarget(annotation)
    const noteBox =
      annotation.noteText && annotation.type !== 'check'
        ? placeMarginNote(annotation, target, occupiedNotes, occupiedChecks)
        : undefined

    if (noteBox) {
      occupiedNotes.push(noteBox)
    }
    if (annotation.type === 'check') {
      occupiedChecks.push({
        x: target.x - 0.02,
        y: target.y - 0.04,
        width: 0.06,
        height: 0.08,
      })
    }

    const leaderTarget = getLeaderTarget(annotation, target)
    const lineWouldCrossWriting = mappedWriting.some(
      (region) =>
        region.y < leaderTarget.y &&
        region.y + region.height > leaderTarget.y &&
        region.x > leaderTarget.x,
    )
    const showLeader =
      Boolean(noteBox) &&
      category !== 'praise' &&
      !lineWouldCrossWriting &&
      !hasLeader
    hasLeader ||= showLeader
    const vectorLabelPoint =
      isPhysicsVector(annotation) && annotation.label
        ? placeVectorLabel(annotation, mappedWriting)
        : undefined

    return {
      annotation,
      category,
      color: categoryColors[category],
      target:
        annotation.type === 'check' ? target : leaderTarget,
      noteBox,
      showLeader,
      vectorLabelPoint,
    }
  })
}

function placeMarginNote(
  annotation: SuggestedMarkup,
  target: Point,
  occupiedNotes: Rect[],
  occupiedChecks: Rect[],
): Rect | undefined {
  const noteLines = Math.min(
    3,
    Math.max(1, Math.ceil((annotation.noteText?.length ?? 0) / 24)),
  )
  const height = clamp(0.035 + noteLines * 0.022, 0.06, 0.105)
  const desiredY = clamp(target.y - height / 2, 0.015, 0.985 - height)
  const step = height + 0.014
  const offsets = [0, step, -step, step * 2, -step * 2, step * 3, -step * 3]

  for (const offset of offsets) {
    const box = {
      x: marginStart,
      y: clamp(desiredY + offset, 0.015, 0.985 - height),
      width: marginWidth,
      height,
    }
    const collides = [...occupiedNotes, ...occupiedChecks].some(
      (other) => overlapRatio(box, other) > 0.02,
    )
    if (!collides) {
      return box
    }
  }

  return undefined
}

function getDisplayTarget(annotation: SuggestedMarkup): Point {
  if (isPhysicsVector(annotation)) {
    return getPhysicsVectorPoints(annotation)?.endpoint ??
      mapPointToPage(annotation.origin)
  }
  if (annotation.type === 'check' && annotation.region) {
    const region = mapRectToPage(annotation.region)
    return {
      x: Math.min(marginStart - 0.035, region.x + region.width + 0.026),
      y: clamp(region.y + region.height / 2),
    }
  }

  return mapPointToPage(getRawTargetPoint(annotation))
}

function getLeaderTarget(annotation: SuggestedMarkup, fallback: Point): Point {
  if (annotation.type === 'physics_vector') {
    return fallback
  }
  if (annotation.region) {
    const region = mapRectToPage(annotation.region)
    return {
      x: clamp(region.x + region.width + 0.004, pageStart, pageEnd - 0.008),
      y: clamp(region.y + region.height / 2),
    }
  }
  return fallback
}

function createLeaderPath(noteBox: Rect, target: Point): string {
  const start = {
    x: noteBox.x,
    y: noteBox.y + noteBox.height / 2,
  }
  const marginElbowX = marginStart - 0.018
  const targetApproachX = Math.max(target.x + 0.025, pageEnd + 0.008)
  return `M ${start.x} ${start.y} H ${marginElbowX} V ${target.y} H ${targetApproachX} H ${target.x}`
}

function overlapRatio(first: Rect, second: Rect): number {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x),
  )
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  )
  return (width * height) / Math.max(first.width * first.height, 0.0001)
}

function mapRectToPage(rect: Rect): Rect {
  return {
    x: pageStart + rect.x * pageWidth,
    y: rect.y,
    width: rect.width * pageWidth,
    height: rect.height,
  }
}

function mapPointToPage(point: Point): Point {
  return {
    x: pageStart + point.x * pageWidth,
    y: point.y,
  }
}

function getCategory(annotation: SuggestedMarkup): AnnotationCategory {
  if (annotation.category) {
    return annotation.category
  }
  if (annotation.type === 'check') {
    return 'praise'
  }
  if (annotation.type === 'question_mark') {
    return 'question'
  }
  return 'issue'
}

function isLocalized(annotation: SuggestedMarkup) {
  if (annotation.type === 'physics_vector') {
    return Boolean(
      annotation.origin &&
        (annotation.endpoint ||
          (annotation.direction &&
            annotation.relativeLength !== undefined)),
    )
  }
  return Boolean(
    annotation.region ||
      annotation.anchor ||
      annotation.leaderAnchor ||
      annotation.notePosition,
  )
}

function isPhysicsVector(
  annotation: SuggestedMarkup,
): annotation is PhysicsVectorMarkup {
  return (
    annotation.type === 'physics_vector' &&
    Boolean(annotation.vectorKind && annotation.origin) &&
    typeof annotation.confidence === 'number' &&
    Boolean(
      annotation.endpoint ||
        (annotation.direction && annotation.relativeLength !== undefined),
    )
  )
}

function getPhysicsVectorPoints(annotation: PhysicsVectorMarkup) {
  const rawEndpoint =
    annotation.endpoint ??
    (annotation.direction && annotation.relativeLength !== undefined
      ? {
          x: clamp(
            annotation.origin.x +
              annotation.direction.x * annotation.relativeLength,
          ),
          y: clamp(
            annotation.origin.y +
              annotation.direction.y * annotation.relativeLength,
          ),
        }
      : undefined)

  if (
    !rawEndpoint ||
    (rawEndpoint.x === annotation.origin.x &&
      rawEndpoint.y === annotation.origin.y)
  ) {
    return undefined
  }

  return {
    origin: mapPointToPage(annotation.origin),
    endpoint: mapPointToPage(rawEndpoint),
  }
}

function placeVectorLabel(
  annotation: PhysicsVectorMarkup,
  writingRegions: Rect[],
): Point | undefined {
  const points = getPhysicsVectorPoints(annotation)
  if (!points || !annotation.label) {
    return undefined
  }
  const candidates = getVectorLabelCandidates(points.origin, points.endpoint)
  const estimatedWidth = clamp(annotation.label.length * 0.015, 0.04, 0.12)

  return candidates.reduce(
    (best, point) => {
      const box = {
        x: point.x - 0.008,
        y: point.y - 0.03,
        width: estimatedWidth,
        height: 0.042,
      }
      const score = writingRegions.reduce(
        (sum, region) => sum + overlapRatio(box, region),
        0,
      )
      return score < best.score ? { point, score } : best
    },
    { point: candidates[0], score: Number.POSITIVE_INFINITY },
  ).point
}

function getVectorLabelCandidates(origin: Point, endpoint: Point): Point[] {
  const dx = endpoint.x - origin.x
  const dy = endpoint.y - origin.y
  const magnitude = Math.hypot(dx, dy) || 1
  const perpendicular = {
    x: -dy / magnitude,
    y: dx / magnitude,
  }
  const makePoint = (along: number, offset: number) => ({
    x: clamp(
      origin.x + dx * along + perpendicular.x * offset,
      pageStart + 0.012,
      pageEnd - 0.06,
    ),
    y: clamp(
      origin.y + dy * along + perpendicular.y * offset,
      0.025,
      0.975,
    ),
  })

  return [
    makePoint(0.58, 0.026),
    makePoint(0.58, -0.026),
    makePoint(0.82, 0.026),
    makePoint(0.34, -0.026),
  ]
}

function getRawTargetPoint(annotation: SuggestedMarkup): Point {
  if (annotation.leaderAnchor) {
    return annotation.leaderAnchor
  }
  if (annotation.anchor) {
    return annotation.anchor
  }
  if (annotation.region) {
    return {
      x: clamp(annotation.region.x + annotation.region.width / 2),
      y: clamp(annotation.region.y + annotation.region.height / 2),
    }
  }
  return annotation.notePosition ?? { x: 0.5, y: 0.5 }
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}
