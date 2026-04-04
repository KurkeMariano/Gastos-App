import { useState, useCallback, useRef } from 'react'
import { C, btnPrimary, btnAdd, btnSec, btnDanger, inp, sel, navBtn, STEPS } from './constants'
import {
  LS, buildCSV, mergeHistory, computeAnalytics,
  getCurrentMonth, monthLabel, getActiveFixed,
  fmtP, fmtD, pct,
} from './utils'
import { useDrive }          from './hooks/useDrive'
import DriveButton           from './components/DriveButton'
import ReportView            from './components/ReportView'
import AnalyticsView         from './components/AnalyticsView'
import FixedExpensesView     from './components/FixedExpensesView'
import ConfirmDialog         from './components/ConfirmDialog'

export default function App() {
  // ── Persistent state ────────────────────────────────────────────────────────
  const [history,       setHistory]       = useState(() => LS.get('presup:history')       || [])
  const [fixedExpenses, setFixedExpenses] = useState(() => LS.get('presup:fixedExpenses') || [])
  const [budget,        setBudget]        = useState(() => LS.get('presup:budget')        || '')

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [view,          setView]          = useState('form')
  const [step,          setStep]          = useState(0)
  const [selMonth,      setSelMonth]      = useState(getCurrentMonth)
  const [dollarRate,    setDollarRate]    = useState('')
  const [income,        setIncome]        = useState({pesos:'', dollars:''})
  const [cards,         setCards]         = useState([
    {id:1, bank:'', type:'visa',       pesos:'', dollars:''},
    {id:2, bank:'', type:'visa',       pesos:'', dollars:''},
    {id:3, bank:'', type:'mastercard', pesos:'', dollars:''},
    {id:4, bank:'', type:'mastercard', pesos:'', dollars:''},
  ])
  const [rent,          setRent]          = useState('')
  const [others,        setOthers]        = useState([{id:1, description:'', amount:'', currency:'pesos', notes:''}])
  const [finalized,     setFinalized]     = useState(false)
  const [errors,        setErrors]        = useState({})
  const [saveMsg,       setSaveMsg]       = useState(null)
  const [histDetail,    setHistDetail]    = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting,      setDeleting]      = useState(false)
  const [noteOpen,      setNoteOpen]      = useState({})   // {[otherId]: bool}
  const cardId = useRef(5), othId = useRef(2)

  // ── Persistence helpers ──────────────────────────────────────────────────────
  const persist      = useCallback(h  => { setHistory(h);        LS.set('presup:history', h)             }, [])
  const persistFixed = useCallback(fe => { setFixedExpenses(fe); LS.set('presup:fixedExpenses', fe)      }, [])
  const persistBudget = (val) => { setBudget(val); LS.set('presup:budget', val) }

  const onHistoryLoaded = useCallback(driveReports => {
    setHistory(prev => {
      const merged = mergeHistory(prev, driveReports)
      LS.set('presup:history', merged)
      return merged
    })
  }, [])

  const drive = useDrive(onHistoryLoaded)

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const addCard  = () => setCards(p => [...p, {id:cardId.current++, bank:'', type:'visa', pesos:'', dollars:''}])
  const rmCard   = id => cards.length > 1 && setCards(p => p.filter(c => c.id !== id))
  const updCard  = (id, f, v) => { if ((f==='pesos'||f==='dollars') && v !== '' && parseFloat(v) < 0) return; setCards(p => p.map(c => c.id===id ? {...c,[f]:v} : c)) }
  const addOther = () => setOthers(p => [...p, {id:othId.current++, description:'', amount:'', currency:'pesos', notes:''}])
  const rmOther  = id => setOthers(p => p.filter(e => e.id !== id))
  const updOther = (id, f, v) => { if (f==='amount' && v !== '' && parseFloat(v) < 0) return; setOthers(p => p.map(e => e.id===id ? {...e,[f]:v} : e)) }

  // ── Copy last month ──────────────────────────────────────────────────────────
  const copyLastMonth = () => {
    const sorted = [...history].sort((a,b) => b.month.localeCompare(a.month))
    const last   = sorted[0]
    if (!last) return
    setIncome({
      pesos:   last.income?.pesos   > 0 ? String(last.income.pesos)   : '',
      dollars: last.income?.dollars > 0 ? String(last.income.dollars) : '',
    })
    setDollarRate(last.dollarRate ? String(last.dollarRate) : '')
    const newCards = (last.cards || []).map((c, i) => ({
      id: i + 1, bank: c.bank, type: c.type, pesos: String(c.pesos||''), dollars: String(c.dollars||''),
    }))
    setCards(newCards.length ? newCards : [{id:1,bank:'',type:'visa',pesos:'',dollars:''}])
    cardId.current = newCards.length + 1
    setRent(last.rent > 0 ? String(last.rent) : '')
    const newOthers = (last.otherExpenses || [])
      .filter(e => e.description || e.amount)
      .map((e, i) => ({ id: i+1, description: e.description, amount: String(e.amount||''), currency: e.currency, notes: '' }))
    setOthers(newOthers.length ? newOthers : [{id:1,description:'',amount:'',currency:'pesos',notes:''}])
    othId.current = newOthers.length + 1
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (step === 0) {
      if (!income.pesos && !income.dollars)          e.income = 'Ingresá al menos un ingreso'
      if (income.pesos   && parseFloat(income.pesos)   < 0) e.incP = 'No puede ser negativo'
      if (income.dollars && parseFloat(income.dollars) < 0) e.incD = 'No puede ser negativo'
    }
    if (step === 1) cards.forEach(c => { if (!c.bank.trim()) e[`b${c.id}`] = 'Nombre requerido' })
    if (step === 2 && rent !== '' && parseFloat(rent) < 0) e.rent = 'No puede ser negativo'
    setErrors(e)
    return !Object.keys(e).length
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  const computeTotals = (fixedExps = []) => {
    const cardP = cards.reduce((a,c) => a + (parseFloat(c.pesos)||0), 0)
    const cardD = cards.reduce((a,c) => a + (parseFloat(c.dollars)||0), 0)
    const rentV = parseFloat(rent) || 0
    const othP  = others.filter(e => e.currency==='pesos').reduce((a,e) => a + (parseFloat(e.amount)||0), 0)
    const othD  = others.filter(e => e.currency==='dollars').reduce((a,e) => a + (parseFloat(e.amount)||0), 0)
    const fixP  = fixedExps.filter(e => e.currency==='pesos').reduce((a,e) => a + (parseFloat(e.amount)||0), 0)
    const fixD  = fixedExps.filter(e => e.currency==='dollars').reduce((a,e) => a + (parseFloat(e.amount)||0), 0)
    const expP  = cardP + rentV + othP + fixP
    const expD  = cardD + othD + fixD
    const incP  = parseFloat(income.pesos)   || 0
    const incD  = parseFloat(income.dollars) || 0
    const balP  = incP - expP
    const balD  = incD - expD
    const total = dollarRate ? (incP + incD * parseFloat(dollarRate) - expP - expD * parseFloat(dollarRate)) : null
    return { expensesPesos:expP, expensesDollars:expD, balancePesos:balP, balanceDollars:balD, totalInPesos:total }
  }

  const buildReport = () => {
    const activeFixed = getActiveFixed(fixedExpenses, selMonth)
    return {
      month:         selMonth,
      dollarRate:    dollarRate || null,
      budget:        budget ? parseFloat(budget) : null,
      income:        {pesos: parseFloat(income.pesos)||0, dollars: parseFloat(income.dollars)||0},
      cards:         cards.map(c => ({...c, pesos:parseFloat(c.pesos)||0, dollars:parseFloat(c.dollars)||0})),
      rent:          parseFloat(rent) || 0,
      otherExpenses: others.map(e => ({...e, amount:parseFloat(e.amount)||0})),
      fixedExpenses: activeFixed,
      totals:        computeTotals(activeFixed),
      savedAt:       new Date().toISOString(),
    }
  }

  const buildReportCSV = (report) => {
    const nh  = [report, ...history.filter(h => h.month !== report.month)]
    const csv = buildCSV(report, computeAnalytics(nh))
    return { csv, filename: `presupuesto_${report.month}.csv`, nh }
  }

  // ── Drive auto-save ──────────────────────────────────────────────────────────
  const saveToDrive = async (report) => {
    if (drive.status !== 'connected') return
    try {
      const { csv, filename } = buildReportCSV(report)
      const existing          = history.find(h => h.month === report.month)
      const fileId            = existing?._driveFileId || null
      const result            = await drive.uploadCSV(filename, csv, fileId)
      const tagged            = {...report, _driveFileId: result.id}
      persist([tagged, ...history.filter(h => h.month !== report.month)])
      setSaveMsg({type:'ok', text:`✓ Guardado en Drive: ${filename}`})
    } catch (err) {
      setSaveMsg({type:'err', text:`No se pudo guardar en Drive: ${err.message}`})
    }
  }

  // ── Local CSV download ───────────────────────────────────────────────────────
  const downloadLocalCSV = (report) => {
    const { csv, filename } = buildReportCSV(report)
    const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export entire history ────────────────────────────────────────────────────
  const exportAllHistory = () => {
    if (!history.length) return
    const sorted = [...history].sort((a,b) => b.month.localeCompare(a.month))
    const parts  = sorted.map(r => `## ${monthLabel(r.month)} ##\n\n${buildCSV(r, null)}`)
    const blob   = new Blob(['\ufeff' + parts.join('\n\n' + '─'.repeat(60) + '\n\n')], {type:'text/csv;charset=utf-8;'})
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url; a.download = 'presup_historial_completo.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Delete record ─────────────────────────────────────────────────────────────
  const deleteRecord = async (report) => {
    setDeleting(true)
    try {
      if (report._driveFileId && drive.status === 'connected')
        await drive.deleteFile(report._driveFileId)
      persist(history.filter(h => h.month !== report.month))
    } catch (err) {
      console.error('Delete failed:', err)
      persist(history.filter(h => h.month !== report.month))
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
      setHistDetail(null)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = async () => {
    if (!validate()) return
    if (step === 3 && !finalized) { setFinalized(true); return }
    if (step === 3 && finalized) {
      const r  = buildReport()
      const nh = [r, ...history.filter(h => h.month !== r.month)]
      persist(nh)
      setStep(4)
      setSaveMsg(null)
      saveToDrive(r)
      return
    }
    setStep(s => s + 1)
  }

  const resetForm = () => {
    setStep(0)
    setIncome({pesos:'', dollars:''})
    setDollarRate('')
    setCards([
      {id:1, bank:'', type:'visa',       pesos:'', dollars:''},
      {id:2, bank:'', type:'visa',       pesos:'', dollars:''},
      {id:3, bank:'', type:'mastercard', pesos:'', dollars:''},
      {id:4, bank:'', type:'mastercard', pesos:'', dollars:''},
    ])
    setRent('')
    setOthers([{id:1, description:'', amount:'', currency:'pesos', notes:''}])
    setFinalized(false)
    setErrors({})
    setSelMonth(getCurrentMonth())
    setSaveMsg(null)
    setNoteOpen({})
    cardId.current = 5
    othId.current  = 2
  }

  const currentReport = step === 4 ? buildReport() : null

  return (
    <div style={{background:C.bg, minHeight:'100vh', fontFamily:"'Segoe UI',system-ui,sans-serif", color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus{border-color:${C.amber}!important;box-shadow:0 0 0 2px ${C.amberGlow};}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3;}
        input[type=month]{color-scheme:dark;}
        .hist-card:hover{border-color:${C.borderLight}!important;background:${C.surfaceHover}!important;}
        .add-btn:hover{background:${C.amber}30!important;box-shadow:0 0 22px ${C.amberGlow}!important;}
        .del-btn:hover{background:${C.redDim}22!important;border-color:${C.redDim}!important;}
        button:active{transform:scale(0.97);}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${C.surface};}
        ::-webkit-scrollbar-thumb{background:${C.borderLight};border-radius:3px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @media(max-width:480px){
          .step-label{display:none!important;}
          .grid-cards{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 1rem',display:'flex',alignItems:'center',justifyContent:'space-between',height:'56px',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:'16px',fontWeight:700,color:C.amber,letterSpacing:'2px'}}>◈ PRESUP</div>
        <DriveButton drive={drive}/>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0.5rem 1rem',display:'flex',gap:'6px'}}>
        {[{id:'form',l:'Nuevo mes'},{id:'fixed',l:'Fijos'},{id:'history',l:'Historial'},{id:'analytics',l:'Analítica'}].map(n => (
          <button key={n.id} style={navBtn(view===n.id)} onClick={() => { setView(n.id); setHistDetail(null) }}>{n.l}</button>
        ))}
      </div>

      <div style={{maxWidth:'680px', margin:'0 auto', padding:'1.25rem 1rem 5rem'}}>

        {/* ══ FORM ═══════════════════════════════════════════════════════ */}
        {view === 'form' && (
          <>
            {/* Month header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',gap:'0.75rem',flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{monthLabel(selMonth)}</div>
                <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'2px'}}>REGISTRO MENSUAL</div>
              </div>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                {history.length > 0 && step === 0 && (
                  <button
                    style={{background:`${C.blue}18`,color:'#93c5fd',border:`1px solid ${C.blue}55`,borderRadius:'8px',padding:'7px 12px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'5px'}}
                    onClick={copyLastMonth}
                    title={`Copiar desde ${monthLabel([...history].sort((a,b)=>b.month.localeCompare(a.month))[0]?.month)}`}
                  >
                    ⤵ Copiar último mes
                  </button>
                )}
                <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} style={{...inp, width:'160px', fontSize:'14px', padding:'8px 10px'}}/>
              </div>
            </div>

            {/* Steps indicator */}
            <div style={{display:'flex',marginBottom:'1.5rem',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden'}}>
              {STEPS.map((st, i) => (
                <div key={i} style={{flex:1,padding:'10px 4px',textAlign:'center',fontSize:'10px',fontFamily:'monospace',letterSpacing:'0.5px',color:step>i?C.amber:step===i?C.text:C.textMuted,background:step===i?C.card:'transparent',borderRight:i<STEPS.length-1?`1px solid ${C.border}`:'none',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',cursor:'default'}}>
                  <span style={{fontSize:'14px',opacity:step===i?1:0.5}}>{st.i}</span>
                  <span className="step-label">{st.l}</span>
                  {step > i && <span style={{fontSize:'8px',color:C.amber}}>✓</span>}
                </div>
              ))}
            </div>

            {/* ── Step 0: Ingresos ─────────────────────────────────────── */}
            {step === 0 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// INGRESOS DEL MES</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',marginBottom:'0.75rem'}}>
                  <div>
                    <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>PESOS ($)</label>
                    <input type="number" min="0" inputMode="decimal" placeholder="0.00" value={income.pesos} onChange={e => setIncome(p => ({...p, pesos:e.target.value}))} style={inp}/>
                    {errors.incP && <div style={{color:C.red,fontSize:'11px',marginTop:'3px'}}>{errors.incP}</div>}
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>DÓLARES (USD)</label>
                    <input type="number" min="0" inputMode="decimal" placeholder="0.00" value={income.dollars} onChange={e => setIncome(p => ({...p, dollars:e.target.value}))} style={inp}/>
                    {errors.incD && <div style={{color:C.red,fontSize:'11px',marginTop:'3px'}}>{errors.incD}</div>}
                  </div>
                </div>
                {errors.income && <div style={{color:C.red,fontSize:'12px',fontFamily:'monospace',marginBottom:'0.5rem'}}>{errors.income}</div>}
                <div style={{borderTop:`1px solid ${C.border}`,margin:'1rem 0'}}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                  <div>
                    <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>COTIZACIÓN USD → $ (opcional)</label>
                    <input type="number" min="0" inputMode="decimal" placeholder="Ej: 1350" value={dollarRate} onChange={e => setDollarRate(e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>PRESUPUESTO MENSUAL $ (opcional)</label>
                    <input type="number" min="0" inputMode="decimal" placeholder="Ej: 500000" value={budget}
                      onChange={e => persistBudget(e.target.value)} style={inp}/>
                    {budget && <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginTop:'3px'}}>Se guarda automáticamente</div>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Tarjetas ─────────────────────────────────────── */}
            {step === 1 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                  <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber}}>// TARJETAS</div>
                  <button className="add-btn" style={btnAdd} onClick={addCard}>＋ Agregar</button>
                </div>
                {cards.map((c, idx) => (
                  <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'0.9rem',marginBottom:'0.6rem'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <span style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace'}}>#{idx+1}</span>
                        <span style={{display:'inline-block',background:c.type==='visa'?'#1a2a4e':'#2a1a3e',color:c.type==='visa'?'#60a5fa':'#c084fc',border:`1px solid ${c.type==='visa'?'#2a3a6e':'#4a2a6e'}`,borderRadius:'4px',padding:'2px 7px',fontSize:'10px',fontFamily:'monospace'}}>{c.type?.toUpperCase?.()}</span>
                      </div>
                      {cards.length > 1 && <button className="del-btn" style={btnDanger} onClick={() => rmCard(c.id)}>✕</button>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem',marginBottom:'0.6rem'}}>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>BANCO</label>
                        <input type="text" placeholder="Ej: Santander" value={c.bank} onChange={e => updCard(c.id,'bank',e.target.value)} style={inp}/>
                        {errors[`b${c.id}`] && <div style={{color:C.red,fontSize:'11px',marginTop:'3px'}}>{errors[`b${c.id}`]}</div>}
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>RED</label>
                        <select value={c.type} onChange={e => updCard(c.id,'type',e.target.value)} style={sel}>
                          <option value="visa">Visa</option>
                          <option value="mastercard">Mastercard</option>
                          <option value="amex">Amex</option>
                          <option value="naranja">Naranja</option>
                        </select>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}}>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>GASTOS $</label>
                        <input type="number" min="0" inputMode="decimal" placeholder="0.00" value={c.pesos} onChange={e => updCard(c.id,'pesos',e.target.value)} style={inp}/>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>GASTOS USD</label>
                        <input type="number" min="0" inputMode="decimal" placeholder="0.00" value={c.dollars} onChange={e => updCard(c.id,'dollars',e.target.value)} style={inp}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Step 2: Alquiler ─────────────────────────────────────── */}
            {step === 2 && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// ALQUILER</div>
                <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'5px',fontFamily:'monospace'}}>MONTO EN PESOS ($)</label>
                <input type="number" min="0" inputMode="decimal" placeholder="0.00 (dejá vacío si no aplica)"
                  value={rent} onChange={e => { if (e.target.value==='' || parseFloat(e.target.value)>=0) setRent(e.target.value) }}
                  style={{...inp, maxWidth:'280px'}}/>
                {errors.rent && <div style={{color:C.red,fontSize:'11px',marginTop:'4px'}}>{errors.rent}</div>}
              </div>
            )}

            {/* ── Step 3: Otros gastos ─────────────────────────────────── */}
            {step === 3 && !finalized && (
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                  <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber}}>// OTROS GASTOS</div>
                  <button className="add-btn" style={btnAdd} onClick={addOther}>＋ Agregar</button>
                </div>
                {others.map((e, idx) => (
                  <div key={e.id} style={{marginBottom:'0.75rem',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'0.75rem'}}>
                    <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:'6px',alignItems:'end'}}>
                      <div>
                        {idx === 0 && <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>DESCRIPCIÓN</label>}
                        <input type="text" placeholder="Ej: Super" value={e.description} onChange={ev => updOther(e.id,'description',ev.target.value)} style={inp}/>
                      </div>
                      <div>
                        {idx === 0 && <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>MONTO</label>}
                        <input type="number" min="0" inputMode="decimal" placeholder="0" value={e.amount} onChange={ev => updOther(e.id,'amount',ev.target.value)} style={inp}/>
                      </div>
                      <div>
                        {idx === 0 && <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>MONEDA</label>}
                        <select value={e.currency} onChange={ev => updOther(e.id,'currency',ev.target.value)} style={sel}>
                          <option value="pesos">$</option>
                          <option value="dollars">USD</option>
                        </select>
                      </div>
                      <button className="del-btn" style={{...btnDanger, paddingTop:'12px', paddingBottom:'12px'}} onClick={() => rmOther(e.id)}>✕</button>
                    </div>
                    {/* Note toggle */}
                    <div style={{marginTop:'6px',display:'flex',alignItems:'center',gap:'6px'}}>
                      <button
                        style={{background:'transparent',color:noteOpen[e.id]?C.amber:C.textMuted,border:`1px solid ${noteOpen[e.id]?C.amber+'55':C.border}`,borderRadius:'4px',padding:'2px 8px',fontSize:'10px',fontFamily:'monospace',cursor:'pointer'}}
                        onClick={() => setNoteOpen(p => ({...p,[e.id]:!p[e.id]}))}
                      >
                        {noteOpen[e.id] ? '▲ nota' : '＋ nota'}
                      </button>
                      {noteOpen[e.id] && (
                        <input type="text" placeholder="Nota opcional…" value={e.notes||''}
                          onChange={ev => updOther(e.id,'notes',ev.target.value)}
                          style={{...inp, fontSize:'12px', padding:'5px 10px', flex:1}}/>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{marginTop:'1.25rem',padding:'0.9rem',background:`${C.amber}08`,border:`1px dashed ${C.amber}44`,borderRadius:'8px'}}>
                  <span style={{fontSize:'12px',color:C.textDim,fontFamily:'monospace'}}>Cuando termines, presioná "Finalizar carga".</span>
                </div>
                {getActiveFixed(fixedExpenses, selMonth).length > 0 && (
                  <div style={{marginTop:'0.75rem',padding:'0.9rem',background:`${C.teal}08`,border:`1px dashed ${C.teal}44`,borderRadius:'8px'}}>
                    <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'1px',color:C.teal,marginBottom:'6px'}}>GASTOS FIJOS INCLUIDOS AUTOMÁTICAMENTE</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
                      {getActiveFixed(fixedExpenses, selMonth).map(e => (
                        <span key={e.id} style={{background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:'6px',padding:'3px 8px',fontSize:'11px',color:C.teal,fontFamily:'monospace'}}>{e.description}: {e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3 finalizado ────────────────────────────────────── */}
            {step === 3 && finalized && (
              <div style={{background:C.card,border:`1px solid ${C.amber}55`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
                <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'0.9rem'}}>// CARGA FINALIZADA</div>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'0.75rem'}}>
                  <span style={{fontSize:'24px',color:C.green}}>✓</span>
                  <div style={{fontFamily:'monospace',color:C.text,fontSize:'14px'}}>{others.filter(e => e.description||e.amount).length} otros gastos cargados</div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:'0.5rem'}}>
                  {others.filter(e => e.description||e.amount).map(e => (
                    <span key={e.id} style={{background:C.tag,border:`1px solid ${C.border}`,borderRadius:'6px',padding:'3px 8px',fontSize:'11px',color:C.textDim,fontFamily:'monospace'}}>
                      {e.description||'Sin nombre'}: {e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}
                      {e.notes ? ` — ${e.notes}` : ''}
                    </span>
                  ))}
                </div>
                {getActiveFixed(fixedExpenses, selMonth).length > 0 && (
                  <>
                    <div style={{fontSize:'10px',fontFamily:'monospace',color:C.teal,marginBottom:'5px',letterSpacing:'1px'}}>+ GASTOS FIJOS AUTO</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
                      {getActiveFixed(fixedExpenses, selMonth).map(e => (
                        <span key={e.id} style={{background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:'6px',padding:'3px 8px',fontSize:'11px',color:C.teal,fontFamily:'monospace'}}>{e.description}: {e.currency==='pesos'?fmtP(e.amount):fmtD(e.amount)}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Step 4: Reporte ──────────────────────────────────────── */}
            {step === 4 && currentReport && (
              <>
                {/* Fixed price change warnings */}
                {(() => {
                  const prevReport = history.filter(h => h.month < currentReport.month).sort((a,b) => b.month.localeCompare(a.month))[0]
                  const curFixed   = currentReport.fixedExpenses || []
                  const prevFixed  = prevReport?.fixedExpenses || []
                  const changes    = curFixed.map(e => {
                    const p = prevFixed.find(x => x.id === e.id)
                    if (!p || p.amount === e.amount) return null
                    return {description:e.description, currency:e.currency, prev:p.amount, curr:e.amount, delta:pct(e.amount,p.amount)}
                  }).filter(Boolean)
                  if (!changes.length) return null
                  return (
                    <div style={{marginBottom:'1rem',padding:'0.9rem 1rem',background:`${C.red}0d`,border:`1px solid ${C.redDim}55`,borderRadius:'10px'}}>
                      <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.red,marginBottom:'8px'}}>⚠ GASTOS FIJOS CON CAMBIO DE PRECIO</div>
                      {changes.map((ch, i) => (
                        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:i<changes.length-1?`1px solid ${C.border}`:'none',flexWrap:'wrap',gap:'4px'}}>
                          <span style={{fontFamily:'monospace',fontSize:'12px',color:C.textDim}}>{ch.description}</span>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',fontFamily:'monospace',fontSize:'12px'}}>
                            <span style={{color:C.textMuted}}>{ch.currency==='pesos'?fmtP(ch.prev):fmtD(ch.prev)}</span>
                            <span style={{color:C.textMuted}}>→</span>
                            <span style={{color:ch.delta>0?C.red:C.green,fontWeight:600}}>{ch.currency==='pesos'?fmtP(ch.curr):fmtD(ch.curr)}</span>
                            <span style={{fontSize:'10px',color:ch.delta>0?C.red:C.green,background:`${ch.delta>0?C.red:C.green}18`,border:`1px solid ${ch.delta>0?C.redDim:C.greenDim}55`,borderRadius:'4px',padding:'1px 6px'}}>{ch.delta>0?'+':''}{ch.delta.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <ReportView report={currentReport}/>
                {/* Drive status */}
                {drive.status === 'connected' && (
                  <div style={{marginBottom:'1rem',padding:'0.75rem 1rem',
                    background:saveMsg?.type==='ok'?`${C.greenDim}22`:saveMsg?.type==='err'?`${C.redDim}22`:`${C.teal}11`,
                    border:`1px solid ${saveMsg?.type==='ok'?C.greenDim:saveMsg?.type==='err'?C.redDim:C.teal+'44'}`,
                    borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',
                    color:saveMsg?.type==='ok'?C.green:saveMsg?.type==='err'?C.red:C.teal,
                    display:'flex',alignItems:'center',gap:'8px'}}>
                    {!saveMsg && <><span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal,animation:'pulse 1s infinite'}}/>Guardando en Drive…</>}
                    {saveMsg  && <>{saveMsg.type==='ok'?'✓ ':saveMsg.type==='err'?'✕ ':''}{saveMsg.text}</>}
                  </div>
                )}
                {drive.status !== 'connected' && (
                  <div style={{marginBottom:'1rem',padding:'0.75rem 1rem',background:`${C.amberDim}11`,border:`1px solid ${C.amber}44`,borderRadius:'8px',fontSize:'12px',fontFamily:'monospace',color:C.amberLight}}>
                    ⚠ Drive no conectado — el reporte se guardó localmente. Conectá Drive para sincronizar en la nube.
                  </div>
                )}
              </>
            )}

            {/* Nav buttons */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'1.5rem',paddingTop:'1.25rem',borderTop:`1px solid ${C.border}`}}>
              <div style={{display:'flex',gap:'8px'}}>
                {step > 0 && step < 4 && (
                  <button style={btnSec} onClick={() => { if (step===3&&finalized) setFinalized(false); else setStep(s=>s-1) }}>← Atrás</button>
                )}
                {step === 4 && <button style={btnSec} onClick={resetForm}>+ Nuevo mes</button>}
              </div>
              {step < 4 && (
                <button style={btnPrimary} onClick={goNext}>
                  {step===3&&!finalized ? '✓ Finalizar' : step===3&&finalized ? 'Ver reporte →' : 'Continuar →'}
                </button>
              )}
              {step === 4 && currentReport && (
                <button style={btnSec} onClick={() => downloadLocalCSV(currentReport)}>↓ Descargar CSV</button>
              )}
            </div>
          </>
        )}

        {/* ══ GASTOS FIJOS ═══════════════════════════════════════════════ */}
        {view === 'fixed' && (
          <FixedExpensesView fixedExpenses={fixedExpenses} onUpdate={persistFixed}/>
        )}

        {/* ══ HISTORY ════════════════════════════════════════════════════ */}
        {view === 'history' && (
          !histDetail ? (
            <>
              <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:'8px'}}>
                <div>
                  <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>Historial</div>
                  <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'4px'}}>{history.length} registro{history.length!==1?'s':''}</div>
                </div>
                <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                  {drive.syncStatus === 'syncing' && (
                    <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',fontFamily:'monospace',color:C.teal}}>
                      <span style={{display:'inline-block',width:'6px',height:'6px',borderRadius:'50%',background:C.teal,animation:'pulse 1s infinite'}}/>
                      Sincronizando…
                    </div>
                  )}
                  {history.length > 0 && (
                    <button style={btnSec} onClick={exportAllHistory}>↓ Exportar todo</button>
                  )}
                </div>
              </div>
              {!history.length && (
                <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
                  <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.3}}>◈</div>
                  <div>{drive.syncStatus==='syncing'?'Cargando desde Drive…':'Sin registros guardados'}</div>
                </div>
              )}
              {history.map((h, i) => {
                const bal = h.totals?.balancePesos ?? 0
                return (
                  <div key={i} className="hist-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'1.1rem',marginBottom:'0.75rem',cursor:'pointer',transition:'border-color 0.15s,background 0.15s'}} onClick={() => setHistDetail(h)}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'5px'}}>
                          <span style={{fontFamily:'monospace',fontSize:'15px',fontWeight:600}}>{monthLabel(h.month)}</span>
                          {h._driveFileId && <span style={{fontSize:'9px',fontFamily:'monospace',color:C.teal,background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:'4px',padding:'1px 6px'}}>DRIVE</span>}
                        </div>
                        <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                          <span style={{background:C.tag,border:`1px solid ${C.border}`,borderRadius:'5px',padding:'3px 8px',fontSize:'11px',color:C.textDim,fontFamily:'monospace'}}>↑ {fmtP(h.income?.pesos)}</span>
                          <span style={{background:C.tag,border:`1px solid ${C.border}`,borderRadius:'5px',padding:'3px 8px',fontSize:'11px',color:C.textDim,fontFamily:'monospace'}}>↓ {fmtP(h.totals?.expensesPesos)}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',flexShrink:0}}>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:'9px',fontFamily:'monospace',color:C.textMuted,letterSpacing:'1px',marginBottom:'3px'}}>BALANCE</div>
                          <div style={{fontFamily:'monospace',fontSize:'18px',fontWeight:700,color:bal>=0?C.green:C.red}}>{bal<0?'-':''}{fmtP(Math.abs(bal))}</div>
                        </div>
                        <button
                          onClick={ev => { ev.stopPropagation(); setDeleteConfirm(h) }}
                          style={{background:'transparent',color:C.red,border:`1px solid ${C.redDim}55`,borderRadius:'6px',padding:'4px 10px',fontSize:'11px',fontFamily:'monospace',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'4px',touchAction:'manipulation'}}
                        >✕ Borrar</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem',flexWrap:'wrap',gap:'8px'}}>
                <button style={btnSec} onClick={() => setHistDetail(null)}>← Volver</button>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  <button style={btnSec} onClick={() => downloadLocalCSV(histDetail)}>↓ Descargar CSV</button>
                  {drive.status === 'connected' && (
                    <button style={btnPrimary} onClick={() => saveToDrive(histDetail)}>↑ Drive</button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(histDetail)}
                    style={{background:'transparent',color:C.red,border:`1px solid ${C.redDim}55`,borderRadius:'8px',padding:'10px 14px',fontSize:'13px',fontFamily:'monospace',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px',touchAction:'manipulation'}}
                  >✕ Borrar mes</button>
                </div>
              </div>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",marginBottom:'1.25rem'}}>{monthLabel(histDetail.month)}</div>
              <ReportView report={histDetail}/>
            </>
          )
        )}

        {/* ══ ANALYTICS ══════════════════════════════════════════════════ */}
        {view === 'analytics' && (
          <>
            <div style={{marginBottom:'1.5rem'}}>
              <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>Analítica</div>
              <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'4px'}}>{history.length} mes{history.length!==1?'es':''} registrado{history.length!==1?'s':''}</div>
            </div>
            <AnalyticsView history={history} syncStatus={drive.syncStatus} budget={budget ? parseFloat(budget) : null}/>
          </>
        )}

      </div>

      {/* ── Confirm delete dialog ─────────────────────────────────────────── */}
      <ConfirmDialog
        report={deleteConfirm}
        deleting={deleting}
        onConfirm={() => deleteRecord(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
