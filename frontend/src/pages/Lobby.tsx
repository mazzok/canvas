import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import type { GameState, WsMessage } from '../types'
import styles from './Lobby.module.css'

const CATEGORY_EMOJI: Record<string, string> = {
  tiere: '🐾',
  pflanzen: '🌿',
  natur: '🌄',
  maerchen: '🧚',
  garten: '🌻',
}

interface Props {
  state: GameState
  send: (msg: WsMessage) => void
}

export default function Lobby({ state, send }: Props) {
  const { t } = useTranslation()
  const joinUrl = state.joinUrl ?? `${window.location.origin}/join/${state.sessionId}`

  const voteCategory = (cat: string) => {
    send({ type: 'VOTE_CATEGORY', payload: { category: cat } })
  }

  const startGame = () => send({ type: 'START_GAME', payload: {} })

  // Map playerId → player for rendering voter chips
  const playerMap = Object.fromEntries(state.players.map(p => [p.id, p]))

  const categories = state.categoryOptions ?? ['tiere', 'pflanzen', 'natur', 'maerchen', 'garten']
  const votes = state.categoryVotes ?? {}
  const countdown = state.categoryCountdownLeft
  const countdownStarted = countdown !== undefined

  return (
    <div className={styles.page}>
      {/* Countdown banner — only shown after first vote */}
      {countdownStarted && (
        <div className={styles.countdown}>
          <div className={styles.countdownLabel}>{t('lobby.startsIn', 'Spiel startet in')}</div>
          <div className={styles.countdownNumber}>{countdown}</div>
          <div className={styles.countdownBar}>
            <div
              className={styles.countdownBarFill}
              style={{ width: `${((countdown ?? 0) / 10) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Category selection — shown in CATEGORY phase */}
      {state.phase === 'CATEGORY' && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>{t('lobby.chooseCategory', 'Kategorie wählen')}</div>
          <div className={styles.categoryGrid}>
            {categories.map(cat => {
              const voters = votes[cat] ?? []
              const isMine = voters.includes(state.playerId)
              return (
                <button
                  key={cat}
                  className={`${styles.categoryBtn} ${isMine ? styles.categoryBtnSelected : ''}`}
                  onClick={() => voteCategory(cat)}
                >
                  <div className={styles.categoryEmoji}>{CATEGORY_EMOJI[cat] ?? '🎯'}</div>
                  <div className={styles.categoryName}>{cat}</div>
                  {isMine && <span className={styles.categoryCheck}>✓</span>}
                  {voters.length > 0 && (
                    <div className={styles.voterChips}>
                      {voters.map(vid => (
                        <span
                          key={vid}
                          className={`${styles.chip} ${vid === state.playerId ? styles.chipSelf : ''}`}
                        >
                          {vid === state.playerId ? 'Du' : (playerMap[vid]?.nickname ?? vid.slice(0, 6))}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          {countdownStarted && (
            <div className={styles.hintText}>{t('lobby.canChange', 'Du kannst deine Wahl noch ändern')}</div>
          )}
        </div>
      )}

      {/* Player list with votes */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          {t('lobby.players', 'Spieler')} ({state.players.length})
        </div>
        {state.players.map(p => {
          const votedCat = Object.entries(votes).find(([, ids]) => ids.includes(p.id))?.[0]
          return (
            <div
              key={p.id}
              className={`${styles.playerRow} ${p.id === state.playerId ? styles.playerRowSelf : ''}`}
            >
              <span className={styles.playerName}>
                {p.id === state.playerId ? `${p.nickname} (Du)` : p.nickname}
                {p.isHost && ' 👑'}
              </span>
              {state.phase === 'CATEGORY' && (
                votedCat
                  ? <span className={styles.playerVoteChip}>{CATEGORY_EMOJI[votedCat]} {votedCat}</span>
                  : <span className={styles.playerNoVote}>{t('lobby.choosing', 'wählt…')}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Host controls + QR in LOBBY phase */}
      {state.phase === 'LOBBY' && (
        <div className={styles.card}>
          {state.isHost && (
            <div className={styles.qrSection}>
              <QRCodeSVG value={joinUrl} size={160} />
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>{joinUrl}</p>
              <button className={styles.startBtn} onClick={startGame}>
                {t('lobby.startGame', 'Spiel starten')}
              </button>
            </div>
          )}
          {!state.isHost && (
            <div className={styles.waitText}>{t('lobby.waitHost', 'Warte auf den Host…')}</div>
          )}
        </div>
      )}
    </div>
  )
}
