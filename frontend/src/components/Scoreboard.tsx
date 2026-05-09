import { useTranslation } from 'react-i18next'
import type { Player } from '../types'
import styles from './Scoreboard.module.css'

interface Props {
  players: Player[]
  currentPlayerId: string
}

export default function Scoreboard({ players, currentPlayerId }: Props) {
  const { t } = useTranslation()
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return (
    <div className={styles.board}>
      {sorted.map(p => (
        <div
          key={p.id}
          className={`${styles.row} ${p.id === currentPlayerId ? styles.rowSelf : ''}`}
        >
          <span className={styles.name}>
            {p.nickname}
            {p.isHost && ' 👑'}
            {p.id === currentPlayerId && ` (${t('common.you', 'Du')})`}
          </span>
          <span className={styles.score}>{p.score} {t('common.points', 'Pkt')}</span>
        </div>
      ))}
    </div>
  )
}
