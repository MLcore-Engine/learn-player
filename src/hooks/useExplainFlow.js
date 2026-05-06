import { useCallback, useState, useRef } from 'react';
import { useAI, useVideo } from '../contexts/AppContext';
import aiService from '../services/aiService';
import { createHighlight } from '../services/highlightService';

const useExplainFlow = ({ hasExternalSubtitles }) => {
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrError, setOcrError] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
  // 追踪正在进行的 explain 请求，防止返回字幕/并发请求后，旧流的 onDelta 回写
  const generationRef = useRef(0);
  const { setSelectedText, setExplanation, setLoading: setAiLoading, addRecord } = useAI();
  const { isLoaded: isVideoLoaded, playerRef, videoPath } = useVideo();

  const handleOCRRecognize = useCallback((payload) => {
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
        const player = playerRef.current;
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
  }, [hasExternalSubtitles, playerRef]);

  const handleExplain = useCallback(async (lang, selectedText, startTimeFromSubtitle) => {
    // C2: 防止并发调用（双击、切换语言时旧请求还在跑）
    if (explainLoading) return;

    const text = selectedText || ocrResult;
    if (!text) {
      alert('没有可解释的文字');
      return;
    }

    // H3: 每次 explain 分配一个 generation；若中途被取消或新的 explain 开始，旧流 onDelta 会被忽略
    const gen = ++generationRef.current;

    setExplainLoading(true);
    setAiLoading(true);
    setSelectedText(text);
    let streamSucceeded = false;
    try {
      setExplanation('');
      let buffer = '';
      // 优先用字幕时间戳（最准确），其次用当前播放位置
      const currentTime = startTimeFromSubtitle ?? playerRef.current?.currentTime?.() ?? null;
      const explanation = await aiService.streamExplanation(text, {
        onDelta: (piece, full) => {
          // 旧 generation 的 chunk 直接丢弃（用户已取消或切换语言）
          if (gen !== generationRef.current) return;
          buffer = full;
          setExplanation(buffer);
        }
      }, {
        language: lang,
        videoPath,
        currentTime
      });

      // 被取消 / 被后续请求取代，不记录、不存库、不加生词本
      if (gen !== generationRef.current) return;
      streamSucceeded = true;

      // 后置写入：失败也不要清 UI（解释已经成功展示）
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
      // C4: 仅在流式过程中失败时恢复 UI；流式完成后的失败不影响展示
      if (!streamSucceeded && gen === generationRef.current) {
        setSelectedText('');
        setExplanation('');
      }
    } finally {
      // 只有当前 generation 才清 loading（避免新请求被旧请求的 finally 误关）
      if (gen === generationRef.current) {
        setAiLoading(false);
        setExplainLoading(false);
      }
    }
  }, [explainLoading, addRecord, ocrResult, setAiLoading, setExplanation, setSelectedText, playerRef, videoPath]);

  // H3: 取消当前进行中的 explain 流（被"返回字幕"等外部操作调用）
  const cancelExplain = useCallback(() => {
    generationRef.current++;
    setExplainLoading(false);
    setAiLoading(false);
  }, [setAiLoading]);

  const handleCloseModal = useCallback(() => {
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
