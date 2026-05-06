import React, { useCallback, useEffect, useRef } from 'react';
import LearningAssistant from '../components/LearningAssistant';
import { useAI, useVideo } from '../contexts/AppContext';
import { useElectronIPC } from '../hooks/useElectronIPC';

/**
 * AI 容器组件
 * 把 AI context 串到 LearningAssistant，处理"返回字幕"和按视频加载历史 records。
 * 实际的解释流由 SidePanel 的 useExplainFlow 驱动，这里只做展示。
 */
const AIContainer = React.memo(({ onBackToSubtitles }) => {
  const { videoPath } = useVideo();
  const {
    selectedText,
    explanation,
    setSelectedText,
    setExplanation,
    setLoading,
    addRecord,
    clearRecords
  } = useAI();

  const { getLearningRecords } = useElectronIPC();

  const handleBackToSubtitles = useCallback(() => {
    setSelectedText('');
    setExplanation('');
    setLoading(false);
    onBackToSubtitles?.();
  }, [onBackToSubtitles, setSelectedText, setExplanation, setLoading]);

  // 用 ref 锁住引用，避免依赖变化触发 effect
  const stableRef = useRef({ addRecord, clearRecords, getLearningRecords });
  useEffect(() => {
    stableRef.current = { addRecord, clearRecords, getLearningRecords };
  }, [addRecord, clearRecords, getLearningRecords]);

  // 视频切换时按 video 加载历史记录
  const loadedPathRef = useRef(null);
  useEffect(() => {
    const currentVideoPath = videoPath;
    if (!currentVideoPath || currentVideoPath === loadedPathRef.current) return;
    loadedPathRef.current = currentVideoPath;

    let isMounted = true;
    const loadRecords = async () => {
      try {
        if (!isMounted) return;
        stableRef.current.clearRecords();
        const records = await stableRef.current.getLearningRecords(currentVideoPath);
        if (!isMounted) return;
        if (records && records.length > 0) {
          records.forEach(record => {
            if (isMounted) {
              stableRef.current.addRecord({
                subtitle_text: record.content,
                explanation: record.translation || record.explanation,
                timestamp: new Date(record.created_at).getTime()
              });
            }
          });
        }
      } catch (error) {
        console.error('加载学习记录失败:', error);
      }
    };
    loadRecords();
    return () => { isMounted = false; };
  }, [videoPath]);

  return (
    <LearningAssistant
      explanation={explanation}
      selectedText={selectedText}
      onBackToSubtitles={handleBackToSubtitles}
    />
  );
});

export default AIContainer;
