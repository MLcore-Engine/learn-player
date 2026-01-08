import { useEffect, useCallback, useRef } from 'react';
import { useVideo } from '../contexts/AppContext';

/**
 * Electron IPC通信钩子
 * 处理与Electron主进程的通用通信逻辑
 * (不包含特定功能如字幕，这些应由各自的hooks处理)
 */
export const useElectronIPC = () => {
  const { setVideoPath } = useVideo();
  // 移除 eventRegisteredRef，直接依赖 React 生命周期管理监听器
  const requestCacheRef = useRef({ learningRecords: {} });

  // 监听主进程发送的视频选择事件
  useEffect(() => {
    if (!window.electronAPI) return;
    console.log('注册videoSelectedFromMenu事件监听');
    const cleanup = window.electronAPI.on('videoSelectedFromMenu', ({ success, path }) => {
      if (success && path) {
        console.log('收到视频选择事件:', path);
        setVideoPath(path);
      }
    });
    return () => {
      if (cleanup) {
        console.log('清理videoSelectedFromMenu事件监听');
        cleanup();
      }
    };
  }, [setVideoPath]);

  // 选择视频文件
  const selectVideo = useCallback(async () => {
    if (!window.electronAPI) {
      console.error('electronAPI不可用');
      return { success: false, error: 'Electron API不可用' };
    }
    try {
      const result = await window.electronAPI.invoke('selectVideo');
      if (result.success && result.path) {
        setVideoPath(result.path);
      }
      return result;
    } catch (error) {
      console.error('选择视频失败:', error);
      return { success: false, error: error.message };
    }
  }, [setVideoPath]);

  // 保存学习记录
  const saveLearningRecord = useCallback(async (record) => {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API不可用' };
    }
    try {
      return await window.electronAPI.invoke('saveLearningRecord', record);
    } catch (error) {
      console.error('保存学习记录失败:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // 获取学习记录 - 添加防抖和缓存机制
  const getLearningRecords = useCallback(async (videoId) => {
    if (!window.electronAPI) {
      return [];
    }
    const now = Date.now();
    const cache = requestCacheRef.current.learningRecords;
    if (cache[videoId] && (now - cache[videoId].timestamp < 5000)) {
      console.log(`使用缓存的学习记录: ${videoId}`);
      return cache[videoId].data;
    }
    try {
      console.log(`请求学习记录: ${videoId}`);
      const records = await window.electronAPI.invoke('getLearningRecords', { videoId });
      cache[videoId] = {
        timestamp: now,
        data: records
      };
      return records;
    } catch (error) {
      console.error('获取学习记录失败:', error);
      return [];
    }
  }, []);

  // 提取视频帧
  const extractFrame = useCallback(async (videoPath, timestamp) => {
    if (!window.electronAPI) {
      return { success: false, error: 'Electron API不可用' };
    }
    try {
      return await window.electronAPI.invoke('extract-frame', { videoPath, timestamp });
    } catch (error) {
      console.error('提取视频帧失败:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const checkFileExists = useCallback(async (filePath) => {
    if (!window.electronAPI) return false;
    return await window.electronAPI.invoke('checkFileExists', filePath);
  }, []);

  return {
    selectVideo,
    saveLearningRecord,
    getLearningRecords,
    extractFrame,
    checkFileExists,
  };
};

export default useElectronIPC; 