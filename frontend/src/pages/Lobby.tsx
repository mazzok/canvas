import type { GameState, WsMessage } from '../types'
export default function Lobby(_: { state: GameState; send: (m: WsMessage) => void }) {
  return <div>Lobby</div>
}
