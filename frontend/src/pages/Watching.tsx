import { useTranslation } from 'react-i18next'
import type { GameState } from '../types'
import Canvas from '../components/Canvas'
import Timer from '../components/Timer'

interface Props { state: GameState }

export default function Watching({ state }: Props) {
  const { t } = useTranslation()

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span>
          <strong>{state.drawerNickname}</strong> {t('drawing.otherDrawing')}
        </span>
        {state.phase === 'DRAWING' && <Timer seconds={state.secondsLeft ?? 60} />}
      </div>

      <Canvas strokes={state.strokeHistory} onStroke={() => {}} readonly={true} />

      {state.phase === 'COUNTDOWN' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 120, color: 'white', fontWeight: 'bold',
        }}>
          {state.secondsLeft ?? '…'}
        </div>
      )}
    </div>
  )
}
