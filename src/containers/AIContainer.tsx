import React, { useCallback, useEffect, useRef } from 'react';
import LearningAssistant from '../components/LearningAssistant';
import { useAI, useVideo } from '../contexts/AppContext';
import { useElectronIPC } from '../hooks/useElectronIPC';
import type { AiRecord } from '../types/state';
import type { LearningRecord } from '../types/ipc';

export interface AIContainerProps {
  onBackToSubtitles?: () => void;
}

/**
 * AI 容器组件
 * 把 AI context 串到 LearningAssistant，处理"返回字幕"和按视频加载历史 records。
 * 实际的解释流由 SidePanel 的 useExplainFlow 驱动，这里只做展示。
 */
const AIContainer = React.memo<AIContainerProps>(({ onBackToSubtitles }) => {
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

  // 用 ref 锁住引用
  const stableRef = useRef({ addRecord, clearRecords, getLearningRecords });
  useEffect(() => {
    stableRef.current = { addRecord, clearRecords, getLearningRecords };
  }, [addRecord, clearRecords, getLearningRecords]);

  // 视频切换时按 video 加载历史记录
  const loadedPathRef = useRef<string | null>(null);
  useEffect(() => {
    const currentVideoPath = videoPath;
    if (!currentVideoPath || currentVideoPath === loadedPathRef.current) return;
    loadedPathRef.current = currentVideoPath;

    let isMounted = true;
    const loadRecords = async (): Promise<void> => {
      try {
        if (!isMounted) return;
        stableRef.current.clearRecords();
        const records = await stableRef.current.getLearningRecords(currentVideoPath);
        if (!isMounted) return;
        if (records && records.length > 0) {
          (records as LearningRecord[]).forEach((record) => {
            if (isMounted) {
              // JS 遗留：record.explanation 实际不存在于 learning_records 表，总是 undefined；
              // 保留访问链以等同旧行为。
              const legacyExplanation = (record as { explanation?: string }).explanation;
              const aiRecord: AiRecord = {
                subtitle_text: record.content ?? '',
                explanation: record.translation || legacyExplanation || '',
                timestamp: record.created_at ? new Date(record.created_at).getTime() : Date.now()
              };
              stableRef.current.addRecord(aiRecord);
            }
          });
        }
      } catch (error) {
        console.error('加载学习记录失败:', error);
      }
    };
    loadRecords();
    return () => {
      isMounted = false;
    };
  }, [videoPath]);

  return (
    <LearningAssistant
      explanation={explanation}
      selectedText={selectedText}
      onBackToSubtitles={handleBackToSubtitles}
    />
  );
});

AIContainer.displayName = 'AIContainer';

export default AIContainer;
