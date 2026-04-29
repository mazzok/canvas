import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import type { DisplayMode, Language } from '../types'

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sessionCode, setSessionCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [displayMode] = useState<DisplayMode>('OWN_DEVICE')
  const [lang, setLang] = useState<Language>((localStorage.getItem('lang') as Language) ?? 'DE')

  function switchLang(l: Language) {
    setLang(l)
    localStorage.setItem('lang', l.toLowerCase())
    i18n.changeLanguage(l.toLowerCase())
  }

  async function handleNewSession() {
    if (!nickname.trim()) return
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, displayMode, language: lang }),
    })
    const data = await res.json()
    localStorage.setItem(`nickname-${data.sessionId}`, nickname)
    localStorage.setItem(`playerId-${data.sessionId}`, data.playerId)
    navigate(`/session/${data.sessionId}`)
  }

  function handleJoin() {
    const code = sessionCode.trim().toUpperCase()
    if (!code || !nickname.trim()) return
    localStorage.setItem(`nickname-${code}`, nickname)
    navigate(`/join/${code}`)
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => switchLang('DE')} style={{ fontWeight: lang === 'DE' ? 'bold' : 'normal' }}>DE</button>
        <button onClick={() => switchLang('EN')} style={{ fontWeight: lang === 'EN' ? 'bold' : 'normal' }}>EN</button>
      </div>
      <h1>{t('home.title')}</h1>
      <input
        placeholder={t('nickname.placeholder')}
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 16 }}
      />
      <button onClick={handleNewSession} style={{ width: '100%', padding: 12, marginBottom: 8 }}>
        {t('home.newSession')}
      </button>
      <hr style={{ margin: '16px 0' }} />
      <input
        placeholder={t('home.sessionId')}
        value={sessionCode}
        onChange={e => setSessionCode(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8 }}
      />
      <button onClick={handleJoin} style={{ width: '100%', padding: 12 }}>
        {t('home.joinSession')}
      </button>
    </div>
  )
}
