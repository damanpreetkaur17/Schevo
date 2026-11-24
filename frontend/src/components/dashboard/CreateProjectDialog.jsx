import { useEffect, useRef, useState } from "react";
import { Check, FilePlus2, LayoutTemplate, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getTemplates } from "../../services/schemaRepository";
import { projectRepository } from "../../services/projectRepository";

function CreateProjectDialog({ open, onClose, title = "Create a new project", initialTemplate }) {
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);
  const [method, setMethod] = useState(initialTemplate ? "template" : "blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState(initialTemplate || "blog");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);
  if (!open) return null;

  const createProject = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) { setError("Give your project a name so it is easy to find later."); return; }
    setPending(true);
    try {
      const project = await projectRepository.create({ name: name.trim(), description: description.trim(), templateId: method === "template" ? templateId : undefined });
      onClose();
      navigate(`/dashboard/projects/${project.id}/design`);
    } catch (requestError) {
      setError(requestError.message || "Could not create the project.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="dashboard-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dashboard-dialog create-project-dialog" role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dashboard-dialog-header"><div><span className="dashboard-eyebrow">New project</span><h2 id="create-project-title">{title}</h2></div><button ref={closeButtonRef} className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></header>
        <form onSubmit={createProject}>
          <div className="dashboard-dialog-body">
            <div className="creation-methods" role="radiogroup" aria-label="Project starting point">
              {[["blank", FilePlus2, "Blank project", "Start with an empty PostgreSQL schema."], ["template", LayoutTemplate, "Use a template", "Begin with a validated schema model."], ["import", Upload, "Import SQL", "Paste PostgreSQL DDL to get started."]].map(([value, Icon, label, copy]) => <button key={value} className={`creation-method ${method === value ? "is-selected" : ""}`} type="button" role="radio" aria-checked={method === value} onClick={() => value !== "import" && setMethod(value)}><Icon size={18} /><span><strong>{label}</strong><small>{copy}</small></span>{method === value && <Check size={15} />}</button>)}
            </div>
            <label className="field-label">Project name<input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="e.g. Commerce API" /></label>
            <label className="field-label">Description <span>Optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you building?" rows="2" /></label>
            {method === "template" && <label className="field-label">Template<select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{getTemplates().map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>}
            {method === "import" && <div className="preview-notice"><strong>SQL import is coming to the browser preview.</strong><span>Project creation is available now; PostgreSQL DDL parsing will be connected to the import service.</span></div>}
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
          <footer className="dashboard-dialog-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Creating..." : method === "template" ? "Create from template" : "Create project"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default CreateProjectDialog;
