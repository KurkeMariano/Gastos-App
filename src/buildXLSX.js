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
