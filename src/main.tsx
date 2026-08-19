import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './lib/i18n';
import { isAndroidWebViewRuntime } from './lib/runtime';

if (isAndroidWebViewRuntime()) {
  document.documentElement.classList.add('android-webview');
  document.body.classList.add('android-webview');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
