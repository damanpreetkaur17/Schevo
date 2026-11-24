import { AlertCircle, LoaderCircle } from "lucide-react";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="dashboard-page-header">
      <div>
        {eyebrow && <span className="dashboard-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="dashboard-page-actions">{actions}</div>}
    </header>
  );
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`dashboard-badge tone-${tone}`}>{children}</span>;
}

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="dashboard-state" role="status">
      <LoaderCircle className="dashboard-loading-icon" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ title = "Could not load projects", onRetry }) {
  return (
    <div className="dashboard-state is-error" role="alert">
      <AlertCircle size={22} />
      <strong>{title}</strong>
      {onRetry && (
        <button className="secondary-button" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, actions }) {
  return (
    <div className="dashboard-empty-state">
      <div className="dashboard-empty-mark">S</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actions && <div className="dashboard-empty-actions">{actions}</div>}
    </div>
  );
}
