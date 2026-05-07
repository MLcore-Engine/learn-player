import { useCallback, useState, useRef } from 'react';
import { useAI, useVideo } from '../contexts/AppContext';
import aiService from '../services/aiService';
import { createHighlight } from '../services/highlightService';
import type { Language } from '../types/highlight';

type OcrStatus = 'idle' | 'loading' | 'success' | 'error';

export interface OcrPayload {
  status?: 'loading' | 'error' | 'success';
  text?: string;
  error?: string;
}

export interface UseExplainFlowOptions {
  hasExternalSubtitles: boolean;
}

export interface UseExplainFlowResult {
  explainLoading: boolean;
  handleCloseModal: () => void;
  handleExplain: (lang: Language, selectedText: string, startTimeFromSubtitle?: number | null) => Promise<void>;
  handleOCRRecognize: (payload: string | OcrPayload) => void;
  cancelExplain: () => void;
  isVideoLoaded: boolean;
  ocrLoading: boolean;
  ocrModalOpen: boolean;
  ocrResult: string;
  ocrStatus: OcrStatus;
  ocrError: string;
}

const useExplainFlow = ({ hasExternalSubtitles }: UseExplainFlowOptions): UseExplainFlowResult => {
  const [ocrModalOpen, setOcrModalOpen] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrError, setOcrError] = useState<string>('');
  const [explainLoading, setExplainLoading] = useState<boolean>(false);
  // 追踪正在进行的 explain 请求，防止返回字幕/并发请求后，旧流的 onDelta 回写
  const generationRef = useRef<number>(0);
  const { setSelectedText, setExplanation, setLoading: setAiLoading, addRecord } = useAI();
  const { isLoaded: isVideoLoaded, playerRef, videoPath } = useVideo();

  const handleOCRRecognize = useCallback(
    (payload: string | OcrPayload): void => {
      if (typeof payload === 'string') {
        setOcrStatus('success');
        setOcrError('');
        setOcrResult(payload);
        setOcrModalOpen(true);
        return;
      }

      if (payload?.status === 'loading') {
        setOcrStatus('loading');
        setOcrError('');
        return;
      }

      if (payload?.status === 'error') {
        const errorMessage = payload.error || '识别失败: 未知错误';
        setOcrStatus('error');
        setOcrError(errorMessage);
        setOcrResult(errorMessage);
        setOcrModalOpen(true);
        return;
      }

      const recognizedText = payload?.text || '';

      if (hasExternalSubtitles && playerRef.current) {
        try {
          const player = playerRef.current as unknown as {
            textTracks?: () => {
              length: number;
              [index: number]: { label?: string; activeCues?: { length: number; [i: number]: { text: string } } };
            };
          };
          if (player && player.textTracks) {
            const tracks = player.textTracks();
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              if (track.label === '外挂字幕' && track.activeCues && track.activeCues.length > 0) {
                const text = track.activeCues[0].text;
                setOcrStatus('success');
                setOcrError('');
                setOcrResult(text);
                setOcrModalOpen(true);
                return;
              }
            }
          }
        } catch (error) {
          console.error('获取字幕轨道失败:', error);
          setOcrStatus('error');
          setOcrError('获取字幕轨道失败');
          setOcrResult('获取字幕轨道失败，请重试');
          setOcrModalOpen(true);
          return;
        }
      }
      setOcrStatus('success');
      setOcrError('');
      setOcrResult(recognizedText);
      setOcrModalOpen(true);
    },
    [hasExternalSubtitles, playerRef]
  );

  const handleExplain = useCallback(
    async (lang: Language, selectedText: string, startTimeFromSubtitle?: number | null): Promise<void> => {
      // C2: 防止并发调用（双击、切换语言时旧请求还在跑）
      if (explainLoading) return;

      const text = selectedText || ocrResult;
      if (!text) {
        alert('没有可解释的文字');
        return;
      }

      // H3: 每次 explain 分配一个 generation
      const gen = ++generationRef.current;

      setExplainLoading(true);
      setAiLoading(true);
      setSelectedText(text);
      let streamSucceeded = false;
      try {
        setExplanation('');
        const player = playerRef.current as unknown as { currentTime?: () => number } | null;
        const currentTime = startTimeFromSubtitle ?? player?.currentTime?.() ?? null;
        const explanation = await aiService.streamExplanation(
          text,
          {
            onDelta: (_piece: string, full: string) => {
              if (gen !== generationRef.current) return;
              setExplanation(full);
            }
          },
          {
            language: lang,
            videoPath: videoPath || undefined,
            currentTime
          }
        );

        if (gen !== generationRef.current) return;
        streamSucceeded = true;

        try {
          addRecord({ subtitle_text: text, explanation, timestamp: Date.now() });
        } catch (e) {
          console.error('addRecord 失败:', e);
        }
        try {
          const result = await createHighlight({
            video_path: videoPath || '',
            original_text: text,
            start_time: currentTime ?? 0,
            language: lang,
            explanation,
            status: 'learning'
          });
          if (result && result.error) {
            console.error('自动保存生词本失败:', result.error);
          }
        } catch (e) {
          console.error('自动保存生词本失败:', e);
        }
      } catch (error) {
        console.error('AI解释失败:', error);
        if (!streamSucceeded && gen === generationRef.current) {
          setSelectedText('');
          setExplanation('');
        }
      } finally {
        if (gen === generationRef.current) {
          setAiLoading(false);
          setExplainLoading(false);
        }
      }
    },
    [explainLoading, addRecord, ocrResult, setAiLoading, setExplanation, setSelectedText, playerRef, videoPath]
  );

  const cancelExplain = useCallback((): void => {
    generationRef.current++;
    setExplainLoading(false);
    setAiLoading(false);
  }, [setAiLoading]);

  const handleCloseModal = useCallback((): void => {
    setOcrModalOpen(false);
    setOcrResult('');
    setOcrStatus('idle');
    setOcrError('');
    setExplainLoading(false);
  }, []);

  return {
    explainLoading,
    handleCloseModal,
    handleExplain,
    handleOCRRecognize,
    cancelExplain,
    isVideoLoaded,
    ocrLoading: ocrStatus === 'loading',
    ocrModalOpen,
    ocrResult,
    ocrStatus,
    ocrError
  };
};

export default useExplainFlow;
