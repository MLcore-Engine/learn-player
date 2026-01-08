import React, { useEffect, useCallback, useState } from 'react';
import 'video.js/dist/video-js.css';
import { AppProvider } from './contexts/AppContext';
import VideoContainer from './containers/VideoContainer';
import SidePanel from './components/SidePanel';
import ApiKeySettings from './components/ApiKeySettings';
import { useApiKey } from './hooks/useApiKey';
import { useElectronIPC } from './hooks/useElectronIPC';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * 应用主容器组件
 * 使用钩子处理全局功能，不包含任何业务逻辑
 */
const AppContent = () => {
  const { 
    apiKey, 
    modelUrl,
    showInput: showApiKeyInput, 
    status: storedApiKeyStatus, 
    setApiKey, 
    setModelUrl,
    setShowInput: setShowApiKeyInput, 
    saveApiKey 
  } = useApiKey();
  
  // 使用IPC钩子处理与主进程通信
  useElectronIPC();

  // 外挂字幕状态
  const [hasExternalSubtitles, setHasExternalSubtitles] = useState(false);

  // 处理播放器就绪回调
  const handlePlayerReady = useCallback((player, info) => {
    if (info && typeof info.hasExternalSubtitles === 'boolean') {
      setHasExternalSubtitles(info.hasExternalSubtitles);
    }
  }, []);
  
  // API密钥设置属性
  const apiKeyProps = {
    isVisible: showApiKeyInput,
    apiKey,
    modelUrl,
    storedApiKeyStatus,
    onApiKeyChange: setApiKey,
    onModelUrlChange: setModelUrl,
    onSave: saveApiKey,
    onCancel: () => setShowApiKeyInput(false)
  };

  return (
    <>
      {/* API密钥设置对话框 */}
      <ApiKeySettings {...apiKeyProps} />
      
      {/* 主应用布局 */}
      <div style={{ 
        display: 'flex', 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0,
        overflow: 'hidden'
      }}>
        {/* 视频区域 */}
        <VideoContainer onPlayerReady={handlePlayerReady} />
        
        {/* 侧边面板 */}
        <SidePanel hasExternalSubtitles={hasExternalSubtitles} />
      </div>
    </>
  );
};

/**
 * 应用根组件
 * 提供所有Provider上下文
 */
function App() {
  // 设置页面标题
  useEffect(() => {
    document.title = "lep";
  }, []);

  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;