import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Lock, User, MapPinned, Route, Fuel } from "lucide-react";
import api from "../services/api.js";
import { setSession } from "../services/auth.js";

const FEATURES = [
  { icon: MapPinned, title: "Live fleet tracking", text: "GPS positions, geofences and status for every truck." },
  { icon: Route, title: "Automatic trip counting", text: "Loading, haul, unloading and cycle times from GPS." },
  { icon: Fuel, title: "Fuel & performance", text: "Fuel used, idling, km/L and driving behaviour per truck." }
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password });
      setSession(res.data.token, res.data.data);
      navigate("/projects");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-ink">
      {/* Brand panel */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-dark p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, #1d4ed8 0, transparent 45%), radial-gradient(circle at 85% 85%, #0ea5e9 0, transparent 40%)"
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Truck size={20} />
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight">Bhushilp Fleet</div>
            <div className="text-xs text-white/60">Mine Monitoring System</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Every truck, trip and litre of fuel — in one place.
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Real-time telematics from Eicher and Volvo fleets, turned into production and cost insight for mine
            operations.
          </p>
          <ul className="mt-10 flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon size={17} />
                </div>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-sm text-white/60">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/50">Kamptee Opencast Mine · FSNL–RTE Minesol</div>
      </aside>

      {/* Sign-in form */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white">
              <Truck size={20} />
            </div>
            <div className="text-base font-semibold text-text">Bhushilp Fleet</div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-text">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your Bhushilp account to access the fleet dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text">Username or email</span>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-panel px-3 py-2.5 shadow-sm transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
                <User size={16} className="text-muted" />
                <input
                  className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted/70"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text">Password</span>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-panel px-3 py-2.5 shadow-sm transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
                <Lock size={16} className="text-muted" />
                <input
                  type="password"
                  className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted/70"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-bad/20 bg-bad/5 px-3 py-2.5 text-sm text-bad">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-muted">Authorised personnel only. Activity may be logged.</p>
        </div>
      </main>
    </div>
  );
}
