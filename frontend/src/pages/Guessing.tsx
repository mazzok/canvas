import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState, WsMessage } from '../types'
import Canvas from '../components/Canvas'
import WordHint from '../components/WordHint'
import Timer from '../components/Timer'
import GuessFeed from '../components/GuessFeed'

interface Props { state: GameState; send: (m: WsMessage) => void }

export default function Guessing({ state, send }: Props) {
  const { t } = useTranslation()
  const [guess, setGuess] = useState('')
  const isDrawer = state.playerId === state.drawerId

  function submit() {
    if (!guess.trim()) return
    send({ type: 'GUESS', payload: { text: guess.trim() } })
    setGuess('')
  }

  const letters = state.revealedLetters ?? [
    state.firstLetter ?? '_',
    ...Array((state.wordLength ?? 1) - 1).fill('_'),
  ]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span>
          {t('guessing.guess')}
          {state.category && <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>({state.category})</span>}
        </span>
        <Timer seconds={state.secondsLeft ?? 60} />
      </div>
      <Canvas strokes={state.strokeHistory} onStroke={() => {}} readonly={true} />
      <div style={{ margin: '16px 0' }}>
        <WordHint letters={letters} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t('guessing.placeholder')}
          autoFocus
          disabled={isDrawer}
          style={{ flex: 1, padding: 10, fontSize: 16, opacity: isDrawer ? 0.4 : 1 }}
        />
        <button onClick={submit} disabled={isDrawer} style={{ padding: '10px 20px', opacity: isDrawer ? 0.4 : 1 }}>{t('guessing.send')}</button>
      </div>
      <GuessFeed guesses={state.guesses} />
    </div>
  )
}
