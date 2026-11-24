import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, ChevronDown, Command, FolderKanban, HelpCircle,
  LayoutDashboard, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search,
  Settings, Sun, X, Workflow, BookOpen, Boxes,
} from "lucide-react";
import { useAuth } from "../context/AuthContextCore";
import { useTheme } from "../context/useTheme";
import AnchoredMenu from "../components/dashboard/AnchoredMenu";
import { schemaRepository } from "../services/schemaRepository";
import "../styles/Dashboard.css";
import "../styles/Studio.css";
import "../styles/ProjectStudio.css";
import "../styles/SchemaWorkspace.css";
import "../styles/ApiDocs.css";

const mainNav = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "My projects", to: "/dashboard/projects", icon: FolderKanban },
  { label: "Templates", to: "/dashboard/templates", icon: Boxes },
  { label: "Activity", to: "/dashboard/activity", icon: Activity },
];
const developNav = [
  { label: "API explorer", to: "/dashboard/api-explorer", icon: Workflow },
  { label: "Documentation", to: "/dashboard/documentation", icon: BookOpen },
];

function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const actions = [
    { label: "Go to Overview", hint: "Workspace", run: () => navigate("/dashboard") },
    { label: "Open My Projects", hint: "Workspace", run: () => navigate("/dashboard/projects") },
    { label: "Browse Templates", hint: "Workspace", run: () => navigate("/dashboard/templates") },
    { label: "Open Settings", hint: "Preferences", run: () => navigate("/dashboard/settings") },
    { label: "Switch theme", hint: "Appearance", run: () => document.documentElement.dispatchEvent(new CustomEvent("schevo:toggle-theme")) },
    ...schemaRepository.list().map((project) => ({
      label: `Open project: ${project.name}`,
      hint: "Project",
      run: () => navigate(`/dashboard/projects/${project.id}/design`),
    })),
  ];
  const results = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    if (open) {
      window.setTimeout(() => {
        setQuery("");
        setActive(0);
        inputRef.current?.focus();
      }, 0);
    }
  }, [open]);
  if (!open) return null;
  const run = (index) => {
    results[index]?.run();
    onClose();
  };
  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search">
          <Search size={18} />
          <input ref={inputRef} value={query} placeholder="Search commands and projects..." onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, results.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
            if (event.key === "Enter") run(active);
            if (event.key === "Escape") onClose();
          }} />
          <kbd>ESC</kbd>
        </div>
        <div className="command-results" role="listbox">
          {results.map((action, index) => (
            <button key={action.label} className={index === active ? "is-active" : ""} type="button" role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => run(index)}>
              <Command size={15} /><span>{action.label}</span><small>{action.hint}</small>
            </button>
          ))}
          {!results.length && <p className="command-empty">No commands found.</p>}
        </div>
        <footer><span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>ESC</kbd> Close</span></footer>
      </section>
    </div>
  );
}

function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("schevo-sidebar") === "collapsed");
  const [commandOpen, setCommandOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, workspace, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountRef = useRef(null);
  const profileRef = useRef(null);
  const projectId = location.pathname.match(/projects\/([^/]+)/)?.[1];
  const project = projectId ? schemaRepository.get(projectId) : null;
  const isWorkspace = Boolean(project);
  const area = location.pathname.split("/").pop();
  const pageTitle = project ? project.name : (mainNav.concat(developNav).find((item) => location.pathname === item.to)?.label || "Settings");

  useEffect(() => {
    localStorage.setItem("schevo-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);
  useEffect(() => {
    const handler = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const handler = () => toggleTheme();
    document.documentElement.addEventListener("schevo:toggle-theme", handler);
    return () => document.documentElement.removeEventListener("schevo:toggle-theme", handler);
  }, [toggleTheme]);
  const closeDrawer = () => setDrawerOpen(false);
  const displayName = user?.displayName || "Account";
  const profileInitial = displayName.trim().charAt(0).toUpperCase() || "S";
  const signOut = async () => {
    setProfileOpen(false);
    setAccountOpen(false);
    await logout();
    navigate("/login");
  };
  const platformShortcut = useMemo(() => navigator.userAgent.includes("Mac") ? "⌘ K" : "Ctrl K", []);

  return (
    <div className={`dashboard-shell ${collapsed ? "is-collapsed" : ""}`}>
      {drawerOpen && <button className="dashboard-drawer-backdrop" type="button" aria-label="Close sidebar" onClick={closeDrawer} />}
      <aside className={`dashboard-sidebar ${drawerOpen ? "is-open" : ""}`}>
        <div className="dashboard-sidebar-header">
          <NavLink className="dashboard-brand" to="/dashboard" aria-label="Schevo Studio overview"><img src="/images/schevo-mark.png" alt="" /><span>Schevo <small>Studio</small></span></NavLink>
          <button className="icon-button dashboard-sidebar-close" type="button" aria-label="Close sidebar" onClick={closeDrawer}><X size={18} /></button>
          <button className="icon-button dashboard-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
        </div>
        <button className="workspace-switcher" type="button" title={workspace?.name || "Workspace"}>
          <span className="workspace-dot" /><span className="workspace-copy"><strong>{workspace?.name || "Workspace"}</strong><small>Your workspace</small></span><ChevronDown size={14} />
        </button>
        <nav className="dashboard-nav" aria-label="Workspace navigation">
          <span className="nav-section-label">Workspace</span>
          {mainNav.map((item) => <NavLink key={item.to} to={item.to} end={item.end} title={collapsed ? item.label : undefined} onClick={closeDrawer} className={({ isActive }) => `dashboard-nav-item ${isActive ? "is-active" : ""}`}><item.icon size={17} /><span>{item.label}</span></NavLink>)}
          <span className="nav-section-label">Develop</span>
          {developNav.map((item) => <NavLink key={item.to} to={item.to} title={collapsed ? item.label : undefined} onClick={closeDrawer} className={({ isActive }) => `dashboard-nav-item ${isActive ? "is-active" : ""}`}><item.icon size={17} /><span>{item.label}</span></NavLink>)}
          <span className="nav-section-label">Preferences</span>
          <NavLink to="/dashboard/settings" title={collapsed ? "Settings" : undefined} onClick={closeDrawer} className={({ isActive }) => `dashboard-nav-item ${isActive ? "is-active" : ""}`}><Settings size={17} /><span>Settings</span></NavLink>
        </nav>
        <div className="dashboard-sidebar-footer">
          <button className="dashboard-help" type="button" onClick={() => setHelpOpen(true)}><HelpCircle size={16} /><span>Help & feedback</span></button>
          <div className="dashboard-profile-anchor" ref={profileRef}>
            <button className="dashboard-profile" type="button" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => { setProfileOpen((value) => !value); setAccountOpen(false); }}><span className="avatar">{profileInitial}</span><span className="dashboard-profile-copy"><strong>{displayName}</strong><small>{user?.email}</small></span><ChevronDown size={14} /></button>
          </div>
        </div>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <button className="icon-button dashboard-menu-button" type="button" aria-label="Open sidebar" onClick={() => setDrawerOpen(true)}><Menu size={20} /></button>
          <div className="dashboard-breadcrumb"><NavLink to="/dashboard">Workspace</NavLink><span>/</span>{isWorkspace ? <><NavLink to={`/dashboard/projects/${project.id}/design`}>{project.name}</NavLink><span>/</span><strong>{area === "design" ? "Design" : pageTitle}</strong></> : <strong>{pageTitle}</strong>}</div>
          <button className="dashboard-search" type="button" onClick={() => setCommandOpen(true)} aria-label="Open command palette"><Search size={16} /><span>Search anything</span><kbd>{platformShortcut}</kbd></button>
          <button className="icon-button dashboard-theme-toggle" type="button" aria-label="Toggle theme" onClick={toggleTheme}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
          <div className="dashboard-account" ref={accountRef}><button className="dashboard-account-button" type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => { setAccountOpen((value) => !value); setProfileOpen(false); }}><span className="avatar">{profileInitial}</span><ChevronDown size={13} /></button></div>
        </header>
        <main className="dashboard-main"><Outlet /></main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <AnchoredMenu open={profileOpen} anchorRef={profileRef} onClose={() => setProfileOpen(false)} placement="above" align="start" label="Account menu">
        <div className="anchored-menu-copy"><strong>{displayName}</strong><small>{user?.email}</small></div>
        <NavLink role="menuitem" to="/dashboard/settings" onClick={() => setProfileOpen(false)}>Account settings</NavLink>
        <button role="menuitem" type="button" onClick={signOut}>Log out</button>
      </AnchoredMenu>
      <AnchoredMenu open={accountOpen} anchorRef={accountRef} onClose={() => setAccountOpen(false)} placement="below" align="end" label="Account">
        <div className="anchored-menu-copy"><strong>{workspace?.name || "Your workspace"}</strong><small>Workspace navigation</small></div>
        <NavLink role="menuitem" to="/dashboard" onClick={() => setAccountOpen(false)}>Workspace overview</NavLink>
        <NavLink role="menuitem" to="/dashboard/projects" onClick={() => setAccountOpen(false)}>My projects</NavLink>
        <NavLink role="menuitem" to="/dashboard/activity" onClick={() => setAccountOpen(false)}>Recent activity</NavLink>
      </AnchoredMenu>
      {helpOpen && <div className="dashboard-dialog-backdrop" onMouseDown={() => setHelpOpen(false)}><section className="dashboard-dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}><header className="dashboard-dialog-header"><div><span className="dashboard-eyebrow">Preview</span><h2 id="help-title">Help and feedback</h2></div><button className="icon-button" type="button" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={18} /></button></header><p>Schema diagnostics stay in the designer problems panel. Account data is stored for your signed-in workspace. Hosted backend generation is not connected yet.</p><footer className="dashboard-dialog-footer"><button className="primary-button" type="button" onClick={() => setHelpOpen(false)}>Close</button></footer></section></div>}
    </div>
  );
}

export default DashboardLayout;
