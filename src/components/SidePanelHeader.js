import React from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import OCRResultModal from './OCRResultModal';
import { Box } from '@mui/material';

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
  timeStatsProps
}) => (
  <Box sx={{
    width: '100%',
    position: 'relative',
    pt: 2,
    pb: 1,
    px: 2,
    backgroundColor: '#F8F3E3',
    borderBottom: '1px solid #E8E0C8',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
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
);

export default SidePanelHeader;
