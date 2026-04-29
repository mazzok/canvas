import type { GameState, WsMessage } from '../types'
export default function Result(_: { state: GameState; send: (m: WsMessage) => void }) {
  return <div>Result</div>
}
