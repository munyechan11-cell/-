import React from "react";

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-navy-100)] flex items-center justify-center mb-6">
            <span className="text-3xl font-extrabold text-[var(--color-navy-700)]">!</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--color-navy-900)] mb-2 tracking-tight">
            예상치 못한 오류가 발생했어요
          </h2>
          <p className="text-[14px] text-[var(--color-ink-500)] mb-8 max-w-xs">
            잠시 후 다시 시도하거나, 페이지를 새로고침해 주세요.
          </p>
          <button
            className="px-6 h-12 rounded-[14px] bg-[var(--color-navy-700)] text-white font-bold"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
          {this.state.message && (
            <p className="mt-6 text-[11px] font-mono text-[var(--color-ink-300)] break-all max-w-sm">
              {this.state.message}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
