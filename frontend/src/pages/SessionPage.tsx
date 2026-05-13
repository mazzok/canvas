import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state, dispatch } = useGameState(sessionId!)
  const { send } = useWebSocket(sessionId!, dispatch)
  const [popupText, setPopupText] = useState<string | null>(null)
  const prevPhase = useRef(state.phase)

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

  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = state.phase
    let text: string | null = null
    if (prev === 'RESULT' && state.phase === 'CATEGORY') {
      text = t('result.nextRound', 'Neue Runde!')
    } else if (prev === 'CATEGORY' && state.phase === 'DRAWING') {
      text = state.playerId === state.drawerId
        ? `${t('drawing.yourTurn', 'Du zeichnest!')} ✏️`
        : `${state.drawerNickname} ${t('drawing.otherDrawing', 'zeichnet')} 🎨`
    }
    if (text) {
      setPopupText(text)
      const timer = setTimeout(() => setPopupText(null), 1500)
      return () => clearTimeout(timer)
    }
  }, [state.phase])

  const popup = popupText && (
    <div className={styles.newRoundOverlay} key={popupText}>
      <div className={styles.newRoundText}>{popupText}</div>
    </div>
  )

  if (state.phase === 'LOBBY' || state.phase === 'CATEGORY') {
    return (
      <div className={styles.container}>
        {popup}
        <Lobby state={state} send={send} />
      </div>
    )
  }
  if (state.phase === 'DRAWING') {
    return (
      <div className={styles.container}>
        {popup}
        {state.playerId === state.drawerId
          ? <Drawing state={state} send={send} />
          : <Watching state={state} send={send} />}
      </div>
    )
  }
  if (state.phase === 'GUESSING') {
    return <div className={styles.container}><Guessing state={state} send={send} /></div>
  }
  return <div className={styles.container}><Result state={state} send={send} /></div>
}
