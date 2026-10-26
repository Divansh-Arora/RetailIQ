/** columns: [{ key, header, render?, sortKey?, num?, className? }] */
export default function Table({ columns, rows, rowKey, sort, onSort, onRowClick, caption }) {
  return (
    <div className="table-wrap">
      <table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort && c.sortKey && sort.key === c.sortKey;
              return (
                <th key={c.key} className={c.num ? 'num' : ''} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortKey && onSort
                    ? <button className="sort-btn" onClick={() => onSort(c.sortKey)}>{c.header}<span aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span></button>
                    : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey]} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined} tabIndex={onRowClick ? 0 : undefined}>
              {columns.map((c) => <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className || ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ pagination, onPage }) {
  if (!pagination) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="muted small">{from}–{to} of {total}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="small">Page {page} of {totalPages}</span>
        <button className="btn small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </nav>
  );
}

/** Small hook-free helper: toggles direction when clicking the active column. */
export const nextSort = (sort, key) => (sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
