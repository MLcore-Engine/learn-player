import React, { useCallback, useRef, useState } from 'react';
import type Player from 'video.js/dist/types/player';
import VideoPlayer, { type PlayerReadyInfo } from '../components/VideoPlayer';
import VideoConversionProgress from '../components/VideoConversionProgress';
import { useVideo, useTimeStats as useContextTimeStats } from '../contexts/AppContext';
import { useElectronIPC } from '../hooks/useElectronIPC';
import { useSubtitle } from '../hooks/useSubtitle';
import { useTimeStats as useTimeStatsHook } from '../hooks/useTimeStats';
import type { SubtitleCue } from '../hooks/useSubtitle';

export interface VideoContainerProps {
  onPlayerReady?: (player: Player, info?: PlayerReadyInfo) => void;
  onSubtitleSelect?: (text: string, startTime: number) => void;
}

/**
 * 视频容器组件 —— 管理视频播放相关的状态和逻辑
 */
const VideoContainer = React.memo<VideoContainerProps>(({ onPlayerReady, onSubtitleSelect }) => {
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

  const currentVideoPathRef = useRef<string | null>(videoPath);
  currentVideoPathRef.current = videoPath;

  const [isConverting, setIsConverting] = useState<boolean>(false);

  const handleTimeUpdate = useCallback(
    (currentTime: number): void => {
      setCurrentTime(currentTime);

      if (subtitles && subtitles.length > 0) {
        const currentSubtitle = (subtitles as SubtitleCue[]).find(
          (sub) => currentTime >= sub.start && currentTime <= sub.end
        );

        if (currentSubtitle) {
          setSubtitleText(currentSubtitle.text);
        } else {
          setSubtitleText('');
        }
      }
    },
    [subtitles, setCurrentTime, setSubtitleText]
  );

  const handleSubtitleSelect = useCallback(
    (text: string, startTime: number): void => {
      console.log('字幕选择:', text, 'at', startTime);
      if (onSubtitleSelect) {
        onSubtitleSelect(text, startTime);
      }
    },
    [onSubtitleSelect]
  );

  const handlePlayerReady = useCallback(
    (player: Player, info?: PlayerReadyInfo): (() => void) | void => {
      if (!player) return;

      setVideoLoaded(false);
      setPlayer(player);

      const p = player as unknown as {
        paused: () => boolean;
        duration: () => number;
      };

      const handlePlay = (): void => {
        console.log('视频播放，开始计时');
        setIsPlaying(true);
        if (currentVideoPathRef.current) {
          startWatchTimer(currentVideoPathRef.current, videoRef);
        }
      };
      const handlePause = (): void => {
        console.log('视频暂停，停止计时');
        setIsPlaying(false);
        stopWatchTimer();
        updateWatchTime();
      };
      const handleEnded = (): void => {
        console.log('视频结束，停止计时');
        setIsPlaying(false);
        stopWatchTimer();
        updateWatchTime();
      };
      const handleLoadedMetadata = (): void => {
        setDuration(p.duration());
        setVideoLoaded(true);
      };
      const handleErrorEvent = (): void => {
        setVideoLoaded(false);
      };

      player.on('play', handlePlay);
      player.on('pause', handlePause);
      player.on('ended', handleEnded);
      player.on('loadedmetadata', handleLoadedMetadata);
      player.on('error', handleErrorEvent);

      if (!p.paused()) {
        console.log('视频已在播放，开始计时');
        setIsPlaying(true);
        if (currentVideoPathRef.current) {
          startWatchTimer(currentVideoPathRef.current, videoRef);
        }
      }

      if (onPlayerReady) {
        onPlayerReady(player, info);
      }

      return () => {
        player.off('play', handlePlay);
        player.off('pause', handlePause);
        player.off('ended', handleEnded);
        player.off('loadedmetadata', handleLoadedMetadata);
        player.off('error', handleErrorEvent);
        stopWatchTimer();
      };
    },
    [setIsPlaying, setDuration, setVideoLoaded, startWatchTimer, stopWatchTimer, updateWatchTime, videoRef, onPlayerReady, setPlayer]
  );

  if (!videoPath) {
    return (
      <div
        style={{
          flex: 1,
          backgroundColor: '#000',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          color: '#fff'
        }}
      >
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

      <VideoConversionProgress
        isVisible={isConverting}
        onCancel={() => setIsConverting(false)}
      />

      {subtitleText && (
        <div
          style={{
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
          }}
        >
          {subtitleText}
        </div>
      )}
    </div>
  );
});

VideoContainer.displayName = 'VideoContainer';

export default VideoContainer;
