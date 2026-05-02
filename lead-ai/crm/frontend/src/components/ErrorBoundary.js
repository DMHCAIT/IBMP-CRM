import React from 'react';
import { Result, Button } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          padding: '20px'
        }}>
          <Result
            status="error"
            title="Application Error"
            subTitle={`${this.state.error?.message || 'Something went wrong'}`}
            extra={[
              <Button type="primary" key="console" onClick={() => window.location.reload()}>
                Reload Page
              </Button>,
              <Button key="details" onClick={() => console.log(this.state.errorInfo)}>
                View Details in Console
              </Button>,
            ]}
          >
            <div style={{ 
              textAlign: 'left', 
              backgroundColor: '#f5f5f5', 
              padding: '16px', 
              borderRadius: '8px',
              maxWidth: '600px',
              overflow: 'auto'
            }}>
              <pre style={{ fontSize: '12px', margin: 0 }}>
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
