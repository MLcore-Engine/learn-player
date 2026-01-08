import { useEffect, useCallback, useRef } from 'react';
import { useTimeStats as useTimeStatsContext } from '../contexts/AppContext';
import { useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';

/**
 * 时间统计钩子
 * 处理观看时间统计、记录和定时更新逻辑
 */
export const useTimeStats = () => {
  // 使用来自Context的状态和actions
  const {
    totalTime,
    sessionTime,
    updateStats,
    startWatchTimer,
    stopWatchTimer,
    timeStatsRef,
    watchTimerRef
  } = useTimeStatsContext();
  
  const { videoPath, videoRef, isPlaying } = useVideo();
  const updateIntervalRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const errorCountRef = useRef(0);

  // 从主进程获取时间统计数据
  const fetchTimeStats = useCallback(async () => {
    if (!ipcClient.isAvailable() || !videoPath) return;
    
    try {
      const data = await ipcClient.getWatchTime(videoPath);
      updateStats({
        totalTime: data.totalTime || 0,
        sessionTime: data.sessionTime || 0
      });
      errorCountRef.current = 0; // 重置错误计数
      return data;
    } catch (error) {
      console.error('获取观看时长失败:', error);
      errorCountRef.current++;
      return { totalTime: 0, sessionTime: 0, lastPosition: 0 };
    }
  }, [videoPath]);

  // 更新观看时长到主进程（仅用于暂停/结束/卸载时刷新进度，不再做周期性累计）
  const updateWatchTime = useCallback(async () => {
    if (!ipcClient.isAvailable() || !videoPath || !videoRef.current) return;
    
    const currentTime = Date.now();
    // 确保两次更新之间至少间隔 30 秒
    if (currentTime - lastUpdateTimeRef.current < 30000) {
      return;
    }
    
    const currentPosition = Math.floor(videoRef.current.currentTime);
    const data = {
      videoId: videoPath,
      deltaSeconds: 0, // 不累加，只刷新视频进度
      currentPosition
    };
    
    try {
      ipcClient.updateWatchTime(data);
      lastUpdateTimeRef.current = currentTime;
      errorCountRef.current = 0; // 重置错误计数
    } catch (error) {
      console.error('更新观看时长失败:', error);
      errorCountRef.current++;
      
      // 如果连续失败超过3次，尝试重新获取统计数据
      if (errorCountRef.current >= 3) {
        await fetchTimeStats();
      }
    }
  }, [videoPath, videoRef, timeStatsRef, fetchTimeStats]);

  // 启动定时更新（禁用周期累计，仅做一次刷新）
  const startPeriodicUpdate = useCallback(() => {
    if (updateIntervalRef.current) return;
    updateWatchTime();
  }, [isPlaying, updateWatchTime]);

  // 停止定时更新
  const stopPeriodicUpdate = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  // 初始化时获取统计数据
  useEffect(() => {
    if (videoPath) {
      fetchTimeStats();
    }
  }, [videoPath, fetchTimeStats]);

  // 监听播放状态变化
  useEffect(() => {
    if (isPlaying) {
      startPeriodicUpdate();
    } else {
      stopPeriodicUpdate();
      // 停止播放时保存一次数据
      updateWatchTime();
    }
  }, [isPlaying, startPeriodicUpdate, stopPeriodicUpdate, updateWatchTime]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPeriodicUpdate();
      if (videoPath) {
        updateWatchTime();
      }
    };
  }, [videoPath, stopPeriodicUpdate, updateWatchTime]);

  // 格式化时间为小时:分钟
  const formatTime = useCallback((seconds) => {
    const totalMinutes = Math.floor((seconds || 0) / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0')
    ].join(':');
  }, []);

  // 计算距离1000小时还剩余的秒数
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
