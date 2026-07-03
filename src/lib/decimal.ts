import Big from 'big.js'

/**
 * All amounts are stored as decimal strings (source model: Decimal(30, 10)).
 * Parsing is tolerant: null/empty/garbage become null instead of throwing,
 * because values can come from AI extraction or free-form user input.
 */
export function parseDecimal(value: string | null | undefined): Big | null {
  if (value == null) return null
  const cleaned = value.trim().replace(/,/g, '')
  if (cleaned === '') return null
  try {
    return new Big(cleaned)
  } catch {
    return null
  }
}

export function sumDecimals(values: Array<string | null | undefined>): Big {
  return values.reduce<Big>((acc, v) => {
    const parsed = parseDecimal(v)
    return parsed ? acc.plus(parsed) : acc
  }, new Big(0))
}

function withThousandsSeparators(fixed: string): string {
  const [int, frac] = fixed.split('.')
  const sign = int.startsWith('-') ? '-' : ''
  const digits = sign ? int.slice(1) : int
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}${frac ? `.${frac}` : ''}`
}

/** "$1,234.50" — or the fallback (default "—") when the value isn't a number. */
export function formatMoney(
  value: string | Big | null | undefined,
  fallback = '—',
): string {
  const big = value instanceof Big ? value : parseDecimal(value)
  if (!big) return fallback
  return `$${withThousandsSeparators(big.toFixed(2))}`
}

/** True when both parse and are numerically equal. */
export function decimalsEqual(a: string | null, b: string | Big | null): boolean {
  const pa = parseDecimal(a)
  const pb = b instanceof Big ? b : parseDecimal(b)
  if (!pa || !pb) return false
  return pa.eq(pb)
}
