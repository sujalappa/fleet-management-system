const TONE_CLASSES = {
  ok: "bg-ok/15 text-ok border-ok/30",
  warn: "bg-warn/15 text-warn border-warn/30",
  idle: "bg-idle/15 text-idle border-idle/30",
  bad: "bg-bad/15 text-bad border-bad/30",
  info: "bg-info/15 text-info border-info/30",
  neutral: "bg-border/40 text-muted border-border"
};

export default function Badge({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone] || TONE_CLASSES.neutral}`}
    >
      {children}
    </span>
  );
}
