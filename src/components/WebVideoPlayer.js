import React, { useEffect, useRef } from 'react';

const WebVideoPlayer = ({ url, onLoad }) => {
  const webviewRef = useRef(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return undefined;

    const handleDidFinishLoad = () => {
      if (onLoad) {
        onLoad();
      }
    };

    webview.addEventListener('did-finish-load', handleDidFinishLoad);
    return () => {
      webview.removeEventListener('did-finish-load', handleDidFinishLoad);
    };
  }, [onLoad]);

  if (!window?.electronAPI) {
    return (
      <div style={{ color: '#fff', padding: '16px' }}>
        当前环境不支持网页播放器，请在桌面客户端中打开。
      </div>
    );
  }

  return (
    <webview
      ref={webviewRef}
      src={url}
      allowpopups="true"
      allowFullScreen
      style={{ width: '100%', height: '100%', border: 'none' }}
      webpreferences="contextIsolation=yes, nodeIntegration=no"
    />
  );
};

export default WebVideoPlayer;
