import { useEffect, useRef } from 'react'

interface Props {
  guesses: Array<{ nickname: string; text: string }>
}

export default function GuessFeed({ guesses }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [guesses.length])

  if (guesses.length === 0) return null

  return (
    <div style={{
      maxHeight: 150, overflowY: 'auto', marginTop: 12,
      background: '#f8f9fa', borderRadius: 8, padding: 8,
    }}>
      {guesses.map((g, i) => (
        <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>
          <strong>{g.nickname}:</strong> {g.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
