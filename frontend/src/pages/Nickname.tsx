import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Nickname() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')

  function handleJoin() {
    if (!nickname.trim()) return
    localStorage.setItem(`nickname-${sessionId}`, nickname.trim())
    navigate(`/session/${sessionId}`)
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24, textAlign: 'center' }}>
      <h2>{t('nickname.title')}</h2>
      <input
        placeholder={t('nickname.placeholder')}
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
        autoFocus
        style={{ width: '100%', padding: 10, fontSize: 18, marginBottom: 16 }}
      />
      <button onClick={handleJoin} style={{ width: '100%', padding: 12, fontSize: 16 }}>
        {t('nickname.join')} →
      </button>
    </div>
  )
}
