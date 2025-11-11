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

  handleReload = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log("ErrorBoundary: Attempting page reload...");
    
    // Try multiple reload methods to ensure it works
    try {
      // Method 1: Standard reload
      window.location.reload(true);
    } catch (error) {
      console.warn("Standard reload failed, trying alternative method:", error);
      // Method 2: Force navigation to current URL
      try {
        window.location.assign(window.location.href);
      } catch (error2) {
        console.warn("Alternative reload failed, trying location.replace:", error2);
        // Method 3: Replace current location
        try {
          window.location.replace(window.location.href);
        } catch (error3) {
          console.error("All reload methods failed:", error3);
          // Last resort: alert user
          alert("Please manually refresh the page to continue.");
        }
      }
    }
  };

  renderActionButtons() {
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={this.handleReload}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            border: '1px solid #0984e3',
            borderRadius: '4px',
            backgroundColor: '#74b9ff',
            color: 'white',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  renderDeveloperInfo() {
    if (process.env.NODE_ENV !== "development" || !this.state.error) {
      return null;
    }
    
    return (
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
    );
  }

  render() {
    if (this.state.hasError) {
      const { section = "Component" } = this.props;

      return (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Modal */}
            <div
              style={{
                padding: '20px',
                border: '1px solid #ff6b6b',
                borderRadius: '8px',
                backgroundColor: '#fff',
                maxWidth: '500px',
                minWidth: '300px',
                fontSize: '14px',
                color: '#333',
                position: 'relative',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                maxHeight: '80vh',
                overflow: 'auto'
              }}
            >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#ff6b6b', marginRight: '8px', fontSize: '16px' }}>⚠️</span>
            <strong style={{ color: '#d63031' }}>{section} Error</strong>
          </div>
          
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
            Something went wrong with this component. Your data is safe.
            <br />
            Please reload the page to continue.
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

          {this.renderActionButtons()}

          {this.renderDeveloperInfo()}
            </div>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}

export default ContentErrorBoundary;