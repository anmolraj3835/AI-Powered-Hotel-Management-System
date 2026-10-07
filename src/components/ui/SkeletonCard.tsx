export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
        <div className="skeleton skeleton-avatar" style={{ width: 44, height: 44, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-title" style={{ marginBottom: '8px', width: '60%' }} />
          <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 60, borderRadius: '8px' }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-container">
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <div className="skeleton" style={{ height: 14, width: '30%' }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '8px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text" style={{ width: '70%', marginBottom: '6px' }} />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
          </div>
          <div className="skeleton" style={{ width: 60, height: 24, borderRadius: '20px' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card" style={{ '--stat-accent': '#e5e7eb' } as React.CSSProperties}>
          <div className="skeleton skeleton-avatar" style={{ width: 44, height: 44 }} />
          <div className="skeleton" style={{ height: 32, width: '60%' }} />
          <div className="skeleton skeleton-text" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  );
}
