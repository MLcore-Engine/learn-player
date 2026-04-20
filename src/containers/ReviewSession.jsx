import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import HighlightCard from '../components/HighlightCard';
import { getDueHighlights, submitReview } from '../services/highlightService';
import { useVideo } from '../contexts/AppContext';

const DAILY_TARGET_KEY = 'dailyReviewTarget';
const DEFAULT_TARGET = 20;

const ReviewSession = ({ onClose }) => {
  const { jumpToTime } = useVideo();
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(0);

  // 加载今日待复习
  const loadDueCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dailyTarget = parseInt(localStorage.getItem(DAILY_TARGET_KEY) || DEFAULT_TARGET, 10);
      const result = await getDueHighlights({ limit: dailyTarget });
      if (Array.isArray(result)) {
        setCards(result);
        setCurrentIndex(0);
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDueCards(); }, [loadDueCards]);

  // 播放片段
  const handlePlaySegment = useCallback((start, end) => {
    jumpToTime(start);
    // 可选：自动播放
  }, [jumpToTime]);

  // 复习完成一张
  const handleReviewed = useCallback(async (quality) => {
    const card = cards[currentIndex];
    if (!card) return;
    try {
      await submitReview(card.id, quality);
      setReviewedToday(prev => prev + 1);
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
      }
    } catch (e) {
      console.error('复习记录失败:', e);
      // 仍然前进到下一张
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
      }
    }
  }, [cards, currentIndex]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (completed) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h4" gutterBottom>🎉 今日复习完成！</Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          已复习 {reviewedToday} 张卡片
        </Typography>
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="outlined" onClick={onClose}>返回</Button>
          <Button variant="outlined" onClick={loadDueCards}>再复习一轮</Button>
        </Box>
      </Box>
    );
  }

  if (cards.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="h5" gutterBottom>📚 暂无待复习内容</Typography>
        <Typography variant="body2" color="text.secondary">
          去看视频，添加一些高亮吧！
        </Typography>
        <Button variant="outlined" onClick={onClose} sx={{ mt: 3}}>返回</Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 进度条 */}
      <Box sx={{ mb: 2, width: '100%', maxWidth: 600 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {currentIndex + 1} / {cards.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            今日已复习 {reviewedToday}
          </Typography>
        </Box>
        <Box sx={{ height: 4, bgcolor: '#333', borderRadius: 2 }}>
          <Box sx={{
            height: '100%',
            width: `${(currentIndex / Math.max(cards.length, 1)) * 100}%`,
            bgcolor: '#1976d2',
            borderRadius: 2,
            transition: 'width 0.3s'
          }} />
        </Box>
      </Box>

      {/* 卡片 */}
      <HighlightCard
        key={cards[currentIndex].id}
        highlight={cards[currentIndex]}
        onPlaySegment={handlePlaySegment}
        onReviewed={handleReviewed}
      />

      {/* 跳过按钮 */}
      <Box sx={{ mt: 2 }}>
        <Button
          variant="text"
          size="small"
          onClick={() => setCurrentIndex(prev => Math.min(prev + 1, cards.length - 1))}
        >
          跳过
        </Button>
      </Box>
    </Box>
  );
};

export default ReviewSession;