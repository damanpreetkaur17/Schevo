import { ArrowUpRight, Boxes, GitBranch, Star } from "lucide-react";
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

function ProjectCard({ project }) {
  const navigate = useNavigate();
  const toggleStar = (event) => {
    event.stopPropagation();
    projectRepository.update(project.id, { starred: !project.starred });
  };
  return (
    <article className="project-card" tabIndex="0" onClick={() => navigate(`/dashboard/projects/${project.id}/design`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/dashboard/projects/${project.id}/design`)}>
      <div className="project-card-heading">
        <div>
          <span className="project-card-database">PostgreSQL</span>
          <h2>{project.name}</h2>
          <p>{project.description}</p>
        </div>
        <SchemaThumbnail schema={project.schema} />
        <button className={`icon-button project-star ${project.starred ? "is-starred" : ""}`} type="button" aria-label={`${project.starred ? "Unstar" : "Star"} ${project.name}`} onClick={toggleStar}>
          <Star size={16} fill={project.starred ? "currentColor" : "none"} />
        </button>
        <button className="icon-button project-open" type="button" aria-label={`Open ${project.name}`} onClick={() => navigate(`/dashboard/projects/${project.id}/design`)}>
          <ArrowUpRight size={18} />
        </button>
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
  );
}

export default ProjectCard;
