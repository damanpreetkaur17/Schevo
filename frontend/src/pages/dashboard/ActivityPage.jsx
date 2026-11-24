import { useEffect, useState } from "react";
import { Activity as ActivityIcon, Database, GitBranch, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, LoadingState, PageHeader } from "../../components/dashboard/DashboardPrimitives";
import { apiRequest } from "../../services/apiClient";

function ActivityPage() {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [kind, setKind] = useState("all");

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/v1/activity")
      .then((data) => {
        if (!cancelled) {
          setEvents(data.events);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  const kinds = [...new Set(events.map((event) => event.kind || event.type || event.action || "activity"))];
  const visible = events.filter((event) => {
    const textMatches = `${event.message} ${event.projectName || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const eventKind = event.kind || event.type || event.action || "activity";
    return textMatches && (kind === "all" || eventKind === kind);
  });
  const grouped = visible.reduce((groups, event) => {
    const key = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(event.at));
    groups[key] = [...(groups[key] || []), event];
    return groups;
  }, {});
  const iconFor = (event) => {
    const value = `${event.kind || event.type || event.action || ""} ${event.message || ""}`.toLowerCase();
    if (value.includes("create") || value.includes("add")) return Plus;
    if (value.includes("delete") || value.includes("remove")) return Trash2;
    if (value.includes("schema") || value.includes("relationship")) return GitBranch;
    if (value.includes("project")) return Database;
    if (value.includes("update") || value.includes("edit")) return Pencil;
    return ActivityIcon;
  };

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Activity" description="Events recorded for your account when you create or structurally change a project." />
      <div className="activity-filters">
      <label className="dashboard-search-input template-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recorded events" aria-label="Search activity" />
      </label>
      <label className="activity-filter-label">Event type
        <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Filter activity by event type">
          <option value="all">All events</option>
          {kinds.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      </div>
      {status === "loading" && <LoadingState label="Loading activity..." />}
      {status === "error" && <EmptyState title="Activity could not be loaded" description="Refresh the page and try again." />}
      {status === "ready" && visible.length > 0 && (
        <section className="activity-list">
          {Object.entries(grouped).map(([date, dateEvents]) => <div className="activity-day" key={date}>
            <h2>{date}</h2>
            {dateEvents.map((event) => {
              const Icon = iconFor(event);
              return <article className="activity-item" key={event.id}>
                <span className="activity-icon"><Icon size={15} /></span>
                <div><strong>{event.message}</strong><p>{event.projectName || "Workspace"} · {event.kind || event.type || event.action || "activity"}</p></div>
                <time dateTime={event.at}>{new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(event.at))}</time>
                {event.projectId && <Link className="secondary-button compact" to={`/dashboard/projects/${event.projectId}/design`}>Open</Link>}
              </article>;
            })}
          </div>)}
        </section>
      )}
      {status === "ready" && !visible.length && (
        <EmptyState title={query ? "No matching events" : "No activity yet"} description={query ? "Try a different search." : "Create a project and Schevo will record that event. Nothing is invented to fill this page."} />
      )}
    </>
  );
}

export default ActivityPage;
