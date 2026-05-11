import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { ipcClient } from '../services/ipcClient';

export interface UseVideoJsPlayerOptions<TInfo = unknown> {
  videoPath: string | null | undefined;
  containerRef: MutableRefObject<HTMLElement | null>;
  videoRef?: MutableRefObject<HTMLVideoElement | null>;
  onTimeUpdateRef: MutableRefObject<((seconds: number) => void) | null | undefined>;
  onPlayerReadyRef: MutableRefObject<((player: Player, info?: TInfo) => (() => void) | void) | null | undefined>;
  getPlayerReadyInfo?: (player: Player) => TInfo;
  handleVideoConversion: (videoPath: string) => Promise<string>;
}

export interface UseVideoJsPlayerResult {
  playerRef: MutableRefObject<Player | null>;
  playerInitializedRef: MutableRefObject<boolean>;
  cleanupPlayer: () => void;
}

const useVideoJsPlayer = <TInfo = unknown>({
  videoPath,
  containerRef,
  videoRef,
  onTimeUpdateRef,
  onPlayerReadyRef,
  getPlayerReadyInfo,
  handleVideoConversion
}: UseVideoJsPlayerOptions<TInfo>): UseVideoJsPlayerResult => {
  const playerRef = useRef<Player | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const playerInitializedRef = useRef<boolean>(false);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const cleanupOnceRef = useRef<boolean>(false);
  const unbindEventsRef = useRef<((player: Player) => void) | null>(null);
  const initTokenRef = useRef<number>(0);

  const cleanupPlayer = useCallback((): void => {
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
        const p = playerRef.current as unknown as { pause?: () => void; el_?: HTMLElement; dispose: () => void };
        if (p.pause) {
          p.pause();
        }
        if (p.el_ && p.el_.parentNode) {
          p.dispose();
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

  const createVideoElement = useCallback((): HTMLVideoElement | null => {
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
    return (player: Player): (() => void) => {
      if (!player) return () => {};

      const handleWaiting = () => console.log('【渲染进程】视频缓冲中...');
      const handleCanPlay = () => console.log('【渲染进程】视频可以播放');
      const handleError = () => {
        const err = (player as unknown as { error: () => unknown }).error();
        console.error('Video.js错误:', err);
      };
      const handleTimeUpdate = () => {
        const s = Math.floor((player as unknown as { currentTime: () => number }).currentTime());
        if (onTimeUpdateRef.current) {
          onTimeUpdateRef.current(s);
        }
      };

      (player as unknown as { volume: (v: number) => void }).volume(0.3);
      const p = player as unknown as { tech?: () => { on: (e: string, h: () => void) => void; off: (e: string, h: () => void) => void } | undefined };
      if (p.tech && p.tech()) {
        p.tech()!.on('waiting', handleWaiting);
        p.tech()!.on('canplay', handleCanPlay);
      }
      player.on('error', handleError);
      player.on('timeupdate', handleTimeUpdate);

      return () => {
        try {
          if (p.tech && p.tech()) {
            p.tech()!.off('waiting', handleWaiting);
            p.tech()!.off('canplay', handleCanPlay);
          }
          player.off('error', handleError);
          player.off('timeupdate', handleTimeUpdate);
        } catch (error) {
          console.warn('【VideoPlayer】解绑事件失败:', error);
        }
      };
    };
  }, [onTimeUpdateRef]);

  const initVideoJsPlayer = useCallback((videoEl: HTMLVideoElement, options: Record<string, unknown>): Player => {
    console.log('【VideoPlayer】初始化Video.js播放器');
    const player = videojs(videoEl, options) as unknown as Player;
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

        await new Promise(r => requestAnimationFrame(() => r(undefined)));

        if (canceled || initToken !== initTokenRef.current) return;

        const player = initVideoJsPlayer(videoEl, options);

        if (canceled || initToken !== initTokenRef.current) return;

        console.log('【VideoPlayer】加载视频URL');
        const videoUrl = await ipcClient.getVideoHttpUrl(finalVideoPath);
        // 让浏览器/videojs 自动从扩展名/服务器 Content-Type 推断 MIME，
        // 避免给 .mkv/.webm 强行贴 video/mp4 标签导致播不动。
        const ext = (finalVideoPath.split('.').pop() || '').toLowerCase();
        const mimeMap: Record<string, string> = {
          mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime',
          mkv: 'video/x-matroska', webm: 'video/webm', ts: 'video/mp2t',
          avi: 'video/x-msvideo', flv: 'video/x-flv', wmv: 'video/x-ms-wmv'
        };
        const mime = mimeMap[ext] || 'video/mp4';
        (player as unknown as { src: (arg: { src: string; type: string }) => void }).src({ src: videoUrl, type: mime });
        (player as unknown as { play: () => Promise<void> }).play().catch(e => console.error('播放失败:', e));

        if (onPlayerReadyRef.current && !canceled) {
          const info = getPlayerReadyInfo ? getPlayerReadyInfo(player) : undefined;
          const cleanup = onPlayerReadyRef.current(player, info);
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
  }, [videoPath, createVideoElement, handleVideoConversion, initVideoJsPlayer, cleanupPlayer, onPlayerReadyRef, getPlayerReadyInfo]);

  return {
    playerRef,
    playerInitializedRef,
    cleanupPlayer
  };
};

export default useVideoJsPlayer;
