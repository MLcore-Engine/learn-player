import { useEffect, useCallback, useRef } from 'react';
import { useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';
import { isElectronAvailable } from '../services/electronApi';
import type {
  LearningRecord,
  SelectVideoResult,
  ExtractFrameResult
} from '../types/ipc';

interface LearningRecordsCache {
  [videoId: string]: {
    timestamp: number;
    data: LearningRecord[];
  };
}

interface RequestCache {
  learningRecords: LearningRecordsCache;
}

export interface UseElectronIPCResult {
  selectVideo: () => Promise<SelectVideoResult>;
  saveLearningRecord: (record: Partial<LearningRecord>) => Promise<{ success?: boolean; id?: number; error?: string }>;
  getLearningRecords: (videoId: string) => Promise<LearningRecord[]>;
  extractFrame: (videoPath: string, timestamp: number) => Promise<ExtractFrameResult>;
  checkFileExists: (filePath: string) => Promise<boolean>;
}

/**
 * Electron IPC 通信钩子（通用）
 */
export const useElectronIPC = (): UseElectronIPCResult => {
  const { setVideoPath } = useVideo();
  const requestCacheRef = useRef<RequestCache>({ learningRecords: {} });

  useEffect(() => {
    if (!isElectronAvailable()) return;
    console.log('注册videoSelectedFromMenu事件监听');
    const cleanup = ipcClient.onVideoSelectedFromMenu((...args: unknown[]) => {
      const payload = args[0] as { success?: boolean; path?: string } | undefined;
      if (payload?.success && payload.path) {
        console.log('收到视频选择事件:', payload.path);
        setVideoPath(payload.path);
      }
    });
    return () => {
      if (cleanup) {
        console.log('清理videoSelectedFromMenu事件监听');
        cleanup();
      }
    };
  }, [setVideoPath]);

  const selectVideo = useCallback(async (): Promise<SelectVideoResult> => {
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
      return { success: false, path: null, error: (error as Error).message };
    }
  }, [setVideoPath]);

  const saveLearningRecord = useCallback(async (record: Partial<LearningRecord>) => {
    if (!isElectronAvailable()) {
      return { success: false, error: 'Electron API不可用' };
    }
    try {
      return await ipcClient.saveLearningRecord(record);
    } catch (error) {
      console.error('保存学习记录失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }, []);

  const getLearningRecords = useCallback(async (videoId: string): Promise<LearningRecord[]> => {
    if (!isElectronAvailable()) {
      return [];
    }
    const now = Date.now();
    const cache = requestCacheRef.current.learningRecords;
    if (cache[videoId] && now - cache[videoId].timestamp < 5000) {
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
      cache[videoId] = { timestamp: now, data: safeRecords };
      return safeRecords;
    } catch (error) {
      console.error('获取学习记录失败:', error);
      return [];
    }
  }, []);

  const extractFrame = useCallback(
    async (videoPath: string, timestamp: number): Promise<ExtractFrameResult> => {
      if (!isElectronAvailable()) {
        return { success: false, error: 'Electron API不可用' };
      }
      try {
        return await ipcClient.extractFrame(videoPath, timestamp);
      } catch (error) {
        console.error('提取视频帧失败:', error);
        return { success: false, error: (error as Error).message };
      }
    },
    []
  );

  const checkFileExists = useCallback(async (filePath: string): Promise<boolean> => {
    if (!isElectronAvailable()) return false;
    return await ipcClient.checkFileExists(filePath);
  }, []);

  return {
    selectVideo,
    saveLearningRecord,
    getLearningRecords,
    extractFrame,
    checkFileExists
  };
};

export default useElectronIPC;
