import { useCallback, useState } from 'react';
import { useAI, useVideo } from '../contexts/AppContext';
import aiService from '../services/aiService';
import { ipcClient } from '../services/ipcClient';

const useExplainFlow = ({ hasExternalSubtitles }) => {
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrError, setOcrError] = useState('');
  const [explainLoading, setExplainLoading] = useState(false);
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

  const handleExplain = useCallback(async (lang, selectedText) => {
    const text = selectedText || ocrResult;
    if (!text) {
      alert('没有可解释的文字');
      return;
    }
    setExplainLoading(true);
    setAiLoading(true);
    setSelectedText(text);
    try {
      setExplanation('');
      let buffer = '';
      const currentTime = playerRef.current?.currentTime?.() || null;
      const explanation = await aiService.streamExplanation(text, {
        onDelta: (piece, full) => {
          buffer = full;
          setExplanation(buffer);
        }
      }, { 
        language: lang,
        videoPath,
        currentTime
      });
      addRecord({ subtitle_text: text, explanation, timestamp: Date.now() });
      if (ipcClient.isAvailable()) {
        ipcClient.saveAiQuery({
          query: text,
          explanation,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('AI解释失败:', error);
    } finally {
      setAiLoading(false);
      setExplainLoading(false);
      setOcrModalOpen(false);
      setOcrResult('');
      setOcrStatus('idle');
      setOcrError('');
    }
  }, [addRecord, ocrResult, setAiLoading, setExplanation, setSelectedText]);

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
    isVideoLoaded,
    ocrLoading: ocrStatus === 'loading',
    ocrModalOpen,
    ocrResult,
    ocrStatus,
    ocrError
  };
};

export default useExplainFlow;
