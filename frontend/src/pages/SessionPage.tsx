import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useGameState } from '../hooks/useGameState'
import Lobby from './Lobby'
import Drawing from './Drawing'
import Watching from './Watching'
import Guessing from './Guessing'
import Result from './Result'
import styles from './SessionPage.module.css'

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { state, dispatch } = useGameState(sessionId!)
  const { send } = useWebSocket(sessionId!, dispatch)

  useEffect(() => {
    if (state.sessionError) {
      localStorage.removeItem(`playerId-${sessionId}`)
      localStorage.removeItem(`nickname-${sessionId}`)
      navigate('/')
    }
  }, [state.sessionError, sessionId, navigate])

  useEffect(() => {
    const storedPlayerId = localStorage.getItem(`playerId-${sessionId}`) ?? undefined
    const nickname = localStorage.getItem(`nickname-${sessionId}`) ?? 'Player'
    console.log('[JOIN] sending, playerId=', storedPlayerId, 'nickname=', nickname)
    send({ type: 'JOIN', payload: { nickname, playerId: storedPlayerId } })
  }, [sessionId, send])

  useEffect(() => {
    if (state.playerId) {
      localStorage.setItem(`playerId-${sessionId}`, state.playerId)
    }
  }, [state.playerId, sessionId])

  if (state.phase === 'LOBBY' || state.phase === 'CATEGORY') {
    return <div className={styles.container}><Lobby state={state} send={send} /></div>
  }
  if (state.phase === 'DRAWING') {
    return (
      <div className={styles.container}>
        {state.playerId === state.drawerId
          ? <Drawing state={state} send={send} />
          : <Watching state={state} />}
      </div>
    )
  }
  if (state.phase === 'COUNTDOWN') {
    return <div className={styles.container}><Watching state={state} /></div>
  }
  if (state.phase === 'GUESSING') {
    return <div className={styles.container}><Guessing state={state} send={send} /></div>
  }
  return <div className={styles.container}><Result state={state} send={send} /></div>
}
