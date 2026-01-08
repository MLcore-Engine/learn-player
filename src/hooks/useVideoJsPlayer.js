import { useCallback, useLayoutEffect, useRef } from 'react';
import videojs from 'video.js';
import { ipcClient } from '../services/ipcClient';

const useVideoJsPlayer = ({
  videoPath,
  containerRef,
  videoRef,
  onTimeUpdateRef,
  onPlayerReadyRef,
  handleVideoConversion
}) => {
  const playerRef = useRef(null);
  const videoElementRef = useRef(null);
  const playerInitializedRef = useRef(false);
  const cleanupFunctionRef = useRef(null);
  const cleanupOnceRef = useRef(false);
  const unbindEventsRef = useRef(null);
  const initTokenRef = useRef(0);

  const cleanupPlayer = useCallback(() => {
    if (cleanupOnceRef.current) {
      return;
    }
    cleanupOnceRef.current = true;

    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }

    if (playerRef.current && unbindEventsRef.current) {
      unbindEventsRef.current(playerRef.current);
      unbindEventsRef.current = null;
    }

    if (playerRef.current) {
      try {
        if (playerRef.current.pause) {
          playerRef.current.pause();
        }
        if (playerRef.current.el_ && playerRef.current.el_.parentNode) {
          playerRef.current.dispose();
        }
      } catch (error) {
        console.error('【渲染进程】清理播放器实例时出错:', error);
      }
      playerRef.current = null;
      playerInitializedRef.current = false;
    }

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
  }, [containerRef]);

  const createVideoElement = useCallback(() => {
    if (!containerRef.current) {
      console.warn('【VideoPlayer】容器ref不可用');
      return null;
    }

    try {
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.className = 'video-js vjs-big-play-centered';
      videoEl.controls = true;
      videoEl.preload = 'auto';
      videoEl.playsInline = true;
      videoEl.style.width = '100%';
      videoEl.style.height = '100%';

      const fallbackP = document.createElement('p');
      fallbackP.className = 'vjs-no-js';
      fallbackP.textContent = '请启用JavaScript以查看此视频';
      videoEl.appendChild(fallbackP);

      if (!containerRef.current) {
        console.warn('【VideoPlayer】容器在创建过程中被销毁');
        return null;
      }

      containerRef.current.appendChild(videoEl);

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
  }, [containerRef, videoRef]);

  const bindPlayerEvents = useCallback(() => {
    return (player) => {
      if (!player) return () => {};

      const handleWaiting = () => console.log('【渲染进程】视频缓冲中...');
      const handleCanPlay = () => console.log('【渲染进程】视频可以播放');
      const handleError = () => {
        const err = player.error();
        console.error('Video.js错误:', err);
      };
      const handleTimeUpdate = () => {
        const s = Math.floor(player.currentTime());
        if (onTimeUpdateRef.current) {
          onTimeUpdateRef.current(s);
        }
      };

      player.volume(0.3);
      if (player.tech && player.tech()) {
        player.tech().on('waiting', handleWaiting);
        player.tech().on('canplay', handleCanPlay);
      }
      player.on('error', handleError);
      player.on('timeupdate', handleTimeUpdate);

      return () => {
        try {
          if (player.tech && player.tech()) {
            player.tech().off('waiting', handleWaiting);
            player.tech().off('canplay', handleCanPlay);
          }
          player.off('error', handleError);
          player.off('timeupdate', handleTimeUpdate);
        } catch (error) {
          console.warn('【VideoPlayer】解绑事件失败:', error);
        }
      };
    };
  }, [onTimeUpdateRef]);

  const initVideoJsPlayer = useCallback((videoEl, options) => {
    console.log('【VideoPlayer】初始化Video.js播放器');
    const player = videojs(videoEl, options);
    playerRef.current = player;
    playerInitializedRef.current = true;
    const unbind = bindPlayerEvents()(player);
    unbindEventsRef.current = unbind;
    return player;
  }, [bindPlayerEvents]);

  useLayoutEffect(() => {
    if (!videoPath) {
      console.log('【VideoPlayer】没有视频路径，跳过初始化');
      return undefined;
    }

    let canceled = false;
    const initToken = ++initTokenRef.current;
    cleanupOnceRef.current = false;

    const initialize = async () => {
      try {
        if (playerInitializedRef.current) {
          console.log('【VideoPlayer】播放器已初始化，跳过');
          return;
        }

        if (playerRef.current) {
          console.log('【VideoPlayer】清理旧播放器实例');
          cleanupPlayer();
        }

        if (canceled || initToken !== initTokenRef.current) return;

        const videoEl = createVideoElement();
        if (!videoEl) {
          console.error('【渲染进程】无法创建视频元素');
          return;
        }

        if (canceled || initToken !== initTokenRef.current) return;

        console.log('【VideoPlayer】开始视频转换');
        const finalVideoPath = await handleVideoConversion(videoPath);

        if (canceled || initToken !== initTokenRef.current) return;

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

        await new Promise(r => requestAnimationFrame(r));

        if (canceled || initToken !== initTokenRef.current) return;

        const player = initVideoJsPlayer(videoEl, options);

        if (canceled || initToken !== initTokenRef.current) return;

        console.log('【VideoPlayer】加载视频URL');
        const videoUrl = await ipcClient.getVideoHttpUrl(finalVideoPath);
        player.src({ src: videoUrl, type: 'video/mp4' });
        player.play().catch(e => console.error('播放失败:', e));

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
    };

    console.log('【VideoPlayer】开始初始化播放器，路径:', videoPath);
    initialize();

    return () => {
      console.log('【VideoPlayer】清理useLayoutEffect');
      canceled = true;
      cleanupPlayer();
    };
  }, [videoPath, createVideoElement, handleVideoConversion, initVideoJsPlayer, cleanupPlayer, onPlayerReadyRef]);

  return {
    playerRef,
    playerInitializedRef,
    cleanupPlayer
  };
};

export default useVideoJsPlayer;
