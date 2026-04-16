import * as XLSX from 'xlsx'
import { monthLabel } from './utils'

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function sheetWithWidths(data) {
  const ws = XLSX.utils.aoa_to_sheet(data)
  if (!data.length) return ws
  const ncols = Math.max(...data.map(r => r.length))
  ws['!cols'] = Array.from({ length: ncols }, (_, ci) => ({
    wch: Math.min(50, Math.max(12, ...data.map(r => String(r[ci] ?? '').length))),
  }))
  ws['!freeze'] = { ySplit: 1 }
  return ws
}

function addSheet(wb, data, name) {
  XLSX.utils.book_append_sheet(wb, sheetWithWidths(data), name)
}

// ─── PER-MONTH WORKBOOK ───────────────────────────────────────────────────────
export function buildXLSX(report, analytics) {
  const wb = XLSX.utils.book_new()
  const t  = report.totals || {}

  // ── Resumen ──────────────────────────────────────────────────────────────
  const res = [['Campo', 'Valor']]
  res.push(['Mes',       monthLabel(report.month)])
  res.push(['Generado',  new Date().toLocaleString('es-AR')])
  if (report.dollarRate) res.push(['Cotización USD ($)', parseFloat(report.dollarRate)])
  if (report.budget)     res.push(['Presupuesto mensual ($)', parseFloat(report.budget)])
  res.push([])
  res.push(['TOTALES', ''])
  res.push(['Total ingresos ($)',   report.income?.pesos   || 0])
  res.push(['Total ingresos (USD)', report.income?.dollars || 0])
  res.push(['Total gastos ($)',     t.expensesPesos        || 0])
  res.push(['Total gastos (USD)',   t.expensesDollars      || 0])
  res.push(['Balance ($)',          t.balancePesos         || 0])
  res.push(['Balance (USD)',        t.balanceDollars       || 0])
  res.push(['Estado',               (t.balancePesos || 0) >= 0 ? 'POSITIVO' : 'NEGATIVO'])
  if (report.budget)
    res.push(['Restante vs presupuesto ($)', report.budget - (t.expensesPesos || 0)])
  if (report.dollarRate && t.totalInPesos != null)
    res.push(['Balance combinado ($)', t.totalInPesos])
  addSheet(wb, res, 'Resumen')

  // ── Ingresos ─────────────────────────────────────────────────────────────
  addSheet(wb, [
    ['Moneda',         'Monto'],
    ['Pesos ($)',      report.income?.pesos   || 0],
    ['Dólares (USD)',  report.income?.dollars || 0],
  ], 'Ingresos')

  // ── Tarjetas ─────────────────────────────────────────────────────────────
  const activeCards = report.cards?.filter(c => c.bank || c.pesos || c.dollars)
  if (activeCards?.length) {
    const cd = [['Banco', 'Red', 'Gastos ($)', 'Gastos (USD)']]
    activeCards.forEach(c => cd.push([
      c.bank             || 'Sin nombre',
      c.type?.toUpperCase?.() || '',
      c.pesos            || 0,
      c.dollars          || 0,
    ]))
    addSheet(wb, cd, 'Tarjetas')
  }

  // ── Alquiler ─────────────────────────────────────────────────────────────
  if ((report.rent || 0) > 0) {
    addSheet(wb, [['Concepto', 'Monto ($)'], ['Alquiler', report.rent]], 'Alquiler')
  }

  // ── Gastos Fijos ─────────────────────────────────────────────────────────
  if (report.fixedExpenses?.length) {
    const fd = [['Descripción', 'Moneda', 'Monto']]
    report.fixedExpenses.forEach(e => fd.push([
      e.description || 'Sin descripción',
      e.currency === 'pesos' ? 'Pesos ($)' : 'Dólares (USD)',
      e.amount || 0,
    ]))
    addSheet(wb, fd, 'Gastos Fijos')
  }

  // ── Otros Gastos ─────────────────────────────────────────────────────────
  const activeOthers = report.otherExpenses?.filter(e => e.description || e.amount)
  if (activeOthers?.length) {
    const od = [['Descripción', 'Categoría', 'Moneda', 'Monto', 'Notas']]
    activeOthers.forEach(e => od.push([
      e.description || 'Sin descripción',
      e.category    || 'Otros',
      e.currency === 'pesos' ? 'Pesos ($)' : 'Dólares (USD)',
      e.amount || 0,
      e.notes  || '',
    ]))
    addSheet(wb, od, 'Otros Gastos')
  }

  // ── Analítica ────────────────────────────────────────────────────────────
  if (analytics) {
    const ad = [['Métrica', 'Valor']]
    ad.push(['Promedio ingresos ($)',        analytics.avgIncome])
    ad.push(['Promedio gastos ($)',          analytics.avgExpenses])
    ad.push(['Promedio balance ($)',         analytics.avgBalance])
    ad.push(['Meses positivos',             analytics.posMonths])
    ad.push(['Meses negativos',             analytics.negMonths])
    if (analytics.savingsRate != null) ad.push(['Tasa de ahorro (%)',             +analytics.savingsRate.toFixed(2)])
    if (analytics.expGrowth   != null) ad.push(['Var. gastos vs mes anterior (%)',  +analytics.expGrowth.toFixed(2)])
    if (analytics.incGrowth   != null) ad.push(['Var. ingresos vs mes anterior (%)', +analytics.incGrowth.toFixed(2)])

    if (analytics.trendData?.length) {
      ad.push([])
      ad.push(['TENDENCIA — ÚLTIMOS MESES', '', '', ''])
      ad.push(['Mes', 'Ingresos ($)', 'Gastos ($)', 'Balance ($)'])
      analytics.trendData.forEach(d => ad.push([monthLabel(d.month), d.income, d.expenses, d.balance]))
    }

    if (analytics.fixedChanges?.length) {
      ad.push([])
      ad.push(['CAMBIOS EN GASTOS FIJOS', '', '', ''])
      ad.push(['Descripción', 'Precio Anterior', 'Precio Actual', 'Variación (%)'])
      analytics.fixedChanges.forEach(ch => ad.push([
        ch.description, ch.prev, ch.curr, +ch.delta.toFixed(2),
      ]))
    }

    if (analytics.fixedTrend?.length) {
      ad.push([])
      ad.push(['EVOLUCIÓN GASTOS FIJOS', ''])
      ad.push(['Mes', 'Total ($)'])
      analytics.fixedTrend.forEach(d => ad.push([monthLabel(d.month), d.total]))
    }

    addSheet(wb, ad, 'Analítica')
  }

  // ── _JSON (datos para sincronización con Drive) ───────────────────────────
  addSheet(wb, [['##PRESUP_DATA##'], [JSON.stringify(report)], ['##PRESUP_DATA##']], '_JSON')

  return wb
}

// ─── ALL-HISTORY WORKBOOK ─────────────────────────────────────────────────────
export function buildHistoryXLSX(history) {
  const wb     = XLSX.utils.book_new()
  const sorted = [...history].sort((a, b) => b.month.localeCompare(a.month))
  const rows   = [['Mes', 'Ingresos ($)', 'Ingresos (USD)', 'Gastos ($)', 'Gastos (USD)', 'Balance ($)', 'Balance (USD)', 'Estado']]
  sorted.forEach(r => {
    const t = r.totals || {}
    rows.push([
      monthLabel(r.month),
      r.income?.pesos   || 0,
      r.income?.dollars || 0,
      t.expensesPesos   || 0,
      t.expensesDollars || 0,
      t.balancePesos    || 0,
      t.balanceDollars  || 0,
      (t.balancePesos || 0) >= 0 ? 'POSITIVO' : 'NEGATIVO',
    ])
  })
  addSheet(wb, rows, 'Historial')
  return wb
}

// ─── BLOB HELPER ──────────────────────────────────────────────────────────────
export function workbookToBlob(wb) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ─── PARSE FROM XLSX (Drive sync) ────────────────────────────────────────────
export function parseReportFromXLSX(arrayBuffer) {
  try {
    const wb   = XLSX.read(arrayBuffer, { type: 'array' })
    const ws   = wb.Sheets['_JSON']
    if (!ws) return null
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
    const json = rows[1]?.[0]
    if (!json) return null
    const report = JSON.parse(String(json))
    if (!report.month || !report.totals) return null
    return report
  } catch {
    return null
  }
}

// ─── IMPORT FROM XLSX (manual import) ────────────────────────────────────────
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function parseMonthLabel(label) {
  const parts = String(label || '').trim().split(/\s+/)
  if (parts.length < 2) return null
  const mIdx = MONTHS_ES.indexOf(parts[0].toLowerCase())
  if (mIdx === -1) return null
  const year = parseInt(parts[parts.length - 1])
  if (!year) return null
  return `${year}-${String(mIdx + 1).padStart(2, '0')}`
}

function parseCurrency(label) {
  return String(label || '').toLowerCase().includes('peso') ? 'pesos' : 'dollars'
}

function parseSheets(wb) {
  const toRows = name => {
    const ws = wb.Sheets[name]
    return ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : []
  }

  // Resumen
  const resMap = {}
  toRows('Resumen').forEach(r => { if (r[0]) resMap[String(r[0])] = r[1] })
  const month      = parseMonthLabel(resMap['Mes']) || null
  const dollarRate = resMap['Cotización USD ($)'] != null ? String(resMap['Cotización USD ($)']) : null
  const budget     = resMap['Presupuesto mensual ($)'] != null ? (parseFloat(resMap['Presupuesto mensual ($)']) || null) : null

  // Ingresos
  const incMap = {}
  toRows('Ingresos').slice(1).forEach(r => { if (r[0]) incMap[String(r[0])] = r[1] })
  const income = {
    pesos:   parseFloat(incMap['Pesos ($)'])     || 0,
    dollars: parseFloat(incMap['Dólares (USD)']) || 0,
  }

  // Tarjetas
  const cards = toRows('Tarjetas').slice(1)
    .filter(r => r[0] || r[2] || r[3])
    .map((r, i) => ({
      id:      i + 1,
      bank:    /^sin nombre$/i.test(String(r[0] || '')) ? '' : String(r[0] || ''),
      type:    String(r[1] || 'visa').toLowerCase(),
      pesos:   parseFloat(r[2]) || 0,
      dollars: parseFloat(r[3]) || 0,
    }))

  // Alquiler
  const rentRow = toRows('Alquiler').slice(1)[0]
  const rent    = parseFloat(rentRow?.[1]) || 0

  // Gastos Fijos (snapshot info — managed globally, returned for informational use)
  const fixedExpenses = toRows('Gastos Fijos').slice(1)
    .filter(r => r[0])
    .map((r, i) => ({
      id:          `imp_${i}`,
      description: /^sin descripción$/i.test(String(r[0])) ? '' : String(r[0]),
      currency:    parseCurrency(r[1]),
      amount:      parseFloat(r[2]) || 0,
    }))

  // Otros Gastos
  const otherExpenses = toRows('Otros Gastos').slice(1)
    .filter(r => r[0] || r[3])
    .map((r, i) => ({
      id:          i + 1,
      description: /^sin descripción$/i.test(String(r[0] || '')) ? '' : String(r[0] || ''),
      category:    String(r[1] || 'Otros'),
      currency:    parseCurrency(r[2]),
      amount:      parseFloat(r[3]) || 0,
      notes:       String(r[4] || ''),
    }))

  return { month, dollarRate, budget, income, cards, rent, fixedExpenses, otherExpenses, totals: {} }
}

// Tries _JSON sheet (previously exported files) then falls back to human-readable sheets.
// Returns { report, source: 'json'|'sheets', fixedFromFile } or null on failure.
export function importXLSX(arrayBuffer) {
  try {
    const wb = XLSX.read(arrayBuffer, { type: 'array' })

    // Fast path: use embedded JSON (previously exported by the app)
    const ws = wb.Sheets['_JSON']
    if (ws) {
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const json = rows[1]?.[0]
      if (json) {
        const report = JSON.parse(String(json))
        if (report.month) return { report, source: 'json', fixedFromFile: report.fixedExpenses || [] }
      }
    }

    // Fallback: parse human-readable sheets
    const parsed = parseSheets(wb)
    if (!parsed.income) return null
    const { fixedExpenses: fixedFromFile, ...report } = parsed
    return { report, source: 'sheets', fixedFromFile }
  } catch {
    return null
  }
}
