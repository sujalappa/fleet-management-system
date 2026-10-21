// Wraps a data-driven section with consistent loading/error/empty states so
// pages don't each reinvent this.
export default function StateBlock({ loading, error, empty, emptyLabel = "No data yet", children }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
        {error}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center py-16 text-muted text-sm">
        {emptyLabel}
      </div>
    );
  }

  return children;
}
