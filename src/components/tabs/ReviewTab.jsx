import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Paper, Stack } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';
import HighlightCard from '../HighlightCard';
import { getDueHighlights, submitReview } from '../../services/highlightService';
import { ipcClient } from '../../services/ipcClient';
import { useVideo } from '../../contexts/AppContext';

/**
 * 复习 Tab（S4）
 * 打开即加载到期卡片 + 统计；有卡片自动开始复习，无卡片显示统计 + 提示
 */
const ReviewTab = ({ onBackToSubtitle }) => {
  const { jumpToTime } = useVideo();
  const [phase, setPhase] = useState('loading'); // loading | reviewing | empty | done | error
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const [dueResult, statsResult] = await Promise.all([
        getDueHighlights({ limit: 20, status: 'learning' }),
        ipcClient.getHighlightsStats()
      ]);

      if (dueResult && dueResult.error) throw new Error(dueResult.error);
      if (statsResult && statsResult.error) throw new Error(statsResult.error);

      setStats(statsResult || null);
      const list = Array.isArray(dueResult) ? dueResult : [];
      setCards(list);
      setIndex(0);
      setPhase(list.length > 0 ? 'reviewing' : 'empty');
    } catch (e) {
      console.error('ReviewTab 加载失败:', e);
      setError(e.message || '加载失败');
      setPhase('error');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReviewed = useCallback(async (quality) => {
    const current = cards[index];
    if (!current) return;
    try {
      const result = await submitReview(current.id, quality);
      if (result && result.error) {
        console.error('submitReview 失败:', result.error);
      }
    } catch (e) {
      console.error('submitReview 异常:', e);
    }

    const next = index + 1;
    if (next >= cards.length) {
      // 刷新统计后进入 done 态
      try {
        const statsResult = await ipcClient.getHighlightsStats();
        if (statsResult && !statsResult.error) setStats(statsResult);
      } catch (_) {}
      setPhase('done');
    } else {
      setIndex(next);
    }
  }, [cards, index]);

  const handlePlaySegment = useCallback((start) => {
    if (typeof jumpToTime === 'function') jumpToTime(start);
  }, [jumpToTime]);

  const renderStats = () => {
    if (!stats) return null;
    const items = [
      { label: '总词数', value: stats.totalHighlights ?? 0 },
      { label: '今日已复习', value: stats.todayReviewed ?? 0 },
      { label: '已掌握', value: stats.masteredHighlights ?? 0 },
      { label: '连续天数', value: stats.streakDays ?? 0 }
    ];
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} justifyContent="space-around">
          {items.map(it => (
            <Box key={it.label} sx={{ textAlign: 'center' }}>
              <Typography variant="h5" color="primary.main">{it.value}</Typography>
              <Typography variant="caption" color="text.secondary">{it.label}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  };

  const renderBackButton = () => (
    onBackToSubtitle && (
      <Button size="small" variant="outlined" startIcon={<ArrowBack />} onClick={onBackToSubtitle}>
        返回字幕
      </Button>
    )
  );

  const renderBody = () => {
    if (phase === 'loading') {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (phase === 'error') {
      return (
        <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Typography color="error">加载失败：{error}</Typography>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>重试</Button>
        </Stack>
      );
    }

    if (phase === 'reviewing') {
      const current = cards[index];
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
            {index + 1} / {cards.length}
          </Typography>
          <HighlightCard
            key={current.id}
            highlight={current}
            onPlaySegment={handlePlaySegment}
            onReviewed={handleReviewed}
          />
        </Box>
      );
    }

    // empty | done
    const msg = phase === 'done' ? '今日复习完成 🎉' : '今日没有需要复习的单词';
    return (
      <Box sx={{ flex: 1 }}>
        {renderStats()}
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 1 }}>{msg}</Typography>
          <Typography variant="body2" color="text.secondary">
            多去字幕里点一些生词 — 解释时会自动加入复习队列
          </Typography>
        </Paper>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">复习</Typography>
        <Button size="small" startIcon={<Refresh />} onClick={loadData}>刷新</Button>
      </Stack>
      {renderBody()}
      <Box sx={{ mt: 1 }}>
        {renderBackButton()}
      </Box>
    </Box>
  );
};

export default ReviewTab;
