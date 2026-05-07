import { useEffect, useCallback } from 'react';
import { useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';
import { isElectronAvailable } from '../services/electronApi';
import type { SelectVideoResult, ExtractFrameResult } from '../types/ipc';

export interface UseElectronIPCResult {
  selectVideo: () => Promise<SelectVideoResult>;
  extractFrame: (videoPath: string, timestamp: number) => Promise<ExtractFrameResult>;
  checkFileExists: (filePath: string) => Promise<boolean>;
}

/**
 * Electron IPC 通信钩子（通用）
 */
export const useElectronIPC = (): UseElectronIPCResult => {
  const { setVideoPath } = useVideo();

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
    extractFrame,
    checkFileExists
  };
};

export default useElectronIPC;
