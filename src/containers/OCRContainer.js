import React from 'react';
import SubtitleOCR from '../components/SubtitleOCR';
import { useVideo } from '../contexts/AppContext';

/**
 * OCR容器组件
 * 渲染 SubtitleOCR 按钮，由父组件通过 props 管理识别结果和弹窗
 */
const OCRContainer = React.memo(({ onRecognize, isLoading, videoReady, hasExternalSubtitles }) => {
  const { videoRef } = useVideo();
  return (
    <SubtitleOCR
      videoRef={videoRef}
      isLoading={isLoading}
      videoReady={videoReady}
      onRecognize={onRecognize}
      hasExternalSubtitles={hasExternalSubtitles}
    />
  );
});

export default OCRContainer; 