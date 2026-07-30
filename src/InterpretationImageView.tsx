import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type {
  InterpretedLine,
  InterpretationRegion,
} from './interpretation'
import {
  clampInterpretationRegion,
  minimumRegionHeight,
  minimumRegionWidth,
} from './interpretationEditing'
import {
  createLineGutterItems,
  sortLinesByOrder,
} from './lineReferences'

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

type RegionInteraction =
  | {
      mode: 'drag'
      pointerId: number
      lineId: string
      startPoint: Point
      startRegion: InterpretationRegion
      currentRegion: InterpretationRegion
    }
  | {
      mode: 'resize'
      pointerId: number
      lineId: string
      handle: ResizeHandle
      startPoint: Point
      startRegion: InterpretationRegion
      currentRegion: InterpretationRegion
    }
  | {
      mode: 'add'
      pointerId: number
      startPoint: Point
      currentRegion: InterpretationRegion
    }

type Point = { x: number; y: number }

type InterpretationImageViewProps = {
  imageUrl: string | null
  lines: InterpretedLine[]
  activeLineId: string | null
  onActiveLineChange: (lineId: string | null) => void
  onAddRegion: (region: InterpretationRegion) => void
  onRegionChange: (
    lineId: string,
    region: InterpretationRegion,
    commit: boolean,
  ) => void
}

export function InterpretationImageView({
  imageUrl,
  lines,
  activeLineId,
  onActiveLineChange,
  onAddRegion,
  onRegionChange,
}: InterpretationImageViewProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<RegionInteraction | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [draftRegion, setDraftRegion] =
    useState<InterpretationRegion | null>(null)
  const sortedLines = useMemo(() => sortLinesByOrder(lines), [lines])
  const localizedLines = sortedLines.filter(
    (
      line,
    ): line is InterpretedLine & { region: InterpretationRegion } =>
      Boolean(line.region),
  )
  const gutterItems = useMemo(
    () => createLineGutterItems(sortedLines),
    [sortedLines],
  )

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }
      interactionRef.current = null
      setDraftRegion(null)
      setAddMode(false)
      onActiveLineChange(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onActiveLineChange])

  function getNormalizedPoint(event: ReactPointerEvent): Point {
    const bounds = overlayRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return { x: 0, y: 0 }
    }
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    }
  }

  function capturePointer(event: ReactPointerEvent) {
    overlayRef.current?.setPointerCapture(event.pointerId)
  }

  function startDrag(
    event: ReactPointerEvent,
    line: InterpretedLine,
  ) {
    if (addMode || !line.region) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    capturePointer(event)
    onActiveLineChange(line.id)
    interactionRef.current = {
      mode: 'drag',
      pointerId: event.pointerId,
      lineId: line.id,
      startPoint: getNormalizedPoint(event),
      startRegion: line.region,
      currentRegion: line.region,
    }
  }

  function startResize(
    event: ReactPointerEvent,
    line: InterpretedLine,
    handle: ResizeHandle,
  ) {
    if (!line.region) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    capturePointer(event)
    onActiveLineChange(line.id)
    interactionRef.current = {
      mode: 'resize',
      pointerId: event.pointerId,
      lineId: line.id,
      handle,
      startPoint: getNormalizedPoint(event),
      startRegion: line.region,
      currentRegion: line.region,
    }
  }

  function startAdd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!addMode || event.target !== event.currentTarget) {
      return
    }
    event.preventDefault()
    capturePointer(event)
    const point = getNormalizedPoint(event)
    const region = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    }
    interactionRef.current = {
      mode: 'add',
      pointerId: event.pointerId,
      startPoint: point,
      currentRegion: region,
    }
    setDraftRegion(region)
    onActiveLineChange(null)
  }

  function updateInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }
    event.preventDefault()
    const point = getNormalizedPoint(event)

    if (interaction.mode === 'add') {
      const region = regionFromPoints(interaction.startPoint, point)
      interaction.currentRegion = region
      setDraftRegion(region)
      return
    }

    const region =
      interaction.mode === 'drag'
        ? dragRegion(interaction.startRegion, interaction.startPoint, point)
        : resizeRegion(
            interaction.startRegion,
            interaction.startPoint,
            point,
            interaction.handle,
          )
    interaction.currentRegion = region
    onRegionChange(interaction.lineId, region, false)
  }

  function finishInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }
    event.preventDefault()
    if (overlayRef.current?.hasPointerCapture(event.pointerId)) {
      overlayRef.current.releasePointerCapture(event.pointerId)
    }
    interactionRef.current = null

    if (interaction.mode === 'add') {
      const region = interaction.currentRegion
      setDraftRegion(null)
      setAddMode(false)
      if (
        region.width >= minimumRegionWidth &&
        region.height >= minimumRegionHeight
      ) {
        onAddRegion(clampInterpretationRegion(region))
      }
      return
    }

    onRegionChange(interaction.lineId, interaction.currentRegion, true)
  }

  function nudgeRegion(
    event: React.KeyboardEvent<HTMLDivElement>,
    line: InterpretedLine,
  ) {
    if (!line.region) {
      return
    }
    const movement = event.shiftKey ? 0.01 : 0.002
    const offsets: Partial<Record<string, Point>> = {
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement },
    }
    const offset = offsets[event.key]
    if (!offset) {
      return
    }
    event.preventDefault()
    onRegionChange(
      line.id,
      clampInterpretationRegion({
        ...line.region,
        x: line.region.x + offset.x,
        y: line.region.y + offset.y,
      }),
      true,
    )
  }

  return (
    <section className="interpretation-image-card">
      <div className="interpretation-image-heading">
        <div>
          <h3>Original work</h3>
          <p>Select a region to edit, move, or resize it.</p>
        </div>
        <div className="interpretation-image-tools">
          <span className="located-count">{localizedLines.length} located</span>
          <button
            aria-pressed={addMode}
            className={addMode ? 'active' : ''}
            onClick={() => {
              setAddMode((value) => !value)
              onActiveLineChange(null)
            }}
            type="button"
          >
            {addMode ? 'Cancel add' : 'Add region'}
          </button>
        </div>
      </div>

      {addMode && (
        <p className="region-edit-notice">
          Draw a box around the missing handwritten step.
        </p>
      )}

      <div className="interpretation-image-scroll">
        <div className="interpretation-image-stage">
          {imageUrl ? (
            <>
              <div className="line-number-gutter interpretation-line-gutter">
                {gutterItems.map((item) => (
                  <button
                    aria-label={`Select line ${item.number}`}
                    className={`${item.id === activeLineId ? 'active' : ''} ${
                      item.workStatus === 'crossed_out' ? 'crossed-out' : ''
                    }`}
                    key={item.id}
                    onClick={() => onActiveLineChange(item.id)}
                    style={{ top: `${item.y * 100}%` }}
                    type="button"
                  >
                    {item.number}
                  </button>
                ))}
              </div>
              <div className="interpretation-image-page">
                <img
                  src={imageUrl}
                  alt="Uploaded handwritten solution with interpretation regions"
                  draggable={false}
                />
                <div
                  aria-label="Editable handwriting interpretation regions"
                  className={`interpretation-overlay ${
                    addMode ? 'add-region-mode' : ''
                  }`}
                  onPointerCancel={finishInteraction}
                  onPointerDown={startAdd}
                  onPointerMove={updateInteraction}
                  onPointerUp={finishInteraction}
                  ref={overlayRef}
                >
                  {localizedLines.map((line) => (
                    <EditableInterpretationRegion
                      displayNumber={
                        sortedLines.findIndex(
                          (candidate) => candidate.id === line.id,
                        ) + 1
                      }
                      key={line.id}
                      line={line}
                      onKeyDown={nudgeRegion}
                      onStartDrag={startDrag}
                      onStartResize={startResize}
                      selected={line.id === activeLineId}
                    />
                  ))}
                  {draftRegion && (
                    <div
                      className="interpretation-region region-draft"
                      style={{
                        left: `${draftRegion.x * 100}%`,
                        top: `${draftRegion.y * 100}%`,
                        width: `${draftRegion.width * 100}%`,
                        height: `${draftRegion.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="image-unavailable">Original image unavailable.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function EditableInterpretationRegion({
  displayNumber,
  line,
  onKeyDown,
  onStartDrag,
  onStartResize,
  selected,
}: {
  displayNumber: number
  line: InterpretedLine & { region: InterpretationRegion }
  onKeyDown: (
    event: React.KeyboardEvent<HTMLDivElement>,
    line: InterpretedLine,
  ) => void
  onStartDrag: (
    event: ReactPointerEvent,
    line: InterpretedLine,
  ) => void
  onStartResize: (
    event: ReactPointerEvent,
    line: InterpretedLine,
    handle: ResizeHandle,
  ) => void
  selected: boolean
}) {
  const { region } = line
  return (
    <div
      aria-label={`Interpretation region ${displayNumber}. Drag to move. Use arrow keys to nudge.`}
      aria-pressed={selected}
      className={`interpretation-region ${selected ? 'active' : ''} ${
        line.workStatus === 'crossed_out' ? 'crossed-out' : ''
      }`}
      onKeyDown={(event) => onKeyDown(event, line)}
      onPointerDown={(event) => onStartDrag(event, line)}
      role="button"
      style={{
        left: `${region.x * 100}%`,
        top: `${region.y * 100}%`,
        width: `${region.width * 100}%`,
        height: `${region.height * 100}%`,
      }}
      tabIndex={0}
    >
      {selected &&
        (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
          <span
            aria-hidden="true"
            className={`region-resize-handle handle-${handle}`}
            key={handle}
            onPointerDown={(event) => onStartResize(event, line, handle)}
          />
        ))}
    </div>
  )
}

function dragRegion(
  region: InterpretationRegion,
  start: Point,
  current: Point,
): InterpretationRegion {
  return clampInterpretationRegion({
    ...region,
    x: region.x + current.x - start.x,
    y: region.y + current.y - start.y,
  })
}

function resizeRegion(
  region: InterpretationRegion,
  start: Point,
  current: Point,
  handle: ResizeHandle,
): InterpretationRegion {
  const deltaX = current.x - start.x
  const deltaY = current.y - start.y
  const right = region.x + region.width
  const bottom = region.y + region.height
  let x = region.x
  let y = region.y
  let width: number
  let height: number

  if (handle.includes('w')) {
    x = clamp(region.x + deltaX, 0, right - minimumRegionWidth)
    width = right - x
  } else {
    width = clamp(
      region.width + deltaX,
      minimumRegionWidth,
      1 - region.x,
    )
  }

  if (handle.includes('n')) {
    y = clamp(region.y + deltaY, 0, bottom - minimumRegionHeight)
    height = bottom - y
  } else {
    height = clamp(
      region.height + deltaY,
      minimumRegionHeight,
      1 - region.y,
    )
  }

  return clampInterpretationRegion({ x, y, width, height })
}

function regionFromPoints(start: Point, current: Point): InterpretationRegion {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  }
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}
