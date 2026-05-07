import React, { useRef, useEffect, useState, useCallback, type MutableRefObject } from 'react';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';
import { ipcClient } from '../services/ipcClient';
import useVideoJsPlayer from '../hooks/useVideoJsPlayer';
import type { SubtitleCue } from '../hooks/useSubtitle';

export type PlayerReadyInfo = {
  isPlaying: boolean;
  hasExternalSubtitles: boolean;
};

export interface VideoPlayerProps {
  videoPath: string | null | undefined;
  onTimeUpdate?: (seconds: number) => void;
  onSubtitleSelect?: (text: string, startTime: number) => void;
  onPlayerReady?: (player: Player, info?: PlayerReadyInfo) => (() => void) | void;
  videoRef?: MutableRefObject<HTMLVideoElement | null>;
  subtitles?: SubtitleCue[];
  isConverting?: boolean;
  onConversionStateChange?: (converting: boolean) => void;
}

/**
 * 视频播放器组件
 * 负责视频的播放和控制
 */
const VideoPlayer = React.memo<VideoPlayerProps>(
  ({
    videoPath,
    onTimeUpdate,
    onSubtitleSelect,
    onPlayerReady,
    videoRef,
    subtitles,
    isConverting: externalIsConverting,
    onConversionStateChange
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const onTimeUpdateRef = useRef<((seconds: number) => void) | undefined>(onTimeUpdate);
    const onPlayerReadyRef = useRef<((player: Player, info?: PlayerReadyInfo) => (() => void) | void) | undefined>(
      onPlayerReady
    );
    const onSubtitleSelectRef = useRef<((text: string, startTime: number) => void) | undefined>(onSubtitleSelect);
    const subtitleTrackRef = useRef<TextTrack | null>(null);
    const subtitleCueHandlerRef = useRef<(() => void) | null>(null);
    const subtitlesRef = useRef<SubtitleCue[] | undefined>(subtitles);

    const [internalIsConverting, setInternalIsConverting] = useState<boolean>(false);
    const isConverting = externalIsConverting !== undefined ? externalIsConverting : internalIsConverting;
    const setIsConverting = onConversionStateChange || setInternalIsConverting;

    onTimeUpdateRef.current = onTimeUpdate;
    onPlayerReadyRef.current = onPlayerReady;
    onSubtitleSelectRef.current = onSubtitleSelect;

    const handleVideoConversion = useCallback(
      async (inputPath: string): Promise<string> => {
        setIsConverting(true);
        try {
          if (!window.electronAPI?.prepareVideo) {
            console.warn('Electron API不可用，跳过视频转换');
            alert('当前环境不支持视频转换，将直接播放原视频');
            return inputPath;
          }

          const result = await ipcClient.prepareVideo(inputPath);
          const resultPath = result.path ?? inputPath;
          console.log('【VideoPlayer】视频格式处理结果:', resultPath);
          return resultPath;
        } catch (error) {
          console.error('视频格式处理错误:', error);
          alert((error as Error).message || '视频处理失败');
          throw error;
        } finally {
          setIsConverting(false);
        }
      },
      [setIsConverting]
    );

    useEffect(() => {
      return () => {
        if (ipcClient.isAvailable()) {
          ipcClient.cleanupVideoCache().catch(error => {
            console.error('清理视频缓存失败:', error);
          });
        }
      };
    }, [videoPath]);

    useEffect(() => {
      subtitlesRef.current = subtitles;
    }, [subtitles]);

    const getPlayerReadyInfo = useCallback(
      (player: Player): PlayerReadyInfo => {
        const p = player as unknown as { paused: () => boolean };
        return {
          isPlaying: player ? !p.paused() : false,
          hasExternalSubtitles: Boolean(subtitlesRef.current && subtitlesRef.current.length > 0)
        };
      },
      []
    );

    const { playerRef, playerInitializedRef } = useVideoJsPlayer({
      videoPath,
      containerRef,
      videoRef,
      onTimeUpdateRef,
      onPlayerReadyRef,
      getPlayerReadyInfo,
      handleVideoConversion
    });

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

        const p = player as unknown as {
          textTracks?: () => TextTrackList;
          addTextTrack?: (kind: string, label: string, lang: string) => TextTrack;
        };
        const tracks = p.textTracks?.();
        if (tracks) {
          for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (t && t.label === '外挂字幕') {
              try {
                t.mode = 'disabled';
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

        if (subtitles && subtitles.length > 0 && p.addTextTrack) {
          console.log('【VideoPlayer】添加外挂字幕, 共', subtitles.length, '条');
          try {
            const extTrack = p.addTextTrack('subtitles', '外挂字幕', 'zh');
            if (extTrack) {
              extTrack.mode = 'showing';

              subtitles.forEach((cueObj, idx) => {
                try {
                  const raw = cueObj as SubtitleCue & { data?: { start?: number; end?: number; text?: string } };
                  const startMs = raw.start ?? raw.data?.start;
                  const endMs = raw.end ?? raw.data?.end;
                  const text = raw.text ?? raw.data?.text;

                  if (
                    typeof startMs !== 'number' ||
                    typeof endMs !== 'number' ||
                    !isFinite(startMs) ||
                    !isFinite(endMs) ||
                    typeof text !== 'string'
                  ) {
                    console.warn(`跳过第${idx}条无效字幕:`, cueObj);
                    return;
                  }

                  const start = startMs / 1000;
                  const end = endMs / 1000;
                  console.log(`添加第${idx}条:{${start}-${end}} ${text}`);

                  const VTTCueCtor = (window as unknown as { VTTCue: typeof VTTCue }).VTTCue;
                  const cue = new VTTCueCtor(start, end, text);
                  extTrack.addCue(cue);
                } catch (e) {
                  console.error(`添加第${idx}条字幕失败:`, e);
                }
              });

              const handleCueChange = (): void => {
                try {
                  const active = extTrack.activeCues;
                  console.log('Cuechange active:', active?.length);
                  if (active?.length && onSubtitleSelectRef.current) {
                    const cue = active[0] as VTTCue;
                    onSubtitleSelectRef.current(cue.text, cue.startTime);
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
    }, [subtitles]);

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
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#fff',
              textAlign: 'center',
              zIndex: 1000
            }}
          >
            <div>正在转换视频格式...</div>
          </div>
        )}

        {/* React只管理这个空容器，Video.js管理其中的video元素 */}
        <div
          key={videoPath ?? 'no-video'}
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
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
