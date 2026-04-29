import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useWebSocket } from './useWebSocket'
import type { WsMessage } from '../types'

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  send(data: string) { this.sent.push(data) }
  close() { this.onclose?.() }
  simulateMessage(msg: WsMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
}

let mockWs: MockWebSocket
const MockWsConstructor = vi.fn(function (this: unknown) { mockWs = new MockWebSocket(); return mockWs }) as unknown as typeof WebSocket
;(MockWsConstructor as unknown as { OPEN: number }).OPEN = MockWebSocket.OPEN
vi.stubGlobal('WebSocket', MockWsConstructor)

describe('useWebSocket', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('connects to correct URL', () => {
    renderHook(() => useWebSocket('ABC123', vi.fn()))
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('/ws/ABC123'))
  })

  it('calls onMessage when server sends data', () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('ABC123', onMessage))
    act(() => { mockWs.simulateMessage({ type: 'PLAYER_JOINED', payload: { nickname: 'Ben' } }) })
    expect(onMessage).toHaveBeenCalledWith({ type: 'PLAYER_JOINED', payload: { nickname: 'Ben' } })
  })

  it('send() serializes and sends message', () => {
    const { result } = renderHook(() => useWebSocket('ABC123', vi.fn()))
    act(() => { mockWs.onopen?.() })
    act(() => { result.current.send({ type: 'GUESS', payload: { text: 'hello' } }) })
    expect(mockWs.sent).toContain(JSON.stringify({ type: 'GUESS', payload: { text: 'hello' } }))
  })
})
