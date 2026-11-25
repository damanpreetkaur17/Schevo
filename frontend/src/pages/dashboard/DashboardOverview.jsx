import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BarChart3, Check, Clock3, Plus, Boxes, TrendingUp, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import CreateProjectDialog from "../../components/dashboard/CreateProjectDialog";
import ProjectCard from "../../components/dashboard/ProjectCard";
import { EmptyState, ErrorState, LoadingState } from "../../components/dashboard/DashboardPrimitives";
import { useAuth } from "../../context/AuthContextCore";
import { projectRepository } from "../../services/projectRepository";

function DashboardOverview() {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [greeting, setGreeting] = useState("");
  const { user } = useAuth();
  const profileName = user?.displayName || "there";
  const now = new Date();
  const hour = now.getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(now);

  const loadProjects = useCallback(async () => {
    setStatus("loading");
    try { setProjects(await projectRepository.list()); setStatus("ready"); } catch { setStatus("error"); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(loadProjects, 0); return () => window.clearTimeout(timer); }, [loadProjects]);
  useEffect(() => {
    const full = `${salutation}, ${profileName}.`;
    if (sessionStorage.getItem("schevo-greeting-seen") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { const timer = window.setTimeout(() => setGreeting(full), 0); return () => window.clearTimeout(timer); }
    let index = 0;
    const timer = window.setInterval(() => { index += 1; setGreeting(full.slice(0, index)); if (index >= full.length) { window.clearInterval(timer); sessionStorage.setItem("schevo-greeting-seen", "true"); } }, 25);
    return () => window.clearInterval(timer);
  }, [salutation, profileName]);

  const recent = projects.slice(0, 3);
  const attention = projects.filter((project) => project.validation === "Warnings" || project.validation === "Errors" || project.generation === "Out of date");
  const lastProject = projects[0];
  const totalTables = projects.reduce((total, project) => total + project.tableCount, 0);
  const totalRelationships = projects.reduce((total, project) => total + project.relationshipCount, 0);
  const checklist = [
    ["Create a project", projects.length > 0, "/dashboard/projects"],
    ["Add your first table", projects.some((project) => project.tableCount > 0), lastProject ? `/dashboard/projects/${lastProject.id}/design` : "/dashboard/projects"],
    ["Review validation", projects.some((project) => project.validation === "Valid"), lastProject ? `/dashboard/projects/${lastProject.id}/design` : "/dashboard/projects"],
    ["Generate a backend", projects.some((project) => project.generation === "In sync"), lastProject ? `/dashboard/projects/${lastProject.id}/code` : "/dashboard/projects"],
  ];

  return <div className="overview-page">
    <header className="overview-welcome"><div><span className="dashboard-eyebrow">{dateLabel}</span><h1 className="greeting-line" aria-live="polite">{greeting || `${salutation}, ${profileName}.`}</h1><p>Your schema workspace is ready when you are. Design, validate and generate with confidence.</p></div><div className="overview-actions"><button className="primary-button" type="button" onClick={() => setDialogOpen(true)}><Plus size={17} /> New project</button><Link className="secondary-button" to="/dashboard/templates"><Boxes size={16} /> Start from a template</Link></div></header>
    {status === "loading" && <LoadingState label="Loading workspace..." />}
    {status === "error" && <ErrorState onRetry={loadProjects} />}
    {status === "ready" && <><div className="overview-metrics"><Metric label="Projects" value={projects.length} detail="Saved to your workspace" /><Metric label="Tables" value={totalTables} detail="Across your workspace" /><Metric label="Relationships" value={totalRelationships} detail="Schema connections" /><Metric label="Valid schemas" value={projects.filter((project) => project.validation === "Valid").length} detail="Ready to review" /></div><OverviewAnalytics projects={projects} /><div className="overview-grid">
      <div className="overview-main">
        {lastProject && <section className="continue-card"><div><span className="dashboard-eyebrow">Continue where you left off</span><h2>{lastProject.name}</h2><p>{lastProject.description}</p><Link className="primary-button" to={`/dashboard/projects/${lastProject.id}/design`}>Open design <ArrowRight size={15} /></Link></div><div className="continue-preview"><span>{lastProject.tableCount} tables</span><span>{lastProject.relationshipCount} relationships</span></div></section>}
        {attention.length > 0 && <section className="attention-strip"><div><span className="attention-dot" /><strong>{attention.length} project{attention.length === 1 ? "" : "s"} need attention</strong></div><Link to="/dashboard/projects">Review projects <ArrowRight size={14} /></Link></section>}
        <section className="dashboard-section" aria-labelledby="recent-projects-title"><header className="dashboard-section-header"><div><span className="dashboard-eyebrow">Workspace</span><h2 id="recent-projects-title">Recent projects</h2></div><Link className="section-link" to="/dashboard/projects">View all <ArrowRight size={14} /></Link></header>{recent.length ? <div className="project-grid">{recent.map((project) => <ProjectCard key={project.id} project={project} onDeleted={(id) => setProjects((current) => current.filter((item) => item.id !== id))} />)}</div> : <EmptyState title="Create your first project" description="Start from a blank schema or choose a validated template." actions={<button className="primary-button" type="button" onClick={() => setDialogOpen(true)}><Plus size={16} /> Create project</button>} />}</section>
      </div>
      <aside className="overview-side"><section className="getting-started"><div className="side-heading"><div><span className="dashboard-eyebrow">Getting started</span><h2>Build your first backend</h2></div><Wand2 size={17} /></div><div className="progress-track"><span style={{ width: `${(checklist.filter((item) => item[1]).length / checklist.length) * 100}%` }} /></div><small>{checklist.filter((item) => item[1]).length} of {checklist.length} complete</small>{checklist.map(([label, complete, to]) => <Link className={`checklist-item ${complete ? "is-complete" : ""}`} key={label} to={to}><span>{complete && <Check size={12} />}</span>{label}{!complete && <ArrowRight size={13} />}</Link>)}</section><section className="workspace-note"><Clock3 size={16} /><div><strong>{user?.email}</strong><p>Projects and schemas are stored in your workspace. Backend generation is still a separate step.</p></div></section></aside>
    </div></>}
    <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
  </div>;
}
function Metric({ label, value, detail }) { return <article className="overview-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }

function OverviewAnalytics({ projects }) {
  const maxTables = Math.max(...projects.map((project) => project.tableCount || 0), 1);
  const validationCounts = projects.reduce((counts, project) => {
    const key = project.validation || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const recent = projects.filter((project) => project.modifiedAt).slice(0, 3);
  return <section className="overview-analytics" aria-labelledby="analytics-title">
    <header className="dashboard-section-header"><div><span className="dashboard-eyebrow">Workspace signals</span><h2 id="analytics-title">Schema activity</h2></div><BarChart3 size={18} /></header>
    <div className="analytics-grid">
      <div className="analytics-card"><strong>Schema growth</strong><p>Current tables by project</p><div className="analytics-bars">{projects.length ? projects.slice(0, 5).map((project) => <div className="analytics-bar-row" key={project.id}><span title={project.name}>{project.name}</span><div><i style={{ width: `${((project.tableCount || 0) / maxTables) * 100}%` }} /></div><b>{project.tableCount || 0}</b></div>) : <small>No projects yet.</small>}</div></div>
      <div className="analytics-card"><strong>Validation status</strong><p>Current schema checks</p><div className="validation-breakdown">{Object.entries(validationCounts).length ? Object.entries(validationCounts).map(([label, count]) => <div key={label}><span className={`validation-dot validation-${label.toLowerCase().replaceAll(" ", "-")}`} />{label}<b>{count}</b></div>) : <small>No validation data yet.</small>}</div></div>
      <div className="analytics-card"><strong>Recent development</strong><p>Projects with recorded modification times</p><div className="recent-changes">{recent.length ? recent.map((project) => <Link key={project.id} to={`/dashboard/projects/${project.id}/design`}><TrendingUp size={13} /><span>{project.name}<small>{new Date(project.modifiedAt).toLocaleDateString()}</small></span><ArrowRight size={13} /></Link>) : <small>No timestamped changes yet.</small>}</div></div>
    </div>
  </section>;
}
export default DashboardOverview;
