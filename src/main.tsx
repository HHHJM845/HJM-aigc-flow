import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Suppress benign ResizeObserver errors
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('ResizeObserver loop')) {
    return;
  }
  originalError(...args);
};

window.addEventListener('error', (e) => {
  if (e.message === 'ResizeObserver loop limit exceeded' || e.message.includes('ResizeObserver loop completed with undelivered notifications.')) {
    e.stopImmediatePropagation();
  }
});

const root = createRoot(document.getElementById('root')!);

if (window.location.pathname.startsWith('/r/')) {
  import('./pages/ReviewPage').then(({ default: ReviewPage }) => {
    root.render(
      <StrictMode>
        <ReviewPage />
      </StrictMode>
    );
  });
} else {
  import('./App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
