import { useNavigate } from "react-router-dom";
import { MapPin, ChevronRight, LogOut, Truck, Building2 } from "lucide-react";
import useFetch from "../hooks/useFetch.js";
import api from "../services/api.js";
import { setActiveProjectId, clearSession, getUser } from "../services/auth.js";
import StateBlock from "../components/common/StateBlock.jsx";

export default function ProjectPortal() {
  const navigate = useNavigate();
  const user = getUser();
  const { data: projects, loading, error } = useFetch(() => api.get("/projects"), []);

  const openProject = (projectId) => {
    setActiveProjectId(projectId);
    navigate(`/dashboard/${projectId}`);
  };

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
              <Truck size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-text">Bhushilp Fleet</div>
              <div className="text-xs text-muted">Mine Monitoring System</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:block">{user?.name}</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Select a site</h1>
        <p className="mt-1 text-sm text-muted">Choose the mine whose fleet you want to monitor.</p>

        <div className="mt-8">
          <StateBlock loading={loading} error={error} empty={projects?.length === 0}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects?.map((project) => (
                <button
                  key={project.projectId}
                  onClick={() => openProject(project.projectId)}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-panel p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Building2 size={19} />
                    </div>
                    <ChevronRight size={18} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-text">{project.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <MapPin size={13} />
                      {project.location?.district}, {project.location?.state}
                    </div>
                  </div>
                  {project.client && (
                    <div className="border-t border-border pt-3 text-xs text-muted">{project.client}</div>
                  )}
                </button>
              ))}
            </div>
          </StateBlock>
        </div>
      </main>
    </div>
  );
}
