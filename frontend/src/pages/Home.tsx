import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import i18n from '../i18n'
import styles from './Home.module.css'

interface SessionSummary {
  id: string
  hostNickname: string
  playerCount: number
  phase: string
  joinUrl: string
}

export default function Home() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [lang, setLang] = useState((localStorage.getItem('lang') ?? 'de').toUpperCase())
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const nicknameRef = useRef<HTMLInputElement>(null)

  const switchLang = (l: string) => {
    setLang(l)
    localStorage.setItem('lang', l.toLowerCase())
    i18n.changeLanguage(l.toLowerCase())
  }

  // Poll active sessions every 5 seconds
  useEffect(() => {
    const fetchSessions = () =>
      fetch('/api/sessions')
        .then(r => r.json())
        .then(setSessions)
        .catch(() => {})
    fetchSessions()
    const id = setInterval(fetchSessions, 5000)
    return () => clearInterval(id)
  }, [])

  const createSession = async () => {
    if (!nickname.trim()) return
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, displayMode: 'OWN_DEVICE', language: lang }),
      })
      if (!res.ok) { setError('Fehler beim Erstellen der Session'); return }
      const data = await res.json()
      localStorage.setItem(`nickname-${data.sessionId}`, nickname)
      localStorage.setItem(`playerId-${data.sessionId}`, data.playerId)
      navigate(`/session/${data.sessionId}`)
    } catch {
      setError('Keine Verbindung zum Server')
    }
  }

  const joinSession = () => {
    if (!joinCode.trim()) return
    navigate(`/join/${joinCode.trim().toUpperCase()}`)
  }

  const prefillJoin = (id: string) => {
    setJoinCode(id)
    nicknameRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.logo}>🎨 Canvas</h1>
        <p className={styles.subtitle}>{t('home.subtitle', 'Zeichnen & Raten mit Freunden')}</p>
      </div>

      <div className={styles.card}>
        <div className={styles.langRow}>
          {['DE', 'EN'].map(l => (
            <button
              key={l}
              className={`${styles.langBtn} ${lang === l ? styles.langBtnActive : ''}`}
              onClick={() => switchLang(l)}
            >{l}</button>
          ))}
        </div>

        <input
          ref={nicknameRef}
          className={styles.input}
          placeholder={t('home.nickname', 'Dein Nickname')}
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createSession()}
        />
        <button className={styles.btnPrimary} onClick={createSession}>
          + {t('home.newGame', 'Neues Spiel')}
        </button>

        <hr className={styles.divider} />

        <input
          className={styles.input}
          placeholder={t('home.code', 'Spiel-Code')}
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && joinSession()}
        />
        <button className={styles.btnSecondary} onClick={joinSession}>
          {t('home.join', 'Beitreten')}
        </button>
        {error && <p style={{ color: 'red', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      <div className={styles.card}>
        <div className={styles.sessionListTitle}>
          {t('home.activeSessions', 'Aktive Sessions')}
          {sessions.length > 0 && ` (${sessions.length})`}
        </div>
        {sessions.length === 0 ? (
          <div className={styles.empty}>{t('home.noSessions', 'Keine aktiven Sessions')}</div>
        ) : sessions.map(s => (
          <div key={s.id} className={styles.sessionItem}>
            <QRCodeSVG value={s.joinUrl} size={40} className={styles.sessionQr} />
            <div className={styles.sessionInfo}>
              <span className={styles.sessionName}>{s.hostNickname}</span>
              <span className={styles.sessionMeta}>{s.playerCount} Spieler · {s.id}</span>
            </div>
            {s.phase === 'LOBBY' ? (
              <button className={styles.joinBtn} onClick={() => prefillJoin(s.id)}>
                {t('home.join', 'Beitreten')}
              </button>
            ) : (
              <span className={styles.runningBadge}>{t('home.running', 'läuft')}</span>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
