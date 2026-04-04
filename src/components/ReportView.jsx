import { C } from '../constants'
import { fmtP, fmtD, clamp } from '../utils'

export default function ReportView({ report }) {
  const t    = report.totals || {}
  const incP = report.income?.pesos   || 0
  const incD = report.income?.dollars || 0
  const balP = t.balancePesos   || 0
  const balD = t.balanceDollars || 0

  const cS   = {background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1rem'}
  const rRow = {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}
  const badge = type => ({
    display:'inline-block',
    background: type==='visa'?'#1a2a4e':type==='mastercard'?'#2a1a3e':type==='amex'?'#1a2e2a':'#1e2a1a',
    color:      type==='visa'?'#60a5fa':type==='mastercard'?'#c084fc':type==='amex'?'#2dd4bf':'#86efac',
    border:`1px solid ${type==='visa'?'#2a3a6e':type==='mastercard'?'#4a2a6e':type==='amex'?'#1f4a40':'#1a4a2a'}`,
    borderRadius:'4px',padding:'2px 7px',fontSize:'10px',fontFamily:'monospace',letterSpacing:'1px',
  })

  // Budget section
  const budget    = report.budget ? parseFloat(report.budget) : null
  const spent     = t.expensesPesos || 0
  const budgetRem = budget != null ? budget - spent : null
  const budgetPct = budget != null ? clamp((spent / budget) * 100, 0, 100) : null
  const overBudget = budget != null && spent > budget

  return (
    <>
      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
        {[
          {l:'INGRESOS $', v:fmtP(incP), c:C.green, s:incD>0?`+ ${fmtD(incD)}`:''},
          {l:'GASTOS $',   v:fmtP(t.expensesPesos||0), c:C.red,   s:(t.expensesDollars||0)>0?`+ ${fmtD(t.expensesDollars)}`:''},
          {l:'BALANCE $',  v:(balP<0?'-':'')+fmtP(Math.abs(balP)), c:balP>=0?C.green:C.red, s:incD>0?(balD<0?'-':'+')+fmtD(Math.abs(balD)):'', bd:balP>=0?C.greenDim:C.redDim},
        ].map((m, i) => (
          <div key={i} style={{background:C.card,border:`1px solid ${m.bd?m.bd+'44':C.border}`,borderRadius:'10px',padding:'0.9rem'}}>
            <div style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginBottom:'6px'}}>{m.l}</div>
            <div style={{fontSize:'clamp(13px,3vw,20px)',fontWeight:700,fontFamily:'monospace',color:m.c,wordBreak:'break-all'}}>{m.v}</div>
            {m.s && <div style={{fontSize:'10px',color:m.c,fontFamily:'monospace',marginTop:'3px',opacity:0.8}}>{m.s}</div>}
          </div>
        ))}
      </div>

      {/* ── Combined balance ──────────────────────────────────────── */}
      {t.totalInPesos != null && (
        <div style={{background:t.totalInPesos>=0?C.greenBg:C.redBg,border:`1px solid ${t.totalInPesos>=0?C.greenDim:C.redDim}`,borderRadius:'10px',padding:'1rem',marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
          <div style={{fontSize:'11px',fontFamily:'monospace',color:t.totalInPesos>=0?C.green:C.red}}>COMBINADO @ ${parseFloat(report.dollarRate||0).toLocaleString('es-AR')}/USD</div>
          <div style={{fontSize:'clamp(18px,4vw,26px)',fontWeight:700,fontFamily:'monospace',color:t.totalInPesos>=0?C.green:C.red}}>{t.totalInPesos<0?'-':''}{fmtP(Math.abs(t.totalInPesos))}</div>
        </div>
      )}

      {/* ── Budget bar ────────────────────────────────────────────── */}
      {budget != null && (
        <div style={{background:overBudget?C.redBg:C.card,border:`1px solid ${overBudget?C.redDim+'88':C.border}`,borderRadius:'12px',padding:'1.1rem',marginBottom:'1.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',flexWrap:'wrap',gap:'6px'}}>
            <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:overBudget?C.red:C.amber}}>
              {overBudget ? '⚠ PRESUPUESTO EXCEDIDO' : '// PRESUPUESTO'}
            </div>
            <div style={{display:'flex',gap:'12px',fontFamily:'monospace',fontSize:'12px'}}>
              <span style={{color:C.textMuted}}>Límite: <span style={{color:C.text}}>{fmtP(budget)}</span></span>
              <span style={{color:overBudget?C.red:C.green}}>
                {overBudget ? `↑ +${fmtP(Math.abs(budgetRem))} de más` : `↓ ${fmtP(budgetRem)} restante`}
              </span>
            </div>
          </div>
          <div style={{background:C.surface,borderRadius:'4px',height:'6px',overflow:'hidden'}}>
            <div style={{height:'6px',width:`${budgetPct}%`,background:overBudget?C.red:budgetPct>80?C.amber:C.green,borderRadius:'4px',transition:'width 0.3s'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px',fontSize:'9px',fontFamily:'monospace',color:C.textMuted}}>
            <span>0%</span>
            <span style={{color:overBudget?C.red:budgetPct>80?C.amber:C.textMuted}}>{budgetPct.toFixed(0)}% usado</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* ── Income ────────────────────────────────────────────────── */}
      <div style={cS}>
        <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  INGRESOS</div>
        <div style={rRow}><span style={{fontFamily:'monospace',fontSize:'13px',color:C.textDim}}>Pesos</span><span style={{fontFamily:'monospace',color:C.green}}>{fmtP(incP)}</span></div>
        <div style={{...rRow,borderBottom:'none'}}><span style={{fontFamily:'monospace',fontSize:'13px',color:C.textDim}}>Dólares</span><span style={{fontFamily:'monospace',color:C.green}}>{fmtD(incD)}</span></div>
      </div>

      {/* ── Cards ─────────────────────────────────────────────────── */}
      <div style={cS}>
        <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  TARJETAS</div>
        {report.cards?.map((c, i) => (
          <div key={i} style={rRow}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
              <span style={badge(c.type)}>{c.type?.toUpperCase?.()}</span>
              <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim}}>{c.bank||'Sin nombre'}</span>
            </div>
            <div style={{textAlign:'right'}}>
              {c.pesos   > 0 && <div style={{fontFamily:'monospace',color:C.red,fontSize:'13px'}}>{fmtP(c.pesos)}</div>}
              {c.dollars > 0 && <div style={{fontFamily:'monospace',color:'#f87171',fontSize:'12px'}}>{fmtD(c.dollars)}</div>}
              {!c.pesos && !c.dollars && <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textMuted}}>$ 0.00</span>}
            </div>
          </div>
        ))}
        <div style={{...rRow,borderBottom:'none',paddingTop:'10px'}}>
          <span style={{fontFamily:'monospace',fontSize:'11px',color:C.textMuted}}>SUBTOTAL</span>
          <span style={{fontFamily:'monospace',color:C.red}}>{fmtP(report.cards?.reduce((a,c) => a+(c.pesos||0), 0)||0)}</span>
        </div>
      </div>

      {/* ── Rent ──────────────────────────────────────────────────── */}
      {(report.rent||0) > 0 && (
        <div style={cS}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  ALQUILER</div>
          <div style={{...rRow,borderBottom:'none'}}><span style={{fontFamily:'monospace',fontSize:'13px',color:C.textDim}}>Alquiler</span><span style={{fontFamily:'monospace',color:C.red}}>{fmtP(report.rent)}</span></div>
        </div>
      )}

      {/* ── Other expenses ────────────────────────────────────────── */}
      {report.otherExpenses?.some(e => e.description || e.amount) && (
        <div style={cS}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  OTROS GASTOS</div>
          {report.otherExpenses.filter(e => e.description || e.amount).map((e, i, arr) => (
            <div key={i} style={i === arr.length-1 ? {...rRow,borderBottom:'none'} : rRow}>
              <div>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim,overflow:'hidden',textOverflow:'ellipsis',maxWidth:'60%',display:'block'}}>{e.description||'Sin descripción'}</span>
                {e.notes && <span style={{fontFamily:'monospace',fontSize:'10px',color:C.textMuted,fontStyle:'italic'}}>{e.notes}</span>}
              </div>
              <span style={{fontFamily:'monospace',color:C.red,fontSize:'13px'}}>{e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Fixed expenses ────────────────────────────────────────── */}
      {report.fixedExpenses?.length > 0 && (
        <div style={cS}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.6rem'}}>//  GASTOS FIJOS</div>
          {report.fixedExpenses.map((e, i, arr) => (
            <div key={i} style={i === arr.length-1 ? {...rRow,borderBottom:'none'} : rRow}>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{fontSize:'9px',fontFamily:'monospace',color:C.teal,background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:'4px',padding:'1px 5px'}}>FIJO</span>
                <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim,overflow:'hidden',textOverflow:'ellipsis',maxWidth:'55%'}}>{e.description||'Sin descripción'}</span>
              </div>
              <span style={{fontFamily:'monospace',color:C.red,fontSize:'13px'}}>{e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}</span>
            </div>
          ))}
          <div style={{...rRow,borderBottom:'none',paddingTop:'10px'}}>
            <span style={{fontFamily:'monospace',fontSize:'11px',color:C.textMuted}}>SUBTOTAL FIJOS</span>
            <span style={{fontFamily:'monospace',color:C.red}}>{fmtP(report.fixedExpenses.filter(e => e.currency==='pesos').reduce((a,e) => a+(e.amount||0), 0))}</span>
          </div>
        </div>
      )}

      {/* ── Final balance ─────────────────────────────────────────── */}
      <div style={{background:balP>=0?C.greenBg:C.redBg,border:`2px solid ${balP>=0?C.greenDim:C.redDim}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',marginBottom:balD!==0?'0.75rem':0}}>
          <span style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:balP>=0?C.green:C.red}}>//  BALANCE FINAL $</span>
          <span style={{fontSize:'clamp(20px,5vw,32px)',fontWeight:700,fontFamily:'monospace',color:balP>=0?C.green:C.red}}>{balP<0?'-':''}{fmtP(Math.abs(balP))}</span>
        </div>
        {balD !== 0 && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',paddingTop:'0.75rem',borderTop:`1px solid ${C.border}`}}>
            <span style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:balD>=0?C.green:C.red}}>//  BALANCE FINAL USD</span>
            <span style={{fontSize:'clamp(16px,4vw,24px)',fontWeight:700,fontFamily:'monospace',color:balD>=0?C.green:C.red}}>{balD<0?'-':''}{fmtD(Math.abs(balD))}</span>
          </div>
        )}
      </div>
    </>
  )
}
