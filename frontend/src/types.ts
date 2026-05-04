export type GamePhase =
  | 'LOBBY' | 'CATEGORY' | 'DRAWING' | 'COUNTDOWN' | 'GUESSING' | 'RESULT'

export type DisplayMode = 'OWN_DEVICE' | 'SHARED_SCREEN'
export type Language = 'DE' | 'EN'
export type StrokeType = 'START' | 'MOVE' | 'END'

export interface StrokeEvent {
  x: number       // normalized 0.0–1.0
  y: number       // normalized 0.0–1.0
  color: string   // hex
  size: 1 | 2 | 3
  type: StrokeType
}

export interface Player {
  id: string
  nickname: string
  score: number
  connected: boolean
  isHost: boolean
}

export interface GameState {
  sessionId: string
  playerId: string
  isHost: boolean
  phase: GamePhase
  joinUrl?: string       // set by backend in GAME_STATE, used for QR code
  sessionError?: string  // set when backend sends ERROR (e.g. session not found)
  displayMode: DisplayMode
  language: Language
  players: Player[]
  // Drawing phase
  drawerId?: string
  drawerNickname?: string
  category?: string
  wordLength?: number
  firstLetter?: string
  secretWord?: string        // only set for the drawer
  strokeHistory: StrokeEvent[]
  // Guessing phase
  revealedLetters?: string[]
  secondsLeft?: number
  // Result
  lastWord?: string
  lastRoundReason?: 'guessed' | 'timeout'
  // Category voting
  categoryOptions?: string[]
  categoryVotes?: Record<string, string[]>   // category → player IDs
  categoryCountdownLeft?: number             // undefined = countdown not started
  myVote?: string                            // this player's current vote (tracked client-side)
}

export type MessageType =
  | 'JOIN' | 'START_GAME' | 'SELECT_CATEGORY' | 'VOTE_CATEGORY'
  | 'STROKE' | 'DRAWING_DONE' | 'GUESS'
  | 'GAME_STATE' | 'PLAYER_JOINED' | 'PLAYER_DISCONNECTED'
  | 'CATEGORY_OPTIONS' | 'CATEGORY_VOTES' | 'ROUND_STARTED' | 'WORD_SECRET'
  | 'COUNTDOWN' | 'HINT' | 'CORRECT_GUESS' | 'ROUND_ENDED' | 'TIMER_TICK' | 'ERROR'

export interface WsMessage {
  type: MessageType
  payload: Record<string, unknown>
}
