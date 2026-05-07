import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';

document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('找不到root元素，无法挂载React应用');
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    // <React.StrictMode>
    <App />
    // </React.StrictMode>
  );

  console.log('React应用已挂载到DOM', {
    rootElement,
    clientHeight: rootElement.clientHeight,
    clientWidth: rootElement.clientWidth
  });
});
