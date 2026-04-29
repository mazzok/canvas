# Drawing & Guessing Game — Design Spec

**Date:** 2026-04-29
**Status:** Approved

---

## Overview

A browser-based multiplayer drawing and guessing game targeted at children up to age 10. One player draws a word from a chosen category; all others try to guess it. Playable on smartphones, tablets, and desktops via any modern browser — no app installation required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (mobile-first, responsive) |
| Backend | Quarkus + Jakarta EE |
| Real-time | Jakarta WebSocket |
| Database | MongoDB (word lists only) |
| State | In-memory (Quarkus) |
| Deployment | Single Docker container (Quarkus serves React build) + MongoDB container |

---

## Architecture

```
React Frontend (mobile-first, responsive)
  │
  ├── REST  →  POST /api/sessions         (create session, get QR code URL)
  └── WebSocket  →  /ws/{sessionId}       (all real-time game events)
                         │
              Quarkus Backend
                - SessionManager (in-memory sessions)
                - GameEngine (phase transitions, timer, scoring)
                - WebSocket Endpoint (broadcast/unicast)
                         │
                      MongoDB
                - word_lists collection (categories + words)
```

- The Quarkus application serves the React production build as static resources — one deployable unit.
- All game timers run server-side. Clients receive `TIMER_TICK` events and display countdowns; they never trust their own clock for game logic.
- MongoDB is used exclusively for word lists. No game state is persisted to the database.

---

## Game Flow

### Session Lifecycle

1. **Host creates session** → enters nickname → receives QR code + session URL (e.g. `https://domain.com/join/ABC123`)
2. **Players join** → scan QR or open URL → enter nickname → land in lobby
3. **Lobby** → all players see the player list; host sees a "Start Game" button
4. **Host starts game** → category selection screen
5. **Category selection** → host picks one category; all players see the choice
6. **Drawer selection** → server randomly selects a player as drawer; all players see who was selected
7. **Drawing phase** → drawer sees the secret word and draws (max 60 seconds); others see the live canvas and a countdown
8. **Drawer can end early** → taps "Fertig" button
9. **Countdown** → 3 … 2 … 1 shown on all devices simultaneously
10. **Guessing phase** → all players except drawer type their guess (max 60 seconds)
11. **Result** → word revealed, points awarded, scoreboard shown
12. **Next round** → host starts another round (back to category selection) or ends the session
13. **Session ends** → final scoreboard shown; no persistent storage of scores

### Display Modes (configured at session start)

| Mode | Description |
|---|---|
| **Own Device** | Drawer draws on their device; all other players see the live canvas on their own device |
| **Shared Screen** | Drawer draws on their device; all others watch a shared screen (TV/laptop) showing the canvas |

---

## Categories & Word Lists

Five categories, all tailored for children up to age 10:

- **Tiere** (Animals)
- **Pflanzen** (Plants)
- **Natur** (Nature)
- **Märchen** (Fairy Tales)
- **Garten** (Garden)

Word lists are stored in MongoDB (`word_lists` collection) and loaded at startup. Each entry:

```json
{
  "category": "tiere",
  "language": "de",
  "words": ["Schmetterling", "Elefant", "Igel", ...]
}
```

---

## Drawing Tools

Minimal tool set, optimised for touchscreen use:

- **Pencil** — free drawing (touch + mouse support)
- **Eraser**
- **Stroke size** — 3 sizes (small, medium, large)
- **Color palette** — 20 fixed colors

No undo, no fill tool, no shapes. The canvas is cleared between rounds.

---

## Scoring

| Outcome | Points |
|---|---|
| Word correctly guessed | Drawer: +2, First correct guesser: +1 |
| Word not guessed within time | Nobody: +0 |

Only the **first** correct guesser receives a point. The drawer receives points only if the word was guessed by at least one player.

### Hint System (during guessing phase)

The word is displayed as: first letter + underscores for remaining letters (e.g. `S _ _ _ _ _ _ _ _ _`).

Additional letters are revealed at fixed intervals (elapsed from the start of the guessing phase):
- **20 seconds** elapsed → reveal 2nd letter
- **40 seconds** elapsed → reveal 3rd letter
- **50 seconds** elapsed → reveal 4th letter

---

## WebSocket Protocol

All messages are JSON. Direction: C = Client, S = Server.

| Direction | Event | Key Payload Fields |
|---|---|---|
| C→S | `JOIN` | `sessionId, nickname, playerId?` (playerId for reconnect) |
| S→C | `GAME_STATE` | full state snapshot + `strokeHistory[]` (reconnect replay) |
| S→C | `PLAYER_JOINED` | `nickname, playerList` |
| S→C | `PLAYER_DISCONNECTED` | `playerId, connected: false` |
| C→S | `START_GAME` | *(host only)* |
| S→C | `CATEGORY_OPTIONS` | `categories[]` |
| C→S | `SELECT_CATEGORY` | `category` *(host only)* |
| S→C | `ROUND_STARTED` | `drawer, category, wordLength, firstLetter` |
| S→C | `WORD_SECRET` | `word` *(unicast to drawer only)* |
| C→S | `STROKE` | `x, y, color, size, type: start/move/end` |
| S→C | `STROKE` | broadcast to all except drawer |
| C→S | `DRAWING_DONE` | *(drawer ends early)* |
| S→C | `COUNTDOWN` | `seconds: 3/2/1` |
| S→C | `HINT` | `revealedLetters: ["S","_","h","_","_",...]` |
| C→S | `GUESS` | `text` |
| S→C | `CORRECT_GUESS` | `winnerId, winnerNickname, scores` |
| S→C | `ROUND_ENDED` | `word, scores, reason: guessed/timeout` |
| S→C | `TIMER_TICK` | `phase, secondsLeft` |

---

## Data Model

### In-Memory Session State

```
Session {
  id: String                        // e.g. "ABC123" (6-char alphanumeric)
  hostId: String
  phase: LOBBY | CATEGORY | DRAWING | COUNTDOWN | GUESSING | RESULT
  displayMode: OWN_DEVICE | SHARED_SCREEN
  language: DE | EN
  players: Map<playerId, Player>
  currentRound: Round | null
}

Player {
  id: String                        // UUID, stable across reconnects
  nickname: String
  score: int
  connected: boolean
  isHost: boolean
}

Round {
  drawerId: String
  word: String
  category: String
  strokeHistory: List<StrokeEvent>  // replayed to reconnecting players
  drawingStartedAt: Instant
  guessingStartedAt: Instant | null
}

StrokeEvent {
  x: float, y: float
  color: String
  size: int                         // 1 | 2 | 3
  type: START | MOVE | END
}
```

### MongoDB Schema

```
Collection: word_lists
{
  category: String,   // "tiere" | "pflanzen" | "natur" | "maerchen" | "garten"
  language: String,   // "de" | "en"
  words: String[]
}
```

---

## Reconnect Flow

1. Client stores its `playerId` (UUID) in `localStorage` on first join
2. On reconnect, client sends `JOIN` with the stored `playerId`
3. Server matches `playerId` → sets `connected: true`
4. Server sends `GAME_STATE` with current phase + full `strokeHistory`
5. Client replays stroke events to reconstruct the current canvas state

---

## Beitritts-Flow (Join Flow)

```
Host:   „Neue Session" → Nickname eingeben → Lobby (sieht QR + Player-Liste + Start-Button)
Player: QR scannen / URL öffnen → Nickname eingeben → Lobby (sieht Player-Liste)
```

Both paths go through the same Nickname screen. The host's `playerId` is marked as `isHost: true` in the session.

---

## Localisation

Language is selected on the start screen (DE / EN). The selection applies to:
- All UI labels and button text
- Word lists served from MongoDB (filtered by `language` field)
- Hint display and result messages

---

## Project Structure

```
canvas/
├── backend/                        # Quarkus + Jakarta EE
│   ├── src/main/java/
│   │   ├── session/                # SessionManager, GameEngine
│   │   ├── websocket/              # WebSocket endpoint
│   │   ├── rest/                   # REST: create session, QR code
│   │   └── model/                  # Session, Player, Round, StrokeEvent
│   └── src/main/resources/
│       └── words/                  # Seed word lists (JSON → MongoDB import)
├── frontend/                       # React
│   ├── src/
│   │   ├── pages/                  # Home, Lobby, Drawing, Guessing, Result
│   │   ├── components/             # Canvas, Timer, Scoreboard, WordHint, ColorPicker
│   │   └── hooks/                  # useWebSocket, useGameState
│   └── ...
└── docker-compose.yml              # Quarkus + MongoDB for local dev
```

---

## Deployment

- Quarkus builds React as static resources → single Docker image
- MongoDB as a separate container (or MongoDB Atlas)
- `docker-compose.yml` for local development
- Target: any VPS or cloud provider (Railway, Fly.io, Hetzner, etc.)
