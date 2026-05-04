import type { Player } from '../types'
import styles from './Scoreboard.module.css'

interface Props {
  players: Player[]
  currentPlayerId: string
}

export default function Scoreboard({ players, currentPlayerId }: Props) {
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
            {p.id === currentPlayerId && ' (Du)'}
          </span>
          <span className={styles.score}>{p.score} Pkt</span>
        </div>
      ))}
    </div>
  )
}
