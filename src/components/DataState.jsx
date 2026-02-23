import { AlertCircle, LoaderCircle } from 'lucide-react'
import './DataState.css'

export default function DataState({
  title,
  description,
  variant = 'empty',
  actionLabel,
  onAction,
}) {
  const isLoading = variant === 'loading'
  const isError = variant === 'error'

  return (
    <div className={`data-state data-state-${variant}`} role={isError ? 'alert' : 'status'}>
      <div className="data-state-icon" aria-hidden="true">
        {isLoading ? (
          <LoaderCircle className="data-state-spinner" size={30} />
        ) : (
          <AlertCircle size={30} />
        )}
      </div>
      <h3 className="data-state-title">{title}</h3>
      {description && <p className="data-state-description">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="data-state-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
