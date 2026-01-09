import React, { useState } from 'react';
import { useVideo } from '../contexts/AppContext';
import { recognizeSubtitleFromVideo } from '../utils/ocr';

/**
 * 字幕OCR组件
 * 提供字幕识别功能
 */
const SubtitleOCR = React.memo(({ videoRef, onRecognize, isLoading: externalLoading, hasExternalSubtitles }) => {
  // 如果外部没有提供loading状态，使用内部的
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  
  // 使用 context 中的 duration 判断视频是否加载完成
  const { duration } = useVideo();
  const isVideoReady = duration > 0;

  const handleRecognize = async () => {
    console.log('handleRecognize invoked, videoRef.current:', videoRef.current);
    // 检查视频是否已加载
    if (!isVideoReady) {
      console.warn('SubtitleOCR: 视频未加载，无法进行OCR识别');
      onRecognize && onRecognize({ status: 'error', error: '请先加载视频' });
      return;
    }
    
    // 检查视频元素是否可用
    if (!videoRef.current) {
      console.error('SubtitleOCR: videoRef.current 为空');
      onRecognize && onRecognize({ status: 'error', error: '视频元素不可用' });
      return;
    }
    
    // 暂停视频再进行OCR识别
    videoRef.current.pause();
    
    // 等待视频暂停并确保当前帧已渲染（重要：确保截图时画面已稳定）
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 检查视频元素尺寸
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
      // 处理未识别到文本的情况
      if (!result) {
        console.warn('【OCR】未识别到文本，可能原因：1) 截图区域未包含字幕 2) 字幕颜色/对比度不足 3) OCR服务识别失败');
        onRecognize && onRecognize({ status: 'error', error: '未检测到字幕，请确认视频正在播放有字幕的画面，然后重试' });
      } else {
        console.log('【OCR】识别成功:', result);
        onRecognize && onRecognize({ status: 'success', text: result });
      }
    } catch (err) {
      console.error('OCR 识别失败', err);
      onRecognize && onRecognize({ status: 'error', error: `识别失败: ${err.message || '未知错误'}` });
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
          cursor: (loading || !isVideoReady) ? 'not-allowed' : 'pointer',
          opacity: (loading || !isVideoReady) ? 0.7 : 1
        }}
      >
        {loading ? '处理中...' : 
         !isVideoReady ? '视频加载...' : 
         hasExternalSubtitles ? '提取字幕' : '识别字幕'}
      </button>
    </div>
  );
}, (prevProps, nextProps) => {
  // 只有在关键props变化时才重新渲染
  return prevProps.videoRef === nextProps.videoRef &&
         prevProps.isLoading === nextProps.isLoading &&
         prevProps.hasExternalSubtitles === nextProps.hasExternalSubtitles;
  // 不比较onRecognize，它应该是一个稳定的回调函数
});

export default SubtitleOCR; 
