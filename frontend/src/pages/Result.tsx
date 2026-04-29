import { useTranslation } from 'react-i18next'
import type { GameState, WsMessage } from '../types'
import Scoreboard from '../components/Scoreboard'

interface Props { state: GameState; send: (m: WsMessage) => void }

export default function Result({ state, send }: Props) {
  const { t } = useTranslation()

  function nextRound() {
    send({ type: 'START_GAME', payload: {} })
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h2>
        {state.lastRoundReason === 'guessed'
          ? `🎉 ${t('result.correct')}`
          : `⏰ ${t('result.timeout')}`}
      </h2>
      <p>{t('result.theWord')} <strong>{state.lastWord}</strong></p>
      <div style={{ margin: '24px 0' }}>
        <Scoreboard players={state.players} currentPlayerId={state.playerId} />
      </div>
      {state.isHost && (
        <button onClick={nextRound} style={{ width: '100%', padding: 14, marginBottom: 8, fontSize: 16 }}>
          {t('result.nextRound')}
        </button>
      )}
      {!state.isHost && <p style={{ color: '#888' }}>{t('lobby.waitingForHost')}</p>}
    </div>
  )
}
