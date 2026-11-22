import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendlyMessage = `Cloud sync permission notice (${parsed.operationType || 'operation'}): ${parsed.error}`;
        }
      } catch {
        // Use raw message if not JSON
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h1 className="font-display text-base font-bold">
                Workspace Recovery Notice
              </h1>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.href = '/';
              }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Return to Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
