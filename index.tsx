import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Fix: Changed the type definition for `window.OneSignal` from `any[]` to `any` to accommodate the SDK object after it loads.
declare global {
  interface Window {
    OneSignal: any;
  }
}

// Service Worker registration is now handled by the OneSignal SDK via OneSignalInitializer.tsx
// to prevent conflicts between the PWA setup and OneSignal's requirements.

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