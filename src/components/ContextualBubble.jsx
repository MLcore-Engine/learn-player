import React, { useEffect, useRef } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';

/**
 * ContextualBubble - 选词后浮出的操作气泡
 * @param {string} text - 选中的文本
 * @param {object} position - { x, y } 屏幕坐标
 * @param {function} onExplain - 点击"中文解释"回调 (text) => void
 * @param {function} onExplainEn - 点击"英文解释"回调 (text) => void
 * @param {function} onPlaySegment - 点击"播放片段"回调 (startTime) => void
 * @param {number|null} startTime - 视频时间戳（秒）
 * @param {boolean} loading - 是否正在解释
 * @param {function} onClose - 关闭气泡回调
 */
const ContextualBubble = ({
  text,
  position,
  onExplain,
  onExplainEn,
  onPlaySegment,
  startTime,
  loading = false,
  onClose
}) => {
  const ref = useRef(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!text) return null;

  return (
    <Box
      ref={ref}
      sx={{
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 280),
        top: Math.min(position.y + 8, window.innerHeight - 120),
        zIndex: 9999,
        backgroundColor: '#222',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        minWidth: '200px',
        maxWidth: '280px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* 选中的文本 */}
      <Box sx={{ fontSize: '12px', color: '#aaa', wordBreak: 'break-word', mb: 1 }}>
        "{text.length > 60 ? text.slice(0, 60) + '…' : text}"
      </Box>

      {/* 操作按钮行 */}
      <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          disabled={loading}
          onClick={() => onExplain(text)}
          sx={{ fontSize: '12px', py: 0.5, px: 1, backgroundColor: '#1976d2' }}
        >
          {loading ? <CircularProgress size={14} color="inherit" /> : '✦ 中文解释'}
        </Button>

        <Button
          variant="contained"
          size="small"
          disabled={loading}
          onClick={() => onExplainEn?.(text)}
          sx={{ fontSize: '12px', py: 0.5, px: 1, backgroundColor: '#0d47a1' }}
        >
          {loading ? <CircularProgress size={14} color="inherit" /> : '✦ 英文解释'}
        </Button>

        {startTime != null && (
          <Button
            variant="outlined"
            size="small"
            disabled={loading}
            onClick={() => onPlaySegment(startTime)}
            sx={{ fontSize: '12px', py: 0.5, px: 1, borderColor: '#f57c00', color: '#ffb74d' }}
          >
            ▶ 播放
          </Button>
        )}
      </Box>

      {/* 关闭按钮 */}
      <Box
        sx={{ position: 'absolute', top: '4px', right: '6px', cursor: 'pointer', color: '#666', fontSize: '14px', lineHeight: 1 }}
        onClick={onClose}
      >
        ×
      </Box>
    </Box>
  );
};

export default ContextualBubble;