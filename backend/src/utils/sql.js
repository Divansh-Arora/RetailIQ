/** Escapes LIKE wildcards in user input so "%" and "_" match literally. */
export const likeContains = (s) => `%${String(s).replace(/[\\%_]/g, '\\$&')}%`;

/** Inclusive date-range predicate on a DATETIME column (index-friendly, no function on the column). */
export function dateRangeClause(column, { from, to } = {}) {
  const sql = [];
  const params = [];
  if (from) { sql.push(`${column} >= ?`); params.push(from); }
  if (to) { sql.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(to); }
  return { sql, params };
}

export const pageMeta = (total, page, limit) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
export const cents = (n) => Math.round(n * 100);
