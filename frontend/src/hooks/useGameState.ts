import { useReducer, useCallback } from 'react'
import type { GameState, WsMessage, StrokeEvent, Player } from '../types'

const initial: GameState = {
  sessionId: '',
  playerId: '',
  isHost: false,
  phase: 'LOBBY',
  displayMode: 'OWN_DEVICE',
  language: 'DE',
  players: [],
  strokeHistory: [],
}

function reducer(state: GameState, msg: WsMessage): GameState {
  const p = msg.payload
  switch (msg.type) {
    case 'GAME_STATE':
      return {
        ...state,
        playerId: p.playerId as string,
        isHost: p.isHost as boolean,
        phase: p.phase as GameState['phase'],
        displayMode: p.displayMode as GameState['displayMode'],
        language: p.language as GameState['language'],
        players: p.players as Player[],
        strokeHistory: (p.strokeHistory as StrokeEvent[]) ?? [],
        joinUrl: p.joinUrl as string | undefined,
        categoryVotes: undefined,
        categoryCountdownLeft: undefined,
        categoryOptions: undefined,
      }
    case 'PLAYER_JOINED':
      return { ...state, players: p.players as Player[] }
    case 'PLAYER_DISCONNECTED':
      return {
        ...state,
        players: state.players.map(pl =>
          pl.id === p.playerId ? { ...pl, connected: false } : pl),
      }
    case 'CATEGORY_OPTIONS':
      return { ...state, phase: 'CATEGORY', categoryOptions: msg.payload.categories as string[] }
    case 'CATEGORY_VOTES': {
      const p = msg.payload
      return {
        ...state,
        categoryVotes: p.votes as Record<string, string[]>,
        categoryCountdownLeft: p.countdownStarted ? p.secondsLeft as number : undefined,
      }
    }
    case 'ROUND_STARTED':
      return {
        ...state,
        phase: 'DRAWING',
        drawerId: p.drawerId as string,
        drawerNickname: p.drawerNickname as string,
        category: p.category as string,
        wordLength: p.wordLength as number,
        firstLetter: p.firstLetter as string,
        secretWord: undefined,
        strokeHistory: [],
        revealedLetters: undefined,
        categoryVotes: undefined,
        categoryCountdownLeft: undefined,
        categoryOptions: undefined,
      }
    case 'WORD_SECRET':
      return { ...state, secretWord: p.word as string }
    case 'STROKE':
      return {
        ...state,
        strokeHistory: [...state.strokeHistory, p as unknown as StrokeEvent],
      }
    case 'COUNTDOWN':
      return { ...state, phase: 'COUNTDOWN' }
    case 'HINT':
      return { ...state, revealedLetters: p.revealedLetters as string[] }
    case 'TIMER_TICK':
      return {
        ...state,
        phase: p.phase as GameState['phase'],
        secondsLeft: p.secondsLeft as number,
      }
    case 'CORRECT_GUESS':
      return { ...state, players: p.scores as Player[] }
    case 'ROUND_ENDED':
      return {
        ...state,
        phase: 'RESULT',
        lastWord: p.word as string,
        lastRoundReason: p.reason as 'guessed' | 'timeout',
        strokeHistory: [],
        players: (p.scores as Player[]) ?? state.players,
      }
    case 'ERROR':
      return { ...state, sessionError: p.message as string }
    default:
      return state
  }
}

export function useGameState(sessionId: string) {
  const [state, dispatch] = useReducer(reducer, { ...initial, sessionId })
  const dispatchMsg = useCallback((msg: WsMessage) => dispatch(msg), [])
  return { state, dispatch: dispatchMsg }
}
