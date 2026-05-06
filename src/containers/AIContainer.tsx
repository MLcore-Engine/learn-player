import React, { useCallback } from 'react';
import LearningAssistant from '../components/LearningAssistant';
import { useAI } from '../contexts/AppContext';

export interface AIContainerProps {
  onBackToSubtitles?: () => void;
}

/**
 * AI 容器组件
 * 把 AI context 串到 LearningAssistant，处理"返回字幕"。
 * 实际的解释流由 SidePanel 的 useExplainFlow 驱动，这里只做展示。
 */
const AIContainer = React.memo<AIContainerProps>(({ onBackToSubtitles }) => {
  const { selectedText, explanation, setSelectedText, setExplanation, setLoading } = useAI();

  const handleBackToSubtitles = useCallback(() => {
    setSelectedText('');
    setExplanation('');
    setLoading(false);
    onBackToSubtitles?.();
  }, [onBackToSubtitles, setSelectedText, setExplanation, setLoading]);

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
