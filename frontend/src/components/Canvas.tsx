import { useRef, useEffect, useCallback, useMemo } from 'react'
import type { StrokeEvent, StrokeType } from '../types'

const SIZE_MAP: Record<1 | 2 | 3, number> = { 1: 3, 2: 7, 3: 14 }

function buildCursor(sizePx: number, color: string): string {
  const r = Math.max(sizePx / 2, 2)
  const d = Math.ceil(r * 2 + 2)
  const c = d / 2
  const isWhite = color === '#ffffff'
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${d}' height='${d}'>`
    + `<circle cx='${c}' cy='${c}' r='${r}' fill='${isWhite ? 'none' : color}' stroke='${isWhite ? '#999' : '#333'}' stroke-width='1' ${isWhite ? "stroke-dasharray='2'" : ''}/>`
    + `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`
}

interface Props {
  strokes: StrokeEvent[]
  onStroke: (s: StrokeEvent) => void
  readonly: boolean
  color?: string
  strokeSize?: 1 | 2 | 3
}

export default function Canvas({ strokes, onStroke, readonly, color = '#000000', strokeSize = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursor = useMemo(() => readonly ? 'default' : buildCursor(SIZE_MAP[strokeSize], color), [readonly, strokeSize, color])
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderStrokes(ctx, strokes, canvas.width, canvas.height)
  }, [strokes])

  function renderStrokes(ctx: CanvasRenderingContext2D, evts: StrokeEvent[], w: number, h: number) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of evts) {
      const px = s.x * w
      const py = s.y * h
      if (s.type === 'START') {
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.strokeStyle = s.color
        ctx.lineWidth = SIZE_MAP[s.size as 1 | 2 | 3]
      } else if (s.type === 'MOVE') {
        ctx.lineTo(px, py)
        ctx.stroke()
      }
    }
  }

  function normalize(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: (clientX - rect.left) / canvas.offsetWidth,
      y: (clientY - rect.top) / canvas.offsetHeight,
    }
  }

  function emit(type: StrokeType, e: React.MouseEvent | React.TouchEvent) {
    if (readonly) return
    const { x, y } = normalize(e)
    const stroke: StrokeEvent = { x, y, color, size: strokeSize, type }
    onStroke(stroke)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = SIZE_MAP[strokeSize]
    if (type === 'START') {
      ctx.beginPath()
      ctx.moveTo(x * canvas.width, y * canvas.height)
    } else if (type === 'MOVE') {
      ctx.lineTo(x * canvas.width, y * canvas.height)
      ctx.stroke()
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    drawing.current = true
    emit('START', e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeSize, readonly])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing.current || !(e.buttons & 1)) return
    emit('MOVE', e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeSize, readonly])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drawing.current) return
    drawing.current = false
    emit('END', e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeSize, readonly])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    emit('START', e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeSize, readonly])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    emit('MOVE', e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeSize, readonly])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    drawing.current = false
    emit('END', e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeSize, readonly])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ width: '100%', height: 'auto', touchAction: 'none', border: '1px solid #ccc', background: '#fff', borderRadius: 8, cursor }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  )
}
