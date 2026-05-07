import { ipcClient } from './ipcClient';

export interface ResolveAiConfigOptions {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  requireApiKey?: boolean;
}

export interface ConfigSource {
  apiKey: string;
  modelUrl: string;
}

export interface ResolvedAiConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  source: ConfigSource;
}

export const resolveAiConfig = async ({
  apiKey = '',
  apiUrl = '',
  model = '',
  requireApiKey = true
}: ResolveAiConfigOptions = {}): Promise<ResolvedAiConfig> => {
  let resolvedApiKey = apiKey;
  let resolvedApiUrl = apiUrl;
  let source: ConfigSource = { apiKey: 'local', modelUrl: 'local' };

  if (ipcClient.isAvailable()) {
    const response = (await ipcClient.getApiKey()) as (
      | { apiKey?: string; modelUrl?: string; source?: ConfigSource; success?: boolean; error?: string }
      | null
    );
    if (response && response.success === false) {
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
