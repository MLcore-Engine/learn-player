import React from 'react';
import TimeStats, { type TimeStatsProps } from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import OCRResultModal from './OCRResultModal';
import { Box } from '@mui/material';
import { useAI } from '../contexts/AppContext';
import type { Language } from '../types/highlight';
import type { OcrPayload } from '../hooks/useExplainFlow';

export interface SidePanelHeaderProps {
  explainLoading: boolean;
  hasExternalSubtitles: boolean;
  isVideoLoaded: boolean;
  ocrLoading: boolean;
  ocrModalOpen: boolean;
  ocrResult: string;
  onCloseModal: () => void;
  onExplain: (lang: Language, text: string, startTime?: number | null) => void;
  onRecognize: (payload: string | OcrPayload) => void;
  timeStatsProps: TimeStatsProps;
}

const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
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
}) => {
  const { selectedText } = useAI();

  return (
    <>
      <Box
        sx={{
          width: '100%',
          position: 'relative',
          pt: 1.5,
          pb: 0.5,
          px: 2,
          backgroundColor: 'background.paper',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
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

      {/* OCR 识别结果弹窗（解释时隐藏，返回字幕后重新出现） */}
      {ocrModalOpen && !selectedText && (
        <OCRResultModal
          isOpen={ocrModalOpen}
          result={ocrResult}
          onExplain={(lang, txt) => {
            onExplain(lang, txt);
          }}
          onClose={onCloseModal}
          isLoading={explainLoading}
        />
      )}
    </>
  );
};

SidePanelHeader.displayName = 'SidePanelHeader';

export default SidePanelHeader;
