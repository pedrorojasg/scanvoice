import { describe, expect, it } from 'vitest'
import {
  computeLineTotal,
  formatMoney,
  isPartialPayment,
  parseDecimal,
  sumDecimals,
} from './decimal'

describe('parseDecimal', () => {
  it('parses plain decimal strings', () => {
    expect(parseDecimal('1234.5000000001')?.toString()).toBe('1234.5000000001')
  })
  it('tolerates thousands separators and whitespace', () => {
    expect(parseDecimal(' 1,234.50 ')?.toString()).toBe('1234.5')
  })
  it('returns null for null, empty and garbage', () => {
    expect(parseDecimal(null)).toBeNull()
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
  })
})

describe('sumDecimals', () => {
  it('sums while skipping unparseable values', () => {
    expect(sumDecimals(['1.10', null, '2.20', 'n/a']).toString()).toBe('3.3')
  })
  it('is exact where floats are not', () => {
    // 0.1 + 0.2 !== 0.3 in float math
    expect(sumDecimals(['0.1', '0.2']).eq('0.3')).toBe(true)
  })
  it('handles high-precision decimal strings', () => {
    expect(sumDecimals(['0.0000000001', '0.0000000002']).toString()).toBe('3e-10')
  })
})

describe('computeLineTotal', () => {
  const base = { unit_price: null, quantity: null, total_discounts: null, total_tax: null }
  it('multiplies price by quantity', () => {
    expect(computeLineTotal({ ...base, unit_price: '4.50', quantity: '10' })).toBe('45')
  })
  it('subtracts discounts and adds tax', () => {
    expect(
      computeLineTotal({
        ...base,
        unit_price: '9.80',
        quantity: '120',
        total_discounts: '50',
        total_tax: '246.96',
      }),
    ).toBe('1372.96')
  })
  it('keeps full decimal precision (no float rounding)', () => {
    expect(computeLineTotal({ ...base, unit_price: '4.5678', quantity: '3' })).toBe('13.7034')
  })
  it('returns null without a parseable price and quantity', () => {
    expect(computeLineTotal({ ...base, unit_price: '4.50' })).toBeNull()
    expect(computeLineTotal({ ...base, quantity: '10' })).toBeNull()
    expect(computeLineTotal({ ...base, unit_price: 'abc', quantity: '10' })).toBeNull()
  })
})

describe('isPartialPayment', () => {
  it('is true strictly between 0 and the total', () => {
    expect(isPartialPayment('100', '272.23')).toBe(true)
    expect(isPartialPayment('0.01', '272.23')).toBe(true)
    expect(isPartialPayment('272.22', '272.23')).toBe(true)
  })
  it('is false at the boundaries', () => {
    expect(isPartialPayment('0', '272.23')).toBe(false)
    expect(isPartialPayment('272.23', '272.23')).toBe(false)
    expect(isPartialPayment('300', '272.23')).toBe(false)
  })
  it('is false when either side is missing or invalid', () => {
    expect(isPartialPayment(null, '272.23')).toBe(false)
    expect(isPartialPayment('100', null)).toBe(false)
    expect(isPartialPayment('abc', '272.23')).toBe(false)
  })
})

describe('formatMoney', () => {
  it('formats with 2 decimals and thousands separators', () => {
    expect(formatMoney('1234567.891')).toBe('$1,234,567.89')
  })
  it('formats negatives and zero', () => {
    expect(formatMoney('-1234.5')).toBe('$-1,234.50')
    expect(formatMoney('0')).toBe('$0.00')
  })
  it('falls back for null/invalid', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(null, '$0.00')).toBe('$0.00')
  })
})
