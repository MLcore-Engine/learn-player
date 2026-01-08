import React, { useLayoutEffect, useRef, useEffect, useState, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

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
  const playerRef = useRef(null);
  const containerRef = useRef(null); // React管理的容器
  const videoElementRef = useRef(null); // 手动创建的video元素
  const playerInitializedRef = useRef(false);
  const cleanupFunctionRef = useRef(null); // 存储清理函数
  const currentVideoPathRef = useRef(videoPath); // 存储当前视频路径
  const onTimeUpdateRef = useRef(onTimeUpdate); // 存储时间更新回调
  const onPlayerReadyRef = useRef(onPlayerReady); // 存储播放器就绪回调
  const onSubtitleSelectRef = useRef(onSubtitleSelect); // 存储字幕选择回调
  const [isPlaying, setIsPlaying] = useState(false);

  // 使用外部的转换状态，如果没有提供则使用内部状态
  const [internalIsConverting, setInternalIsConverting] = useState(false);
  const isConverting = externalIsConverting !== undefined ? externalIsConverting : internalIsConverting;
  const setIsConverting = onConversionStateChange || setInternalIsConverting;

  // 更新refs
  currentVideoPathRef.current = videoPath;
  onTimeUpdateRef.current = onTimeUpdate;
  onPlayerReadyRef.current = onPlayerReady;
  onSubtitleSelectRef.current = onSubtitleSelect;

  // 清理播放器实例的函数 - 稳定化
  const cleanupPlayer = useCallback(() => {
    // 执行从容器组件传来的清理函数
    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }
    
    if (playerRef.current) {
      try {
        // 先暂停播放
        if (playerRef.current.pause) {
          playerRef.current.pause();
        }
        // 确保播放器实例存在且有效
        if (playerRef.current.el_ && playerRef.current.el_.parentNode) {
          playerRef.current.dispose();
        }
      } catch (error) {
        console.error('【渲染进程】清理播放器实例时出错:', error);
      }
      playerRef.current = null;
      playerInitializedRef.current = false;
    }
    
    // 手动清理video元素
    if (videoElementRef.current && containerRef.current) {
      try {
        if (containerRef.current.contains(videoElementRef.current)) {
          containerRef.current.removeChild(videoElementRef.current);
        }
      } catch (error) {
        console.error('【渲染进程】清理video元素时出错:', error);
      }
      videoElementRef.current = null;
    }
  }, []);

  // 手动创建video元素 - 稳定化
  const createVideoElement = useCallback(() => {
    if (!containerRef.current) {
      console.warn('【VideoPlayer】容器ref不可用');
      return null;
    }
    
    try {
      // 创建video元素
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.className = 'video-js vjs-big-play-centered';
      videoEl.controls = true;
      videoEl.preload = 'auto';
      videoEl.playsInline = true;
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';
      
      // 添加fallback内容
      const fallbackP = document.createElement('p');
      fallbackP.className = 'vjs-no-js';
      fallbackP.textContent = '请启用JavaScript以查看此视频';
      videoEl.appendChild(fallbackP);
      
      // 确保容器仍然存在
      if (!containerRef.current) {
        console.warn('【VideoPlayer】容器在创建过程中被销毁');
        return null;
      }
      
      // 将video元素添加到容器
      containerRef.current.appendChild(videoEl);
      
      // 更新refs
      videoElementRef.current = videoEl;
      if (videoRef) {
        videoRef.current = videoEl;
      }
      
      console.log('【VideoPlayer】成功创建video元素');
      return videoEl;
    } catch (error) {
      console.error('【VideoPlayer】创建video元素失败:', error);
      return null;
    }
  }, [videoRef]);

  // 处理视频格式转换 - 使用主进程IPC接口
  const handleVideoConversion = useCallback(async (inputPath) => {
    setIsConverting(true);
    try {
      // 调用主进程的prepareVideo接口
      const resultPath = await window.electronAPI.prepareVideo(inputPath);

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
      if (window.electronAPI.cleanupVideoCache) {
        window.electronAPI.cleanupVideoCache().catch(error => {
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

  // 初始化播放器，只在 videoPath 变化时执行
  useLayoutEffect(() => {
    let canceled = false;
    let player = null;
    
    if (!videoPath) {
      console.log('【VideoPlayer】没有视频路径，跳过初始化');
      return;
    }
    
    console.log('【VideoPlayer】开始初始化播放器，路径:', videoPath);
    
    (async () => {
      try {
        // 检查是否已被取消
        if (canceled) return;
        
        if (playerInitializedRef.current) {
          console.log('【VideoPlayer】播放器已初始化，跳过');
          return;
        }
        
        // 清理旧实例
        if (playerRef.current) {
          console.log('【VideoPlayer】清理旧播放器实例');
          cleanupPlayer();
        }
        
        // 再次检查是否已被取消
        if (canceled) return;
        
        // 手动创建video元素
        const videoEl = createVideoElement();
        if (!videoEl) {
          console.error('【渲染进程】无法创建视频元素');
          return;
        }
        
        // 检查是否已被取消
        if (canceled) return;
        
        // 转换视频并初始化播放器
        console.log('【VideoPlayer】开始视频转换');
        const finalVideoPath = await handleVideoConversion(currentVideoPathRef.current);
        
        // 检查是否已被取消
        if (canceled) return;
        
        const options = { 
          autoplay: false, 
          controls: true, 
          preload: 'auto', 
          width: '100%', 
          height: '100%', 
          html5: { 
            nativeVideoTracks: true, 
            nativeAudioTracks: true, 
            nativeTextTracks: true 
          }, 
          liveui: false, 
          inactivityTimeout: 3000, 
          playbackRates: [0.5, 1, 1.5, 2] 
        };
        
        // 等待下一帧，确保DOM已经更新
        await new Promise(r => requestAnimationFrame(r));
        
        // 最后检查是否已被取消
        if (canceled) return;
        
        // 初始化Video.js播放器
        console.log('【VideoPlayer】初始化Video.js播放器');
        player = videojs(videoEl, options);
        playerRef.current = player;
        playerInitializedRef.current = true;
        
        // 基本事件绑定
        player.volume(0.3);
        player.tech().on('waiting', () => console.log('【渲染进程】视频缓冲中...'));
        player.tech().on('canplay', () => console.log('【渲染进程】视频可以播放'));
        player.on('error', e => { 
          const err = player.error(); 
          console.error('Video.js错误:', err); 
        });
        player.on('timeupdate', () => { 
          const s = Math.floor(player.currentTime()); 
          onTimeUpdateRef.current(s); 
        });
        
        // 检查是否已被取消
        if (canceled) return;
        
        // 加载并播放视频
        console.log('【VideoPlayer】加载视频URL');
        const videoUrl = await window.electronAPI.getVideoHttpUrl(finalVideoPath);
        player.src({ src: videoUrl, type: 'video/mp4' });
        player.play().catch(e => console.error('播放失败:', e));
        
        // 调用onPlayerReady回调并存储清理函数
        if (onPlayerReadyRef.current && !canceled) {
          const cleanup = onPlayerReadyRef.current(player);
          if (typeof cleanup === 'function') {
            cleanupFunctionRef.current = cleanup;
          }
        }
        
        console.log('【VideoPlayer】播放器初始化完成');
        
      } catch (err) {
        if (!canceled) {
          console.error('初始化播放器出错:', err);
        }
      }
    })();
    
    return () => { 
      console.log('【VideoPlayer】清理useLayoutEffect');
      canceled = true; 
      if (playerRef.current) { 
        cleanupPlayer(); 
        playerInitializedRef.current = false; 
      } 
    };
  }, [videoPath]); // 只依赖videoPath

  // 外挂字幕：当 subtitles 更新时，只更新字幕轨道 - 稳定化
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerInitializedRef.current) return;
    
    console.log('【VideoPlayer】subtitles effect, count=', subtitles?.length);
    
    try {
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
            
            extTrack.addEventListener('cuechange', () => { 
              try {
                const active = extTrack.activeCues; 
                console.log('Cuechange active:', active?.length); 
                if (active?.length) {
                  onSubtitleSelectRef.current(active[0].text); 
                }
              } catch (e) {
                console.warn('处理cuechange事件时出错:', e);
              }
            });
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