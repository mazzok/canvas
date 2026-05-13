const ERASER_COLOR = '#ffffff'

const COLORS = [
  '#000000','#e74c3c','#e67e22','#f1c40f','#2ecc71',
  '#1abc9c','#3498db','#9b59b6','#e91e63','#795548','#607d8b',
  '#ff5722','#8bc34a','#00bcd4','#673ab7','#ff9800','#4caf50',
  '#f44336','#2196f3',
]

const SIZES: Array<1 | 2 | 3> = [1, 2, 3]

interface Props {
  color: string
  size: 1 | 2 | 3
  onColorChange: (c: string) => void
  onSizeChange: (s: 1 | 2 | 3) => void
}

export default function ColorPicker({ color, size, onColorChange, onSizeChange }: Props) {
  const isEraser = color === ERASER_COLOR

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {COLORS.map(c => (
          <div
            key={c}
            onClick={() => onColorChange(c)}
            style={{
              width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '3px solid #333' : '2px solid #ccc',
              boxSizing: 'border-box',
            }}
          />
        ))}
        <div
          onClick={() => onColorChange(ERASER_COLOR)}
          title="Eraser"
          style={{
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
            background: '#fff',
            border: isEraser ? '3px solid #333' : '2px solid #ccc',
            boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}
        >
          ⌫
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {SIZES.map(s => (
          <div
            key={s}
            onClick={() => onSizeChange(s)}
            style={{
              width: s * 8 + 8, height: s * 8 + 8, borderRadius: '50%',
              background: '#333', cursor: 'pointer',
              opacity: size === s ? 1 : 0.3,
            }}
          />
        ))}
        <span style={{ fontSize: 12, color: '#888' }}>Größe</span>
      </div>
    </div>
  )
}
