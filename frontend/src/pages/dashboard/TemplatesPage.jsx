import { useMemo, useState } from "react";
import { ArrowUpRight, Database, Eye, GitBranch, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createSchemaFromTemplate, getTemplates, schemaRepository } from "../../services/schemaRepository";
import SchemaThumbnail from "../../components/dashboard/SchemaThumbnail";
import { PageHeader } from "../../components/dashboard/DashboardPrimitives";

function TemplatesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState(null);
  const [createError, setCreateError] = useState("");
  const templates = useMemo(() => getTemplates().filter((template) => template.name.toLowerCase().includes(query.toLowerCase())), [query]);
  const preview = templates.find((template) => template.id === previewId);
  const createProjectFromTemplate = async (template) => {
    setCreateError("");
    try {
      const project = await schemaRepository.create({ name: `${template.name} project`, description: template.description, templateId: template.id });
      navigate(`/dashboard/projects/${project.id}/design`);
    } catch (error) {
      setCreateError(error.message || "Could not create the project.");
    }
  };
  return <>
    <PageHeader eyebrow="Schema library" title="Templates" description="Start with a genuine, validated PostgreSQL model instead of a blank canvas." />
    <label className="dashboard-search-input template-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" /></label>
    <div className="template-grid">{templates.map((template) => <article className="template-card" key={template.id}>
      <SchemaThumbnail schema={createSchemaFromTemplate(template.id)} />
      <div className="template-card-copy"><div><span className="dashboard-eyebrow">PostgreSQL</span><h2>{template.name}</h2></div><button className="icon-button" type="button" aria-label={`Preview ${template.name}`} onClick={() => setPreviewId(template.id)}><ArrowUpRight size={17} /></button><p>{template.description}</p></div>
      <footer><span><Database size={13} /> {template.tables} tables</span><span><GitBranch size={13} /> {template.relationships} relationships</span><button className="secondary-button compact" type="button" onClick={() => setPreviewId(template.id)}><Eye size={13} /> Preview</button></footer>
    </article>)}</div>
    {createError && <p className="field-error" role="alert">{createError}</p>}
    {!templates.length && <div className="panel-empty large">No templates match your search.</div>}
    {preview && <div className="dashboard-dialog-backdrop" role="presentation" onMouseDown={() => setPreviewId(null)}><section className="template-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="template-preview-title" onMouseDown={(event) => event.stopPropagation()}><header className="dashboard-dialog-header"><div><span className="dashboard-eyebrow">Template preview</span><h2 id="template-preview-title">{preview.name}</h2></div><button className="icon-button" type="button" aria-label="Close preview" onClick={() => setPreviewId(null)}><X size={18} /></button></header><div className="template-preview-body"><SchemaThumbnail schema={createSchemaFromTemplate(preview.id)} large /><div className="template-preview-meta"><div><strong>{preview.tables}</strong><span>tables</span></div><div><strong>{preview.relationships}</strong><span>relationships</span></div><p>{preview.description} {preview.useCase}</p></div></div><footer className="dashboard-dialog-footer"><button className="secondary-button" type="button" onClick={() => setPreviewId(null)}>Close</button><button className="primary-button" type="button" onClick={() => createProjectFromTemplate(preview)}>Use template</button></footer></section></div>}
  </>;
}
export default TemplatesPage;
