import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[#1e1e1e] text-gray-300 p-6 text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <h3 className="text-sm font-semibold text-white mb-1">Editor Notice</h3>
          <p className="text-xs text-gray-400 mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-all shadow-sm"
          >
            Reload Editor
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
