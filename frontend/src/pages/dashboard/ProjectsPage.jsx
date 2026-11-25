import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Grid2X2, List } from "lucide-react";
import CreateProjectDialog from "../../components/dashboard/CreateProjectDialog";
import ProjectCard from "../../components/dashboard/ProjectCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/dashboard/DashboardPrimitives";
import { projectRepository } from "../../services/projectRepository";

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("template");

  const loadProjects = useCallback(async () => {
    setStatus("loading");
    try {
      setProjects(await projectRepository.list());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let active = true;

    projectRepository.list()
      .then((result) => {
        if (active) {
          setProjects(result);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.description.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "All" ||
        (filter === "Needs attention" &&
          (project.validation === "Warnings" ||
            project.validation === "Errors" ||
            project.generation === "Out of date"));

      return matchesQuery && matchesFilter;
    });
  }, [projects, query, filter]);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Find and open your database projects."
        actions={
          <button className="primary-button" type="button" onClick={() => setDialogOpen(true)}>
            <Plus size={17} /> New Project
          </button>
        }
      />

      <section className="dashboard-project-toolbar" aria-label="Project filters">
        <label className="dashboard-search-input">
          <Search size={17} />
          <input
            type="search"
            value={query}
            placeholder="Search projects"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <select
          className="dashboard-select"
          value={filter}
          aria-label="Filter projects"
          onChange={(event) => setFilter(event.target.value)}
        >
          <option>All</option>
          <option>Needs attention</option>
        </select>

        <div className="dashboard-view-toggle" aria-label="Project view">
          <button
            className={view === "grid" ? "is-active" : ""}
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={16} />
          </button>
          <button
            className={view === "list" ? "is-active" : ""}
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List size={16} />
          </button>
        </div>
      </section>

      {status === "loading" && <LoadingState label="Loading projects..." />}
      {status === "error" && <ErrorState onRetry={loadProjects} />}
      {status === "ready" && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create a blank project, start from a template or import SQL."
          actions={
            <button className="primary-button" type="button" onClick={() => setDialogOpen(true)}>
              <Plus size={16} /> Create project
            </button>
          }
        />
      )}
      {status === "ready" && projects.length > 0 && filteredProjects.length === 0 && (
        <EmptyState
          title="No matching projects"
          description="Try a different search or filter."
        />
      )}
      {status === "ready" && filteredProjects.length > 0 && (
        <div className={`project-grid ${view === "list" ? "is-list" : ""}`}>
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} onDeleted={(id) => setProjects((current) => current.filter((item) => item.id !== id))} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={dialogOpen || Boolean(templateId)} initialTemplate={templateId} onClose={() => setDialogOpen(false)} />
    </>
  );
}

export default ProjectsPage;
