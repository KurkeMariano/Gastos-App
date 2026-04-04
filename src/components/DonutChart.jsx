import { C } from '../constants'

export default function DonutChart({ items, size = 110 }) {
  if (!items?.length) return null
  const total  = items.reduce((a, [,v]) => a + v, 0)
  const COLORS = [C.amber, C.blue, C.purple, C.teal, '#f472b6', '#fb923c']
  let cum = -90
  const cx = size/2, cy = size/2, r = size/2 - 8, ri = r - 16

  const slices = items.map(([,v], i) => {
    const angle = (v / total) * 360
    const s1    = cum * (Math.PI/180)
    const e1    = (cum + angle) * (Math.PI/180)
    cum += angle
    const x1  = cx + r  * Math.cos(s1), y1  = cy + r  * Math.sin(s1)
    const x2  = cx + r  * Math.cos(e1), y2  = cy + r  * Math.sin(e1)
    const xi1 = cx + ri * Math.cos(s1), yi1 = cy + ri * Math.sin(s1)
    const xi2 = cx + ri * Math.cos(e1), yi2 = cy + ri * Math.sin(e1)
    const large = angle > 180 ? 1 : 0
    return {
      d: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large},0 ${xi1},${yi1} Z`,
      color: COLORS[i % COLORS.length],
    }
  })

  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} opacity="0.85"/>)}
    </svg>
  )
}
