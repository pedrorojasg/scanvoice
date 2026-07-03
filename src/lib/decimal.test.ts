import { describe, expect, it } from 'vitest'
import { formatMoney, parseDecimal, sumDecimals } from './decimal'

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
