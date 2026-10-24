import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Human-readable name, used in loading and error messages. */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Wraps a microfrontend so a remote that fails to load (for example, because its dev
 * server is not running) shows a message instead of crashing the whole shell.
 */
export class RemoteBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Failed to load ${this.props.name}`, error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Could not load the {this.props.name}.</p>
          <p className="text-sm">Make sure its dev server is running, then refresh the page.</p>
        </div>
      );
    }

    return (
      <Suspense fallback={<p className="text-slate-500">Loading the {this.props.name}…</p>}>
        {this.props.children}
      </Suspense>
    );
  }
}
