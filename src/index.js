import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';

// 确保DOM加载完成后再渲染React
document.addEventListener('DOMContentLoaded', () => {
  // 检查根元素是否存在
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('找不到root元素，无法挂载React应用');
    return;
  }
  
  // 创建React根并渲染应用
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    // <React.StrictMode>
      <App />
    // </React.StrictMode>
  );
  
  // 添加调试信息
  console.log('React应用已挂载到DOM', {
    rootElement,
    clientHeight: rootElement.clientHeight,
    clientWidth: rootElement.clientWidth
  });
});
