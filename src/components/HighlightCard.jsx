import React, { useState } from 'react';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';

/**
 * HighlightCard - SRS 复习翻转卡片
 * @param {object} highlight - 高亮数据（来自 getDueHighlights）
 * @param {function} onPlaySegment - 播放片段回调 (startTime, endTime) => void
 * @param {function} onReviewed - 用户评星后回调 (quality: 0-3) => void
 */
const HighlightCard = ({ highlight, onPlaySegment, onReviewed }) => {
  const [flipped, setFlipped] = useState(false);

  if (!highlight) return null;

  const formatTime = (seconds) => {
    if (seconds == null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlay = () => {
    if (onPlaySegment) {
      const start = highlight.start_time ? highlight.start_time - 2 : 0;
      const end = highlight.end_time ? highlight.end_time + 2 : start + 4;
      onPlaySegment(start, end);
    }
  };

  return (
    <Box sx={{ perspective: '1000px', width: '100%', maxWidth: 600, mx: 'auto' }}>
      <Box
        onClick={() => !flipped && setFlipped(true)}
        sx={{
          position: 'relative',
          width: '100%',
          minHeight: 300,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          cursor: flipped ? 'default' : 'pointer',
        }}
      >
        {/* 正面 */}
        <Card sx={{
          position: 'absolute', width: '100%', backfaceVisibility: 'hidden',
          bgcolor: '#1a1a1a', color: '#fff'
        }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
              {highlight.original_text}
            </Typography>
            {highlight.start_time != null && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                在 {formatTime(highlight.start_time)} 处添加
              </Typography>
            )}
            {highlight.context_before && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                "...{highlight.context_before} {highlight.original_text} {highlight.context_after}..."
              </Typography>
            )}
            {!flipped && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 4, display: 'block' }}>
                点击卡片显示答案
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* 背面 */}
        <Card sx={{
          position: 'absolute', width: '100%', backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', bgcolor: '#1a1a1a', color: '#fff'
        }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
              {highlight.explanation || highlight.user_note || '（暂无解释）'}
            </Typography>
            {highlight.start_time != null && (
              <Button
                variant="outlined"
                size="small"
                onClick={handlePlay}
                sx={{ mt: 2, borderColor: '#f57c00', color: '#ffb74d' }}
              >
                ▶ 播放视频片段
              </Button>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* 评价按钮（仅背面显示） */}
      {flipped && (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 3 }}>
          {[
            { label: '重来', quality: 0, color: '#d32f2f' },
            { label: '困难', quality: 1, color: '#f57c00' },
            { label: '良好', quality: 2, color: '#388e3c' },
            { label: '简单', quality: 3, color: '#1976d2' },
          ].map(({ label, quality, color }) => (
            <Button
              key={quality}
              variant="contained"
              onClick={() => { setFlipped(false); onReviewed?.(quality); }}
              sx={{ bgcolor: color, '&:hover': { bgcolor: color, opacity: 0.9 } }}
            >
              {label}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default HighlightCard;