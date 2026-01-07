import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ResizeObserver loop completed with undelivered notifications.
// This is a benign error that happens often with ReactFlow and other libraries observing element size.
// We suppress it to prevent it from cluttering the console or triggering error boundaries.
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications.';
window.addEventListener('error', (e) => {
  if (e.message === resizeObserverLoopErr) {
    e.stopImmediatePropagation();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);