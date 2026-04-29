import type { Player } from '../types'
import { useTranslation } from 'react-i18next'

interface Props { players: Player[]; currentPlayerId: string }

export default function Scoreboard({ players, currentPlayerId }: Props) {
  const { t } = useTranslation()
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return (
    <div>
      <h3>{t('result.scores')}</h3>
      {sorted.map((p, i) => (
        <div key={p.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 12px', marginBottom: 4,
          background: p.id === currentPlayerId ? '#4a9eff22' : '#f5f5f5',
          borderRadius: 6, fontWeight: p.id === currentPlayerId ? 'bold' : 'normal',
        }}>
          <span>{i + 1}. {p.nickname} {p.isHost ? `(${t('common.host')})` : ''} {p.id === currentPlayerId ? `(${t('common.you')})` : ''}</span>
          <span>{p.score} {t('common.points')}</span>
        </div>
      ))}
    </div>
  )
}
