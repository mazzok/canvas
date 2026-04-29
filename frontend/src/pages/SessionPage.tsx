import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useGameState } from '../hooks/useGameState'
import Lobby from './Lobby'
import Drawing from './Drawing'
import Watching from './Watching'
import Guessing from './Guessing'
import Result from './Result'

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { state, dispatch } = useGameState(sessionId!)
  const { send } = useWebSocket(sessionId!, dispatch)

  useEffect(() => {
    const storedPlayerId = localStorage.getItem(`playerId-${sessionId}`) ?? undefined
    const nickname = localStorage.getItem(`nickname-${sessionId}`) ?? 'Player'
    send({ type: 'JOIN', payload: { nickname, playerId: storedPlayerId } })
  }, [sessionId, send])

  useEffect(() => {
    if (state.playerId) {
      localStorage.setItem(`playerId-${sessionId}`, state.playerId)
    }
  }, [state.playerId, sessionId])

  if (state.phase === 'LOBBY' || state.phase === 'CATEGORY') {
    return <Lobby state={state} send={send} />
  }
  if (state.phase === 'DRAWING') {
    return state.playerId === state.drawerId
      ? <Drawing state={state} send={send} />
      : <Watching state={state} />
  }
  if (state.phase === 'COUNTDOWN') {
    return <Watching state={state} />
  }
  if (state.phase === 'GUESSING') {
    return <Guessing state={state} send={send} />
  }
  return <Result state={state} send={send} />
}
