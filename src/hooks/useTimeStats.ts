import { useEffect, useCallback, useRef } from 'react';
import { useTimeStats as useTimeStatsContext, useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';
import type { WatchTime } from '../types/ipc';

export interface UseTimeStatsResult {
  totalTime: number;
  sessionTime: number;
  formatTime: (seconds: number) => string;
  remainingSeconds: number;
  fetchTimeStats: () => Promise<WatchTime | undefined>;
  updateWatchTime: () => Promise<void>;
  isTimerActive: boolean;
}

/**
 * 时间统计钩子 — 处理观看时间统计和定时更新
 */
export const useTimeStats = (): UseTimeStatsResult => {
  const {
    totalTime,
    sessionTime,
    updateStats,
    watchTimerRef
  } = useTimeStatsContext();

  const { videoPath, videoRef, isPlaying } = useVideo();
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0);

  const fetchTimeStats = useCallback(async (): Promise<WatchTime | undefined> => {
    if (!ipcClient.isAvailable() || !videoPath) return undefined;

    try {
      const data = await ipcClient.getWatchTime(videoPath);
      updateStats({
        totalTime: data.totalTime || 0,
        sessionTime: data.sessionTime || 0
      });
      errorCountRef.current = 0;
      return data;
    } catch (error) {
      console.error('获取观看时长失败:', error);
      errorCountRef.current++;
      return { totalTime: 0, sessionTime: 0, lastPosition: 0 };
    }
  }, [videoPath, updateStats]);

  const updateWatchTime = useCallback(async (): Promise<void> => {
    if (!ipcClient.isAvailable() || !videoPath || !videoRef.current) return;

    const currentTime = Date.now();
    if (currentTime - lastUpdateTimeRef.current < 30000) {
      return;
    }

    const currentPosition = Math.floor(videoRef.current.currentTime);
    const data = {
      videoId: videoPath,
      deltaSeconds: 0,
      currentPosition
    };

    try {
      ipcClient.updateWatchTime(data);
      lastUpdateTimeRef.current = currentTime;
      errorCountRef.current = 0;
    } catch (error) {
      console.error('更新观看时长失败:', error);
      errorCountRef.current++;

      if (errorCountRef.current >= 3) {
        await fetchTimeStats();
      }
    }
  }, [videoPath, videoRef, fetchTimeStats]);

  const startPeriodicUpdate = useCallback(() => {
    if (updateIntervalRef.current) return;
    updateWatchTime();
  }, [updateWatchTime]);

  const stopPeriodicUpdate = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (videoPath) {
      fetchTimeStats();
    }
  }, [videoPath, fetchTimeStats]);

  useEffect(() => {
    if (isPlaying) {
      startPeriodicUpdate();
    } else {
      stopPeriodicUpdate();
      updateWatchTime();
    }
  }, [isPlaying, startPeriodicUpdate, stopPeriodicUpdate, updateWatchTime]);

  useEffect(() => {
    return () => {
      stopPeriodicUpdate();
      if (videoPath) {
        updateWatchTime();
      }
    };
  }, [videoPath, stopPeriodicUpdate, updateWatchTime]);

  const formatTime = useCallback((seconds: number): string => {
    const totalMinutes = Math.floor((seconds || 0) / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0')
    ].join(':');
  }, []);

  const remainingSeconds = Math.max(0, 1000 * 3600 - totalTime);

  return {
    totalTime,
    sessionTime,
    formatTime,
    remainingSeconds,
    fetchTimeStats,
    updateWatchTime,
    isTimerActive: !!watchTimerRef.current
  };
};

export default useTimeStats;
