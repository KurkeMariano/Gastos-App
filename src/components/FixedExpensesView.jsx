import { useState } from 'react'
import { C, btnAdd } from '../constants'
import { getCurrentMonth, monthLabel, getFixedAmountForMonth, fmtP, fmtD, pct } from '../utils'

export default function FixedExpensesView({ fixedExpenses, onUpdate, history = [] }) {
  const [showAdd,       setShowAdd]       = useState(false)
  const [addForm,       setAddForm]       = useState({description:'',amount:'',currency:'pesos'})
  const [addError,      setAddError]      = useState('')
  const [editId,        setEditId]        = useState(null)
  const [editAmount,    setEditAmount]    = useState('')
  const [showInactive,  setShowInactive]  = useState(false)
  const [showHistory,   setShowHistory]   = useState({})
  const [showImport,    setShowImport]    = useState(false)
  const [importSel,     setImportSel]     = useState({})   // { key: bool } — undefined = true

  const curMonth = getCurrentMonth()
  const active   = fixedExpenses.filter(fe => fe.deletedMonth === null || fe.deletedMonth > curMonth)
  const inactive = fixedExpenses.filter(fe => fe.deletedMonth !== null && fe.deletedMonth <= curMonth)

  const cS   = {background:'#131b2a',border:`1px solid ${C.border}`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1rem'}
  const rRow = {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}
  const inp  = {background:'#0f1623',border:`1px solid ${C.borderLight}`,borderRadius:'8px',color:C.text,padding:'12px 14px',fontSize:'16px',fontFamily:'monospace',width:'100%',boxSizing:'border-box',outline:'none',WebkitAppearance:'none'}
  const sel  = {background:'#0f1623',border:`1px solid ${C.borderLight}`,borderRadius:'8px',color:C.text,padding:'12px 14px',fontSize:'16px',fontFamily:'monospace',width:'100%',boxSizing:'border-box',outline:'none',cursor:'pointer',WebkitAppearance:'none'}

  // ── Gastos fijos importables desde historial ──────────────────────────────
  // Toma el valor más reciente por cada (description, currency) del historial.
  // Excluye los que ya existen en la lista global (activos o inactivos).
  const importable = (() => {
    const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month))
    const map = {}
    sorted.forEach(r => {
      r.fixedExpenses?.forEach(e => {
        if (!e.description) return
        const key = `${e.description.toLowerCase()}||${e.currency}`
        map[key] = { description: e.description, currency: e.currency, amount: e.amount, fromMonth: r.month }
      })
    })
    return Object.values(map).filter(item =>
      !fixedExpenses.some(fe =>
        fe.description.toLowerCase() === item.description.toLowerCase() &&
        fe.currency === item.currency
      )
    )
  })()

  const itemKey  = item => `${item.description.toLowerCase()}||${item.currency}`
  const isSelec  = item => importSel[itemKey(item)] !== false
  const selCount = importable.filter(isSelec).length

  const toggleSel = item => {
    const k = itemKey(item)
    setImportSel(prev => ({ ...prev, [k]: !(prev[k] ?? true) }))
  }

  const handleImport = () => {
    const toImport = importable.filter(isSelec)
    if (!toImport.length) return
    const newFixed = toImport.map((item, i) => ({
      id:           Date.now() + i,
      description:  item.description,
      currency:     item.currency,
      createdMonth: item.fromMonth,
      deletedMonth: null,
      priceHistory: [{ fromMonth: item.fromMonth, amount: item.amount }],
    }))
    onUpdate([...fixedExpenses, ...newFixed])
    setShowImport(false)
    setImportSel({})
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    if (!addForm.description.trim())              { setAddError('Ingresá una descripción'); return }
    if (!addForm.amount || parseFloat(addForm.amount) <= 0) { setAddError('Ingresá un monto válido'); return }
    const fe = {
      id: Date.now(),
      description: addForm.description.trim(),
      currency: addForm.currency,
      createdMonth: curMonth,
      deletedMonth: null,
      priceHistory: [{ fromMonth: curMonth, amount: parseFloat(addForm.amount) }],
    }
    onUpdate([...fixedExpenses, fe])
    setAddForm({description:'',amount:'',currency:'pesos'})
    setAddError('')
    setShowAdd(false)
  }

  const handleDelete = id => {
    onUpdate(fixedExpenses.map(fe => fe.id === id ? {...fe, deletedMonth: curMonth} : fe))
  }

  const handleUpdatePrice = id => {
    if (!editAmount || parseFloat(editAmount) <= 0) return
    onUpdate(fixedExpenses.map(fe => {
      if (fe.id !== id) return fe
      const filtered = fe.priceHistory.filter(ph => ph.fromMonth < curMonth)
      return { ...fe, priceHistory: [...filtered, { fromMonth: curMonth, amount: parseFloat(editAmount) }] }
    }))
    setEditId(null)
    setEditAmount('')
  }

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{marginBottom:'1.5rem',display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:'8px'}}>
        <div>
          <div style={{fontSize:'20px',fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>Gastos Fijos</div>
          <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginTop:'4px'}}>{active.length} activo{active.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {importable.length > 0 && !showImport && (
            <button
              style={{background:`${C.teal}18`,color:C.teal,border:`1px solid ${C.teal}55`,borderRadius:'8px',padding:'8px 14px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'5px'}}
              onClick={() => setShowImport(true)}
            >
              ↓ Importar desde historial ({importable.length})
            </button>
          )}
          {!showAdd && (
            <button className="add-btn" style={btnAdd} onClick={() => setShowAdd(true)}>＋ Agregar</button>
          )}
        </div>
      </div>

      {/* ── Panel importar desde historial ──────────────────────────── */}
      {showImport && importable.length > 0 && (
        <div style={{background:'#0d1e2a',border:`1px solid ${C.teal}55`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.teal,marginBottom:'0.75rem'}}>// IMPORTAR DESDE HISTORIAL</div>
          <div style={{fontSize:'12px',color:C.textMuted,fontFamily:'monospace',marginBottom:'1rem'}}>
            Se encontraron {importable.length} gastos fijos en reportes guardados que no están en la lista activa. Seleccioná los que querés importar.
          </div>
          {importable.map((item, i) => {
            const key = itemKey(item)
            const selected = isSelec(item)
            return (
              <div
                key={i}
                onClick={() => toggleSel(item)}
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 10px',marginBottom:'5px',background:selected?`${C.teal}10`:C.surface,border:`1px solid ${selected?C.teal+'44':C.border}`,borderRadius:'8px',cursor:'pointer',transition:'background 0.15s,border-color 0.15s'}}
              >
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'16px',height:'16px',borderRadius:'4px',border:`2px solid ${selected?C.teal:C.borderLight}`,background:selected?C.teal:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {selected && <span style={{color:'#07090f',fontSize:'11px',fontWeight:700,lineHeight:1}}>✓</span>}
                  </div>
                  <div>
                    <div style={{fontFamily:'monospace',fontSize:'13px',color:C.text}}>{item.description}</div>
                    <div style={{fontFamily:'monospace',fontSize:'10px',color:C.textMuted,marginTop:'2px'}}>
                      Encontrado en {monthLabel(item.fromMonth)}
                    </div>
                  </div>
                </div>
                <span style={{fontFamily:'monospace',fontSize:'14px',fontWeight:600,color:C.teal}}>
                  {item.currency === 'pesos' ? fmtP(item.amount) : fmtD(item.amount)}
                </span>
              </div>
            )
          })}
          <div style={{display:'flex',gap:'8px',marginTop:'1rem'}}>
            <button
              disabled={selCount === 0}
              onClick={handleImport}
              style={{background:selCount>0?`linear-gradient(135deg,${C.teal},#1a9e8e)`:`${C.teal}33`,color:selCount>0?'#07090f':C.textMuted,border:'none',borderRadius:'8px',padding:'10px 18px',fontSize:'13px',fontFamily:'monospace',fontWeight:700,cursor:selCount>0?'pointer':'default'}}
            >
              ✓ Importar {selCount > 0 ? `${selCount} fijo${selCount > 1 ? 's' : ''}` : '(ninguno seleccionado)'}
            </button>
            <button
              onClick={() => { setShowImport(false); setImportSel({}) }}
              style={{background:'transparent',color:C.textDim,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 14px',fontSize:'13px',fontFamily:'monospace',cursor:'pointer'}}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Form agregar ────────────────────────────────────────────── */}
      {showAdd && (
        <div style={{background:'#131b2a',border:`1px solid ${C.amber}55`,borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem'}}>
          <div style={{fontSize:'10px',fontFamily:'monospace',letterSpacing:'2px',color:C.amber,marginBottom:'1rem'}}>// NUEVO GASTO FIJO</div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:'8px',marginBottom:'0.75rem'}}>
            <div>
              <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>DESCRIPCIÓN</label>
              <input type="text" placeholder="Ej: Netflix" value={addForm.description}
                onChange={e => setAddForm(p => ({...p, description: e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>MONTO</label>
              <input type="number" min="0" inputMode="decimal" placeholder="0.00" value={addForm.amount}
                onChange={e => setAddForm(p => ({...p, amount: e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:'11px',color:C.textMuted,marginBottom:'4px',fontFamily:'monospace'}}>MONEDA</label>
              <select value={addForm.currency} onChange={e => setAddForm(p => ({...p, currency: e.target.value}))} style={sel}>
                <option value="pesos">$</option>
                <option value="dollars">USD</option>
              </select>
            </div>
          </div>
          {addError && <div style={{color:C.red,fontSize:'12px',fontFamily:'monospace',marginBottom:'0.5rem'}}>{addError}</div>}
          <div style={{fontSize:'11px',color:C.textMuted,fontFamily:'monospace',marginBottom:'0.75rem'}}>
            Se incluirá automáticamente desde {monthLabel(curMonth)}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{background:`linear-gradient(135deg,${C.amber},${C.amberDim})`,color:'#07090f',border:'none',borderRadius:'8px',padding:'11px 20px',fontSize:'14px',fontFamily:'monospace',fontWeight:700,cursor:'pointer'}} onClick={handleAdd}>✓ Guardar</button>
            <button style={{background:'transparent',color:C.textDim,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontFamily:'monospace',cursor:'pointer'}} onClick={() => { setShowAdd(false); setAddError('') }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {active.length === 0 && !showAdd && !showImport && (
        <div style={{textAlign:'center',padding:'3rem 1rem',color:C.textMuted,fontFamily:'monospace'}}>
          <div style={{fontSize:'36px',marginBottom:'1rem',opacity:0.3}}>◈</div>
          <div>Sin gastos fijos configurados</div>
          <div style={{fontSize:'12px',marginTop:'8px'}}>Agregá gastos que se repiten cada mes</div>
        </div>
      )}

      {/* ── Lista activos ────────────────────────────────────────────── */}
      {active.map(fe => {
        const curAmount = getFixedAmountForMonth(fe, curMonth)
        const isEditing = editId === fe.id
        return (
          <div key={fe.id} style={{background:'#131b2a',border:`1px solid ${C.border}`,borderRadius:'10px',padding:'1.1rem',marginBottom:'0.75rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:'monospace',fontSize:'15px',fontWeight:600,marginBottom:'4px'}}>{fe.description}</div>
                <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontFamily:'monospace',fontSize:'18px',fontWeight:700,color:C.red}}>{fe.currency==='pesos'?fmtP(curAmount):fmtD(curAmount)}</span>
                  {fe.priceHistory.length > 1 && (
                    <button style={{fontSize:'10px',fontFamily:'monospace',color:C.teal,background:`${C.teal}15`,border:`1px solid ${C.teal}33`,borderRadius:'4px',padding:'2px 7px',cursor:'pointer'}}
                      onClick={() => setShowHistory(p => ({...p, [fe.id]: !p[fe.id]}))}>
                      {fe.priceHistory.length} precios {showHistory[fe.id] ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {showHistory[fe.id] && (
                  <div style={{marginTop:'8px',background:C.surface,borderRadius:'6px',padding:'8px 10px'}}>
                    <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',letterSpacing:'1px',marginBottom:'6px'}}>HISTORIAL DE PRECIOS</div>
                    {[...fe.priceHistory].reverse().map((ph, i, arr) => {
                      const prev  = arr[i+1]
                      const delta = prev ? pct(ph.amount, prev.amount) : null
                      return (
                        <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:i<arr.length-1?`1px solid ${C.border}`:'none'}}>
                          <span style={{fontFamily:'monospace',fontSize:'11px',color:C.textDim}}>{monthLabel(ph.fromMonth)}</span>
                          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                            <span style={{fontFamily:'monospace',fontSize:'12px',fontWeight:600,color:i===0?C.text:C.textMuted}}>{fe.currency==='pesos'?fmtP(ph.amount):fmtD(ph.amount)}</span>
                            {delta != null && <span style={{fontSize:'10px',color:delta>0?C.red:C.green,fontFamily:'monospace'}}>{delta>0?'+':''}{delta.toFixed(1)}%</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace',marginTop:'4px'}}>Desde {monthLabel(fe.createdMonth)}</div>
              </div>
              <button style={{background:'transparent',color:C.red,border:`1px solid ${C.redDim}44`,borderRadius:'6px',padding:'6px 10px',fontSize:'12px',cursor:'pointer',fontFamily:'monospace'}}
                onClick={() => handleDelete(fe.id)}>✕ Eliminar</button>
            </div>
            {isEditing ? (
              <div style={{marginTop:'0.75rem',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                <input type="number" min="0" inputMode="decimal" placeholder="Nuevo monto" value={editAmount}
                  onChange={e => setEditAmount(e.target.value)} autoFocus
                  style={{background:'#0f1623',border:`1px solid ${C.amber}`,borderRadius:'8px',color:C.text,padding:'8px 12px',fontSize:'14px',fontFamily:'monospace',width:'160px',outline:'none'}}/>
                <button style={{background:`linear-gradient(135deg,${C.amber},${C.amberDim})`,color:'#07090f',border:'none',borderRadius:'8px',padding:'9px 16px',fontSize:'13px',fontFamily:'monospace',fontWeight:700,cursor:'pointer'}}
                  onClick={() => handleUpdatePrice(fe.id)}>✓ Actualizar</button>
                <button style={{background:'transparent',color:C.textDim,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'8px 12px',fontSize:'13px',fontFamily:'monospace',cursor:'pointer'}}
                  onClick={() => { setEditId(null); setEditAmount('') }}>Cancelar</button>
              </div>
            ) : (
              <div style={{marginTop:'0.75rem'}}>
                <button style={{background:`${C.blue}18`,color:'#93c5fd',border:`1px solid ${C.blue}55`,borderRadius:'6px',padding:'5px 10px',fontSize:'11px',fontFamily:'monospace',cursor:'pointer'}}
                  onClick={() => { setEditId(fe.id); setEditAmount(String(curAmount)) }}>✎ Actualizar precio</button>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Inactivos ────────────────────────────────────────────────── */}
      {inactive.length > 0 && (
        <div style={{marginTop:'1.5rem'}}>
          <button style={{background:'transparent',color:C.textMuted,border:`1px solid ${C.border}`,borderRadius:'6px',padding:'6px 12px',fontSize:'12px',fontFamily:'monospace',cursor:'pointer'}}
            onClick={() => setShowInactive(p => !p)}>
            {showInactive ? '▲' : '▼'} Gastos eliminados ({inactive.length})
          </button>
          {showInactive && (
            <div style={{marginTop:'0.75rem',opacity:0.6}}>
              {inactive.map(fe => (
                <div key={fe.id} style={{...cS,marginBottom:'0.5rem'}}>
                  <div style={{...rRow,borderBottom:'none'}}>
                    <div>
                      <div style={{fontFamily:'monospace',fontSize:'13px',color:C.textMuted,textDecoration:'line-through'}}>{fe.description}</div>
                      <div style={{fontSize:'10px',color:C.textMuted,fontFamily:'monospace'}}>{monthLabel(fe.createdMonth)} → {monthLabel(fe.deletedMonth)}</div>
                    </div>
                    <span style={{fontFamily:'monospace',fontSize:'13px',color:C.textMuted}}>
                      {fe.currency==='pesos'?fmtP(getFixedAmountForMonth(fe,fe.deletedMonth)):fmtD(getFixedAmountForMonth(fe,fe.deletedMonth))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
