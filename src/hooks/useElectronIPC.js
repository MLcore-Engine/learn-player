import { useEffect, useCallback, useRef } from 'react';
import { useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';
import { isElectronAvailable } from '../services/electronApi';

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
    if (!isElectronAvailable()) return;
    console.log('注册videoSelectedFromMenu事件监听');
    const cleanup = ipcClient.onVideoSelectedFromMenu(({ success, path }) => {
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
    if (!isElectronAvailable()) {
      console.error('electronAPI不可用');
      return { success: false, path: null, error: 'Electron API不可用' };
    }
    try {
      const result = await ipcClient.selectVideo();
      if (result.success && result.path) {
        setVideoPath(result.path);
      }
      return result;
    } catch (error) {
      console.error('选择视频失败:', error);
      return { success: false, path: null, error: error.message };
    }
  }, [setVideoPath]);

  // 保存学习记录
  const saveLearningRecord = useCallback(async (record) => {
    if (!isElectronAvailable()) {
      return { success: false, error: 'Electron API不可用' };
    }
    try {
      return await ipcClient.saveLearningRecord(record);
    } catch (error) {
      console.error('保存学习记录失败:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // 获取学习记录 - 添加防抖和缓存机制
  const getLearningRecords = useCallback(async (videoId) => {
    if (!isElectronAvailable()) {
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
      const records = await ipcClient.getLearningRecords(videoId);
      const safeRecords = Array.isArray(records) ? records : [];
      if (!Array.isArray(records)) {
        console.warn('获取学习记录返回非数组，已兜底为空数组:', records);
      }
      console.log(`获取学习记录响应: ${videoId}, 记录数: ${safeRecords.length}`);
      cache[videoId] = {
        timestamp: now,
        data: safeRecords
      };
      return safeRecords;
    } catch (error) {
      console.error('获取学习记录失败:', error);
      return [];
    }
  }, []);

  // 提取视频帧
  const extractFrame = useCallback(async (videoPath, timestamp) => {
    if (!isElectronAvailable()) {
      return { success: false, error: 'Electron API不可用' };
    }
    try {
      return await ipcClient.extractFrame(videoPath, timestamp);
    } catch (error) {
      console.error('提取视频帧失败:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const checkFileExists = useCallback(async (filePath) => {
    if (!isElectronAvailable()) return false;
    return await ipcClient.checkFileExists(filePath);
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
