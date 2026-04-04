import { C } from '../constants'
import { sign, fmtK, monthShort } from '../utils'

export default function BarChart({ data }) {
  if (!data?.length) return null
  const maxVal = Math.max(...data.map(d => Math.max(d.expenses, d.income)), 1)
  const barH   = 80
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:'clamp(3px,1.5vw,8px)',height:barH+54,overflowX:'auto',paddingBottom:'2px'}}>
      {data.map((d, i) => {
        const eH  = Math.round((d.expenses / maxVal) * barH)
        const iH  = Math.round((d.income   / maxVal) * barH)
        const pos = d.balance >= 0
        return (
          <div key={i} style={{flex:'0 0 auto',minWidth:'34px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
            <div style={{display:'flex',gap:'2px',alignItems:'flex-end',height:barH}}>
              <div style={{width:'9px',height:iH||2,background:C.green,borderRadius:'2px 2px 0 0',opacity:0.75}}/>
              <div style={{width:'9px',height:eH||2,background:C.red,  borderRadius:'2px 2px 0 0',opacity:0.75}}/>
            </div>
            <div style={{fontSize:'9px',color:pos?C.green:C.red,fontFamily:'monospace',textAlign:'center',lineHeight:1.2}}>{sign(d.balance)}{fmtK(d.balance)}</div>
            <div style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace',textAlign:'center',whiteSpace:'nowrap'}}>{monthShort(d.month)}</div>
          </div>
        )
      })}
      <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:'4px',marginLeft:'8px',paddingBottom:'30px',flex:'0 0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><div style={{width:'8px',height:'8px',background:C.green,borderRadius:'2px',opacity:0.75}}/><span style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace'}}>Ingreso</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><div style={{width:'8px',height:'8px',background:C.red,  borderRadius:'2px',opacity:0.75}}/><span style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace'}}>Gasto</span></div>
      </div>
    </div>
  )
}
