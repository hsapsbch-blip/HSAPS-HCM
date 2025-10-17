import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Fix: Changed the type definition for `window.OneSignal` from `any[]` to `any` to accommodate the SDK object after it loads.
declare global {
  interface Window {
    OneSignal: any;
    // Fix: Add `OneSignalDeferred` to the global Window interface to support the deferred push SDK initialization pattern.
    OneSignalDeferred: any[];
  }
}

// Re-add the standard PWA service worker registration.
// This ensures /service-worker.js is correctly registered, fixing the 404 error
// and allowing both PWA functionality and the OneSignal SDK to work.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}


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