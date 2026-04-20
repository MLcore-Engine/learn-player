import React, { useState } from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import OCRResultModal from './OCRResultModal';
import ContextualBubble from './ContextualBubble';
import { Box } from '@mui/material';
import { useVideo } from '../contexts/AppContext';

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
  const { jumpToTime } = useVideo();
  
  // Contextual bubble 状态
  const [bubbleText, setBubbleText] = useState('');
  const [bubblePosition, setBubblePosition] = useState({ x: 0, y: 0 });
  const [bubbleStartTime, setBubbleStartTime] = useState(null);

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
        <Box sx={{ position: 'relative' }}>
          <OCRResultModal
            isOpen={ocrModalOpen}
            result={ocrResult}
            onExplain={onExplain}
            onClose={onCloseModal}
            isLoading={explainLoading}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              zIndex: 10
            }}
          />
        </Box>
      </Box>

      {/* Contextual Bubble */}
      <ContextualBubble
        text={bubbleText}
        position={bubblePosition}
        startTime={bubbleStartTime}
        loading={explainLoading}
        onExplain={(text) => {
          onExplain(text);
          setBubbleText('');
        }}
        onSaveToReview={async (text) => {
          if (onSaveToHighlight) {
            // 调用保存生词的回调
            await onSaveToHighlight(text, bubbleStartTime);
          }
          setBubbleText('');
        }}
        onPlaySegment={(startTime) => {
          if (typeof jumpToTime === 'function') {
            jumpToTime(startTime);
          }
          setBubbleText('');
        }}
        onClose={() => setBubbleText('')}
      />
    </>
  );
};

// 暴露方法给父组件调用（通过 ref 转发）
SidePanelHeader.displayName = 'SidePanelHeader';

export default SidePanelHeader;