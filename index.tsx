
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ResizeObserver loop completed with undelivered notifications.
// This is a benign error that happens often with ReactFlow and other libraries observing element size.
// We suppress it to prevent it from cluttering the console or triggering error boundaries.
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications.';
const resizeObserverLoopLimitErr = 'ResizeObserver loop limit exceeded';

// Patch console.error to suppress specific ResizeObserver errors
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' && 
    (args[0].includes(resizeObserverLoopErr) || args[0].includes(resizeObserverLoopLimitErr))
  ) {
    return;
  }
  originalError.apply(console, args);
};

window.addEventListener('error', (e) => {
  if (typeof e.message === 'string' && (
      e.message.includes(resizeObserverLoopErr) || 
      e.message.includes(resizeObserverLoopLimitErr)
  )) {
    e.stopImmediatePropagation();
    e.preventDefault();
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
