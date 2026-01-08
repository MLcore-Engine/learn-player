import React, { useRef, useEffect, useState, useCallback } from 'react';
import 'video.js/dist/video-js.css';
import { ipcClient } from '../services/ipcClient';
import useVideoJsPlayer from '../hooks/useVideoJsPlayer';

/**
 * 视频播放器组件
 * 负责视频的播放和控制
 * 重构：将Video.js的DOM管理完全从React渲染管道中剥离
 */
const VideoPlayer = React.memo(({
  videoPath,
  onTimeUpdate,
  onSubtitleSelect,
  onPlayerReady,
  videoRef,
  subtitles,
  isConverting: externalIsConverting,
  onConversionStateChange
}) => {
  const containerRef = useRef(null); // React管理的容器
  const onTimeUpdateRef = useRef(onTimeUpdate); // 存储时间更新回调
  const onPlayerReadyRef = useRef(onPlayerReady); // 存储播放器就绪回调
  const onSubtitleSelectRef = useRef(onSubtitleSelect); // 存储字幕选择回调
  const subtitleTrackRef = useRef(null);
  const subtitleCueHandlerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 使用外部的转换状态，如果没有提供则使用内部状态
  const [internalIsConverting, setInternalIsConverting] = useState(false);
  const isConverting = externalIsConverting !== undefined ? externalIsConverting : internalIsConverting;
  const setIsConverting = onConversionStateChange || setInternalIsConverting;

  // 更新refs
  onTimeUpdateRef.current = onTimeUpdate;
  onPlayerReadyRef.current = onPlayerReady;
  onSubtitleSelectRef.current = onSubtitleSelect;


  // 处理视频格式转换 - 使用主进程IPC接口
  const handleVideoConversion = useCallback(async (inputPath) => {
    setIsConverting(true);
    try {
      // 调用主进程的prepareVideo接口
      const resultPath = await ipcClient.prepareVideo(inputPath);

      console.log('【VideoPlayer】视频格式处理结果:', resultPath);
      return resultPath;
    } catch (error) {
      console.error('视频格式处理错误:', error);
      alert(error.message || '视频处理失败');
      throw error;
    } finally {
      setIsConverting(false);
    }
  }, [setIsConverting]);

  // 监听 videoPath 变化
  useEffect(() => {
    // 组件卸载时清理缓存
    return () => {
      if (ipcClient.isAvailable()) {
        ipcClient.cleanupVideoCache().catch(error => {
          console.error('清理视频缓存失败:', error);
        });
      }
    };
  }, [videoPath]);

  // 监听字幕变化
  useEffect(() => {
    setIsPlaying(subtitles && subtitles.length > 0);
  }, [subtitles]);

  // 将状态传递给父组件
  useEffect(() => {
    if (onPlayerReadyRef.current) {
      onPlayerReadyRef.current(playerRef.current, { isPlaying });
    }
  }, [isPlaying]);

  const { playerRef, playerInitializedRef } = useVideoJsPlayer({
    videoPath,
    containerRef,
    videoRef,
    onTimeUpdateRef,
    onPlayerReadyRef,
    handleVideoConversion
  });

  // 外挂字幕：当 subtitles 更新时，只更新字幕轨道 - 稳定化
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerInitializedRef.current) return;

    console.log('【VideoPlayer】subtitles effect, count=', subtitles?.length);

    try {
      if (subtitleTrackRef.current && subtitleCueHandlerRef.current) {
        subtitleTrackRef.current.removeEventListener('cuechange', subtitleCueHandlerRef.current);
      }
      subtitleTrackRef.current = null;
      subtitleCueHandlerRef.current = null;

      // 移除旧轨道
      const tracks = player.textTracks();
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) { 
          const t = tracks[i]; 
          if (t && t.label === '外挂字幕') { 
            try {
              t.mode = 'disabled';
              // 安全地移除cues
              if (t.cues) {
                const cues = Array.from(t.cues);
                cues.forEach(cue => {
                  try {
                    t.removeCue(cue);
                  } catch (e) {
                    console.warn('移除cue失败:', e);
                  }
                });
              }
            } catch (e) {
              console.warn('处理字幕轨道时出错:', e);
            }
          }
        }
      }
      
      // 添加新字幕
      if (subtitles && subtitles.length > 0) {
        console.log('【VideoPlayer】添加外挂字幕, 共', subtitles.length, '条');
        try {
          const extTrack = player.addTextTrack('subtitles', '外挂字幕', 'zh'); 
          if (extTrack) {
            extTrack.mode = 'showing';
            
            subtitles.forEach((cueObj, idx) => {
              try {
                // 支持 parseSync 返回的不同格式
                let startMs = cueObj.start ?? cueObj.data?.start;
                let endMs = cueObj.end ?? cueObj.data?.end;
                let text = cueObj.text ?? cueObj.data?.text;
                
                // 验证数据有效性
                if (!isFinite(startMs) || !isFinite(endMs) || typeof text !== 'string') {
                  console.warn(`跳过第${idx}条无效字幕:`, cueObj);
                  return;
                }
                
                // 毫秒转换为秒
                const start = startMs / 1000;
                const end = endMs / 1000;
                console.log(`添加第${idx}条:{${start}-${end}} ${text}`);
                
                const cue = new window.VTTCue(start, end, text);
                extTrack.addCue(cue);
              } catch (e) {
                console.error(`添加第${idx}条字幕失败:`, e);
              }
            });
            
            const handleCueChange = () => { 
              try {
                const active = extTrack.activeCues; 
                console.log('Cuechange active:', active?.length); 
                if (active?.length) {
                  onSubtitleSelectRef.current(active[0].text); 
                }
              } catch (e) {
                console.warn('处理cuechange事件时出错:', e);
              }
            };
            extTrack.addEventListener('cuechange', handleCueChange);
            subtitleTrackRef.current = extTrack;
            subtitleCueHandlerRef.current = handleCueChange;
          }
        } catch (e) {
          console.error('创建字幕轨道失败:', e);
        }
      }
    } catch (e) {
      console.error('字幕处理过程中出错:', e);
    }
  }, [subtitles]); // 只依赖subtitles

  return (
    <div 
      className="video-container"
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '300px',
        backgroundColor: '#000',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {isConverting && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <div>正在转换视频格式...</div>
        </div>
      )}
      
      {/* React只管理这个空容器，Video.js管理其中的video元素 */}
      <div 
        key={videoPath}
        ref={containerRef}
        data-vjs-player 
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />
    </div>
  );
});

export default VideoPlayer;
