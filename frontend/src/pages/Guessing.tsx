import type { GameState, WsMessage } from '../types'
export default function Guessing(_: { state: GameState; send: (m: WsMessage) => void }) {
  return <div>Guessing</div>
}
