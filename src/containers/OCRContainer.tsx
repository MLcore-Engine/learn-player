import React from 'react';
import SubtitleOCR from '../components/SubtitleOCR';
import { useVideo } from '../contexts/AppContext';
import type { OcrPayload } from '../hooks/useExplainFlow';

export interface OCRContainerProps {
  onRecognize?: (payload: OcrPayload) => void;
  isLoading?: boolean;
  videoReady?: boolean;
  hasExternalSubtitles?: boolean;
}

/**
 * OCR 容器组件 —— 渲染 SubtitleOCR 按钮，由父组件通过 props 管理识别结果和弹窗
 */
const OCRContainer = React.memo<OCRContainerProps>(
  ({ onRecognize, isLoading, hasExternalSubtitles }) => {
    const { videoRef } = useVideo();
    return (
      <SubtitleOCR
        videoRef={videoRef}
        isLoading={isLoading}
        onRecognize={onRecognize}
        hasExternalSubtitles={hasExternalSubtitles}
      />
    );
  }
);

OCRContainer.displayName = 'OCRContainer';

export default OCRContainer;
