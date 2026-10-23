import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

// Dates are plain "YYYY-MM-DD" strings for IST calendar days; all arithmetic
// is done on UTC midnights of those strings so time zones can't shift a day.
const IST_MS = 5.5 * 60 * 60 * 1000;
const toUtc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (s, n) => fromUtc(toUtc(s) + n * 864e5);
export const todayIst = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
const weekday = (s) => (new Date(toUtc(s)).getUTCDay() + 6) % 7; // Mon=0 … Sun=6

function presets() {
  const t = todayIst();
  const y = +t.slice(0, 4);
  const m = +t.slice(5, 7);
  const monthStart = `${t.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const qStartMonth = String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0");
  const weekStart = addDays(t, -weekday(t));
  return [
    { label: "Today", from: t, to: t },
    { label: "Yesterday", from: addDays(t, -1), to: addDays(t, -1) },
    { label: "Last 7 days", from: addDays(t, -6), to: t },
    { label: "This week", from: weekStart, to: t },
    { label: "Last week", from: addDays(weekStart, -7), to: addDays(weekStart, -1) },
    { label: "Fortnight", from: addDays(t, -13), to: t },
    { label: "Last 30 days", from: addDays(t, -29), to: t },
    { label: "This month", from: monthStart, to: t },
    { label: "Last month", from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { label: "This quarter", from: `${y}-${qStartMonth}-01`, to: t },
    { label: "This year", from: `${y}-01-01`, to: t }
  ];
}

const fmt = (s) =>
  new Date(toUtc(s)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function rangeLabel({ from, to }) {
  const match = presets().find((p) => p.from === from && p.to === to);
  if (match) return match.label;
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // first click of a custom range
  const [hover, setHover] = useState(null);
  const [month, setMonth] = useState(value.to.slice(0, 7)); // "YYYY-MM"
  const ref = useRef(null);
  const today = todayIst();

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (from, to) => {
    onChange({ from, to });
    setAnchor(null);
    setOpen(false);
  };

  const clickDay = (d) => {
    if (d > today) return;
    if (!anchor) return setAnchor(d);
    pick(d < anchor ? d : anchor, d < anchor ? anchor : d);
  };

  // Calendar grid for `month`, Monday-first.
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const cells = [...Array(weekday(first)).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i))];
  const shiftMonth = (n) => {
    const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  // While choosing a custom range, preview anchor → hovered day.
  const [selFrom, selTo] = anchor
    ? [anchor, hover || anchor].sort()
    : [value.from, value.to];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm font-medium text-text shadow-sm transition hover:border-accent/40"
      >
        <CalendarDays size={16} className="text-muted" />
        {rangeLabel(value)}
      </button>

      {open && (
        <div className="absolute right-0 z-[1000] mt-2 w-[320px] rounded-xl border border-border bg-panel p-4 shadow-xl">
          <div className="flex flex-wrap gap-2">
            {presets().map((p) => {
              const active = p.from === value.from && p.to === value.to && !anchor;
              return (
                <button
                  key={p.label}
                  onClick={() => pick(p.from, p.to)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active ? "border-accent bg-accent text-white" : "border-border text-text hover:border-accent/40"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} className="rounded-md p-1 text-muted hover:bg-panel-hover hover:text-text">
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-semibold text-text">
              {new Date(toUtc(first)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              disabled={month >= today.slice(0, 7)}
              className="rounded-md p-1 text-muted hover:bg-panel-hover hover:text-text disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-muted">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm" onMouseLeave={() => setHover(null)}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const future = d > today;
              const edge = d === selFrom || d === selTo;
              const inRange = d > selFrom && d < selTo;
              return (
                <button
                  key={d}
                  disabled={future}
                  onClick={() => clickDay(d)}
                  onMouseEnter={() => setHover(d)}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition ${
                    edge
                      ? "bg-accent font-semibold text-white"
                      : inRange
                        ? "bg-accent/10 text-accent"
                        : future
                          ? "text-muted/40"
                          : d === today
                            ? "font-semibold text-accent ring-1 ring-accent/40 hover:bg-panel-hover"
                            : "text-text hover:bg-panel-hover"
                  }`}
                >
                  {+d.slice(8, 10)}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {anchor ? "Now pick the end date" : "Pick a start date, then an end date"}
          </p>
        </div>
      )}
    </div>
  );
}
