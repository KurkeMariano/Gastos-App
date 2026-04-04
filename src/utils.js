import { CSV_DATA_MARKER } from './constants'

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
export const fmt   = (n, sym='$') => `${sym} ${Math.abs(parseFloat(n)||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
export const fmtP  = n => fmt(n,'$')
export const fmtD  = n => fmt(n,'USD')
export const fmtK  = n => { const v=Math.abs(parseFloat(n)||0); return v>=1e6?`$${(v/1e6).toFixed(1)}M`:v>=1e3?`$${(v/1e3).toFixed(0)}K`:`$${v.toFixed(0)}` }
export const pct   = (a,b) => b===0?null:((a-b)/b*100)
export const sign  = n => n>0?'+':''
export const clamp = (v,mn,mx) => Math.min(mx,Math.max(mn,v))

// ─── DATE ─────────────────────────────────────────────────────────────────────
export function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

export function monthLabel(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const ms = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${ms[parseInt(mo)-1]} ${y}`
}

export function monthShort(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const ms = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${ms[parseInt(mo)-1]} ${y.slice(2)}`
}

// ─── FIXED EXPENSES ───────────────────────────────────────────────────────────
export function getFixedAmountForMonth(fe, month) {
  const applicable = fe.priceHistory.filter(ph => ph.fromMonth <= month)
  if (!applicable.length) return fe.priceHistory[0]?.amount || 0
  return applicable[applicable.length - 1].amount
}

export function getActiveFixed(fixedExpenses, month) {
  return fixedExpenses
    .filter(fe => fe.createdMonth <= month && (fe.deletedMonth === null || fe.deletedMonth > month))
    .map(fe => ({ id: fe.id, description: fe.description, currency: fe.currency, amount: getFixedAmountForMonth(fe, month) }))
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
export const LS = {
  get: k => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):null } catch { return null } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)) } catch(e) { console.warn('LS',e) } },
}

// ─── CSV — WRITE ─────────────────────────────────────────────────────────────
export function buildCSV(report, analytics) {
  const q   = v => `"${String(v??'').replace(/"/g,'""')}"`
  const row = (...cols) => cols.map(q).join(',')
  const L   = []
  const t   = report.totals || {}

  L.push(row('PRESUP — Reporte mensual'))
  L.push(row('Mes', monthLabel(report.month)))
  L.push(row('Generado', new Date().toLocaleString('es-AR')))
  report.dollarRate && L.push(row('Cotización USD', `$ ${parseFloat(report.dollarRate).toLocaleString('es-AR')}`))
  report.budget     && L.push(row('Presupuesto $', `$ ${parseFloat(report.budget).toLocaleString('es-AR')}`))
  L.push('')

  L.push(row('=== INGRESOS ==='))
  L.push(row('Pesos',   `$ ${(report.income?.pesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})}`))
  L.push(row('Dólares', `USD ${(report.income?.dollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})}`))
  L.push('')

  L.push(row('=== TARJETAS ==='))
  L.push(row('Banco','Red','Gastos $','Gastos USD'))
  report.cards?.forEach(c => L.push(row(c.bank||'Sin nombre', c.type?.toUpperCase?.(),
    (c.pesos||0).toLocaleString('es-AR',{minimumFractionDigits:2}),
    (c.dollars||0).toLocaleString('es-AR',{minimumFractionDigits:2}))))
  L.push('')

  if ((report.rent||0) > 0) {
    L.push(row('=== ALQUILER ==='))
    L.push(row('Monto $', (report.rent||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
    L.push('')
  }

  if (report.otherExpenses?.some(e => e.description || e.amount)) {
    L.push(row('=== OTROS GASTOS ==='))
    L.push(row('Descripción','Moneda','Monto','Notas'))
    report.otherExpenses.filter(e => e.description || e.amount).forEach(e =>
      L.push(row(
        e.description||'Sin descripción',
        e.currency==='pesos'?'Pesos':'Dólares',
        (e.amount||0).toLocaleString('es-AR',{minimumFractionDigits:2}),
        e.notes||''
      ))
    )
    L.push('')
  }

  if (report.fixedExpenses?.length) {
    L.push(row('=== GASTOS FIJOS ==='))
    L.push(row('Descripción','Moneda','Monto'))
    report.fixedExpenses.forEach(e =>
      L.push(row(e.description||'Sin descripción', e.currency==='pesos'?'Pesos':'Dólares',
        (e.amount||0).toLocaleString('es-AR',{minimumFractionDigits:2}))))
    L.push('')
  }

  L.push(row('=== RESUMEN ==='))
  L.push(row('Total ingresos $',   (report.income?.pesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Total ingresos USD', (report.income?.dollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Total gastos $',     (t.expensesPesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Total gastos USD',   (t.expensesDollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Balance $',          (t.balancePesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Balance USD',        (t.balanceDollars||0).toLocaleString('es-AR',{minimumFractionDigits:2})))
  L.push(row('Estado',             (t.balancePesos||0)>=0?'POSITIVO':'NEGATIVO'))
  if (report.budget) {
    const rem = report.budget - (t.expensesPesos||0)
    L.push(row('Presupuesto $', parseFloat(report.budget).toLocaleString('es-AR',{minimumFractionDigits:2})))
    L.push(row('Restante $', rem.toLocaleString('es-AR',{minimumFractionDigits:2})))
  }
  if (report.dollarRate && t.totalInPesos != null)
    L.push(row(`Balance combinado (@$${parseFloat(report.dollarRate).toLocaleString('es-AR')})`,
      (t.totalInPesos||0).toLocaleString('es-AR',{minimumFractionDigits:2})))

  if (analytics) {
    L.push('')
    L.push(row('=== ANALÍTICA ==='))
    L.push(row('Mes','Ingresos $','Gastos $','Balance $'))
    analytics.trendData?.forEach(d => L.push(row(monthLabel(d.month), d.income, d.expenses, d.balance)))
    L.push('')
    L.push(row('Promedio ingresos $', analytics.avgIncome?.toFixed(2)))
    L.push(row('Promedio gastos $',   analytics.avgExpenses?.toFixed(2)))
    L.push(row('Promedio balance $',  analytics.avgBalance?.toFixed(2)))
    L.push(row('Meses positivos',     analytics.posMonths))
    L.push(row('Meses negativos',     analytics.negMonths))
    analytics.savingsRate != null && L.push(row('Tasa de ahorro', `${analytics.savingsRate.toFixed(1)}%`))
    analytics.expGrowth   != null && L.push(row('Var. gastos vs mes anterior',   `${sign(analytics.expGrowth)}${analytics.expGrowth.toFixed(1)}%`))
    analytics.incGrowth   != null && L.push(row('Var. ingresos vs mes anterior', `${sign(analytics.incGrowth)}${analytics.incGrowth.toFixed(1)}%`))
    if (analytics.topItems?.length) {
      L.push('')
      L.push(row('Top categorías de gasto'))
      analytics.topItems.forEach(([k,v]) => L.push(row(k, v.toFixed(2))))
    }
  }

  L.push('')
  L.push(CSV_DATA_MARKER)
  L.push(JSON.stringify(report))
  L.push(CSV_DATA_MARKER)

  return L.join('\n')
}

// ─── CSV — PARSE ─────────────────────────────────────────────────────────────
export function parseReportFromCSV(text) {
  try {
    const lines = text.split(/\r?\n/)
    const start = lines.findIndex(l => l.trim() === CSV_DATA_MARKER)
    if (start === -1) return null
    const jsonLine = lines[start + 1]?.trim()
    if (!jsonLine) return null
    const report = JSON.parse(jsonLine)
    if (!report.month || !report.totals) return null
    return report
  } catch {
    return null
  }
}

// ─── MERGE HISTORY ────────────────────────────────────────────────────────────
export function mergeHistory(local, fromDrive) {
  const map = {}
  local.forEach(r    => { map[r.month] = r })
  fromDrive.forEach(r => { map[r.month] = r })
  return Object.values(map).sort((a,b) => b.month.localeCompare(a.month))
}

// ─── ANALYTICS ENGINE ─────────────────────────────────────────────────────────
export function computeAnalytics(history) {
  if (!history.length) return null
  const sorted   = [...history].sort((a,b) => a.month.localeCompare(b.month))
  const last     = sorted[sorted.length-1]
  const prev     = sorted.length > 1 ? sorted[sorted.length-2] : null

  // Top accumulated items
  const allItems = {}
  sorted.forEach(h => {
    h.cards?.forEach(c => { const k=`${c.bank||'Sin nombre'} (${c.type?.toUpperCase?.()})`; allItems[k]=(allItems[k]||0)+(c.pesos||0) })
    if (h.rent > 0) allItems['Alquiler'] = (allItems['Alquiler']||0) + h.rent
    h.otherExpenses?.forEach(e => { if (!e.description && !e.amount) return; const k=e.description||'Sin descripción'; allItems[k]=(allItems[k]||0)+(e.currency==='pesos'?(e.amount||0):0) })
    h.fixedExpenses?.forEach(e => { if (!e.description && !e.amount) return; const k=`[Fijo] ${e.description||'Sin descripción'}`; allItems[k]=(allItems[k]||0)+(e.currency==='pesos'?(e.amount||0):0) })
  })
  const topItems   = Object.entries(allItems).filter(([,v]) => v>0).sort(([,a],[,b]) => b-a).slice(0,6)
  const trendData  = sorted.slice(-6).map(h => ({month:h.month, expenses:h.totals?.expensesPesos||0, income:h.income?.pesos||0, balance:h.totals?.balancePesos||0}))
  const avgExpenses = sorted.reduce((a,h) => a+(h.totals?.expensesPesos||0), 0) / sorted.length
  const avgIncome   = sorted.reduce((a,h) => a+(h.income?.pesos||0), 0) / sorted.length
  const avgBalance  = sorted.reduce((a,h) => a+(h.totals?.balancePesos||0), 0) / sorted.length
  const posMonths   = sorted.filter(h => (h.totals?.balancePesos||0) >= 0).length
  const lastInc     = last.income?.pesos || 0
  const lastExp     = last.totals?.expensesPesos || 0
  const savingsRate = lastInc > 0 ? ((lastInc - lastExp) / lastInc * 100) : null
  const peakMonth   = sorted.reduce((b,h) => (h.totals?.expensesPesos||0) > (b.totals?.expensesPesos||0) ? h : b, sorted[0])
  const cardTotals  = {}
  sorted.forEach(h => h.cards?.forEach(c => { const k=`${c.bank||'Sin nombre'} (${c.type?.toUpperCase?.()})`; cardTotals[k]=(cardTotals[k]||0)+(c.pesos||0) }))
  const topCards = Object.entries(cardTotals).sort(([,a],[,b]) => b-a).slice(0,4)

  // Fixed expenses analytics
  const lastFixed      = last.fixedExpenses || []
  const prevFixed      = prev?.fixedExpenses || []
  const lastFixedTotal = lastFixed.filter(e => e.currency==='pesos').reduce((a,e) => a+(e.amount||0), 0)
  const prevFixedTotal = prevFixed.filter(e => e.currency==='pesos').reduce((a,e) => a+(e.amount||0), 0)
  const fixedGrowth    = prev && prevFixedTotal > 0 ? pct(lastFixedTotal, prevFixedTotal) : null
  const fixedChanges   = lastFixed.map(e => {
    const prevE = prevFixed.find(p => p.id === e.id)
    if (!prevE || prevE.amount === e.amount) return null
    return { id:e.id, description:e.description, currency:e.currency, prev:prevE.amount, curr:e.amount, delta:pct(e.amount,prevE.amount) }
  }).filter(Boolean)
  const fixedTrend = sorted.slice(-6).map(h => ({
    month: h.month,
    total: (h.fixedExpenses||[]).filter(e => e.currency==='pesos').reduce((a,e) => a+(e.amount||0), 0)
  })).filter(d => d.total > 0)

  // Year-over-year comparison
  const lastMonthStr  = last.month.split('-')[1]
  const lastYearStr   = String(parseInt(last.month.split('-')[0]) - 1)
  const sameMonthLY   = sorted.find(h => h.month === `${lastYearStr}-${lastMonthStr}`)
  const yoyExpGrowth  = sameMonthLY ? pct(lastExp, sameMonthLY.totals?.expensesPesos||0) : null
  const yoyIncGrowth  = sameMonthLY ? pct(lastInc, sameMonthLY.income?.pesos||0) : null

  // All-time trend for YoY chart (same month across all years)
  const yoyMonths = sorted
    .filter(h => h.month.endsWith(`-${lastMonthStr}`))
    .map(h => ({ year: h.month.split('-')[0], expenses: h.totals?.expensesPesos||0, income: h.income?.pesos||0 }))

  return {
    sorted, last, prev,
    topItems, trendData,
    expGrowth: prev ? pct(lastExp, prev.totals?.expensesPesos||0) : null,
    incGrowth: prev ? pct(lastInc, prev.income?.pesos||0) : null,
    avgExpenses, avgIncome, avgBalance,
    posMonths, negMonths: sorted.length - posMonths,
    savingsRate, peakMonth, topCards,
    lastFixedTotal, prevFixedTotal, fixedGrowth, fixedChanges, fixedTrend,
    yoyExpGrowth, yoyIncGrowth, sameMonthLY, yoyMonths,
  }
}
