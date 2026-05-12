import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { startKeepAlive } from './lib/keepAlive';

// Keep the Render free-tier backend warm (pings /ping every 10 min while tab is visible)
if (process.env.NODE_ENV === 'production') {
  startKeepAlive();
}

if (process.env.NODE_ENV !== 'production') {
  console.log('🚀 API URL:', process.env.REACT_APP_API_URL || 'http://localhost:8000');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
