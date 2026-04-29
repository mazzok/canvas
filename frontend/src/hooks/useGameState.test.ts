import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useGameState } from './useGameState'
import type { WsMessage } from '../types'

function applyMessage(result: ReturnType<typeof useGameState>, msg: WsMessage) {
  act(() => result.dispatch(msg))
}

describe('useGameState', () => {
  it('initialises with empty state', () => {
    const { result } = renderHook(() => useGameState('ABC123'))
    expect(result.current.state.phase).toBe('LOBBY')
    expect(result.current.state.players).toHaveLength(0)
  })

  it('GAME_STATE sets phase and players', () => {
    const { result } = renderHook(() => useGameState('ABC123'))
    applyMessage(result.current, {
      type: 'GAME_STATE',
      payload: {
        playerId: 'p1', isHost: true, phase: 'LOBBY',
        displayMode: 'OWN_DEVICE', language: 'DE',
        players: [{ id: 'p1', nickname: 'Anna', score: 0, connected: true, isHost: true }],
        strokeHistory: [],
      },
    })
    expect(result.current.state.playerId).toBe('p1')
    expect(result.current.state.players).toHaveLength(1)
  })

  it('ROUND_STARTED sets drawer info and phase to DRAWING', () => {
    const { result } = renderHook(() => useGameState('ABC123'))
    applyMessage(result.current, {
      type: 'ROUND_STARTED',
      payload: { drawerId: 'p2', drawerNickname: 'Ben', category: 'tiere', wordLength: 13, firstLetter: 'S' },
    })
    expect(result.current.state.phase).toBe('DRAWING')
    expect(result.current.state.drawerId).toBe('p2')
  })

  it('STROKE appends to strokeHistory', () => {
    const { result } = renderHook(() => useGameState('ABC123'))
    applyMessage(result.current, {
      type: 'STROKE',
      payload: { x: 0.5, y: 0.5, color: '#000', size: 1, type: 'START' },
    })
    expect(result.current.state.strokeHistory).toHaveLength(1)
  })

  it('ROUND_ENDED clears stroke history and sets RESULT phase', () => {
    const { result } = renderHook(() => useGameState('ABC123'))
    applyMessage(result.current, {
      type: 'ROUND_ENDED',
      payload: { word: 'Schmetterling', reason: 'guessed', scores: [] },
    })
    expect(result.current.state.phase).toBe('RESULT')
    expect(result.current.state.strokeHistory).toHaveLength(0)
    expect(result.current.state.lastWord).toBe('Schmetterling')
  })
})
