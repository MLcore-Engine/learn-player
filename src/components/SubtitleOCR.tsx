import React, { useState, type MutableRefObject } from 'react';
import { useVideo } from '../contexts/AppContext';
import { recognizeSubtitleFromVideo } from '../utils/ocr';
import type { OcrPayload } from '../hooks/useExplainFlow';

export interface SubtitleOCRProps {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onRecognize?: (payload: OcrPayload) => void;
  isLoading?: boolean;
  hasExternalSubtitles?: boolean;
}

const SubtitleOCR = React.memo<SubtitleOCRProps>(
  ({ videoRef, onRecognize, isLoading: externalLoading, hasExternalSubtitles }) => {
    const [internalLoading, setInternalLoading] = useState<boolean>(false);
    const loading = externalLoading !== undefined ? externalLoading : internalLoading;

    const { duration } = useVideo();
    const isVideoReady = duration > 0;

    const handleRecognize = async (): Promise<void> => {
      console.log('handleRecognize invoked, videoRef.current:', videoRef.current);
      if (!isVideoReady) {
        console.warn('SubtitleOCR: 视频未加载，无法进行OCR识别');
        onRecognize && onRecognize({ status: 'error', error: '请先加载视频' });
        return;
      }

      if (!videoRef.current) {
        console.error('SubtitleOCR: videoRef.current 为空');
        onRecognize && onRecognize({ status: 'error', error: '视频元素不可用' });
        return;
      }

      videoRef.current.pause();
      await new Promise<void>(resolve => setTimeout(resolve, 200));

      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        console.warn('SubtitleOCR: 视频尺寸未就绪', {
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
          readyState: videoRef.current.readyState
        });
        onRecognize && onRecognize({ status: 'error', error: '视频尺寸未就绪，请稍后重试' });
        return;
      }

      onRecognize && onRecognize({ status: 'loading' });

      if (externalLoading === undefined) {
        setInternalLoading(true);
      }

      try {
        const result = (await recognizeSubtitleFromVideo(videoRef.current)).trim();
        if (!result) {
          console.warn('【OCR】未识别到文本');
          onRecognize && onRecognize({ status: 'error', error: '未检测到字幕，请确认视频正在播放有字幕的画面，然后重试' });
        } else {
          console.log('【OCR】识别成功:', result);
          onRecognize && onRecognize({ status: 'success', text: result });
        }
      } catch (err) {
        console.error('OCR 识别失败', err);
        onRecognize && onRecognize({ status: 'error', error: `识别失败: ${(err as Error)?.message || '未知错误'}` });
      } finally {
        if (externalLoading === undefined) {
          setInternalLoading(false);
        }
      }
    };

    return (
      <div className="subtitle-ocr">
        <button
          onClick={handleRecognize}
          disabled={loading || !isVideoReady}
          style={{
            width: '100%',
            padding: '8px 0',
            borderRadius: 8,
            border: '1px solid #1976d2',
            background: '#fff',
            color: '#1976d2',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
            transition: 'background 0.2s, color 0.2s',
            cursor: loading || !isVideoReady ? 'not-allowed' : 'pointer',
            opacity: loading || !isVideoReady ? 0.7 : 1
          }}
        >
          {loading ? '处理中...' : !isVideoReady ? '视频加载...' : hasExternalSubtitles ? '提取字幕' : '识别字幕'}
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.videoRef === nextProps.videoRef &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.hasExternalSubtitles === nextProps.hasExternalSubtitles
    );
  }
);

SubtitleOCR.displayName = 'SubtitleOCR';

export default SubtitleOCR;
