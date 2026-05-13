import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameState, WsMessage, StrokeEvent } from '../types'
import Canvas from '../components/Canvas'
import ColorPicker from '../components/ColorPicker'
import Timer from '../components/Timer'
import GuessFeed from '../components/GuessFeed'

interface Props { state: GameState; send: (m: WsMessage) => void }

export default function Drawing({ state, send }: Props) {
  const { t } = useTranslation()
  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState<1 | 2 | 3>(1)

  function handleStroke(stroke: StrokeEvent) {
    send({ type: 'STROKE', payload: stroke as unknown as Record<string, unknown> })
  }

  function handleDone() {
    send({ type: 'DRAWING_DONE', payload: {} })
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ color: '#888', fontSize: 14 }}>{t('drawing.draw')} </span>
          <strong style={{ fontSize: 18 }}>{state.secretWord}</strong>
        </div>
        <Timer seconds={state.secondsLeft ?? 60} />
      </div>
      <Canvas
        strokes={state.strokeHistory}
        onStroke={handleStroke}
        readonly={false}
        color={color}
        strokeSize={size}
      />
      <div style={{ marginTop: 12 }}>
        <ColorPicker color={color} size={size} onColorChange={setColor} onSizeChange={setSize} />
      </div>
      <GuessFeed guesses={state.guesses} />
      <button onClick={handleDone} style={{ width: '100%', padding: 12, marginTop: 12, color: '#e74c3c', border: '1px solid #e74c3c', background: 'white', borderRadius: 6 }}>
        {t('drawing.done')}
      </button>
    </div>
  )
}
