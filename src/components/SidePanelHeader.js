import React, { useState, useEffect, useCallback } from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import OCRResultModal from './OCRResultModal';
import ContextualBubble from './ContextualBubble';
import { Box } from '@mui/material';
import { useVideo } from '../contexts/AppContext';
import { createHighlight } from '../services/highlightService';

const SidePanelHeader = ({
  explainLoading,
  hasExternalSubtitles,
  isVideoLoaded,
  ocrLoading,
  ocrModalOpen,
  ocrResult,
  onCloseModal,
  onExplain,
  onRecognize,
  timeStatsProps,
  onSubtitleSelected,
  onSaveToHighlight
}) => {
  const { jumpToTime, videoPath } = useVideo();

  // Contextual bubble 状态
  const [bubbleText, setBubbleText] = useState('');
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });
  const [bubbleStartTime, setBubbleStartTime] = useState(null);
  useEffect(() => {
    if (typeof onSubtitleSelected === 'function') {
      const handler = (text, startTime) => {
        if (!text) return;
        setBubbleText(text);
        setBubblePosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setBubbleStartTime(startTime ?? null);
      };
      onSubtitleSelected(handler);
    }
  }, [onSubtitleSelected]);

  // T2-2: 一键加入生词本
  const handleSaveToReview = useCallback(async (text) => {
    try {
      await createHighlight({
        video_path: videoPath || '',
        original_text: text,
        start_time: bubbleStartTime ?? null,
        status: 'pending'
      });
    } catch (e) {
      console.error('添加生词本失败:', e);
    }
    setBubbleText('');
  }, [videoPath, bubbleStartTime]);

  return (
    <>
      <Box sx={{
        width: '100%',
        position: 'relative',
        pt: 1.5,
        pb: 0.5,
        px: 2,
        backgroundColor: 'background.paper',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1, width: '48%' }}>
            <OCRContainer
              onRecognize={onRecognize}
              isLoading={ocrLoading}
              videoReady={isVideoLoaded}
              hasExternalSubtitles={hasExternalSubtitles}
            />
          </Box>
          <Box sx={{ flex: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <TimeStats {...timeStatsProps} smallFont horizontal />
          </Box>
        </Box>
      </Box>

      {/* OCR 识别结果弹窗（优先于 contextual bubble） */}
      {ocrModalOpen && (
        <OCRResultModal
          isOpen={ocrModalOpen}
          result={ocrResult}
          onExplain={(lang, txt) => {
            onExplain(lang, txt);
            onCloseModal();
          }}
          onClose={onCloseModal}
          isLoading={explainLoading}
        />
      )}
      {/* Contextual Bubble（OCR 弹窗打开时不显示） */}
      {!ocrModalOpen && bubbleText && (
        <ContextualBubble
          text={bubbleText}
          position={bubblePosition}
          startTime={bubbleStartTime}
          loading={explainLoading}
          onExplain={(text) => {
            // handleExplain signature: (lang, selectedText, startTimeFromSubtitle)
            onExplain('zh', text, bubbleStartTime);
            setBubbleText('');
          }}
          onSaveToReview={handleSaveToReview}
          onPlaySegment={(startTime) => {
            if (typeof jumpToTime === 'function') {
              jumpToTime(startTime);
            }
            setBubbleText('');
          }}
          onClose={() => setBubbleText('')}
        />
      )}
    </>
  );
};

// 暴露方法给父组件调用（通过 ref 转发）
SidePanelHeader.displayName = 'SidePanelHeader';

export default SidePanelHeader;