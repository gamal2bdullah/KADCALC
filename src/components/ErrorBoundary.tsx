import { Component, type ReactNode } from 'react';

// Global error boundary — prevents a render crash from wiping the whole app.
// Shows a recoverable state instead of a blank screen.
interface State { error: Error | null; }
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // In production this would go to an error tracker.
    console.error('KAD Calculator fatal render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-surface-base p-6">
          <div className="panel max-w-md w-full p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="section-title mb-2">Something went wrong</h2>
            <p className="text-sm text-text-tertiary mb-4">
              The calculator hit an unexpected error. Your data is safe in local storage.
            </p>
            <pre className="text-[11px] text-left bg-surface-code border border-border-medium rounded p-3 text-red-300 overflow-auto max-h-32 mb-4">
              {this.state.error.message}
            </pre>
            <button
              className="btn btn-primary w-full justify-center"
              onClick={() => this.setState({ error: null })}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
