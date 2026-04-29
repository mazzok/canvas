import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import type { GameState, WsMessage } from '../types'
import Scoreboard from '../components/Scoreboard'

interface Props { state: GameState; send: (m: WsMessage) => void }

export default function Lobby({ state, send }: Props) {
  const { t } = useTranslation()
  const joinUrl = `${window.location.origin}/join/${state.sessionId}`

  const categories = ['tiere', 'pflanzen', 'natur', 'maerchen', 'garten']

  function startGame() {
    send({ type: 'START_GAME', payload: {} })
  }

  function selectCategory(cat: string) {
    send({ type: 'SELECT_CATEGORY', payload: { category: cat } })
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h2>{t('lobby.title')}</h2>

      {state.phase === 'LOBBY' && (
        <>
          {state.isHost && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <p style={{ color: '#666', fontSize: 14 }}>{t('lobby.scanQr')}</p>
              <QRCodeSVG value={joinUrl} size={160} />
              <p style={{ fontSize: 12, wordBreak: 'break-all', color: '#888' }}>{joinUrl}</p>
            </div>
          )}
          <Scoreboard players={state.players} currentPlayerId={state.playerId} />
          {state.isHost && (
            <button onClick={startGame} style={{ width: '100%', padding: 14, marginTop: 16, fontSize: 16 }}>
              {t('lobby.startGame')}
            </button>
          )}
          {!state.isHost && <p style={{ textAlign: 'center', color: '#888' }}>{t('lobby.waitingForHost')}</p>}
        </>
      )}

      {state.phase === 'CATEGORY' && state.isHost && (
        <div>
          <h3>Kategorie wählen:</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => selectCategory(cat)} style={{ padding: 12, fontSize: 16 }}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
      {state.phase === 'CATEGORY' && !state.isHost && (
        <p style={{ textAlign: 'center', color: '#888' }}>Host wählt Kategorie...</p>
      )}
    </div>
  )
}
