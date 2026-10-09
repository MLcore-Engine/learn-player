import React, { useState, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import ContextualBubble, { type BubblePosition } from './ContextualBubble';
import dictionaryService, { formatDictionaryResult } from '../utils/dictionaryService';
import type { Language } from '../types/highlight';

export interface OCRResultModalProps {
  isOpen: boolean;
  result: string;
  onExplain: (lang: Language, text: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
  isLoading?: boolean;
}

const OCRResultModal = React.memo<OCRResultModalProps>(
  ({ isOpen, result, onExplain, onClose, style, isLoading = false }) => {
    const [bubbleText, setBubbleText] = useState<string>('');
    const [bubblePosition, setBubblePosition] = useState<BubblePosition>({ x: 0, y: 0 });
    const [bubbleStartTime, setBubbleStartTime] = useState<number | null>(null);
    const [dictResult, setDictResult] = useState<string>('');
    const [dictLoading, setDictLoading] = useState<boolean>(false);
    const [dictError, setDictError] = useState<string>('');

    // 结果变化或关闭时清空上一次的字典查询
    useEffect(() => {
      setDictResult('');
      setDictError('');
    }, [result, isOpen]);

    const handleWordClick = useCallback((text: string, event: React.MouseEvent) => {
      if (!text || !text.trim()) return;
      setBubbleText(text.trim());
      setBubblePosition({ x: event.clientX, y: event.clientY });
      setBubbleStartTime(null);
    }, []);

    /** 本地 mdict 字典查询：不消耗 API，离线可用 */
    const handleDictionaryLookup = useCallback(async (word: string): Promise<void> => {
      const w = word.trim();
      if (!w) return;
      setDictLoading(true);
      setDictError('');
      try {
        const r = await dictionaryService.lookup(w);
        if (!r) {
          setDictResult('');
          setDictError(`本地字典未找到「${w}」`);
          return;
        }
        setDictResult(formatDictionaryResult(r));
      } catch (e) {
        setDictResult('');
        setDictError((e as Error).message || '字典查询失败');
      } finally {
        setDictLoading(false);
      }
    }, []);

    if (!isOpen) return null;

    const handleClose = (): void => {
      setBubbleText('');
      setDictResult('');
      setDictError('');
      onClose();
    };

    return (
      <div
        className="ocr-result-modal"
        style={{
          ...style,
          width: '100%',
          boxSizing: 'border-box',
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: 8,
          padding: 16,
          marginTop: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          maxHeight: 'calc(100vh - 200px)',
          position: 'relative'
        }}
      >
        {/* 可点击单词列表 */}
        <div
          style={{
            marginBottom: 12,
            color: '#222',
            fontSize: 22,
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            overflow: 'auto',
            maxHeight: '40vh',
            paddingRight: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            position: 'relative'
          }}
        >
          {result.split(/(\s+)/).map((token, i) => {
            if (token.trim() === '')
              return (
                <span key={i} style={{ whiteSpace: 'pre' }}>
                  {token}
                </span>
              );
            return (
              <span
                key={i}
                onClick={(e) => handleWordClick(token, e)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '16px',
                  color: '#1565c0',
                  display: 'inline-block',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#bbdefb';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#e3f2fd';
                }}
              >
                {token}
              </span>
            );
          })}
        </div>

        {/* 关闭按钮 */}
        <span
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            cursor: 'pointer',
            fontSize: 20,
            color: '#999',
            lineHeight: 1,
            zIndex: 1
          }}
        >
          ×
        </span>

        {/* 本地字典查询结果 */}
        {dictLoading && (
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#666' }}>字典查询中...</span>
          </Box>
        )}
        {dictError && (
          <Box sx={{ mb: 1, fontSize: 13, color: '#d32f2f' }}>{dictError}</Box>
        )}
        {dictResult && (
          <Box
            data-testid="ocr-dict-result"
            sx={{
              mb: 1.5,
              p: 1.5,
              background: '#f5f5f5',
              borderRadius: 1,
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: '30vh',
              '& strong': { color: 'primary.main' }
            }}
            dangerouslySetInnerHTML={{
              __html: dictResult
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br/>')
            }}
          />
        )}

        {/* ContextualBubble */}
        <ContextualBubble
          text={bubbleText}
          position={bubblePosition}
          startTime={bubbleStartTime}
          loading={isLoading}
          dictLoading={dictLoading}
          onDictionaryLookup={(text) => {
            void handleDictionaryLookup(text);
            setBubbleText('');
          }}
          onExplain={(text) => {
            onExplain('zh', text);
            setBubbleText('');
          }}
          onExplainEn={(text) => {
            onExplain('en', text);
            setBubbleText('');
          }}
          onPlaySegment={null}
          onClose={() => setBubbleText('')}
        />
      </div>
    );
  }
);

OCRResultModal.displayName = 'OCRResultModal';

export default OCRResultModal;
