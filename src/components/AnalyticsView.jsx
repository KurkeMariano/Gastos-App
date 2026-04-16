import { C } from '../constants'
import { computeAnalytics, fmtP, fmtK, monthLabel, monthShort, sign, clamp } from '../utils'

function committedColor(rate) {
  if (rate < 50) return C.green
  if (rate < 70) return C.amber
  return C.red
}

function committedLabel(rate) {
  if (rate < 40) return 'Excelente flexibilidad presupuestaria.'
  if (rate < 55) return 'Margen razonable de gasto discrecional.'
  if (rate < 70) return 'Ingreso discrecional ajustado.'
  return 'Ingreso discrecional muy comprometido.'
}
import BarChart   from './BarChart'
import DonutChart from './DonutChart'

const COLORS = [C.amber, C.blue, C.purple, C.teal, '#f472b6', '#fb923c']

export default function AnalyticsView({ history, syncStatus, budget }) {
  const a       = computeAnalytics(history)
  const loading = syncStatus === 'syncing'

  if (loading && !history.length) return (
    <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
      <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.4}}>◈</div>
      <div>Cargando historial desde Drive…</div>
    </div>
  )

  if (!a || !history.length) return (
    <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
      <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.3}}>◈</div>
      <div>Sin datos suficientes</div>
      <div style={{fontSize:'12px',marginTop:'8px'}}>Cargá al menos un mes para ver métricas</div>
    </div>
  )

  const maxTopVal = a.topItems[0]?.[1] || 1

  // Budget adherence across history
  const budgetAdherence = budget && history.length
    ? history.filter(h => (h.totals?.expensesPesos||0) <= budget).length
    : null

  return (
    <>
      {loading && (
        <div style={{marginBottom:'1rem',padding:'8px 12px',background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:C.teal,display:'flex',alignItems:'center',gap:'8px'}}>
          <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal}}/>
          Actualizando datos desde Drive…
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'0.75rem',marginBottom:'1.25rem'}}>
        {[
          {label:'PROM. GASTOS',  val:fmtP(a.avgExpenses), color:C.red},
          {label:'PROM. INGRESO', val:fmtP(a.avgIncome),   color:C.green},
          {label:'MESES +',       val:`${a.posMonths} / ${history.length}`, color:a.posMonths>=a.negMonths?C.green:C.red},
          {label:'AHORRO',        val:a.savingsRate!=null?`${a.savingsRate.toFixed(1)}%`:'—', color:a.savingsRate>0?C.green:C.red},
        ].map((k, i) => (
          <div key={i} style={{background:C.card,border:`1px solid ${k.color}33`,borderRadius:'10px',padding:'1rem'}}>
            <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1.5px',marginBottom:'6px'}}>{k.label}</div>
            <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── Committed income rate ───────────────────────────────────── */}
      {a.committedRate != null && (
        <div style={{background:C.card,border:`1px solid ${committedColor(a.committedRate)}33`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// INGRESO COMPROMETIDO EN FIJOS</div>
          <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',alignItems:'flex-start',marginBottom:'0.9rem'}}>
            <div>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>ALQUILER + FIJOS</div>
              <div style={{fontSize:'28px',fontWeight:700,fontFamily:'monospace',color:committedColor(a.committedRate),lineHeight:1}}>{a.committedRate.toFixed(1)}%</div>
              <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',marginTop:'4px'}}>{fmtP(a.committed)} de {fmtP(a.last.income?.pesos||0)}</div>
            </div>
            <div style={{flex:1,minWidth:'140px',paddingTop:'4px'}}>
              <div style={{background:C.surface,borderRadius:'4px',height:'8px',overflow:'hidden',marginBottom:'6px'}}>
                <div style={{height:'8px',width:`${clamp(a.committedRate,0,100)}%`,background:committedColor(a.committedRate),borderRadius:'4px',transition:'width 0.3s'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',fontFamily:'monospace',color:C.textMuted}}>
                <span>0%</span>
                <span style={{color:committedColor(a.committedRate),fontWeight:600}}>libre: {(100 - a.committedRate).toFixed(1)}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
          <div style={{fontSize:'11px',fontFamily:'monospace',color:C.textMuted,borderTop:`1px solid ${C.border}`,paddingTop:'0.6rem'}}>
            {committedLabel(a.committedRate)}
          </div>
        </div>
      )}

      {/* ── Budget adherence ────────────────────────────────────────── */}
      {budget != null && (
        <div style={{background:C.card,border:`1px solid ${C.amber}33`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// PRESUPUESTO MENSUAL</div>
          <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem'}}>
            <div style={{flex:1,minWidth:'120px'}}>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>LÍMITE</div>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:C.amber}}>{fmtP(budget)}</div>
            </div>
            <div style={{flex:1,minWidth:'120px'}}>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>PROM. GASTO</div>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:a.avgExpenses>budget?C.red:C.green}}>{fmtP(a.avgExpenses)}</div>
            </div>
            {budgetAdherence != null && (
              <div style={{flex:1,minWidth:'120px'}}>
                <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>MESES EN PRESUPUESTO</div>
                <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:budgetAdherence/history.length>=0.7?C.green:C.red}}>
                  {budgetAdherence} / {history.length}
                </div>
              </div>
            )}
          </div>
          {/* Budget adherence per month mini-chart */}
          <div style={{display:'flex',alignItems:'flex-end',gap:'clamp(2px,1vw,6px)',height:'48px',overflowX:'auto'}}>
            {[...history].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12).map((h, i) => {
              const exp  = h.totals?.expensesPesos || 0
              const over = exp > budget
              const pctH = Math.min((exp / (budget * 1.5)) * 40, 40)
              return (
                <div key={i} style={{flex:'0 0 auto',minWidth:'20px',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
                  <div style={{width:'12px',height:pctH||2,background:over?C.red:C.green,borderRadius:'2px 2px 0 0',opacity:0.8,position:'relative'}}>
                    {exp <= budget && <div style={{position:'absolute',bottom:0,left:0,right:0,height:`${(budget/budget)*100}%`,borderTop:`1px dashed ${C.amber}66`}}/>}
                  </div>
                  <div style={{fontSize:'8px',color:C.textMuted,fontFamily:'monospace',whiteSpace:'nowrap'}}>{monthShort(h.month)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MoM comparison ──────────────────────────────────────────── */}
      {a.expGrowth != null && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// VS MES ANTERIOR</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
            {[
              {label:'GASTOS',   val:a.expGrowth, isGastos:true},
              {label:'INGRESOS', val:a.incGrowth, isGastos:false},
            ].filter(x => x.val != null).map((item, i) => {
              const good  = item.isGastos ? item.val <= 0 : item.val >= 0
              const color = item.val === 0 ? C.textMuted : good ? C.green : C.red
              const arrow = item.val > 0 ? '↑' : item.val < 0 ? '↓' : '→'
              return (
                <div key={i}>
                  <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginBottom:'6px'}}>{item.label}</div>
                  <div style={{fontSize:'22px',fontWeight:700,fontFamily:'monospace',color,marginBottom:'6px'}}>{arrow} {sign(item.val)}{item.val.toFixed(1)}%</div>
                  <div style={{background:C.surface,borderRadius:'3px',height:'4px'}}>
                    <div style={{height:'4px',width:`${clamp(Math.abs(item.val),0,100)}%`,background:color,borderRadius:'3px',minWidth:'3px'}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Year-over-year ──────────────────────────────────────────── */}
      {a.yoyExpGrowth != null && (
        <div style={{background:C.card,border:`1px solid ${C.purple}33`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.purple,marginBottom:'1rem'}}>// AÑO VS AÑO — {monthLabel(a.last.month).split(' ')[0].toUpperCase()}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom: a.yoyMonths?.length > 1 ? '1rem' : '0'}}>
            {[
              {label:'GASTOS',   val:a.yoyExpGrowth, isGastos:true},
              {label:'INGRESOS', val:a.yoyIncGrowth, isGastos:false},
            ].filter(x => x.val != null).map((item, i) => {
              const good  = item.isGastos ? item.val <= 0 : item.val >= 0
              const color = item.val === 0 ? C.textMuted : good ? C.green : C.red
              const arrow = item.val > 0 ? '↑' : item.val < 0 ? '↓' : '→'
              return (
                <div key={i}>
                  <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginBottom:'6px'}}>{item.label}</div>
                  <div style={{fontSize:'22px',fontWeight:700,fontFamily:'monospace',color,marginBottom:'4px'}}>{arrow} {sign(item.val)}{item.val.toFixed(1)}%</div>
                  <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace'}}>vs {a.sameMonthLY?.month?.split('-')[0]}</div>
                </div>
              )
            })}
          </div>
          {/* Multi-year bars for the same month */}
          {a.yoyMonths?.length > 1 && (
            <div>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'8px',letterSpacing:'1px'}}>EVOLUCIÓN ANUAL</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:'clamp(4px,2vw,12px)',height:'70px',overflowX:'auto'}}>
                {(() => {
                  const maxV = Math.max(...a.yoyMonths.map(d => Math.max(d.expenses, d.income)), 1)
                  const bH   = 50
                  return a.yoyMonths.map((d, i) => (
                    <div key={i} style={{flex:'0 0 auto',minWidth:'40px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
                      <div style={{display:'flex',gap:'2px',alignItems:'flex-end',height:bH}}>
                        <div style={{width:'10px',height:Math.round((d.income/maxV)*bH)||2,background:C.green,borderRadius:'2px 2px 0 0',opacity:0.75}}/>
                        <div style={{width:'10px',height:Math.round((d.expenses/maxV)*bH)||2,background:C.red,borderRadius:'2px 2px 0 0',opacity:0.75}}/>
                      </div>
                      <div style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace'}}>{d.year}</div>
                    </div>
                  ))
                })()}
                <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:'4px',marginLeft:'6px',paddingBottom:'16px',flex:'0 0 auto'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'3px'}}><div style={{width:'7px',height:'7px',background:C.green,borderRadius:'2px',opacity:0.75}}/><span style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace'}}>Ingreso</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:'3px'}}><div style={{width:'7px',height:'7px',background:C.red,borderRadius:'2px',opacity:0.75}}/><span style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace'}}>Gasto</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 6-month trend ───────────────────────────────────────────── */}
      {a.trendData.length > 1 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// ÚLTIMOS {a.trendData.length} MESES</div>
          <BarChart data={a.trendData}/>
        </div>
      )}

      {/* ── Fixed expenses ──────────────────────────────────────────── */}
      {(a.lastFixedTotal > 0 || a.fixedChanges?.length > 0) && (
        <div style={{background:C.card,border:`1px solid ${C.teal}33`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.teal,marginBottom:'1rem'}}>// GASTOS FIJOS</div>
          <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom: a.fixedChanges?.length>0||a.fixedTrend?.length>1 ? '1rem' : '0'}}>
            <div style={{flex:1,minWidth:'120px'}}>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>ESTE MES</div>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:C.teal}}>{fmtP(a.lastFixedTotal)}</div>
            </div>
            {a.prevFixedTotal > 0 && (
              <div style={{flex:1,minWidth:'120px'}}>
                <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>MES ANTERIOR</div>
                <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:C.textDim}}>{fmtP(a.prevFixedTotal)}</div>
              </div>
            )}
            {a.fixedGrowth != null && (
              <div style={{flex:1,minWidth:'120px'}}>
                <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'4px'}}>VARIACIÓN</div>
                <div style={{fontSize:'20px',fontWeight:700,fontFamily:'monospace',color:a.fixedGrowth>0?C.red:C.green}}>
                  {a.fixedGrowth>0?'↑':'↓'} {sign(a.fixedGrowth)}{a.fixedGrowth.toFixed(1)}%
                </div>
              </div>
            )}
          </div>

          {a.fixedChanges?.length > 0 && (
            <div style={{marginBottom:a.fixedTrend?.length>1?'1rem':'0'}}>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'6px',letterSpacing:'1px'}}>CAMBIOS VS MES ANTERIOR</div>
              {a.fixedChanges.map((ch, i) => {
                const up    = ch.delta > 0
                const color = up ? C.red : C.green
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:`1px solid ${C.border}`,flexWrap:'wrap',gap:'4px'}}>
                    <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim}}>{ch.description}</span>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',fontFamily:'monospace',fontSize:'12px'}}>
                      <span style={{color:C.textMuted}}>{ch.currency==='pesos'?fmtP(ch.prev):ch.prev}</span>
                      <span style={{color:C.textMuted}}>→</span>
                      <span style={{color,fontWeight:600}}>{ch.currency==='pesos'?fmtP(ch.curr):ch.curr}</span>
                      <span style={{color,background:`${color}18`,border:`1px solid ${color}44`,borderRadius:'4px',padding:'1px 6px',fontSize:'10px'}}>{up?'+':''}{ch.delta.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {a.fixedTrend?.length > 1 && (
            <div>
              <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginBottom:'8px',letterSpacing:'1px'}}>EVOLUCIÓN COSTO FIJO</div>
              {(() => {
                const maxF = Math.max(...a.fixedTrend.map(d => d.total), 1)
                const bH   = 50
                return (
                  <div style={{display:'flex',alignItems:'flex-end',gap:'clamp(3px,1.5vw,8px)',height:bH+28}}>
                    {a.fixedTrend.map((d, i) => {
                      const h     = Math.round((d.total/maxF)*bH)
                      const prev  = i > 0 ? a.fixedTrend[i-1].total : d.total
                      const color = d.total > prev ? C.red : d.total < prev ? C.green : C.teal
                      return (
                        <div key={i} style={{flex:'0 0 auto',minWidth:'32px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
                          <div style={{width:'14px',height:h||2,background:color,borderRadius:'2px 2px 0 0',opacity:0.8}}/>
                          <div style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace',textAlign:'center',whiteSpace:'nowrap'}}>{monthShort(d.month)}</div>
                          <div style={{fontSize:'8px',color,fontFamily:'monospace',textAlign:'center'}}>{fmtK(d.total)}</div>
                        </div>
                      )
                    })}
                    <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:'3px',marginLeft:'6px',paddingBottom:'18px',flex:'0 0 auto'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'3px'}}><div style={{width:'7px',height:'7px',background:C.green,borderRadius:'2px'}}/><span style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace'}}>baja</span></div>
                      <div style={{display:'flex',alignItems:'center',gap:'3px'}}><div style={{width:'7px',height:'7px',background:C.red,borderRadius:'2px'}}/><span style={{fontSize:'9px',color:C.textMuted,fontFamily:'monospace'}}>sube</span></div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Top expenses ────────────────────────────────────────────── */}
      {a.topItems.length > 0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// TOP GASTOS ACUMULADOS</div>
          <div style={{display:'flex',gap:'1rem',alignItems:'center',flexWrap:'wrap'}}>
            <div style={{flex:'1',minWidth:'180px'}}>
              {a.topItems.map(([k,v], i) => (
                <div key={i} style={{marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontSize:'12px',color:C.textDim,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'65%'}}>{k}</span>
                    <span style={{fontSize:'12px',color:COLORS[i%COLORS.length],fontFamily:'monospace',fontWeight:600}}>{fmtP(v)}</span>
                  </div>
                  <div style={{background:C.surface,borderRadius:'3px',height:'4px'}}>
                    <div style={{height:'4px',width:`${(v/maxTopVal)*100}%`,background:COLORS[i%COLORS.length],borderRadius:'3px',opacity:0.8}}/>
                  </div>
                </div>
              ))}
            </div>
            <DonutChart items={a.topItems}/>
          </div>
        </div>
      )}

      {/* ── Balance + top cards ─────────────────────────────────────── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.75rem'}}>// BALANCE</div>
          {[
            ['Balance promedio', fmtP(a.avgBalance),                    a.avgBalance>=0?C.green:C.red],
            ['Mes pico gasto',   monthLabel(a.peakMonth?.month),        C.amber],
            ['Gasto pico',       fmtP(a.peakMonth?.totals?.expensesPesos), C.red],
          ].map(([k,v,c], i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'4px',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace'}}>{k}</span>
              <span style={{fontSize:'12px',color:c,fontFamily:'monospace',fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        {a.topCards.length > 0 && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem'}}>
            <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.75rem'}}>// TOP TARJETAS</div>
            {a.topCards.map(([k,v], i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:'4px',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'55%'}}>{k}</span>
                <span style={{fontSize:'12px',color:C.red,fontFamily:'monospace'}}>{fmtP(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
