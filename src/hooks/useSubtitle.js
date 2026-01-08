// src/hooks/useSubtitle.js
import { useState, useEffect, useCallback } from 'react';
import { useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';

export const useSubtitle = () => {
  const [subtitles, setSubtitles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { videoPath } = useVideo();
  
  // 监听主进程发送的字幕加载完成事件
  useEffect(() => {
    if (!ipcClient.isAvailable()) return;
    
    const cleanup = ipcClient.onSubtitleLoaded((result) => {
      setLoading(false);
      
      if (result.success) {
        setSubtitles(result.subtitles);
        setError(null);
      } else {
        setSubtitles([]);
        setError(result.error);
      }
    });
    
    return () => cleanup && cleanup();
  }, []);
  
  // 选择并加载字幕
  const selectAndLoadSubtitle = useCallback(async () => {
    if (!ipcClient.isAvailable()) {
      setError('Electron API不可用');
      return false;
    }
    
    setLoading(true);
    
    try {
      // 1. 选择字幕文件
      const result = await ipcClient.selectSubtitle(videoPath);
      
      if (!result.success) {
        setLoading(false);
        if (!result.canceled) {
          setError(result.error || '选择字幕失败');
        }
        return false;
      }
      
      // 2. 加载字幕内容
      ipcClient.loadSubtitle(result.path);
      return true;
    } catch (error) {
      setLoading(false);
      setError(error.message);
      return false;
    }
  }, [videoPath]);
  
  // 直接加载指定路径的字幕
  const loadSubtitle = useCallback((subtitlePath) => {
    if (!ipcClient.isAvailable() || !subtitlePath) {
      setError('无效的字幕路径或Electron API不可用');
      return;
    }
    
    setLoading(true);
    ipcClient.loadSubtitle(subtitlePath);
  }, []);
  
  return {
    subtitles,
    loading,
    error,
    selectAndLoadSubtitle,
    loadSubtitle
  };
};

export default useSubtitle;
