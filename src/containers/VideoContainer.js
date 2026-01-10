import React, { useCallback, useEffect, useRef, useState } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import VideoConversionProgress from '../components/VideoConversionProgress';
import WebVideoPlayer from '../components/WebVideoPlayer';
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
    setPlayer,
    setVideoPath
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
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

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
  const handlePlayerReady = useCallback((player, info) => {
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
      onPlayerReady(player, info);
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
  }, [setIsPlaying, setDuration, setVideoLoaded, startWatchTimer, stopWatchTimer, updateWatchTime, videoRef, onPlayerReady, setPlayer]);

  const isWebVideo = /^https?:\/\//i.test(videoPath || '');

  useEffect(() => {
    if (!isWebVideo) return;
    stopWatchTimer();
    setIsPlaying(false);
    setSubtitleText('');
    setVideoLoaded(false);
    setPlayer(null);
    if (videoRef?.current) {
      videoRef.current = null;
    }
  }, [isWebVideo, setIsPlaying, setSubtitleText, setVideoLoaded, stopWatchTimer, setPlayer, videoRef]);

  const handleOpenWebVideo = useCallback(() => {
    const trimmed = videoUrlInput.trim();
    if (!trimmed) {
      setUrlError('请输入视频链接');
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(trimmed);
    } catch (error) {
      setUrlError('链接格式不正确，请输入完整的 http/https 地址');
      return;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      setUrlError('仅支持 http 或 https 链接');
      return;
    }

    setUrlError('');
    setVideoPath(parsedUrl.toString());
    setVideoUrlInput('');
  }, [setVideoPath, videoUrlInput]);

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
        <div style={{ marginTop: '24px', width: '80%', maxWidth: '520px' }}>
          <div style={{ marginBottom: '8px', color: '#ccc' }}>或输入 B 站 / YouTube 链接</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={videoUrlInput}
              onChange={(event) => setVideoUrlInput(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#1a1a1a',
                color: '#fff'
              }}
            />
            <button
              onClick={handleOpenWebVideo}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              打开链接
            </button>
          </div>
          {urlError && (
            <div style={{ marginTop: '8px', color: '#ff6b6b' }}>{urlError}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, backgroundColor: '#000', position: 'relative' }}>
      {isWebVideo ? (
        <>
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            display: 'flex',
            gap: '8px',
            zIndex: 1001
          }}>
            <input
              value={videoUrlInput}
              onChange={(event) => setVideoUrlInput(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: '#fff'
              }}
            />
            <button
              onClick={handleOpenWebVideo}
              style={{
                padding: '6px 12px',
                backgroundColor: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              打开链接
            </button>
            <button
              onClick={selectVideo}
              style={{
                padding: '6px 12px',
                backgroundColor: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              打开本地文件
            </button>
          </div>
          {urlError && (
            <div style={{
              position: 'absolute',
              top: '56px',
              left: '16px',
              color: '#ff6b6b',
              zIndex: 1001
            }}>
              {urlError}
            </div>
          )}
          <WebVideoPlayer url={videoPath} onLoad={() => setVideoLoaded(true)} />
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
});

export default VideoContainer;
