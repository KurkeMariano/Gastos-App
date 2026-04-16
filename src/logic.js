// ── Lógica pura extraída de App.jsx para poder ser testeada ──────────────────

// Validación de tarjetas (paso 1):
// El nombre del banco solo es requerido si la tarjeta tiene algún monto cargado.
export function validateCards(cards) {
  const errors = {}
  cards.forEach(c => {
    const hasAmount = (parseFloat(c.pesos) || 0) > 0 || (parseFloat(c.dollars) || 0) > 0
    if (hasAmount && !c.bank.trim()) errors[`b${c.id}`] = 'Nombre requerido'
  })
  return errors
}

// Filtro de tarjetas para buildReport:
// Se descartan tarjetas sin banco y sin montos (filas vacías).
export function filterCards(cards) {
  return cards
    .filter(c => c.bank.trim() || (parseFloat(c.pesos) || 0) > 0 || (parseFloat(c.dollars) || 0) > 0)
    .map(c => ({ ...c, pesos: parseFloat(c.pesos) || 0, dollars: parseFloat(c.dollars) || 0 }))
}

// Mapeo de loadFromReport: convierte montos numéricos a strings para inputs,
// omitiendo los ceros (dejan el campo vacío).
export function mapCardsFromReport(reportCards) {
  return (reportCards || []).map((c, i) => ({
    id: i + 1,
    bank: c.bank,
    type: c.type,
    pesos:   c.pesos   > 0 ? String(c.pesos)   : '',
    dollars: c.dollars > 0 ? String(c.dollars) : '',
  }))
}

export function mapOthersFromReport(reportOthers) {
  return (reportOthers || [])
    .filter(e => e.description || e.amount)
    .map((e, i) => ({
      id:          i + 1,
      description: e.description || '',
      amount:      String(e.amount || ''),
      currency:    e.currency || 'pesos',
      notes:       e.notes || '',
      category:    e.category || 'Otros',
    }))
}
