import React, { useEffect, useCallback, useState } from 'react';
import 'video.js/dist/video-js.css';
import { AppProviders, VideoProviders, AIProviders } from './providers';
import VideoContainer from './containers/VideoContainer';
import SidePanel from './components/SidePanel';
import ApiKeySettings from './components/ApiKeySettings';
import ErrorBoundary from './components/ErrorBoundary';
import { useApiKey } from './hooks/useApiKey';
import { useElectronIPC } from './hooks/useElectronIPC';
import type { PlayerReadyInfo } from './components/VideoPlayer';
import type Player from 'video.js/dist/types/player';

/**
 * 应用主容器组件 —— 使用钩子处理全局功能，不包含任何业务逻辑
 */
const AppContent: React.FC = () => {
  const {
    apiKey,
    modelUrl,
    showInput: showApiKeyInput,
    status: storedApiKeyStatus,
    configSource,
    setApiKey,
    setModelUrl,
    setShowInput: setShowApiKeyInput,
    saveApiKey
  } = useApiKey();

  useElectronIPC();

  const [hasExternalSubtitles, setHasExternalSubtitles] = useState<boolean>(false);

  const handlePlayerReady = useCallback((_player: Player, info?: PlayerReadyInfo): void => {
    if (info && typeof info.hasExternalSubtitles === 'boolean') {
      setHasExternalSubtitles(info.hasExternalSubtitles);
    }
  }, []);

  const apiKeyProps = {
    isVisible: showApiKeyInput,
    apiKey,
    modelUrl,
    storedApiKeyStatus,
    configSource,
    onApiKeyChange: setApiKey,
    onModelUrlChange: setModelUrl,
    onSave: saveApiKey,
    onCancel: () => setShowApiKeyInput(false)
  };

  return (
    <>
      {/* API 密钥设置对话框 */}
      <ApiKeySettings {...apiKeyProps} />

      {/* 主应用布局 */}
      <div
        style={{
          display: 'flex',
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <VideoContainer onPlayerReady={handlePlayerReady} />

        <AIProviders>
          <SidePanel hasExternalSubtitles={hasExternalSubtitles} />
        </AIProviders>
      </div>
    </>
  );
};

/**
 * 应用根组件 —— 提供所有 Provider 上下文
 */
const App: React.FC = () => {
  useEffect(() => {
    document.title = 'lep';
  }, []);

  return (
    <ErrorBoundary>
      <AppProviders>
        <VideoProviders>
          <AppContent />
        </VideoProviders>
      </AppProviders>
    </ErrorBoundary>
  );
};

export default App;
