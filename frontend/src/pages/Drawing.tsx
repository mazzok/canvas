import type { GameState, WsMessage } from '../types'
export default function Drawing(_: { state: GameState; send: (m: WsMessage) => void }) {
  return <div>Drawing</div>
}
