import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState, WsMessage } from '../types'
import Canvas from '../components/Canvas'
import Timer from '../components/Timer'
import GuessFeed from '../components/GuessFeed'

interface Props { state: GameState; send: (m: WsMessage) => void }

export default function Watching({ state, send }: Props) {
  const { t } = useTranslation()
  const [guess, setGuess] = useState('')

  function submit() {
    if (!guess.trim()) return
    send({ type: 'GUESS', payload: { text: guess.trim() } })
    setGuess('')
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span>
          <strong>{state.drawerNickname}</strong> {t('drawing.otherDrawing')}
          {state.category && <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>({state.category})</span>}
        </span>
        <Timer seconds={state.secondsLeft ?? 60} />
      </div>

      <Canvas strokes={state.strokeHistory} onStroke={() => {}} readonly={true} />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t('guessing.placeholder')}
          autoFocus
          style={{ flex: 1, padding: 10, fontSize: 16 }}
        />
        <button onClick={submit} style={{ padding: '10px 20px' }}>{t('guessing.send')}</button>
      </div>

      <GuessFeed guesses={state.guesses} />
    </div>
  )
}
