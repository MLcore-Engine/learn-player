import { useEffect, useCallback, useRef } from 'react';
import { useApiKey as useApiKeyContext } from '../contexts/AppContext';
import aiService from '../utils/aiService';

// 缓存持续时间（毫秒）
const CACHE_DURATION = 30000; // 30秒

/**
 * API Key管理钩子
 * 处理与API Key相关的所有逻辑，包括获取、保存和状态管理
 */
export const useApiKey = () => {
  // 使用来自Context的状态和actions
  const { 
    apiKey,
    modelUrl, // 新增：模型 URL
    showInput, 
    status, 
    setApiKey,
    setModelUrl, // 新增：设置模型 URL
    setShowInput, 
    setStatus 
  } = useApiKeyContext();

  // 使用 ref 存储缓存和防抖状态
  const cacheRef = useRef({
    lastFetch: 0,
    cachedResult: null,
    isFetching: false
  });

  // 获取API Key的函数
  const fetchApiKey = useCallback(async (force = false) => {
    if (!window.electronAPI) return;
    
    const now = Date.now();
    const cache = cacheRef.current;

    // 如果正在获取中，且不是强制刷新，则直接返回
    if (cache.isFetching && !force) {
      return;
    }

    // 如果缓存有效，且不是强制刷新，则使用缓存
    if (!force && cache.cachedResult && (now - cache.lastFetch < CACHE_DURATION)) {
      setStatus(cache.cachedResult.status);
      setModelUrl(cache.cachedResult.modelUrl);
      return;
    }

    try {
      cache.isFetching = true;
      setStatus('正在获取...');
      
      const result = await window.electronAPI.invoke('getApiKey');
      console.log('getApiKey result', result);
      
      if (result.success) {
        const newStatus = result.apiKey ? '已设置' : '未设置';
        setStatus(newStatus);
        setModelUrl(result.modelUrl);
        
        // 更新缓存
        cache.cachedResult = {
          status: newStatus,
          apiKey: result.apiKey,
          modelUrl: result.modelUrl
        };
        cache.lastFetch = now;
        
        // 设置到aiService中
        if (aiService && typeof aiService.setApiKey === 'function') {
          aiService.setApiKey(result.apiKey || '');
          if (result.modelUrl && typeof aiService.setModelUrl === 'function') {
            aiService.setModelUrl(result.modelUrl);
          }
        }
      } else {
        setStatus(`获取失败: ${result.error}`);
      }
    } catch (error) {
      console.error('获取API Key失败:', error);
      if (error.message.includes('Rate limit exceeded')) {
        setStatus('请求过于频繁，请稍后再试');
      } else {
        setStatus(`获取错误: ${error.message}`);
      }
    } finally {
      cache.isFetching = false;
    }
  }, [setStatus, setModelUrl]);

  // 保存API Key的函数
  const saveApiKey = useCallback(async () => {
    if (!window.electronAPI) return;
    
    try {
      const result = await window.electronAPI.invoke('saveApiKey', { apiKey, modelUrl });
      if (result.success) {
        alert('设置保存成功！');
        setApiKey('');
        setShowInput(false);
        // 强制刷新API Key状态
        await fetchApiKey(true);
        return true;
      } else {
        alert(`保存失败: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      alert(`保存错误: ${error.message}`);
      return false;
    }
  }, [apiKey, modelUrl, setApiKey, setShowInput, fetchApiKey]);

  // 在组件挂载时获取API Key状态
  useEffect(() => {
    fetchApiKey();
  }, []);

  // 监听主进程发送的打开API Key设置事件
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const cleanup = window.electronAPI.on('openApiKeySettings', () => {
      // 强制刷新API Key状态
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
    setApiKey,
    setModelUrl,
    setShowInput,
    saveApiKey,
    fetchApiKey
  };
};

export default useApiKey; 