import type { LucideIcon } from 'lucide-react';

// Unified empty state — replaces the ad-hoc "No data yet" blocks.
export function EmptyState({
  icon: Icon, title, sub, action,
}: {
  icon: LucideIcon; title: string; sub?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty-state">
      <div className="es-icon"><Icon className="w-6 h-6" /></div>
      <div className="es-title">{title}</div>
      {sub && <div className="es-sub">{sub}</div>}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}
