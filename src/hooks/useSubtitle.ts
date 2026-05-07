import { useState, useEffect, useCallback } from 'react';
import { useVideo } from '../contexts/AppContext';
import { ipcClient } from '../services/ipcClient';

// 字幕条目的最小形态（主进程 loadSubtitle 解析 srt/vtt 后 push 的对象）
export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface SubtitleLoadedPayload {
  success: boolean;
  subtitles?: SubtitleCue[];
  error?: string;
}

export interface UseSubtitleResult {
  subtitles: SubtitleCue[];
  loading: boolean;
  error: string | null;
  selectAndLoadSubtitle: () => Promise<boolean>;
  loadSubtitle: (subtitlePath: string) => void;
}

export const useSubtitle = (): UseSubtitleResult => {
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { videoPath } = useVideo();

  useEffect(() => {
    if (!ipcClient.isAvailable()) return;

    const cleanup = ipcClient.onSubtitleLoaded((...args: unknown[]) => {
      const result = args[0] as SubtitleLoadedPayload | undefined;
      setLoading(false);

      if (result?.success) {
        setSubtitles(result.subtitles ?? []);
        setError(null);
      } else {
        setSubtitles([]);
        setError(result?.error ?? '字幕加载失败');
      }
    });

    return () => cleanup && cleanup();
  }, []);

  const selectAndLoadSubtitle = useCallback(async (): Promise<boolean> => {
    if (!ipcClient.isAvailable()) {
      setError('Electron API不可用');
      return false;
    }

    setLoading(true);

    try {
      const result = await ipcClient.selectSubtitle(videoPath ?? '');

      if (!result.success) {
        setLoading(false);
        if (!result.canceled) {
          setError(result.error ?? '选择字幕失败');
        }
        return false;
      }

      if (result.path) {
        ipcClient.loadSubtitle(result.path);
      }
      return true;
    } catch (err) {
      setLoading(false);
      setError((err as Error).message);
      return false;
    }
  }, [videoPath]);

  const loadSubtitle = useCallback((subtitlePath: string): void => {
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
