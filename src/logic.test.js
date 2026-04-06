import { describe, it, expect } from 'vitest'
import { validateCards, filterCards, mapCardsFromReport, mapOthersFromReport } from './logic'

// ── validateCards ─────────────────────────────────────────────────────────────

describe('validateCards', () => {
  it('no da error si no hay tarjetas', () => {
    expect(validateCards([])).toEqual({})
  })

  it('no da error si una tarjeta tiene banco y montos', () => {
    const cards = [{ id: 1, bank: 'Santander', pesos: '1000', dollars: '' }]
    expect(validateCards(cards)).toEqual({})
  })

  it('da error si tiene monto en pesos pero no tiene banco', () => {
    const cards = [{ id: 1, bank: '', pesos: '500', dollars: '' }]
    expect(validateCards(cards)).toEqual({ b1: 'Nombre requerido' })
  })

  it('da error si tiene monto en dólares pero no tiene banco', () => {
    const cards = [{ id: 2, bank: '  ', pesos: '', dollars: '100' }]
    expect(validateCards(cards)).toEqual({ b2: 'Nombre requerido' })
  })

  it('no da error si no tiene banco pero tampoco tiene montos (tarjeta vacía eliminable)', () => {
    const cards = [{ id: 3, bank: '', pesos: '', dollars: '' }]
    expect(validateCards(cards)).toEqual({})
  })

  it('no da error si no tiene banco y montos son 0', () => {
    const cards = [{ id: 4, bank: '', pesos: '0', dollars: '0' }]
    expect(validateCards(cards)).toEqual({})
  })

  it('valida correctamente múltiples tarjetas mezcladas', () => {
    const cards = [
      { id: 1, bank: 'Galicia', pesos: '2000', dollars: '' },  // ok
      { id: 2, bank: '',        pesos: '500',  dollars: '' },  // error: tiene monto sin banco
      { id: 3, bank: '',        pesos: '',     dollars: '' },  // ok: vacía
    ]
    expect(validateCards(cards)).toEqual({ b2: 'Nombre requerido' })
  })
})

// ── filterCards ───────────────────────────────────────────────────────────────

describe('filterCards', () => {
  it('retorna array vacío si no hay tarjetas', () => {
    expect(filterCards([])).toEqual([])
  })

  it('excluye tarjeta sin banco y sin montos', () => {
    const cards = [{ id: 1, bank: '', pesos: '', dollars: '' }]
    expect(filterCards(cards)).toEqual([])
  })

  it('excluye tarjeta sin banco y montos en cero', () => {
    const cards = [{ id: 1, bank: '', pesos: '0', dollars: '0' }]
    expect(filterCards(cards)).toEqual([])
  })

  it('incluye tarjeta con banco aunque tenga $0', () => {
    const cards = [{ id: 1, bank: 'Santander', type: 'visa', pesos: '', dollars: '' }]
    const result = filterCards(cards)
    expect(result).toHaveLength(1)
    expect(result[0].bank).toBe('Santander')
    expect(result[0].pesos).toBe(0)
    expect(result[0].dollars).toBe(0)
  })

  it('incluye tarjeta con monto aunque no tenga banco', () => {
    const cards = [{ id: 1, bank: '', type: 'mastercard', pesos: '1500', dollars: '' }]
    const result = filterCards(cards)
    expect(result).toHaveLength(1)
    expect(result[0].pesos).toBe(1500)
  })

  it('convierte montos string a número', () => {
    const cards = [{ id: 1, bank: 'BBVA', type: 'visa', pesos: '3500.50', dollars: '200' }]
    const result = filterCards(cards)
    expect(result[0].pesos).toBe(3500.50)
    expect(result[0].dollars).toBe(200)
  })

  it('filtra solo las vacías dejando las que tienen datos', () => {
    const cards = [
      { id: 1, bank: 'Galicia',    type: 'visa',       pesos: '2000', dollars: '' },
      { id: 2, bank: '',           type: 'mastercard', pesos: '',     dollars: '' },
      { id: 3, bank: 'Santander',  type: 'visa',       pesos: '1000', dollars: '50' },
    ]
    const result = filterCards(cards)
    expect(result).toHaveLength(2)
    expect(result.map(c => c.bank)).toEqual(['Galicia', 'Santander'])
  })
})

// ── mapCardsFromReport ────────────────────────────────────────────────────────

describe('mapCardsFromReport', () => {
  it('retorna array vacío si no hay tarjetas', () => {
    expect(mapCardsFromReport([])).toEqual([])
    expect(mapCardsFromReport(undefined)).toEqual([])
  })

  it('mapea montos positivos a string', () => {
    const cards = [{ bank: 'Galicia', type: 'visa', pesos: 1500, dollars: 0 }]
    const result = mapCardsFromReport(cards)
    expect(result[0].pesos).toBe('1500')
    expect(result[0].dollars).toBe('')  // 0 → vacío para dejar el input limpio
  })

  it('convierte cero en string vacío para no mostrar "0" en el input', () => {
    const cards = [{ bank: 'BBVA', type: 'mastercard', pesos: 0, dollars: 0 }]
    const result = mapCardsFromReport(cards)
    expect(result[0].pesos).toBe('')
    expect(result[0].dollars).toBe('')
  })

  it('asigna ids secuenciales desde 1', () => {
    const cards = [
      { bank: 'A', type: 'visa', pesos: 100, dollars: 0 },
      { bank: 'B', type: 'visa', pesos: 200, dollars: 0 },
    ]
    const result = mapCardsFromReport(cards)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })

  it('preserva bank y type', () => {
    const cards = [{ bank: 'Naranja X', type: 'naranja', pesos: 500, dollars: 10 }]
    const result = mapCardsFromReport(cards)
    expect(result[0].bank).toBe('Naranja X')
    expect(result[0].type).toBe('naranja')
  })
})

// ── mapOthersFromReport ───────────────────────────────────────────────────────

describe('mapOthersFromReport', () => {
  it('retorna array vacío si no hay otros gastos', () => {
    expect(mapOthersFromReport([])).toEqual([])
    expect(mapOthersFromReport(undefined)).toEqual([])
  })

  it('filtra entradas sin descripción ni monto', () => {
    const others = [
      { description: '', amount: 0, currency: 'pesos', notes: '' },
      { description: 'Super', amount: 3000, currency: 'pesos', notes: '' },
    ]
    const result = mapOthersFromReport(others)
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Super')
  })

  it('convierte monto a string', () => {
    const others = [{ description: 'Gym', amount: 15000, currency: 'pesos', notes: 'anual' }]
    const result = mapOthersFromReport(others)
    expect(result[0].amount).toBe('15000')
  })

  it('preserva notas y moneda', () => {
    const others = [{ description: 'Netflix', amount: 20, currency: 'dollars', notes: 'streaming' }]
    const result = mapOthersFromReport(others)
    expect(result[0].currency).toBe('dollars')
    expect(result[0].notes).toBe('streaming')
  })

  it('incluye entrada que tiene monto aunque no tenga descripción', () => {
    const others = [{ description: '', amount: 500, currency: 'pesos', notes: '' }]
    const result = mapOthersFromReport(others)
    expect(result).toHaveLength(1)
  })
})
