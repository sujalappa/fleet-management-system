// Tailwind needs literal class names to detect them at build time, so accent
// colors are looked up here rather than interpolated into a class string.
const ACCENT_CLASSES = {
  accent: "text-accent bg-accent/10",
  ok: "text-ok bg-ok/10",
  warn: "text-warn bg-warn/10",
  bad: "text-bad bg-bad/10",
  info: "text-info bg-info/10",
  idle: "text-idle bg-idle/10"
};

export default function KPICard({ label, value, sub, icon: Icon, accent = "accent" }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.accent}`}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className="truncate text-2xl font-semibold tracking-tight text-text">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
