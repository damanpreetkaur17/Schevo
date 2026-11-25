import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Boxes, GitBranch, Star, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { projectRepository } from "../../services/projectRepository";
import SchemaThumbnail from "./SchemaThumbnail";
import { Badge } from "./DashboardPrimitives";

function validationTone(status) {
  if (status === "Valid") return "success";
  if (status === "Warnings") return "warning";
  if (status === "Errors") return "danger";
  return "neutral";
}

function generationTone(status) {
  if (status === "In sync") return "success";
  if (status === "Out of date") return "warning";
  return "neutral";
}

function formatModified(date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function ProjectCard({ project, onDeleted }) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const cancelButtonRef = useRef(null);
  const toggleStar = (event) => {
    event.stopPropagation();
    projectRepository.update(project.id, { starred: !project.starred });
  };
  useEffect(() => {
    if (!deleteOpen) return undefined;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deleting) setDeleteOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteOpen, deleting]);

  const deleteProject = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await projectRepository.delete(project.id);
      onDeleted?.(project.id);
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(error.message || "Could not delete the project. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <article className="project-card" tabIndex="0" onClick={() => navigate(`/dashboard/projects/${project.id}/design`)} onKeyDown={(event) => event.target === event.currentTarget && event.key === "Enter" && navigate(`/dashboard/projects/${project.id}/design`)}>
        <div className="project-card-heading">
          <div>
            <span className="project-card-database">PostgreSQL</span>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
          </div>
          <SchemaThumbnail schema={project.schema} />
          <div className="project-card-actions">
            <button className={`icon-button project-star ${project.starred ? "is-starred" : ""}`} type="button" aria-label={`${project.starred ? "Unstar" : "Star"} ${project.name}`} onClick={toggleStar}>
              <Star size={16} fill={project.starred ? "currentColor" : "none"} />
            </button>
            <button className="icon-button project-open" type="button" aria-label={`Open ${project.name}`} onClick={() => navigate(`/dashboard/projects/${project.id}/design`)}>
              <ArrowUpRight size={18} />
            </button>
            <button
              className="icon-button project-delete"
              type="button"
              title="Delete project"
              aria-label={`Delete project ${project.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setDeleteError("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="project-card-meta">
          <span><Boxes size={15} /> {project.tableCount} tables</span>
          <span><GitBranch size={15} /> {project.relationshipCount} relationships</span>
        </div>

        <div className="project-card-statuses">
          <div>
            <span>Validation</span>
            <Badge tone={validationTone(project.validation)}>{project.validation}</Badge>
          </div>
          <div>
            <span>Generation</span>
            <Badge tone={generationTone(project.generation)}>{project.generation}</Badge>
          </div>
        </div>

        <footer className="project-card-footer">
          <span>Modified {formatModified(project.modifiedAt)}</span>
          <span>Open workspace</span>
        </footer>
      </article>
      {deleteOpen && (
        <div
          className="dashboard-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setDeleteOpen(false);
          }}
        >
          <section
            className="dashboard-dialog delete-project-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`delete-project-title-${project.id}`}
            aria-describedby={`delete-project-description-${project.id}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="dashboard-dialog-header">
              <div><span className="dashboard-eyebrow">Delete project</span><h2 id={`delete-project-title-${project.id}`}>Delete {project.name}?</h2></div>
              <button className="icon-button" type="button" aria-label="Close dialog" disabled={deleting} onClick={() => setDeleteOpen(false)}><X size={18} /></button>
            </header>
            <div className="dashboard-dialog-body">
              <p id={`delete-project-description-${project.id}`}>
                This action cannot be undone. All associated schema data will also be deleted.
              </p>
              {deleteError && <p className="field-error" role="alert">{deleteError}</p>}
            </div>
            <footer className="dashboard-dialog-footer">
              <button ref={cancelButtonRef} className="secondary-button" type="button" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button className="danger-button" type="button" disabled={deleting} onClick={deleteProject}>
                <Trash2 size={15} /> {deleting ? "Deleting..." : "Delete Project"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

export default ProjectCard;
