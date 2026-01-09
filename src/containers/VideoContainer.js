import React, { useCallback, useRef, useState } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import VideoConversionProgress from '../components/VideoConversionProgress';
import { useVideo, useTimeStats as useContextTimeStats } from '../contexts/AppContext';
import { useElectronIPC } from '../hooks/useElectronIPC';
import { useSubtitle } from '../hooks/useSubtitle';
import { useTimeStats as useTimeStatsHook } from '../hooks/useTimeStats';

/**
 * 视频容器组件
 * 管理视频播放相关的状态和逻辑，渲染VideoPlayer组件
 */
const VideoContainer = React.memo(({ onPlayerReady }) => {
  const { 
    videoPath, 
    videoRef, 
    setCurrentTime, 
    setDuration, 
    setIsPlaying, 
    setSubtitleText,
    setVideoLoaded,
    subtitleText,
    setPlayer
  } = useVideo();
  
  const { startWatchTimer, stopWatchTimer } = useContextTimeStats();
  const { updateWatchTime } = useTimeStatsHook();
  const { selectVideo } = useElectronIPC();
  const { subtitles } = useSubtitle();
  
  // 使用ref来存储当前的videoPath，避免闭包问题
  const currentVideoPathRef = useRef(videoPath);
  currentVideoPathRef.current = videoPath;

  // 视频转换状态
  const [isConverting, setIsConverting] = useState(false);

  // 处理视频时间更新 - 稳定化
  const handleTimeUpdate = useCallback((currentTime) => {
    setCurrentTime(currentTime);
    
    // 查找并显示当前时间对应的字幕
    if (subtitles && subtitles.length > 0) {
      const currentSubtitle = subtitles.find(
        sub => currentTime >= sub.start && currentTime <= sub.end
      );
      
      if (currentSubtitle) {
        setSubtitleText(currentSubtitle.text);
      } else {
        setSubtitleText('');
      }
    }
  }, [subtitles, setCurrentTime, setSubtitleText]);

  // 处理字幕选择 - 稳定化
  const handleSubtitleSelect = useCallback((text) => {
    console.log('字幕选择:', text);
    // 用户点击字幕时的处理逻辑
  }, []);

  // 从VideoPlayer获取播放器实例的回调 - 稳定化
  const handlePlayerReady = useCallback((player) => {
    if (!player) return;
    
    // 新视频加载，重置加载状态
    setVideoLoaded(false);
    
    // 设置 player 实例到 context
    setPlayer(player);
    
    // 定义事件处理函数
    const handlePlay = () => {
      console.log('视频播放，开始计时');
      setIsPlaying(true);
      startWatchTimer(currentVideoPathRef.current, videoRef);
    };
    const handlePause = () => {
      console.log('视频暂停，停止计时');
      setIsPlaying(false);
      stopWatchTimer();
      updateWatchTime();
    };
    const handleEnded = () => {
      console.log('视频结束，停止计时');
      setIsPlaying(false);
      stopWatchTimer();
      updateWatchTime();
    };
    const handleLoadedMetadata = () => {
      setDuration(player.duration());
      setVideoLoaded(true);
    };
    const handleErrorEvent = () => {
      setVideoLoaded(false);
    };
    
    // 使用 video.js 的事件监听
    player.on('play', handlePlay);
    player.on('pause', handlePause);
    player.on('ended', handleEnded);
    player.on('loadedmetadata', handleLoadedMetadata);
    player.on('error', handleErrorEvent);
    
    // 初始化时，如果视频已经在播放，则启动计时器
    if (!player.paused()) {
      console.log('视频已在播放，开始计时');
      setIsPlaying(true);
      startWatchTimer(currentVideoPathRef.current, videoRef);
    }

    // 调用父组件的 onPlayerReady 回调
    if (onPlayerReady) {
      onPlayerReady(player, { hasExternalSubtitles: subtitles && subtitles.length > 0 });
    }
    
    // 返回清理函数
    return () => {
      player.off('play', handlePlay);
      player.off('pause', handlePause);
      player.off('ended', handleEnded);
      player.off('loadedmetadata', handleLoadedMetadata);
      player.off('error', handleErrorEvent);
      stopWatchTimer();
    };
  }, [setIsPlaying, setDuration, setVideoLoaded, startWatchTimer, stopWatchTimer, updateWatchTime, videoRef, onPlayerReady, subtitles, setPlayer]);

  // 如果没有视频路径，显示提示
  if (!videoPath) {
    return (
      <div style={{ 
        flex: 1, 
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        color: '#fff'
      }}>
        <strong>文件 → 打开视频</strong>
        <button 
          onClick={selectVideo} 
          style={{ 
            marginTop: '20px', 
            padding: '10px 20px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          选择视频文件
        </button>
      </div>
    );
  }

  return (
  <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
  <VideoPlayer
  videoPath={videoPath}
  onTimeUpdate={handleTimeUpdate}
  onSubtitleSelect={handleSubtitleSelect}
  onPlayerReady={handlePlayerReady}
  videoRef={videoRef}
  subtitles={subtitles}
    isConverting={isConverting}
        onConversionStateChange={setIsConverting}
      />

      {/* 视频转换进度显示 */}
      <VideoConversionProgress
        isVisible={isConverting}
        onCancel={() => setIsConverting(false)}
      />
      {/* 字幕浮层展示 */}
      {subtitleText && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '4px',
          maxWidth: '80%',
          textAlign: 'center',
          zIndex: 1000
        }}>
          {subtitleText}
        </div>
      )}
    </div>
  );
});

export default VideoContainer;
