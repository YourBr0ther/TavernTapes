import { Component, ErrorInfo, ReactNode } from 'react';
import { createComponentLogger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  private logger = createComponentLogger('ErrorBoundary');

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
    this.logger.debug('ErrorBoundary initialized');
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.logger.error('React error boundary caught an error', error, {
      method: 'componentDidCatch',
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ErrorBoundary'
    });
    
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
        this.logger.debug('Custom error handler called successfully');
      } catch (handlerError) {
        this.logger.error('Error in custom error handler', handlerError, { method: 'componentDidCatch' });
      }
    }
  }

  private handleRetry = () => {
    this.logger.info('User initiated error boundary retry', { method: 'handleRetry' });
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-[#1C1C1C] rounded-lg border border-[#F44336]/20">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-[#F44336]">Something went wrong</h2>
            <p className="text-gray-300">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            
            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-[#2C2C2C] p-4 rounded mt-4">
                <summary className="cursor-pointer text-sm text-[#FFD700] mb-2">
                  Error Details (Development)
                </summary>
                <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 text-[#FFD700] rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors duration-200"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;