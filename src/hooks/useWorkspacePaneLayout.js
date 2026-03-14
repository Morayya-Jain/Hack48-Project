import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'dojo.workspace.layout.v1'
const MD_MEDIA_QUERY = '(min-width: 768px)'

const DEFAULT_LEFT_WIDTH_PCT = 22
const DEFAULT_RIGHT_WIDTH_PCT = 24
const DEFAULT_EDITOR_HEIGHT_PX = 480

const MIN_LEFT_WIDTH_PCT = 15
const MIN_RIGHT_WIDTH_PCT = 15
const MIN_CENTER_WIDTH_PCT = 40
const MIN_EDITOR_HEIGHT_PX = 288
const MAX_EDITOR_HEIGHT_VH = 70
const MIN_BOTTOM_PANE_HEIGHT_PX = 176
const MIN_EDITOR_HEIGHT_COMPACT_PX = 160
const CENTER_VERTICAL_OVERHEAD_PX = 72

const COLLAPSED_RAIL_WIDTH_PX = 44
const SPLITTER_SIZE_PX = 8

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min
  }

  if (max < min) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeExpandedWidths(leftWidthPct, rightWidthPct) {
  let nextLeft = clamp(leftWidthPct, MIN_LEFT_WIDTH_PCT, 100 - MIN_CENTER_WIDTH_PCT)
  let nextRight = clamp(rightWidthPct, MIN_RIGHT_WIDTH_PCT, 100 - MIN_CENTER_WIDTH_PCT)
  const combined = nextLeft + nextRight
  const maxCombined = 100 - MIN_CENTER_WIDTH_PCT

  if (combined > maxCombined) {
    const overflow = combined - maxCombined
    const reducibleRight = Math.max(0, nextRight - MIN_RIGHT_WIDTH_PCT)
    const reduceRight = Math.min(overflow, reducibleRight)
    nextRight -= reduceRight

    const remaining = overflow - reduceRight
    if (remaining > 0) {
      nextLeft = Math.max(MIN_LEFT_WIDTH_PCT, nextLeft - remaining)
    }
  }

  return {
    leftWidthPct: nextLeft,
    rightWidthPct: nextRight,
  }
}

function getEditorHeightBounds(containerHeight) {
  if (typeof window === 'undefined') {
    return {
      min: MIN_EDITOR_HEIGHT_PX,
      max: DEFAULT_EDITOR_HEIGHT_PX,
    }
  }

  const viewportLimit = Math.floor(window.innerHeight * (MAX_EDITOR_HEIGHT_VH / 100))
  let nextMin = MIN_EDITOR_HEIGHT_PX
  let nextMax = Math.max(nextMin, viewportLimit)

  if (Number.isFinite(containerHeight) && containerHeight > 0) {
    const availableEditorHeight = Math.floor(
      containerHeight - MIN_BOTTOM_PANE_HEIGHT_PX - CENTER_VERTICAL_OVERHEAD_PX,
    )
    const compactMin = Math.max(
      MIN_EDITOR_HEIGHT_COMPACT_PX,
      Math.min(MIN_EDITOR_HEIGHT_PX, availableEditorHeight),
    )
    nextMin = compactMin
    nextMax = Math.min(nextMax, Math.max(nextMin, availableEditorHeight))
  }

  return {
    min: nextMin,
    max: Math.max(nextMin, nextMax),
  }
}

function clampEditorHeight(height, containerHeight) {
  const bounds = getEditorHeightBounds(containerHeight)
  return clamp(
    toNumber(height, DEFAULT_EDITOR_HEIGHT_PX),
    bounds.min,
    bounds.max,
  )
}

function readPersistedLayout() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    const normalizedWidths = normalizeExpandedWidths(
      toNumber(parsed?.leftWidthPct, DEFAULT_LEFT_WIDTH_PCT),
      toNumber(parsed?.rightWidthPct, DEFAULT_RIGHT_WIDTH_PCT),
    )

    return {
      leftWidthPct: normalizedWidths.leftWidthPct,
      rightWidthPct: normalizedWidths.rightWidthPct,
      leftCollapsed: Boolean(parsed?.leftCollapsed),
      rightCollapsed: Boolean(parsed?.rightCollapsed),
      editorHeightPx: clampEditorHeight(parsed?.editorHeightPx, 0),
      bottomPaneCollapsed: Boolean(parsed?.bottomPaneCollapsed),
    }
  } catch {
    return null
  }
}

function writePersistedLayout(layout) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Ignore storage write failures to avoid breaking workspace interactions.
  }
}

export function useWorkspacePaneLayout() {
  const initialLayout = useMemo(() => readPersistedLayout(), [])
  const workspaceRef = useRef(null)
  const centerPaneElementRef = useRef(null)
  const dragStateRef = useRef(null)
  const leftExpandedWidthRef = useRef(initialLayout?.leftWidthPct ?? DEFAULT_LEFT_WIDTH_PCT)
  const rightExpandedWidthRef = useRef(initialLayout?.rightWidthPct ?? DEFAULT_RIGHT_WIDTH_PCT)

  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MD_MEDIA_QUERY).matches : false,
  )
  const [leftWidthPct, setLeftWidthPct] = useState(
    initialLayout?.leftWidthPct ?? DEFAULT_LEFT_WIDTH_PCT,
  )
  const [rightWidthPct, setRightWidthPct] = useState(
    initialLayout?.rightWidthPct ?? DEFAULT_RIGHT_WIDTH_PCT,
  )
  const [leftCollapsed, setLeftCollapsed] = useState(initialLayout?.leftCollapsed ?? false)
  const [rightCollapsed, setRightCollapsed] = useState(initialLayout?.rightCollapsed ?? false)
  const [editorHeightPx, setEditorHeightPx] = useState(
    initialLayout?.editorHeightPx ?? DEFAULT_EDITOR_HEIGHT_PX,
  )
  const [bottomPaneCollapsed, setBottomPaneCollapsed] = useState(
    initialLayout?.bottomPaneCollapsed ?? false,
  )
  const [activeDragType, setActiveDragType] = useState('')
  const [hasCenterPaneNode, setHasCenterPaneNode] = useState(false)

  const leftWidthRef = useRef(leftWidthPct)
  const rightWidthRef = useRef(rightWidthPct)
  const leftCollapsedRef = useRef(leftCollapsed)
  const rightCollapsedRef = useRef(rightCollapsed)
  const editorHeightRef = useRef(editorHeightPx)
  const bottomPaneCollapsedRef = useRef(bottomPaneCollapsed)

  useEffect(() => {
    leftWidthRef.current = leftWidthPct
  }, [leftWidthPct])

  useEffect(() => {
    rightWidthRef.current = rightWidthPct
  }, [rightWidthPct])

  useEffect(() => {
    leftCollapsedRef.current = leftCollapsed
  }, [leftCollapsed])

  useEffect(() => {
    rightCollapsedRef.current = rightCollapsed
  }, [rightCollapsed])

  useEffect(() => {
    editorHeightRef.current = editorHeightPx
  }, [editorHeightPx])

  useEffect(() => {
    bottomPaneCollapsedRef.current = bottomPaneCollapsed
  }, [bottomPaneCollapsed])

  useEffect(() => {
    writePersistedLayout({
      leftWidthPct,
      rightWidthPct,
      leftCollapsed,
      rightCollapsed,
      editorHeightPx,
      bottomPaneCollapsed,
    })
  }, [
    leftWidthPct,
    rightWidthPct,
    leftCollapsed,
    rightCollapsed,
    editorHeightPx,
    bottomPaneCollapsed,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQueryList = window.matchMedia(MD_MEDIA_QUERY)
    const updateDesktopLayout = (event) => {
      setIsDesktopLayout(event.matches)
    }

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateDesktopLayout)
      return () => mediaQueryList.removeEventListener('change', updateDesktopLayout)
    }

    mediaQueryList.addListener(updateDesktopLayout)
    return () => mediaQueryList.removeListener(updateDesktopLayout)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      const containerHeight = centerPaneElementRef.current?.getBoundingClientRect().height || 0
      setEditorHeightPx((prev) => clampEditorHeight(prev, containerHeight))
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [hasCenterPaneNode])

  const stopDrag = useCallback(() => {
    if (!dragStateRef.current) {
      return
    }

    dragStateRef.current = null
    setActiveDragType('')

    if (typeof document !== 'undefined') {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  const beginDrag = useCallback(
    (type, event) => {
      if (!isDesktopLayout || event.button !== 0) {
        return
      }

      if (type === 'left' && leftCollapsedRef.current) {
        return
      }

      if (type === 'right' && rightCollapsedRef.current) {
        return
      }

      if ((type === 'center' || type === 'center-bottom') && bottomPaneCollapsedRef.current) {
        return
      }

      const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || 0
      if (workspaceWidth <= 0) {
        return
      }

      event.preventDefault()

      dragStateRef.current = {
        type,
        startX: event.clientX,
        startY: event.clientY,
        startLeftWidthPct: leftWidthRef.current,
        startRightWidthPct: rightWidthRef.current,
        startEditorHeightPx: editorHeightRef.current,
        workspaceWidth,
        centerHeight: centerPaneElementRef.current?.getBoundingClientRect().height || 0,
      }

      setActiveDragType(type)

      if (typeof document !== 'undefined') {
        document.body.style.userSelect = 'none'
        document.body.style.cursor =
          type === 'center' || type === 'center-bottom' ? 'row-resize' : 'col-resize'
      }
    },
    [isDesktopLayout],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      if (dragState.type === 'left') {
        const deltaPct = ((event.clientX - dragState.startX) / dragState.workspaceWidth) * 100
        const nextLeft = dragState.startLeftWidthPct + deltaPct
        const fixedRight = rightCollapsedRef.current ? 0 : dragState.startRightWidthPct
        const maxLeft = Math.max(MIN_LEFT_WIDTH_PCT, 100 - fixedRight - MIN_CENTER_WIDTH_PCT)
        setLeftWidthPct(clamp(nextLeft, MIN_LEFT_WIDTH_PCT, maxLeft))
        return
      }

      if (dragState.type === 'right') {
        const deltaPct = ((event.clientX - dragState.startX) / dragState.workspaceWidth) * 100
        const nextRight = dragState.startRightWidthPct - deltaPct
        const fixedLeft = leftCollapsedRef.current ? 0 : dragState.startLeftWidthPct
        const maxRight = Math.max(MIN_RIGHT_WIDTH_PCT, 100 - fixedLeft - MIN_CENTER_WIDTH_PCT)
        setRightWidthPct(clamp(nextRight, MIN_RIGHT_WIDTH_PCT, maxRight))
        return
      }

      if (dragState.type === 'center') {
        const deltaY = event.clientY - dragState.startY
        const nextHeight = dragState.startEditorHeightPx + deltaY
        setEditorHeightPx(clampEditorHeight(nextHeight, dragState.centerHeight))
        return
      }

      if (dragState.type === 'center-bottom') {
        const deltaY = event.clientY - dragState.startY
        const nextHeight = dragState.startEditorHeightPx - deltaY
        setEditorHeightPx(clampEditorHeight(nextHeight, dragState.centerHeight))
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }
  }, [stopDrag])

  useEffect(
    () => () => {
      if (typeof document !== 'undefined') {
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    },
    [],
  )

  const toggleLeftCollapsed = useCallback(() => {
    if (leftCollapsedRef.current) {
      const fixedRight = rightCollapsedRef.current ? 0 : rightWidthRef.current
      const maxLeft = Math.max(MIN_LEFT_WIDTH_PCT, 100 - fixedRight - MIN_CENTER_WIDTH_PCT)
      const restored = clamp(leftExpandedWidthRef.current, MIN_LEFT_WIDTH_PCT, maxLeft)
      setLeftWidthPct(restored)
      setLeftCollapsed(false)
      return
    }

    leftExpandedWidthRef.current = leftWidthRef.current
    setLeftCollapsed(true)
  }, [])

  const toggleRightCollapsed = useCallback(() => {
    if (rightCollapsedRef.current) {
      const fixedLeft = leftCollapsedRef.current ? 0 : leftWidthRef.current
      const maxRight = Math.max(MIN_RIGHT_WIDTH_PCT, 100 - fixedLeft - MIN_CENTER_WIDTH_PCT)
      const restored = clamp(rightExpandedWidthRef.current, MIN_RIGHT_WIDTH_PCT, maxRight)
      setRightWidthPct(restored)
      setRightCollapsed(false)
      return
    }

    rightExpandedWidthRef.current = rightWidthRef.current
    setRightCollapsed(true)
  }, [])

  const toggleBottomPaneCollapsed = useCallback(() => {
    setBottomPaneCollapsed((prev) => !prev)
  }, [])

  const centerPaneRef = useCallback((node) => {
    centerPaneElementRef.current = node
    setHasCenterPaneNode(Boolean(node))
  }, [])

  return {
    workspaceRef,
    centerPaneRef,
    isDesktopLayout,
    leftWidthPct,
    rightWidthPct,
    leftCollapsed,
    rightCollapsed,
    editorHeightPx,
    bottomPaneCollapsed,
    activeDragType,
    railWidthPx: COLLAPSED_RAIL_WIDTH_PX,
    splitterSizePx: SPLITTER_SIZE_PX,
    beginLeftResize: (event) => beginDrag('left', event),
    beginRightResize: (event) => beginDrag('right', event),
    beginCenterResize: (event) => beginDrag('center', event),
    beginCenterBottomResize: (event) => beginDrag('center-bottom', event),
    toggleLeftCollapsed,
    toggleRightCollapsed,
    toggleBottomPaneCollapsed,
  }
}
