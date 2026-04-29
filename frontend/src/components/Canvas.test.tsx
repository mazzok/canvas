import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Canvas from './Canvas'
import type { StrokeEvent } from '../types'

describe('Canvas', () => {
  it('renders a canvas element', () => {
    const { container } = render(
      <Canvas strokes={[]} onStroke={vi.fn()} readonly={false} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('calls onStroke with normalized coords on mousedown', () => {
    const onStroke = vi.fn()
    const { container } = render(
      <Canvas strokes={[]} onStroke={onStroke} readonly={false}
              color="#ff0000" strokeSize={1} />
    )
    const canvas = container.querySelector('canvas')!
    Object.defineProperty(canvas, 'offsetWidth', { value: 400 })
    Object.defineProperty(canvas, 'offsetHeight', { value: 300 })
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 150, buttons: 1 })
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'START', color: '#ff0000', size: 1 })
    )
    const call = onStroke.mock.calls[0][0] as StrokeEvent
    // 200/400 = 0.5
    expect(call.x).toBeCloseTo(0.5)
    expect(call.y).toBeCloseTo(0.5)
  })

  it('does not emit strokes when readonly', () => {
    const onStroke = vi.fn()
    const { container } = render(
      <Canvas strokes={[]} onStroke={onStroke} readonly={true} />
    )
    fireEvent.mouseDown(container.querySelector('canvas')!)
    expect(onStroke).not.toHaveBeenCalled()
  })
})
