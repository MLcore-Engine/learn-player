import { useEffect, useCallback, useRef } from 'react';
import { useApiKey as useApiKeyContext } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';
import type { ApiKeyResult } from '../types/ipc';
import type { ApiKeyState } from '../types/state';

const CACHE_DURATION = 30000; // 30 seconds

interface ApiKeyCache {
  lastFetch: number;
  cachedResult: {
    status: string;
    apiKey?: string;
    modelUrl?: string;
    configSource: ApiKeyState['configSource'];
  } | null;
  isFetching: boolean;
}

export interface UseApiKeyResult {
  apiKey: string;
  modelUrl: string;
  showInput: boolean;
  status: string;
  configSource: ApiKeyState['configSource'];
  setApiKey: (apiKey: string) => void;
  setModelUrl: (modelUrl: string) => void;
  setShowInput: (show: boolean) => void;
  saveApiKey: () => Promise<boolean>;
  fetchApiKey: (force?: boolean) => Promise<void>;
}

/**
 * API Key 管理钩子
 */
export const useApiKey = (): UseApiKeyResult => {
  const {
    apiKey,
    modelUrl,
    showInput,
    status,
    configSource,
    setApiKey,
    setModelUrl,
    setShowInput,
    setStatus,
    setConfigSource
  } = useApiKeyContext();

  const cacheRef = useRef<ApiKeyCache>({
    lastFetch: 0,
    cachedResult: null,
    isFetching: false
  });

  const fetchApiKey = useCallback(
    async (force = false): Promise<void> => {
      if (!ipcClient.isAvailable()) return;

      const now = Date.now();
      const cache = cacheRef.current;

      if (cache.isFetching && !force) {
        return;
      }

      if (!force && cache.cachedResult && now - cache.lastFetch < CACHE_DURATION) {
        setStatus(cache.cachedResult.status);
        if (cache.cachedResult.modelUrl !== undefined) {
          setModelUrl(cache.cachedResult.modelUrl);
        }
        if (cache.cachedResult.configSource) {
          setConfigSource(cache.cachedResult.configSource);
        }
        return;
      }

      try {
        cache.isFetching = true;
        setStatus('正在获取...');

        const result = (await ipcClient.getApiKey()) as ApiKeyResult | null;
        console.log('getApiKey result', result);

        if (result && result.success) {
          const newStatus = result.apiKey ? '已设置' : '未设置';
          setStatus(newStatus);
          setModelUrl(result.modelUrl || '');
          const source = result.source || { apiKey: 'default', modelUrl: 'default' };
          setConfigSource(source);

          cache.cachedResult = {
            status: newStatus,
            apiKey: result.apiKey,
            modelUrl: result.modelUrl,
            configSource: source
          };
          cache.lastFetch = now;
        } else {
          setStatus(`获取失败: ${result?.error ?? '未知错误'}`);
        }
      } catch (error) {
        console.error('获取API Key失败:', error);
        const message = (error as Error).message || '';
        if (message.includes('Rate limit exceeded')) {
          setStatus('请求过于频繁，请稍后再试');
        } else {
          setStatus(`获取错误: ${message}`);
        }
      } finally {
        cache.isFetching = false;
      }
    },
    [setStatus, setModelUrl, setConfigSource]
  );

  const saveApiKey = useCallback(async (): Promise<boolean> => {
    if (!ipcClient.isAvailable()) return false;

    try {
      const result = await ipcClient.saveApiKey({ apiKey, modelUrl });
      if (result.success) {
        alert('设置保存成功！');
        setApiKey('');
        setShowInput(false);
        await fetchApiKey(true);
        return true;
      } else {
        alert(`保存失败: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      alert(`保存错误: ${(error as Error).message}`);
      return false;
    }
  }, [apiKey, modelUrl, setApiKey, setShowInput, fetchApiKey]);

  useEffect(() => {
    fetchApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ipcClient.isAvailable()) return;

    const cleanup = ipcClient.onOpenApiKeySettings(() => {
      fetchApiKey(true);
      setShowInput(true);
    });

    return () => cleanup && cleanup();
  }, [fetchApiKey, setShowInput]);

  return {
    apiKey,
    modelUrl,
    showInput,
    status,
    configSource,
    setApiKey,
    setModelUrl,
    setShowInput,
    saveApiKey,
    fetchApiKey
  };
};

export default useApiKey;
