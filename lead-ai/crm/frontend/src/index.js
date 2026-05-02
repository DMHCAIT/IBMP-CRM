import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

console.log('🚀 API URL:', process.env.REACT_APP_API_URL || 'http://localhost:8000');
console.log('🌍 Environment:', process.env.NODE_ENV);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
