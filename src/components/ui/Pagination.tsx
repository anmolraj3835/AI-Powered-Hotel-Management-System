interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  count?: number;
}

export default function Pagination({
  page, totalPages, onPageChange, pageSize, onPageSizeChange, count
}: PaginationProps) {
  if (totalPages <= 1 && !count) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'between',
      gap: '16px', flexWrap: 'wrap', marginTop: '16px'
    }}>
      <div style={{ flex: 1 }}>
        {count !== undefined && (
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            Showing {((page - 1) * (pageSize || 20)) + 1}–{Math.min(page * (pageSize || 20), count)} of {count} results
          </span>
        )}
      </div>
      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} style={{ padding: '0 4px', color: '#9ca3af' }}>…</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn ${page === p ? 'active' : ''}`}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="form-select"
          style={{ width: 'auto', padding: '6px 8px', fontSize: '0.8rem' }}
          aria-label="Page size"
        >
          {[10, 20, 50].map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
      )}
    </div>
  );
}
