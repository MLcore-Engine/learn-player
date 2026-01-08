import { ipcClient } from './ipcClient';

export const resolveAiConfig = async ({
  apiKey = '',
  apiUrl = '',
  model = '',
  requireApiKey = true
} = {}) => {
  let resolvedApiKey = apiKey;
  let resolvedApiUrl = apiUrl;
  let source = { apiKey: 'local', modelUrl: 'local' };

  if (ipcClient.isAvailable()) {
    const response = await ipcClient.getApiKey();
    if (response?.success === false) {
      throw new Error(response.error || '获取API Key失败，请检查设置');
    }
    if (response) {
      resolvedApiKey = response.apiKey || resolvedApiKey;
      resolvedApiUrl = response.modelUrl || resolvedApiUrl;
      source = response.source || source;
    }
  }

  if (requireApiKey && !resolvedApiKey) {
    throw new Error('未设置API Key');
  }

  return {
    apiKey: resolvedApiKey,
    apiUrl: resolvedApiUrl,
    model,
    source
  };
};

export default resolveAiConfig;
