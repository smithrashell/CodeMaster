/**
 * Lightweight ErrorBoundary for Content Scripts
 * Custom error boundary without Mantine dependencies
 */

import React from "react";

class ContentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const errorId = `error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    console.error("ContentErrorBoundary caught an error:", {
      errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      location: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { section = "Component" } = this.props;

      return (
        <div
          style={{
            padding: '12px',
            margin: '8px 0',
            border: '1px solid #ff6b6b',
            borderRadius: '6px',
            backgroundColor: '#fff5f5',
            maxWidth: '100%',
            fontSize: '14px',
            color: '#333',
            position: 'relative',
            display: 'block',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#ff6b6b', marginRight: '8px', fontSize: '16px' }}>⚠️</span>
            <strong style={{ color: '#d63031' }}>{section} Error</strong>
          </div>
          
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
            Something went wrong with this component. Your data is safe.
          </div>

          {this.state.error && (
            <div style={{ 
              fontSize: '12px', 
              color: '#888',
              marginBottom: '8px',
              wordBreak: 'break-word'
            }}>
              <strong>Error:</strong> {this.state.error.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                border: '1px solid #0984e3',
                borderRadius: '4px',
                backgroundColor: '#74b9ff',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              ↻ Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                border: '1px solid #636e72',
                borderRadius: '4px',
                backgroundColor: '#ddd',
                color: '#333',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <details style={{ marginTop: '12px', fontSize: '11px' }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>
                Developer Info
              </summary>
              <pre style={{ 
                fontSize: '10px', 
                background: '#f8f9fa', 
                padding: '8px', 
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '100px',
                marginTop: '4px'
              }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ContentErrorBoundary;