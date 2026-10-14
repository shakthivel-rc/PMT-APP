import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './app/store';
import App from './App';
import { reportRenderError } from './lib/reportRenderError';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// React 19's three root error handlers. Without them a render crash showed "Couldn't load
// this page" and left no record anywhere — the app has exactly one error boundary and no
// error-tracking service. See src/lib/reportRenderError.ts.
const root = createRoot(rootElement, {
  onCaughtError: (error, errorInfo) => reportRenderError('caught', error, errorInfo),
  onUncaughtError: (error, errorInfo) => reportRenderError('uncaught', error, errorInfo),
  onRecoverableError: (error, errorInfo) => reportRenderError('recoverable', error, errorInfo),
});
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
