/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SQL SANITIZE HELPER — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R5: Audit sécurité raw queries
 *
 * NOTE: All existing raw queries in the codebase use Prisma's tagged template
 * literals ($queryRaw`...`) which automatically parameterize values.
 * This helper provides additional safety for any future dynamic queries.
 *
 * AUDIT RESULTS:
 * ✅ stock-dashboard.service.ts: All 12 raw queries use $queryRaw with template literals
 * ✅ All date/string parameters are passed as ${variable} (auto-parameterized)
 * ✅ No string concatenation or $queryRawUnsafe found
 *
 * This helper exists for defense-in-depth for future development.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Sanitize a string for use in SQL LIKE patterns.
 * Escapes special LIKE characters (%, _, \)
 */
export function sanitizeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Validate that a sort column name is safe (alphanumeric + underscore only)
 * Prevents SQL injection through ORDER BY clauses
 */
export function validateSortColumn(
  column: string,
  allowedColumns: string[],
): string {
  const normalized = column.toLowerCase().trim();
  if (!allowedColumns.includes(normalized)) {
    throw new Error(
      `Invalid sort column: "${column}". Allowed: ${allowedColumns.join(', ')}`,
    );
  }
  return normalized;
}

/**
 * Validate sort direction
 */
export function validateSortDirection(direction: string): 'ASC' | 'DESC' {
  const normalized = direction.toUpperCase().trim();
  if (normalized !== 'ASC' && normalized !== 'DESC') {
    return 'ASC'; // Default safe value
  }
  return normalized as 'ASC' | 'DESC';
}

/**
 * Validate and clamp a numeric parameter within bounds
 */
export function clampNumber(
  value: number | string | undefined,
  min: number,
  max: number,
  defaultVal: number,
): number {
  if (value === undefined || value === null) return defaultVal;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return defaultVal;
  return Math.min(Math.max(num, min), max);
}

/**
 * Validate that a string matches a safe pattern (no SQL special chars)
 * Use for identifiers, codes, etc.
 */
export function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}
