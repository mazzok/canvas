interface Props { seconds: number; total?: number }

export default function Timer({ seconds, total = 60 }: Props) {
  const pct = Math.max(0, seconds / total)
  const color = pct > 0.5 ? '#27ae60' : pct > 0.25 ? '#f39c12' : '#e74c3c'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 48, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, transition: 'width 1s linear' }} />
      </div>
      <span style={{ fontWeight: 'bold', color, minWidth: 28 }}>{seconds}s</span>
    </div>
  )
}
