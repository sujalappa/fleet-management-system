import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LayoutDashboard, Truck, Users, Camera, Fuel, LogOut, ChevronLeft, MapPin, Route, ClipboardList } from "lucide-react";
import api from "../services/api.js";
import { setActiveProjectId, clearSession, getUser } from "../services/auth.js";
import OverviewTab from "./tabs/OverviewTab.jsx";
import FleetTab from "./tabs/FleetTab.jsx";
import PerformanceTab from "./tabs/PerformanceTab.jsx";
import TripsTab from "./tabs/TripsTab.jsx";
import ShiftLogTab from "./tabs/ShiftLogTab.jsx";
import DriversTab from "./tabs/DriversTab.jsx";
import CamerasTab from "./tabs/CamerasTab.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, Component: OverviewTab, subtitle: "Live fleet map and production summary" },
  { id: "trips", label: "Trips", icon: Route, Component: TripsTab, subtitle: "Trip count and loading, haul and unloading times per shift" },
  { id: "shifts", label: "Shift Log", icon: ClipboardList, Component: ShiftLogTab, subtitle: "Opening and closing odometer per truck, per shift" },
  { id: "fleet", label: "Fleet Operations", icon: Truck, Component: FleetTab, subtitle: "Status, fuel and engine data for every truck" },
  { id: "performance", label: "Fuel & Performance", icon: Fuel, Component: PerformanceTab, subtitle: "Daily fuel use, idling and driving behaviour" },
  { id: "drivers", label: "Drivers", icon: Users, Component: DriversTab, subtitle: "Driver assignments and performance" },
  { id: "cameras", label: "Cameras", icon: Camera, Component: CamerasTab, subtitle: "AI safety events from on-board cameras" }
];

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function MineDashboard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [activeTab, setActiveTab] = useState("overview");
  const [project, setProject] = useState(null);

  useEffect(() => {
    setActiveProjectId(projectId);
    api.get("/projects").then((res) => {
      setProject(res.data.data.find((p) => p.projectId === projectId));
    });
  }, [projectId]);

  const active = TABS.find((t) => t.id === activeTab) || TABS[0];
  const ActiveComponent = active.Component;

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink lg:flex-row">
      {/* Sidebar (top bar on small screens) */}
      <aside className="flex shrink-0 flex-col bg-brand-dark text-white lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <Truck size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Bhushilp Fleet</div>
            <div className="text-[11px] text-white/50">Mine Monitoring</div>
          </div>
        </div>

        <button
          onClick={() => navigate("/projects")}
          className="mx-3 mb-4 hidden rounded-lg bg-white/5 px-3 py-2.5 text-left ring-1 ring-white/10 transition hover:bg-white/10 lg:block"
        >
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-white/50">
            <ChevronLeft size={12} /> Site
          </div>
          <div className="mt-0.5 truncate text-sm font-medium">{project?.name || "Loading…"}</div>
          {project?.location?.district && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-white/50">
              <MapPin size={11} /> {project.location.district}, {project.location.state}
            </div>
          )}
        </button>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {TABS.map((tab) => {
            const isActive = tab.id === active.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white text-brand-dark shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <tab.icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 border-t border-white/10 px-5 py-4 lg:flex">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs capitalize text-white/50">{user?.role?.replace("_", " ")}</div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="rounded-md p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel px-6 py-4 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-text">{active.label}</h1>
            <p className="text-sm text-muted">
              {active.subtitle}
              {project?.name ? ` · ${project.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-ok/20 bg-ok/5 px-3 py-1 text-xs font-medium text-ok">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
              </span>
              Live telematics
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text lg:hidden"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] flex-1 px-6 py-6 lg:px-8">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
