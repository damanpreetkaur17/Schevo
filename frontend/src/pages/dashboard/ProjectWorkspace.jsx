import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Database, GitBranch, LayoutGrid, Minus, PanelRight, Plus, Redo2, Search, Trash2, Undo2, Wand2 } from "lucide-react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { createJunctionTable, eligibleReferenceColumns, eligibleReferenceKeys, relationshipForColumn, setForeignKey, setForeignKeyColumns } from "../../domain/schema/mutate";
import { canonicalizeSchema } from "../../domain/schema/model";
import { findAvailableTablePosition } from "../../domain/schema/layout";
import { createGeneratedBackendArchive, createProjectApiEndpoints, generateProjectApiKey } from "../../services/backendGenerator";
import { apiRequest } from "../../services/apiClient";
import { REFERENTIAL_ACTIONS, TYPE_OPTIONS } from "../../domain/schema/types";
import { isAccountMode, persistenceState, saveProjectNow, schemaRepository, schemaToSql, subscribePersistence, validateSchema, validationStatus } from "../../services/schemaRepository";
import { Badge, EmptyState, PageHeader } from "../../components/dashboard/DashboardPrimitives";

function ProjectWorkspace() {
  const { projectId, area = "design" } = useParams();
  const navigate = useNavigate();
  const initial = useMemo(() => schemaRepository.get(projectId), [projectId]);
  const [project] = useState(initial);
  const [schema, setSchema] = useState(initial?.schema || { tables: [], relationships: [] });
  const [selectedTable, setSelectedTable] = useState(initial?.schema?.tables?.[0]?.id || null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [panel, setPanel] = useState("problems");
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [query, setQuery] = useState("");
  const [relationshipMode, setRelationshipMode] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [pointer, setPointer] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [notice, setNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBackend, setGeneratedBackend] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [saveInfo, setSaveInfo] = useState(() => persistenceState(projectId));
  const firstSchemaEffect = useRef(true);
  const problems = useMemo(() => validateSchema(schema), [schema]);
  const statusLabel = validationStatus(problems);
  const table = schema.tables.find((item) => item.id === selectedTable);
  const canvasTables = schema.tables.map((item) => item.id === dragPosition?.tableId
    ? { ...item, x: dragPosition.x, y: dragPosition.y }
    : item);
  const canvasWidth = Math.max(900, ...canvasTables.map((item) => item.x + 280));
  const canvasHeight = Math.max(700, ...canvasTables.map((item) => item.y + Math.max(180, item.columns.length * 36 + 70)));

  useEffect(() => { if (!initial) navigate("/dashboard/projects"); }, [initial, navigate]);
  useEffect(() => {
    return subscribePersistence(projectId, setSaveInfo);
  }, [projectId]);
  useEffect(() => {
    if (firstSchemaEffect.current) { firstSchemaEffect.current = false; return; }
    if (!project) return;
    schemaRepository.update(projectId, { schema, tableCount: schema.tables.length, relationshipCount: schema.relationships.length, validation: statusLabel, generation: "Out of date", lastArea: area });
  }, [schema, project, projectId, statusLabel, area]);
  if (!project) return <EmptyState title="Project not found" description="This project may have been deleted or is not available in preview mode." actions={<NavLink className="primary-button" to="/dashboard/projects">Back to projects</NavLink>} />;

  const updateSchema = (next) => { const normalized = canonicalizeSchema(next); setHistory((items) => [...items.slice(-19), schema]); setFuture([]); setSchema(normalized); };
  const addTable = () => {
    const id = `table-${Date.now()}`;
    const newTable = { id, name: "new_table", description: "", ...findAvailableTablePosition(schema.tables, { columns: [{ id: `${id}-id` }] }), columns: [{ id: `${id}-id`, name: "id", type: "uuid", nullable: false }], constraints: [{ id: `pk:${id}:${id}-id`, type: "primaryKey", columns: [`${id}-id`] }] };
    updateSchema({ ...schema, tables: [...schema.tables, newTable] });
    setSelectedTable(id); setSelectedColumn(null);
  };
  const updateTable = (patch) => updateSchema({ ...schema, tables: schema.tables.map((item) => item.id === selectedTable ? { ...item, ...patch } : item) });
  const addColumn = () => { if (!table) return; updateTable({ columns: [...table.columns, { id: `${table.id}-column-${table.columns.length + 1}`, name: "new_column", type: "text", nullable: true }] }); };
  const updateColumn = (id, patch) => {
    const columns = table.columns.map((column) => column.id === id ? { ...column, ...patch } : column);
    const constraints = [...(table.constraints || [])];
    if (Object.hasOwn(patch, "primaryKey")) {
      const nextKeyColumns = columns.filter((column) => column.primaryKey).map((column) => column.id);
      const currentKey = constraints.find((constraint) => constraint.type === "primaryKey");
      if (!nextKeyColumns.length) {
        for (let index = constraints.length - 1; index >= 0; index -= 1) if (constraints[index].type === "primaryKey") constraints.splice(index, 1);
      } else if (currentKey) currentKey.columns = nextKeyColumns;
      else constraints.push({ id: `pk:${table.id}:${nextKeyColumns.join(":" )}`, type: "primaryKey", columns: nextKeyColumns });
    }
    if (Object.hasOwn(patch, "unique")) {
      const matching = constraints.find((constraint) => constraint.type === "unique" && constraint.columns.length === 1 && constraint.columns[0] === id);
      if (patch.unique && !matching) constraints.push({ id: `uq:${table.id}:${id}`, type: "unique", columns: [id] });
      if (!patch.unique && matching) constraints.splice(constraints.indexOf(matching), 1);
    }
    updateTable({ columns, constraints });
  };
  const deleteTable = () => { updateSchema({ ...schema, tables: schema.tables.filter((item) => item.id !== selectedTable), relationships: schema.relationships.filter((item) => item.sourceTable !== selectedTable && item.targetTable !== selectedTable) }); setSelectedTable(null); };
  const autoLayout = () => {
    const tables = [];
    schema.tables.forEach((item) => tables.push({ ...item, ...findAvailableTablePosition(tables, item) }));
    updateSchema({ ...schema, tables });
  };
  const zoomIn = () => setZoom((value) => Math.min(200, value + 10));
  const zoomOut = () => setZoom((value) => Math.max(50, value - 10));
  const generateBackend = async () => {
    setIsGenerating(true);
    setNotice("");
    try {
      const apiKey = generateProjectApiKey();
      const archive = await createGeneratedBackendArchive({ projectName: project.name, schema, apiKey });
      const url = URL.createObjectURL(archive.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = archive.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setGeneratedBackend({
        apiKey,
        fileName: archive.fileName,
        files: Object.keys(archive.files),
        generatedAt: new Date().toISOString(),
      });
      setCopyMessage("");
      navigate(`/dashboard/projects/${projectId}/code`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Backend generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };
  const copyApiKey = async () => {
    if (!generatedBackend?.apiKey) return;
    try {
      await navigator.clipboard.writeText(generatedBackend.apiKey);
      setCopyMessage("API key copied.");
    } catch {
      setCopyMessage("Could not copy the API key. Select and copy it manually.");
    }
  };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((items) => [schema, ...items]); setSchema(previous); setHistory((items) => items.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((items) => [...items, schema]); setSchema(next); setFuture((items) => items.slice(1)); };
  const sql = schemaToSql(schema);
  const createRelationship = (targetTableId, targetColumnId) => {
    if (!connectionStart || (connectionStart.tableId === targetTableId && connectionStart.columnId === targetColumnId)) return;
    const sourceTable = schema.tables.find((item) => item.id === connectionStart.tableId);
    const targetTable = schema.tables.find((item) => item.id === targetTableId);
    const sourceColumn = sourceTable?.columns.find((item) => item.id === connectionStart.columnId);
    const targetColumn = targetTable?.columns.find((item) => item.id === targetColumnId);
    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) return;
    const candidate = setForeignKey(schema, { tableId: targetTable.id, columnId: targetColumn.id, referencedTableId: sourceTable.id, referencedColumnId: sourceColumn.id });
    const blocking = validateSchema(candidate).filter((problem) => problem.severity === "error" && problem.columnId === targetColumn.id);
    if (blocking.length) { setNotice(blocking[0].message); setConnectionStart(null); setPointer(null); return; }
    setNotice("");
    updateSchema(candidate);
    setConnectionStart(null); setPointer(null); setRelationshipMode(false);
  };
  const selectColumnForRelationship = (tableId, columnId) => {
    if (!relationshipMode && !connectionStart) { setSelectedTable(tableId); setSelectedColumn(columnId); return; }
    if (!connectionStart) { setConnectionStart({ tableId, columnId }); setSelectedTable(tableId); setSelectedColumn(columnId); return; }
    createRelationship(tableId, columnId);
  };

  return (
    <div className="project-workspace">
      <header className="project-header">
        <div><span className="dashboard-eyebrow">Project</span><h1>{project.name}</h1><p>{project.description}</p></div>
        <div className="project-header-status"><Badge tone={problems.some((problem) => problem.severity === "error") ? "warning" : problems.length ? "neutral" : "success"}>{problems.some((problem) => problem.severity === "error") ? `${problems.filter((problem) => problem.severity === "error").length} errors` : problems.length ? `${problems.length} notes` : "Valid"}</Badge><SaveIndicator projectId={projectId} saveInfo={saveInfo} /><button className="primary-button" type="button" onClick={generateBackend} disabled={isGenerating} aria-busy={isGenerating}><Wand2 size={15} /> {isGenerating ? "Generating…" : "Generate backend"}</button></div>
      </header>
      <nav className="project-tabs" aria-label="Project workspace"><NavLink to={`/dashboard/projects/${projectId}/design`}>Design</NavLink><NavLink to={`/dashboard/projects/${projectId}/code`}>Code</NavLink><NavLink to={`/dashboard/projects/${projectId}/api`}>API</NavLink><NavLink to={`/dashboard/projects/${projectId}/history`}>History</NavLink><NavLink to={`/dashboard/projects/${projectId}/settings`}>Settings</NavLink></nav>
      {notice && area !== "design" && <p className="generation-notice" role="alert">{notice}</p>}
      {area !== "design" ? <WorkspaceArea area={area} project={project} schema={schema} generatedBackend={generatedBackend} copyApiKey={copyApiKey} copyMessage={copyMessage} /> : <div className="design-layout">
        <aside className="schema-explorer">
          <div className="workspace-panel-heading"><div><span>Schema</span><strong>{schema.tables.length} tables</strong></div><button className="icon-button" type="button" aria-label="Add table" onClick={addTable}><Plus size={16} /></button></div>
          <label className="workspace-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find tables..." /></label>
          <div className="table-list">{schema.tables.filter((item) => item.name.includes(query.toLowerCase())).map((item) => <button key={item.id} className={`table-list-item ${item.id === selectedTable ? "is-selected" : ""}`} type="button" onClick={() => { setSelectedTable(item.id); setSelectedColumn(null); }}><Database size={15} /><span>{item.name}</span>{problems.some((problem) => problem.tableId === item.id) && <i />}</button>)}</div>
          {!schema.tables.length && <p className="panel-empty">Add a table to start designing your schema.</p>}
        </aside>
        <section className="schema-canvas" aria-label="Schema canvas">
          <div className="canvas-toolbar">
            <button type="button" title="Add table" aria-label="Add table" onClick={addTable}><Plus size={15} /></button>
            <button className={relationshipMode ? "is-active" : ""} type="button" title="Create relationship" aria-label="Create relationship" aria-pressed={relationshipMode} onClick={() => { setRelationshipMode((value) => !value); setConnectionStart(null); }}><GitBranch size={15} /></button>
            <button type="button" title="Auto layout" aria-label="Auto layout" onClick={autoLayout}><LayoutGrid size={15} /></button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={zoomOut} disabled={zoom <= 50}><Minus size={15} /></button>
            <span aria-live="polite">{zoom}%</span>
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={zoomIn} disabled={zoom >= 200}><Plus size={15} /></button>
            <span className="toolbar-divider" />
            <button type="button" title="Undo" aria-label="Undo" onClick={undo} disabled={!history.length}><Undo2 size={15} /></button>
            <button type="button" title="Redo" aria-label="Redo" onClick={redo} disabled={!future.length}><Redo2 size={15} /></button>
            <button className="inspector-toggle" type="button" title="Toggle inspector" aria-label="Toggle inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}><PanelRight size={15} /></button>
          </div>
          <div className="canvas-grid" onMouseMove={(event) => {
            if (!connectionStart) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setPointer({
              x: (event.clientX - rect.left + event.currentTarget.scrollLeft) * 100 / zoom,
              y: (event.clientY - rect.top + event.currentTarget.scrollTop) * 100 / zoom,
            });
          }}>
            <div className="canvas-world" style={{ width: `${canvasWidth * zoom / 100}px`, height: `${canvasHeight * zoom / 100}px` }}>
              <div className="canvas-world-content" style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px`, transform: `scale(${zoom / 100})` }}>
                <svg className="relationship-layer" aria-hidden="true">
                  {schema.relationships.map((relationship) => {
                    const source = canvasTables.find((item) => item.id === relationship.sourceTable);
                    const target = canvasTables.find((item) => item.id === relationship.targetTable);
                    if (!source || !target) return null;
                    return <path key={relationship.id} d={`M ${source.x + 230} ${source.y + 64} C ${source.x + 290} ${source.y + 64}, ${target.x - 60} ${target.y + 64}, ${target.x} ${target.y + 64}`} />;
                  })}
                  {connectionStart && pointer && (() => {
                    const source = canvasTables.find((item) => item.id === connectionStart.tableId);
                    return source ? <path className="connection-preview" d={`M ${source.x + 230} ${source.y + 64} C ${source.x + 280} ${source.y + 64}, ${pointer.x - 50} ${pointer.y}, ${pointer.x} ${pointer.y}`} /> : null;
                  })()}
                </svg>
                {schema.tables.map((item) => <TableNode key={item.id} table={item} zoom={zoom} selected={item.id === selectedTable} connectionStart={connectionStart} relationshipMode={relationshipMode} onSelect={() => { setSelectedTable(item.id); setSelectedColumn(null); }} onMovePreview={(x, y) => setDragPosition({ tableId: item.id, x, y })} onMove={(x, y) => { if (x !== item.x || y !== item.y) updateSchema({ ...schema, tables: schema.tables.map((current) => current.id === item.id ? { ...current, x, y } : current) }); setDragPosition(null); }} onColumnSelect={(columnId) => selectColumnForRelationship(item.id, columnId)} onConnectionStart={(columnId) => { setConnectionStart({ tableId: item.id, columnId }); setRelationshipMode(true); }} onConnectionEnd={(columnId) => createRelationship(item.id, columnId)} />)}
              </div>
            </div>
          </div>
          {notice && <p className="canvas-notice" role="status">{notice}</p>}
          <div className="canvas-help">{connectionStart ? "Choose the referencing column. The first column is the referenced key." : relationshipMode ? "Select the referenced column, then the foreign-key column" : "Hover a column to connect handles · Drag tables to arrange your schema"}</div>
          <div className="bottom-panel"><div className="bottom-tabs">{[["problems", "Problems", problems.length], ["sql", "SQL preview", null], ["changes", "Changes", history.length]].map(([value, label, count]) => <button key={value} className={panel === value ? "is-active" : ""} type="button" onClick={() => setPanel(value)}>{label}{count ? <b>{count}</b> : null}</button>)}</div>{panel === "problems" && <div className="bottom-content">{problems.length ? problems.map((problem) => <button key={problem.id} type="button" onClick={() => problem.tableId && setSelectedTable(problem.tableId)}><span className={`problem-dot ${problem.severity}`} />{problem.message}</button>) : <p><Check size={15} /> No validation problems found.</p>}</div>}{panel === "sql" && <div className="sql-panel"><div className="sql-panel-actions"><button className="secondary-button compact" type="button" onClick={() => navigator.clipboard.writeText(sql || "")}>Copy SQL</button><button className="secondary-button compact" type="button" onClick={() => { const blob = new Blob([sql || ""], { type: "text/sql" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "schema"}.sql`; link.click(); URL.revokeObjectURL(url); }}>Download</button></div><pre className="sql-preview">{sql || "-- Add a table to preview PostgreSQL SQL"}</pre></div>}{panel === "changes" && <div className="bottom-content"><p>{history.length ? `${history.length} local change${history.length === 1 ? "" : "s"} ready to review.` : "Your local changes will appear here."}</p></div>}</div>
        </section>
        <aside className={`schema-inspector ${inspectorOpen ? "is-open" : ""}`}>{table ? <><div className="inspector-heading"><div><span>Table</span><strong>{table.name}</strong></div><button className="icon-button" type="button" aria-label="Delete table" onClick={deleteTable}><Trash2 size={15} /></button></div><div className="inspector-scroll"><details className="inspector-group" open><summary>General</summary><label className="field-label">Table name<input value={table.name} onChange={(event) => updateTable({ name: event.target.value })} /></label><label className="field-label">Description<textarea rows="2" value={table.description} onChange={(event) => updateTable({ description: event.target.value })} /></label></details><details className="inspector-group" open><summary><span>Columns</span><button className="secondary-button compact" type="button" onClick={(event) => { event.preventDefault(); addColumn(); }}><Plus size={14} /> Add</button></summary>{table.columns.map((column) => <ColumnEditor key={column.id} schema={schema} table={table} column={column} selected={selectedColumn === column.id} onSelect={() => setSelectedColumn(column.id)} onPatch={(patch) => updateColumn(column.id, patch)} onSchema={updateSchema} />)}</details><details className="inspector-group"><summary>Constraints and indexes</summary><ConstraintIndexEditor schema={schema} table={table} onSchema={updateSchema} /></details><details className="inspector-group"><summary>Relationships</summary><RelationshipEditor schema={schema} table={table} onSchema={updateSchema} /></details></div></> : <div className="inspector-empty"><Database size={24} /><strong>Select a table</strong><p>Choose a table from the explorer or canvas to inspect its columns and constraints.</p></div>}</aside>
      </div>}
    </div>
  );
}

function SaveIndicator({ projectId, saveInfo }) {
  const labels = { clean: "Clean", dirty: "Unsaved changes", saving: "Saving…", saved: "Saved to account", "save-failed": "Save failed", "local-only": "Local-only changes" };
  return <div className={`save-state save-state-${saveInfo.status}`} role={saveInfo.status === "save-failed" ? "alert" : "status"}>
    <span>{labels[saveInfo.status] || "Checking save state…"}</span>
    {saveInfo.error && <span className="save-error-message">{saveInfo.error}</span>}
    {saveInfo.status === "save-failed" && saveInfo.errorCode !== 409 && <button className="secondary-button compact" type="button" onClick={() => saveProjectNow(projectId).catch(() => undefined)}>Retry save</button>}
  </div>;
}

function ColumnEditor({ schema, table, column, selected, onSelect, onPatch, onSchema }) {
  const relationship = relationshipForColumn(schema, table.id, column);
  const options = eligibleReferenceColumns(schema, table.id);
  const matched = relationship && options.find((option) => option.tableId === relationship.sourceTable && (option.columnId === relationship.sourceColumn || option.label.endsWith(`.${relationship.sourceColumn}`)));
  const typeChoices = TYPE_OPTIONS.includes(column.type) ? TYPE_OPTIONS : [column.type, ...TYPE_OPTIONS];
  const referenceValue = matched ? `${matched.tableId}:${matched.columnId}` : "";
  const applyReference = (tableId, columnId, extra = {}) => onSchema(setForeignKey(schema, {
    tableId: table.id,
    columnId: column.id,
    referencedTableId: tableId,
    referencedColumnId: columnId,
    onDelete: extra.onDelete || relationship?.onDelete || "NO ACTION",
    onUpdate: extra.onUpdate || relationship?.onUpdate || "NO ACTION",
    cardinality: extra.cardinality || relationship?.cardinality || relationship?.kind || "one-to-many",
    name: extra.name ?? relationship?.name ?? "",
    deferrable: extra.deferrable ?? relationship?.deferrable ?? false,
    initiallyDeferred: extra.initiallyDeferred ?? relationship?.initiallyDeferred ?? false,
  }));
  return (
    <div className={`column-editor ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      <div className="column-editor-row">
        <input value={column.name} aria-label="Column name" onChange={(event) => onPatch({ name: event.target.value })} />
        <select aria-label="Data type" value={column.type} onChange={(event) => onPatch({ type: event.target.value })}>{typeChoices.map((type) => <option key={type}>{type}</option>)}</select>
      </div>
      <div className="column-toggles">
        <label><input type="checkbox" checked={Boolean(column.primaryKey)} onChange={(event) => onPatch({ primaryKey: event.target.checked, nullable: event.target.checked ? false : column.nullable })} /> PK</label>
        <label><input type="checkbox" checked={column.nullable === false} disabled={Boolean(column.primaryKey)} onChange={(event) => onPatch({ nullable: !event.target.checked })} /> Required</label>
        <label><input type="checkbox" checked={Boolean(column.unique || column.primaryKey)} disabled={Boolean(column.primaryKey)} onChange={(event) => onPatch({ unique: event.target.checked })} /> Unique</label>
      </div>
      <label className="field-label fk-field">Foreign key
        <select aria-label={`Foreign key for ${column.name}`} value={referenceValue} onChange={(event) => {
          if (!event.target.value) applyReference(null, null);
          else { const [referencedTableId, referencedColumnId] = event.target.value.split(":"); applyReference(referencedTableId, referencedColumnId); }
        }}>
          <option value="">None</option>
          {relationship && !matched && <option value="" disabled>Current reference is not an eligible key</option>}
          {options.map((option) => <option key={`${option.tableId}:${option.columnId}`} value={`${option.tableId}:${option.columnId}`}>{option.label}{option.sameTable ? " (self)" : ""}</option>)}
        </select>
      </label>
      <label className="field-label">Default expression<input value={column.defaultExpression || ""} placeholder="e.g. now() or 'draft'" onChange={(event) => onPatch({ defaultExpression: event.target.value, defaultValue: event.target.value })} /></label>
      <div className="column-toggles column-generation-fields">
        <label className="column-generation-field">Identity<select aria-label="Identity generation" value={column.identity?.mode || "none"} disabled={!['smallint', 'integer', 'bigint'].includes(column.type)} onChange={(event) => onPatch({ identity: event.target.value === "none" ? null : { mode: event.target.value } })}><option value="none">None</option><option value="BY DEFAULT">BY DEFAULT</option><option value="ALWAYS">ALWAYS</option></select></label>
        <label className="column-generation-field">UUID generation<select aria-label="UUID generation" value={column.uuidGeneration || "none"} disabled={column.type !== "uuid"} onChange={(event) => onPatch({ uuidGeneration: event.target.value === "none" ? null : event.target.value, uuidGenerate: event.target.value !== "none" })}><option value="none">None</option><option value="gen_random_uuid">gen_random_uuid() (PostgreSQL 13+)</option><option value="uuid_generate_v4">uuid_generate_v4() (requires uuid-ossp)</option></select><small className="field-help">Schevo does not install extensions; enable uuid-ossp in the target database before using uuid_generate_v4().</small></label>
      </div>
      {matched && <div className="fk-actions">
        <label>ON DELETE<select aria-label="On delete" value={relationship.onDelete || "NO ACTION"} onChange={(event) => applyReference(matched.tableId, matched.columnId, { onDelete: event.target.value })}>{REFERENTIAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
        <label>ON UPDATE<select aria-label="On update" value={relationship.onUpdate || "NO ACTION"} onChange={(event) => applyReference(matched.tableId, matched.columnId, { onUpdate: event.target.value })}>{REFERENTIAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
        <label>Cardinality<select aria-label="Cardinality" value={relationship.kind === "one-to-one" ? "one-to-one" : "one-to-many"} onChange={(event) => applyReference(matched.tableId, matched.columnId, { cardinality: event.target.value })}><option value="one-to-many">One to many</option><option value="one-to-one">One to one</option></select></label>
        <label>Constraint name<input aria-label="Constraint name" value={relationship.name || ""} onChange={(event) => applyReference(matched.tableId, matched.columnId, { name: event.target.value })} /></label>
        <label><input type="checkbox" checked={Boolean(relationship.deferrable)} onChange={(event) => applyReference(matched.tableId, matched.columnId, { deferrable: event.target.checked, initiallyDeferred: event.target.checked ? relationship.initiallyDeferred : false })} /> Deferrable</label>
        {relationship.deferrable && <label><input type="checkbox" checked={Boolean(relationship.initiallyDeferred)} onChange={(event) => applyReference(matched.tableId, matched.columnId, { initiallyDeferred: event.target.checked })} /> Initially deferred</label>}
      </div>}
    </div>
  );
}

function ConstraintIndexEditor({ schema, table, onSchema }) {
  const [checkName, setCheckName] = useState("");
  const [checkExpression, setCheckExpression] = useState("");
  const [uniqueName, setUniqueName] = useState("");
  const [uniqueColumns, setUniqueColumns] = useState([]);
  const [uniqueNullsNotDistinct, setUniqueNullsNotDistinct] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [indexColumns, setIndexColumns] = useState([]);
  const [indexMethod, setIndexMethod] = useState("btree");
  const [indexUnique, setIndexUnique] = useState(false);
  const [indexWhere, setIndexWhere] = useState("");
  const columnsLabel = (ids) => ids.map((id) => table.columns.find((column) => column.id === id)?.name || id).join(", ");
  const patchConstraint = (id, patch) => onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, constraints: item.constraints.map((constraint) => constraint.id === id ? { ...constraint, ...patch } : constraint) } : item) }));
  const removeConstraint = (id) => onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, constraints: item.constraints.filter((constraint) => constraint.id !== id) } : item) }));
  const patchIndex = (id, patch) => onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, indexes: item.indexes.map((index) => index.id === id ? { ...index, ...patch } : index) } : item) }));
  const removeIndex = (id) => onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, indexes: item.indexes.filter((index) => index.id !== id) } : item) }));
  const toggle = (values, setter, id, checked) => setter(checked ? [...values, id] : values.filter((value) => value !== id));
  const addCheck = (event) => {
    event.preventDefault();
    const constraint = { id: `check:${table.id}:${Date.now()}`, name: checkName, type: "check", expression: checkExpression, columns: [] };
    onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, constraints: [...item.constraints, constraint] } : item) }));
    setCheckName(""); setCheckExpression("");
  };
  const addUnique = (event) => {
    event.preventDefault();
    if (!uniqueColumns.length) return;
    const constraint = { id: `unique:${table.id}:${Date.now()}`, name: uniqueName, type: "unique", columns: uniqueColumns, nullsNotDistinct: uniqueNullsNotDistinct };
    onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, constraints: [...item.constraints, constraint] } : item) }));
    setUniqueName(""); setUniqueColumns([]); setUniqueNullsNotDistinct(false);
  };
  const addIndex = (event) => {
    event.preventDefault();
    if (!indexColumns.length) return;
    const index = { id: `index:${table.id}:${Date.now()}`, name: indexName, columns: indexColumns, method: indexMethod, unique: indexUnique, options: { ...(indexWhere ? { where: indexWhere } : {}) } };
    onSchema(canonicalizeSchema({ ...schema, tables: schema.tables.map((item) => item.id === table.id ? { ...item, indexes: [...item.indexes, index] } : item) }));
    setIndexName(""); setIndexColumns([]); setIndexWhere(""); setIndexUnique(false);
  };
  const constraints = table.constraints.filter((constraint) => constraint.type === "check" || constraint.type === "unique");
  return <>
    <section className="inspector-section constraint-editor">
      <div className="inspector-section-heading"><strong>Constraints</strong></div>
      {constraints.map((constraint) => <fieldset className="relationship-config" key={constraint.id}>
        <legend>{constraint.type === "check" ? "CHECK" : `UNIQUE (${columnsLabel(constraint.columns)})`}</legend>
        <label>Constraint name<input aria-label={`${constraint.type} constraint name`} value={constraint.name || ""} onChange={(event) => patchConstraint(constraint.id, { name: event.target.value })} /></label>
        {constraint.type === "check" ? <label>Expression<textarea aria-label="CHECK expression" value={constraint.expression || ""} onChange={(event) => patchConstraint(constraint.id, { expression: event.target.value })} placeholder="e.g. price >= 0" /></label> : <>
          <div>{table.columns.map((column) => <label className="relationship-column-choice" key={column.id}><input type="checkbox" checked={constraint.columns.includes(column.id)} onChange={(event) => patchConstraint(constraint.id, { columns: event.target.checked ? [...constraint.columns, column.id] : constraint.columns.filter((id) => id !== column.id) })} /> {column.name}</label>)}</div>
          <label><input type="checkbox" checked={Boolean(constraint.nullsNotDistinct)} onChange={(event) => patchConstraint(constraint.id, { nullsNotDistinct: event.target.checked })} /> NULLS NOT DISTINCT</label>
          <p className="field-help">PostgreSQL 15 or newer only.</p>
        </>}
        {constraint.type !== "check" && <><label><input type="checkbox" checked={Boolean(constraint.deferrable)} onChange={(event) => patchConstraint(constraint.id, { deferrable: event.target.checked, initiallyDeferred: event.target.checked ? constraint.initiallyDeferred : false })} /> Deferrable</label>
        {constraint.deferrable && <label><input type="checkbox" checked={Boolean(constraint.initiallyDeferred)} onChange={(event) => patchConstraint(constraint.id, { initiallyDeferred: event.target.checked })} /> Initially deferred</label>}</>}
        <button className="secondary-button compact" type="button" onClick={() => removeConstraint(constraint.id)}>Delete constraint</button>
      </fieldset>)}
      <form className="relationship-create" onSubmit={addCheck}><strong>Add CHECK constraint</strong><label>Constraint name<input value={checkName} onChange={(event) => setCheckName(event.target.value)} /></label><label>Expression<textarea required value={checkExpression} onChange={(event) => setCheckExpression(event.target.value)} placeholder="e.g. quantity > 0" /></label><button className="secondary-button compact" type="submit">Add CHECK</button></form>
      <form className="relationship-create" onSubmit={addUnique}><strong>Add composite UNIQUE</strong>{table.columns.map((column) => <label className="relationship-column-choice" key={column.id}><input type="checkbox" checked={uniqueColumns.includes(column.id)} onChange={(event) => toggle(uniqueColumns, setUniqueColumns, column.id, event.target.checked)} /> {column.name}</label>)}<label>Constraint name<input value={uniqueName} onChange={(event) => setUniqueName(event.target.value)} /></label><label><input type="checkbox" checked={uniqueNullsNotDistinct} onChange={(event) => setUniqueNullsNotDistinct(event.target.checked)} /> NULLS NOT DISTINCT (PostgreSQL 15+)</label><button className="secondary-button compact" type="submit" disabled={!uniqueColumns.length}>Add UNIQUE</button></form>
    </section>
    <section className="inspector-section index-editor"><div className="inspector-section-heading"><strong>Indexes</strong></div>
      {table.indexes.map((index) => <fieldset className="relationship-config" key={index.id}><legend>{index.unique ? "Unique" : "Index"}: {columnsLabel(index.columns)}</legend><label>Index name<input value={index.name || ""} onChange={(event) => patchIndex(index.id, { name: event.target.value })} /></label><label>Method<select value={index.method || "btree"} onChange={(event) => patchIndex(index.id, { method: event.target.value })}>{["btree", "hash", "gist", "spgist", "gin", "brin"].map((method) => <option key={method}>{method}</option>)}</select></label><label><input type="checkbox" checked={Boolean(index.unique)} onChange={(event) => patchIndex(index.id, { unique: event.target.checked })} /> Unique index</label><label>Partial predicate<input value={index.options?.where || ""} onChange={(event) => patchIndex(index.id, { options: { ...index.options, where: event.target.value } })} /></label><p className="field-help">Methods and predicates map to PostgreSQL. INCLUDE columns and operator classes are not editable here.</p><button className="secondary-button compact" type="button" onClick={() => removeIndex(index.id)}>Delete index</button></fieldset>)}
      <form className="relationship-create" onSubmit={addIndex}><strong>Add index</strong>{table.columns.map((column) => <label className="relationship-column-choice" key={column.id}><input type="checkbox" checked={indexColumns.includes(column.id)} onChange={(event) => toggle(indexColumns, setIndexColumns, column.id, event.target.checked)} /> {column.name}</label>)}<label>Index name<input value={indexName} onChange={(event) => setIndexName(event.target.value)} /></label><label>Method<select value={indexMethod} onChange={(event) => setIndexMethod(event.target.value)}>{["btree", "hash", "gist", "spgist", "gin", "brin"].map((method) => <option key={method}>{method}</option>)}</select></label><label><input type="checkbox" checked={indexUnique} onChange={(event) => setIndexUnique(event.target.checked)} /> Unique index</label><label>Partial predicate<input value={indexWhere} onChange={(event) => setIndexWhere(event.target.value)} placeholder="e.g. deleted_at IS NULL" /></label><button className="secondary-button compact" type="submit" disabled={!indexColumns.length}>Add index</button></form>
    </section>
  </>;
}

function RelationshipEditor({ schema, table, onSchema }) {
  const keys = eligibleReferenceKeys(schema, table.id);
  const [keyId, setKeyId] = useState(keys[0]?.constraintId || "");
  const [rightKeyId, setRightKeyId] = useState(keys[1]?.constraintId || keys[0]?.constraintId || "");
  const [junctionName, setJunctionName] = useState("");
  const [localColumns, setLocalColumns] = useState([]);
  const [name, setName] = useState("");
  const [cardinality, setCardinality] = useState("one-to-many");
  const [onDelete, setOnDelete] = useState("NO ACTION");
  const [onUpdate, setOnUpdate] = useState("NO ACTION");
  const [deferrable, setDeferrable] = useState(false);
  const [initiallyDeferred, setInitiallyDeferred] = useState(false);
  const [error, setError] = useState("");
  const selectedKeyId = keys.some((item) => item.constraintId === keyId) ? keyId : (keys[0]?.constraintId || "");
  const key = keys.find((item) => item.constraintId === selectedKeyId);
  const rightKey = keys.find((item) => item.constraintId === rightKeyId);
  const foreignKeys = table.constraints.filter((constraint) => constraint.type === "foreignKey");

  const createRelationship = (event) => {
    event.preventDefault();
    if (!key || localColumns.length !== key.columns.length) {
      setError(`Choose exactly ${key?.columns.length || 0} referencing column${key?.columns.length === 1 ? "" : "s"}.`);
      return;
    }
    onSchema(setForeignKeyColumns(schema, {
      tableId: table.id,
      columns: table.columns.filter((column) => localColumns.includes(column.id)).map((column) => column.id),
      referencedTableId: key.tableId,
      referencedColumns: key.columns,
      name,
      cardinality,
      onDelete,
      onUpdate,
      deferrable,
      initiallyDeferred: deferrable && initiallyDeferred,
    }));
    setLocalColumns([]);
    setName("");
    setError("");
  };

  const replaceForeignKey = (constraint, patch) => onSchema(setForeignKeyColumns(schema, {
    tableId: table.id,
    columns: constraint.columns,
    referencedTableId: constraint.referencedTableId,
    referencedColumns: constraint.referencedColumns,
    name: patch.name ?? constraint.name,
    cardinality: patch.cardinality ?? constraint.cardinality ?? "one-to-many",
    onDelete: patch.onDelete ?? constraint.onDelete,
    onUpdate: patch.onUpdate ?? constraint.onUpdate,
    deferrable: patch.deferrable ?? constraint.deferrable,
    initiallyDeferred: patch.initiallyDeferred ?? constraint.initiallyDeferred,
  }));

  const removeForeignKey = (constraint) => onSchema(setForeignKeyColumns(schema, { tableId: table.id, columns: constraint.columns, referencedColumns: [] }));

  const addJunction = () => {
    if (!key || !rightKey) { setError("Choose two primary or unique keys."); return; }
    try {
      onSchema(createJunctionTable(schema, { leftTableId: key.tableId, leftColumns: key.columns, rightTableId: rightKey.tableId, rightColumns: rightKey.columns, name: junctionName }));
      setJunctionName("");
      setError("");
    } catch (junctionError) {
      setError(junctionError.message);
    }
  };

  return <section className="inspector-section relationship-editor">
    <div className="inspector-section-heading"><strong>Relationships</strong></div>
    {foreignKeys.map((constraint) => {
      const referenced = schema.tables.find((item) => item.id === constraint.referencedTableId);
      const label = (ids, owner) => ids.map((id) => owner?.columns.find((column) => column.id === id)?.name || id).join(", ");
      return <fieldset className="relationship-config" key={constraint.id}>
        <legend>{referenced?.name || "Missing table"}: {label(constraint.referencedColumns || [], referenced)} → {label(constraint.columns, table)}</legend>
        <label>Constraint name<input value={constraint.name || ""} onChange={(event) => replaceForeignKey(constraint, { name: event.target.value })} /></label>
        <label>ON DELETE<select value={constraint.onDelete || "NO ACTION"} onChange={(event) => replaceForeignKey(constraint, { onDelete: event.target.value })}>{REFERENTIAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
        <label>ON UPDATE<select value={constraint.onUpdate || "NO ACTION"} onChange={(event) => replaceForeignKey(constraint, { onUpdate: event.target.value })}>{REFERENTIAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
        <label>Cardinality<select value={constraint.cardinality || "one-to-many"} onChange={(event) => replaceForeignKey(constraint, { cardinality: event.target.value })}><option value="one-to-many">One to many</option><option value="one-to-one">One to one</option></select></label>
        <label><input type="checkbox" checked={Boolean(constraint.deferrable)} onChange={(event) => replaceForeignKey(constraint, { deferrable: event.target.checked, initiallyDeferred: event.target.checked ? constraint.initiallyDeferred : false })} /> Deferrable</label>
        {constraint.deferrable && <label><input type="checkbox" checked={Boolean(constraint.initiallyDeferred)} onChange={(event) => replaceForeignKey(constraint, { initiallyDeferred: event.target.checked })} /> Initially deferred</label>}
        <button className="secondary-button compact" type="button" onClick={() => removeForeignKey(constraint)}>Remove relationship</button>
      </fieldset>;
    })}
    {keys.length ? <form className="relationship-create" onSubmit={createRelationship}>
      <strong>Add foreign key</strong>
      <label>Referenced key<select value={keyId} onChange={(event) => { setKeyId(event.target.value); setLocalColumns([]); }}>{keys.map((item) => <option key={item.constraintId} value={item.constraintId}>{item.label}</option>)}</select></label>
      {table.columns.map((column) => <label className="relationship-column-choice" key={column.id}><input type="checkbox" checked={localColumns.includes(column.id)} disabled={!localColumns.includes(column.id) && localColumns.length >= (key?.columns.length || 0)} onChange={(event) => setLocalColumns((selected) => event.target.checked ? [...selected, column.id] : selected.filter((id) => id !== column.id))} /> {column.name} <small>{column.type}</small></label>)}
      <label>Constraint name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Cardinality<select value={cardinality} onChange={(event) => setCardinality(event.target.value)}><option value="one-to-many">One to many</option><option value="one-to-one">One to one</option></select></label>
      <label>ON DELETE<select value={onDelete} onChange={(event) => setOnDelete(event.target.value)}>{REFERENTIAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
      <label>ON UPDATE<select value={onUpdate} onChange={(event) => setOnUpdate(event.target.value)}>{REFERENTIAL_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
      <label><input type="checkbox" checked={deferrable} onChange={(event) => { setDeferrable(event.target.checked); if (!event.target.checked) setInitiallyDeferred(false); }} /> Deferrable</label>
      {deferrable && <label><input type="checkbox" checked={initiallyDeferred} onChange={(event) => setInitiallyDeferred(event.target.checked)} /> Initially deferred</label>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="secondary-button compact" type="submit" disabled={!key}>Add relationship</button>
      <div className="junction-creator"><strong>Create many-to-many junction</strong><label>First key<select value={selectedKeyId} onChange={(event) => setKeyId(event.target.value)}>{keys.map((item) => <option key={item.constraintId} value={item.constraintId}>{item.label}</option>)}</select></label><label>Second key<select value={rightKeyId} onChange={(event) => setRightKeyId(event.target.value)}>{keys.map((item) => <option key={item.constraintId} value={item.constraintId}>{item.label}</option>)}</select></label><label>Table name<input value={junctionName} placeholder="users_roles" onChange={(event) => setJunctionName(event.target.value)} /></label><button className="secondary-button compact" type="button" onClick={addJunction}>Create junction table</button></div>
    </form> : <p className="panel-empty">Add a primary or unique key on another table before creating a foreign key.</p>}
  </section>;
}

function TableNode({ table, zoom, selected, onSelect, onMovePreview, onMove, onColumnSelect, onConnectionStart, onConnectionEnd, relationshipMode, connectionStart }) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const [position, setPosition] = useState({ x: table.x, y: table.y });

  useEffect(() => {
    if (!drag.current) setPosition({ x: table.x, y: table.y });
  }, [table.x, table.y]);

  const start = (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, x: table.x, y: table.y };
    setPosition({ x: table.x, y: table.y });
    setDragging(true);
    onSelect();
  };
  const move = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const scale = zoom / 100;
    const nextPosition = {
      x: Math.max(0, drag.current.x + (event.clientX - drag.current.originX) / scale),
      y: Math.max(0, drag.current.y + (event.clientY - drag.current.originY) / scale),
    };
    setPosition(nextPosition);
    onMovePreview(nextPosition.x, nextPosition.y);
  };
  const end = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    onMove(position.x, position.y);
  };

  return <article className={`table-node ${selected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""}`} style={{ left: position.x, top: position.y, zIndex: dragging ? 10 : selected ? 3 : 2 }} onClick={onSelect}><header onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><Database size={14} /><strong>{table.name}</strong><button type="button" aria-label={`Select ${table.name}`} onClick={onSelect}><ChevronDown size={14} /></button></header>{table.columns.map((column) => <div className={`table-column-row ${connectionStart?.columnId === column.id ? "is-connection-source" : ""}`} key={column.id}><button className="table-column" type="button" onClick={(event) => { event.stopPropagation(); onColumnSelect(column.id); }}><span className="table-column-label">{column.primaryKey && <b title="Primary key">PK</b>}{column.foreignKey && <b title="Foreign key">FK</b>}{column.unique && !column.primaryKey && <b title="Unique">UQ</b>}{!column.nullable && <b title="Not null">NN</b>}{column.name}</span><small>{column.type}</small></button><button className={`connection-handle ${relationshipMode ? "is-visible" : ""}`} type="button" aria-label={`Connect ${table.name}.${column.name}`} title="Connect this column" onMouseDown={(event) => { event.stopPropagation(); onConnectionStart(column.id); }} onMouseUp={(event) => { event.stopPropagation(); if (connectionStart) onConnectionEnd(column.id); }} /></div>)}</article>;
}

function WorkspaceArea({ area, project, schema, generatedBackend, copyApiKey, copyMessage }) {
  const sql = schemaToSql(schema);
  const [versions, setVersions] = useState([]);
  const [historyState, setHistoryState] = useState("idle");
  useEffect(() => {
    if (area !== "history") return undefined;
    if (!isAccountMode()) return undefined;
    let active = true;
    apiRequest(`/api/v1/projects/${project.id}/versions`)
      .then((data) => { if (active) { setVersions(data.versions); setHistoryState("ready"); } })
      .catch(() => { if (active) setHistoryState("error"); });
    return () => { active = false; };
  }, [area, project.id]);
  const visibleHistoryState = area === "history" && !isAccountMode() ? "local-only" : historyState === "idle" ? "loading" : historyState;
  if (area === "code") return <section className="area-page">
    <PageHeader eyebrow="Generated backend" title="Code" description="Download a runnable Express and PostgreSQL backend generated from this project's schema." />
    {generatedBackend ? <div className="generated-backend">
      <div className="generated-backend-heading"><div><strong>{generatedBackend.fileName}</strong><span>Generated {new Date(generatedBackend.generatedAt).toLocaleString()}</span></div><Badge tone="success">Ready</Badge></div>
      <section className="generated-api-key"><div><h2>Project API key</h2><p>This key is included in the ZIP's local <code>.env</code>. Keep it private; it is shown only in this open workspace.</p></div><button className="secondary-button compact" type="button" onClick={copyApiKey}>Copy key</button><code className="generated-api-key-value">{generatedBackend.apiKey}</code>{copyMessage && <span className="field-success" role="status">{copyMessage}</span>}</section>
      <section><h2>Included files</h2><ul className="generated-file-list">{generatedBackend.files.map((file) => <li key={file}><code>{file}</code></li>)}</ul></section>
      <p className="generated-backend-next">Unzip the download, review <code>.env</code>, then run <code>npm install</code>, <code>npm test</code>, and <code>npm start</code>. See the included README for endpoint details.</p>
    </div> : <EmptyState title="No backend generated yet" description={`${schema.tables.length} schema table${schema.tables.length === 1 ? "" : "s"} will be turned into a downloadable Express + PostgreSQL backend. Each table needs a primary key for complete CRUD endpoints.`} />}
    <details className="generated-sql-details"><summary>Preview generated PostgreSQL schema</summary><pre className="code-preview"><code>{sql || "-- Add a table to produce SQL."}</code></pre></details>
  </section>;
  if (area === "api") {
    const endpoints = createProjectApiEndpoints(schema);
    return <section className="area-page">
      <PageHeader eyebrow="Generated API" title="API explorer" description="These project-specific CRUD routes are included in the downloadable backend. Deploy that backend to make the routes live." />
      <div className="generated-api-base"><strong>Local development base URL</strong><code>http://localhost:4000</code><span>Use your deployed host instead after deployment. Data endpoints require the generated key in the <code>x-api-key</code> header.</span></div>
      {generatedBackend && <div className="generated-api-key generated-api-key-compact"><div><h2>Project API key</h2><code className="generated-api-key-value">{generatedBackend.apiKey}</code>{copyMessage && <span className="field-success" role="status">{copyMessage}</span>}</div><button className="secondary-button compact" type="button" onClick={copyApiKey}>Copy key</button></div>}
      {schema.tables.some((table) => !table.constraints.some((constraint) => constraint.type === "primaryKey")) && <p className="field-error" role="status">Add a primary key to each table to generate its complete CRUD endpoints.</p>}
      <div className="generated-endpoints">
        <div className="generated-endpoint-row"><span className="endpoint-method method-get">GET</span><code>/health</code><span>Check server and database availability (no key required)</span></div>
        {endpoints.map((endpoint) => <div className="generated-endpoint-row" key={`${endpoint.method}:${endpoint.path}`}><span className={`endpoint-method method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><code>{endpoint.path}</code><span>{endpoint.description}</span></div>)}
      </div>
      <pre className="generated-api-example"><code>{`curl -H "x-api-key: ${generatedBackend?.apiKey || "<PROJECT_API_KEY>"}" http://localhost:4000${endpoints[0]?.path || "/api/<table>"}`}</code></pre>
      <p className="generated-backend-next">Record keys in item routes are URL-safe values returned as <code>key</code> by list and create responses. The API is hosted by your deployed generated backend, not by Schevo.</p>
    </section>;
  }
  if (area === "history") return <section className="area-page"><PageHeader eyebrow="Schema evolution" title="History" description="Schema snapshots are recorded when a schema save is confirmed by the platform." />{visibleHistoryState === "loading" && <p role="status">Loading schema versions…</p>}{visibleHistoryState === "error" && <p className="field-error" role="alert">Could not load schema history.</p>}{visibleHistoryState === "local-only" && <p className="panel-empty">This preview project is stored in this browser. Remote schema snapshots are available after signing in.</p>}{visibleHistoryState === "ready" && <div className="timeline">{versions.map((version, index) => <div className={`timeline-item ${index === 0 ? "is-current" : ""}`} key={version.version}><span className="timeline-dot" /><div><strong>{index === 0 ? "Current schema" : `Schema version ${version.version}`}</strong><p>{version.schema.tables.length} tables · {version.schema.relationships.length} relationships · {new Date(version.createdAt).toLocaleString()}</p><small>By {version.createdBy}</small></div></div>)}</div>}</section>;
  return <ProjectSettings project={project} />;
}

function ProjectSettings({ project }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [message, setMessage] = useState("");
  const save = (event) => {
    event.preventDefault();
    schemaRepository.update(project.id, { name: name.trim() || project.name, description });
    setMessage(isAccountMode() ? "Changes were saved locally and queued for account persistence. Check the save status above." : "Changes are stored in this browser only.");
  };
  return (
    <section className="area-page">
      <PageHeader eyebrow="Project settings" title="Settings" description="These fields update the project stored in your workspace." />
      <form className="project-settings-content" onSubmit={save}>
        <label className="field-label">Project name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field-label">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="3" /></label>
        <p>Database target: PostgreSQL. SQL preview uses the schema currently open in Design.</p>
        {message && <p className="field-success" role="status">{message}</p>}
        <button className="primary-button" type="submit">Save project details</button>
      </form>
    </section>
  );
}

export default ProjectWorkspace;
