interface Props { letters: string[] }

export default function WordHint({ letters }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
      {letters.map((l, i) =>
        l === ' ' ? (
          <div key={i} style={{ width: 16 }} />
        ) : (
          <div key={i} style={{
            width: 24, borderBottom: '2px solid #333',
            textAlign: 'center', fontSize: 20, fontWeight: 'bold', minHeight: 28,
          }}>
            {l === '_' ? '' : l}
          </div>
        )
      )}
    </div>
  )
}
