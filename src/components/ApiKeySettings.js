import React from 'react';

const ApiKeySettings = ({ 
  isVisible, 
  apiKey,
  modelUrl,
  storedApiKeyStatus,
  configSource,
  onApiKeyChange,
  onModelUrlChange,
  onSave, 
  onCancel 
}) => {
  if (!isVisible) return null;

  const sourceLabels = {
    store: '用户设置',
    env: '环境变量',
    default: '默认',
    local: '本地'
  };
  const apiKeySourceLabel = sourceLabels[configSource?.apiKey] || '未知';
  const modelUrlSourceLabel = sourceLabels[configSource?.modelUrl] || '未知';
  
  return (
    <div style={{
      position: 'fixed', 
      top: '20px', 
      left: '50%', 
      transform: 'translateX(-50%)',
      background: '#333', 
      color: '#fff', 
      padding: '20px', 
      borderRadius: '5px',
      zIndex: 2000, 
      boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
    }}>
      <h5>设置API Key</h5>
      <p>当前状态: {storedApiKeyStatus}</p>
      <p style={{ fontSize: '0.9em', color: '#bbb' }}>
        当前来源: API Key 为 {apiKeySourceLabel}，模型 URL 为 {modelUrlSourceLabel}
      </p>
      <div style={{ marginBottom: '15px' }}>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="输入新的 API Key (留空则清除)"
          style={{ width: '300px', marginRight: '10px', padding: '5px' }}
        />
      </div>
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={modelUrl}
          onChange={(e) => onModelUrlChange(e.target.value)}
          placeholder="输入大模型 API URL"
          style={{ width: '300px', marginRight: '10px', padding: '5px' }}
        />
      </div>
      <button onClick={onSave}>保存</button>
      <button onClick={onCancel} style={{ marginLeft: '10px' }}>取消</button>
      <p style={{ fontSize: '0.8em', marginTop: '10px', color: '#aaa' }}>
        API Key 将被加密存储在本地。留空并保存可以清除已存储的 Key。
      </p>
    </div>
  );
};

export default ApiKeySettings; 
