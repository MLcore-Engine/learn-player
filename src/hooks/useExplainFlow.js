import { useCallback, useState } from 'react';
import { useAI, useVideo } from '../contexts/AppContext';
import aiService from '../services/aiService';
import { ipcClient } from '../services/ipcClient';

const useExplainFlow = ({ hasExternalSubtitles }) => {
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const { setSelectedText, setExplanation, setLoading: setAiLoading, addRecord } = useAI();
  const { isLoaded: isVideoLoaded, playerRef } = useVideo();

  const handleOCRRecognize = useCallback((recognizedText) => {
    if (hasExternalSubtitles && playerRef.current) {
      try {
        const player = playerRef.current;
        if (player && player.textTracks) {
          const tracks = player.textTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (track.label === '外挂字幕' && track.activeCues && track.activeCues.length > 0) {
              const text = track.activeCues[0].text;
              setOcrResult(text);
              setOcrModalOpen(true);
              return;
            }
          }
        }
      } catch (error) {
        console.error('获取字幕轨道失败:', error);
      }
    }

    if (recognizedText === '识别中...') {
      setOcrLoading(true);
      return;
    }

    setOcrResult(recognizedText);
    setOcrModalOpen(true);
    setOcrLoading(false);
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
      const explanation = await aiService.streamExplanation(text, {
        onDelta: (piece, full) => {
          buffer = full;
          setExplanation(buffer);
        }
      }, { language: lang });
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
    }
  }, [addRecord, ocrResult, setAiLoading, setExplanation, setSelectedText]);

  const handleCloseModal = useCallback(() => {
    setOcrModalOpen(false);
    setOcrResult('');
    setExplainLoading(false);
  }, []);

  return {
    explainLoading,
    handleCloseModal,
    handleExplain,
    handleOCRRecognize,
    isVideoLoaded,
    ocrLoading,
    ocrModalOpen,
    ocrResult
  };
};

export default useExplainFlow;
